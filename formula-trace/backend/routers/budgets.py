from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from database import get_db
from models import CostBudget, BudgetAlert, FormulaVersion, SupplierQuote, ProductLine
from schemas import (
    CostBudgetCreate,
    CostBudgetResponse,
    BudgetAlertResponse,
    BudgetAlertHandleRequest,
    BudgetStatusItem,
    BudgetMonitoringResponse,
)
from datetime import date, datetime
from routers.costs import get_best_price_for_ingredient

router = APIRouter(prefix="/api/budgets", tags=["budgets"])


async def calculate_version_cost(
    db: AsyncSession,
    version: FormulaVersion,
    target_date: date | None = None
) -> tuple[float | None, list[str]]:
    if target_date is None:
        target_date = date.today()

    total_cost = 0.0
    missing_quotes = []
    has_unknown = False

    for ing in version.ingredients:
        best_quote = await get_best_price_for_ingredient(db, ing["name"], target_date)
        if best_quote is None:
            missing_quotes.append(ing["name"])
            has_unknown = True
        else:
            cost = (ing["percentage"] / 100.0) * best_quote.unit_price
            total_cost += cost

    if has_unknown:
        return None, missing_quotes
    return round(total_cost, 4), missing_quotes


async def check_and_create_alert(
    db: AsyncSession,
    budget: CostBudget,
    version: FormulaVersion,
    actual_cost: float
):
    existing = await db.execute(
        select(BudgetAlert).where(
            BudgetAlert.budget_id == budget.id,
            BudgetAlert.version_id == version.id
        )
    )
    if existing.scalar_one_or_none():
        return

    exceed_ratio = actual_cost / budget.target_cost_per_kg
    if actual_cost > budget.target_cost_per_kg:
        alert_type = "over_budget"
    elif actual_cost >= budget.warning_cost:
        alert_type = "warning"
    else:
        return

    alert = BudgetAlert(
        budget_id=budget.id,
        version_id=version.id,
        actual_cost=actual_cost,
        budget_limit=budget.target_cost_per_kg,
        exceed_ratio=exceed_ratio,
        alert_type=alert_type,
        status="pending"
    )
    db.add(alert)
    await db.commit()


def get_budget_status(
    actual_cost: float | None,
    budget: CostBudget,
    has_unknown: bool
) -> str:
    if has_unknown or actual_cost is None:
        return "unknown"
    if actual_cost > budget.target_cost_per_kg:
        return "over"
    if actual_cost >= budget.warning_cost:
        return "warning"
    return "normal"


@router.post("", response_model=CostBudgetResponse, status_code=201)
async def create_budget(data: CostBudgetCreate, db: AsyncSession = Depends(get_db)):
    pl_result = await db.execute(
        select(ProductLine).where(ProductLine.id == data.product_line_id)
    )
    if not pl_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="产品线不存在")

    if data.warning_threshold <= 0 or data.warning_threshold >= 1:
        raise HTTPException(status_code=400, detail="预警阈值必须在0到1之间")

    active_result = await db.execute(
        select(CostBudget).where(
            CostBudget.product_line_id == data.product_line_id,
            CostBudget.is_active == True
        )
    )
    active_budget = active_result.scalar_one_or_none()
    if active_budget:
        active_budget.is_active = False
        active_budget.deactivated_at = datetime.now()
        active_budget.deactivated_by = data.created_by

    new_budget = CostBudget(
        product_line_id=data.product_line_id,
        target_cost_per_kg=data.target_cost_per_kg,
        warning_threshold=data.warning_threshold,
        created_by=data.created_by,
        remark=data.remark,
        is_active=True
    )
    db.add(new_budget)
    await db.commit()
    await db.refresh(new_budget)

    versions_result = await db.execute(
        select(FormulaVersion).where(
            FormulaVersion.product_line_id == data.product_line_id
        )
    )
    versions = versions_result.scalars().all()
    for version in versions:
        cost, missing = await calculate_version_cost(db, version)
        if cost is not None:
            await check_and_create_alert(db, new_budget, version, cost)

    return new_budget


@router.get("/product-line/{product_line_id}/active", response_model=CostBudgetResponse | None)
async def get_active_budget(product_line_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CostBudget).where(
            CostBudget.product_line_id == product_line_id,
            CostBudget.is_active == True
        )
    )
    return result.scalar_one_or_none()


@router.get("/product-line/{product_line_id}/history", response_model=list[CostBudgetResponse])
async def get_budget_history(product_line_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CostBudget).where(
            CostBudget.product_line_id == product_line_id
        ).order_by(CostBudget.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{budget_id}", response_model=CostBudgetResponse)
async def get_budget(budget_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CostBudget).where(CostBudget.id == budget_id))
    budget = result.scalar_one_or_none()
    if not budget:
        raise HTTPException(status_code=404, detail="预算不存在")
    return budget


@router.get("/product-line/{product_line_id}/monitoring", response_model=BudgetMonitoringResponse)
async def get_budget_monitoring(product_line_id: int, db: AsyncSession = Depends(get_db)):
    pl_result = await db.execute(
        select(ProductLine).where(ProductLine.id == product_line_id)
    )
    if not pl_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="产品线不存在")

    budget_result = await db.execute(
        select(CostBudget).where(
            CostBudget.product_line_id == product_line_id,
            CostBudget.is_active == True
        )
    )
    active_budget = budget_result.scalar_one_or_none()

    versions_result = await db.execute(
        select(FormulaVersion).where(
            FormulaVersion.product_line_id == product_line_id
        ).order_by(FormulaVersion.version_number.desc())
    )
    versions = versions_result.scalars().all()

    items = []
    for version in versions:
        actual_cost, missing_quotes = await calculate_version_cost(db, version)
        has_unknown = len(missing_quotes) > 0
        is_reliable = not has_unknown

        if active_budget:
            budget_ratio = (actual_cost / active_budget.target_cost_per_kg) if actual_cost else None
            status = get_budget_status(actual_cost, active_budget, has_unknown)
        else:
            budget_ratio = None
            status = "no_budget"

        items.append(BudgetStatusItem(
            version_id=version.id,
            version_number=version.version_number,
            actual_cost=actual_cost,
            budget_limit=active_budget.target_cost_per_kg if active_budget else 0,
            budget_ratio=budget_ratio,
            budget_status=status,
            has_unknown_cost=has_unknown,
            is_budget_reliable=is_reliable,
            missing_quotes=missing_quotes
        ))

    return BudgetMonitoringResponse(
        product_line_id=product_line_id,
        active_budget=active_budget,
        items=items
    )


@router.get("/product-line/{product_line_id}/alerts/pending", response_model=list[BudgetAlertResponse])
async def get_pending_alerts(product_line_id: int, db: AsyncSession = Depends(get_db)):
    budget_result = await db.execute(
        select(CostBudget.id).where(
            CostBudget.product_line_id == product_line_id,
            CostBudget.is_active == True
        )
    )
    budget_id = budget_result.scalar_one_or_none()
    if not budget_id:
        return []

    result = await db.execute(
        select(BudgetAlert).where(
            BudgetAlert.budget_id == budget_id,
            BudgetAlert.status == "pending"
        ).order_by(BudgetAlert.created_at.desc())
    )
    alerts = result.scalars().all()

    response = []
    for alert in alerts:
        version_result = await db.execute(
            select(FormulaVersion.version_number).where(FormulaVersion.id == alert.version_id)
        )
        version_number = version_result.scalar_one_or_none()
        alert_data = BudgetAlertResponse.model_validate(alert)
        alert_data.version_number = version_number
        response.append(alert_data)

    return response


@router.get("/product-line/{product_line_id}/alerts", response_model=list[BudgetAlertResponse])
async def get_all_alerts(
    product_line_id: int,
    status: str | None = None,
    db: AsyncSession = Depends(get_db)
):
    budget_ids_result = await db.execute(
        select(CostBudget.id).where(CostBudget.product_line_id == product_line_id)
    )
    budget_ids = [row[0] for row in budget_ids_result.all()]
    if not budget_ids:
        return []

    query = select(BudgetAlert).where(BudgetAlert.budget_id.in_(budget_ids))
    if status:
        query = query.where(BudgetAlert.status == status)
    query = query.order_by(BudgetAlert.created_at.desc())

    result = await db.execute(query)
    alerts = result.scalars().all()

    response = []
    for alert in alerts:
        version_result = await db.execute(
            select(FormulaVersion.version_number).where(FormulaVersion.id == alert.version_id)
        )
        version_number = version_result.scalar_one_or_none()
        alert_data = BudgetAlertResponse.model_validate(alert)
        alert_data.version_number = version_number
        response.append(alert_data)

    return response


@router.post("/alerts/{alert_id}/handle", response_model=BudgetAlertResponse)
async def handle_alert(
    alert_id: int,
    data: BudgetAlertHandleRequest,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(BudgetAlert).where(BudgetAlert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="预警记录不存在")

    alert.status = "handled"
    alert.handled_by = data.handled_by
    alert.handle_remark = data.handle_remark
    alert.handled_at = datetime.now()

    await db.commit()
    await db.refresh(alert)

    version_result = await db.execute(
        select(FormulaVersion.version_number).where(FormulaVersion.id == alert.version_id)
    )
    version_number = version_result.scalar_one_or_none()

    response = BudgetAlertResponse.model_validate(alert)
    response.version_number = version_number
    return response


@router.get("/alerts/{alert_id}", response_model=BudgetAlertResponse)
async def get_alert(alert_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BudgetAlert).where(BudgetAlert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="预警记录不存在")

    version_result = await db.execute(
        select(FormulaVersion.version_number).where(FormulaVersion.id == alert.version_id)
    )
    version_number = version_result.scalar_one_or_none()

    response = BudgetAlertResponse.model_validate(alert)
    response.version_number = version_number
    return response
