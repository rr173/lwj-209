from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from database import get_db
from models import FormulaVersion, SupplierQuote
from schemas import (
    SupplierQuoteCreate,
    SupplierQuoteResponse,
    CostBreakdownResponse,
    CostBreakdownItem,
    CostSimulateRequest,
    CostSimulateResponse,
    CostSimulateComparison
)
from datetime import date

router = APIRouter(prefix="/api/costs", tags=["costs"])


async def get_best_price_for_ingredient(
    db: AsyncSession,
    ingredient_name: str,
    target_date: date | None = None
) -> SupplierQuote | None:
    if target_date is None:
        target_date = date.today()

    result = await db.execute(
        select(SupplierQuote).where(
            SupplierQuote.ingredient_name == ingredient_name,
            SupplierQuote.valid_from <= target_date,
            SupplierQuote.valid_to >= target_date
        ).order_by(SupplierQuote.unit_price.asc())
    )
    quotes = result.scalars().all()
    return quotes[0] if quotes else None


async def has_overlapping_quote(
    db: AsyncSession,
    ingredient_name: str,
    supplier_name: str,
    valid_from: date,
    valid_to: date,
    exclude_id: int | None = None
) -> bool:
    query = select(SupplierQuote).where(
        SupplierQuote.ingredient_name == ingredient_name,
        SupplierQuote.supplier_name == supplier_name,
        and_(
            SupplierQuote.valid_from <= valid_to,
            SupplierQuote.valid_to >= valid_from
        )
    )
    if exclude_id is not None:
        query = query.where(SupplierQuote.id != exclude_id)

    result = await db.execute(query)
    return result.scalar_one_or_none() is not None


@router.post("/quotes", response_model=SupplierQuoteResponse, status_code=201)
async def create_supplier_quote(data: SupplierQuoteCreate, db: AsyncSession = Depends(get_db)):
    if await has_overlapping_quote(
        db,
        data.ingredient_name,
        data.supplier_name,
        data.valid_from,
        data.valid_to
    ):
        raise HTTPException(
            status_code=400,
            detail="同一供应商对同一成分的报价时间段不能重叠"
        )

    quote = SupplierQuote(
        ingredient_name=data.ingredient_name,
        supplier_name=data.supplier_name,
        unit_price=data.unit_price,
        min_order_quantity=data.min_order_quantity,
        valid_from=data.valid_from,
        valid_to=data.valid_to
    )
    db.add(quote)
    await db.commit()
    await db.refresh(quote)
    return quote


@router.get("/quotes/ingredient/{ingredient_name}", response_model=list[SupplierQuoteResponse])
async def get_quotes_by_ingredient(ingredient_name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SupplierQuote).where(
            SupplierQuote.ingredient_name == ingredient_name
        ).order_by(SupplierQuote.unit_price.asc())
    )
    return result.scalars().all()


@router.get("/quotes/{quote_id}", response_model=SupplierQuoteResponse)
async def get_quote(quote_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SupplierQuote).where(SupplierQuote.id == quote_id))
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="报价不存在")
    return quote


@router.delete("/quotes/{quote_id}", status_code=204)
async def delete_quote(quote_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SupplierQuote).where(SupplierQuote.id == quote_id))
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="报价不存在")
    await db.delete(quote)
    await db.commit()


@router.get("/breakdown/{version_id}", response_model=CostBreakdownResponse)
async def get_cost_breakdown(version_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FormulaVersion).where(FormulaVersion.id == version_id))
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")

    breakdown = []
    missing_quotes = []
    total_cost = 0.0

    for ing in version.ingredients:
        best_quote = await get_best_price_for_ingredient(db, ing["name"])
        has_quote = best_quote is not None
        unit_price = best_quote.unit_price if has_quote else None
        supplier_name = best_quote.supplier_name if has_quote else None
        cost = (ing["percentage"] / 100.0) * unit_price if has_quote else None

        if cost is not None:
            total_cost += cost

        if not has_quote:
            missing_quotes.append(ing["name"])

        breakdown.append(CostBreakdownItem(
            ingredient_name=ing["name"],
            percentage=ing["percentage"],
            unit_price=unit_price,
            supplier_name=supplier_name,
            cost=cost,
            has_quote=has_quote
        ))

    return CostBreakdownResponse(
        version_id=version.id,
        version_number=version.version_number,
        total_cost=round(total_cost, 4),
        breakdown=breakdown,
        missing_quotes=missing_quotes
    )


@router.post("/simulate", response_model=CostSimulateResponse)
async def simulate_cost(data: CostSimulateRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FormulaVersion).where(FormulaVersion.id == data.version_id))
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")

    original_ing_map = {ing["name"]: ing["percentage"] for ing in version.ingredients}
    new_ing_map = {ing.name: ing.percentage for ing in data.ingredients}

    all_names = sorted(set(original_ing_map.keys()) | set(new_ing_map.keys()))

    items = []
    missing_quotes = []
    original_total = 0.0
    new_total = 0.0

    for name in all_names:
        original_pct = original_ing_map.get(name, 0.0)
        new_pct = new_ing_map.get(name, 0.0)

        best_quote = await get_best_price_for_ingredient(db, name)
        has_quote = best_quote is not None
        unit_price = best_quote.unit_price if has_quote else None

        original_cost = (original_pct / 100.0) * unit_price if has_quote else None
        new_cost = (new_pct / 100.0) * unit_price if has_quote else None
        cost_delta = (new_cost - original_cost) if (original_cost is not None and new_cost is not None) else None

        if original_cost is not None:
            original_total += original_cost
        if new_cost is not None:
            new_total += new_cost

        if not has_quote:
            missing_quotes.append(name)

        items.append(CostSimulateComparison(
            ingredient_name=name,
            original_percentage=original_pct,
            new_percentage=new_pct,
            original_cost=original_cost,
            new_cost=new_cost,
            cost_delta=cost_delta
        ))

    total_delta = new_total - original_total
    delta_percentage = (total_delta / original_total * 100) if original_total > 0 else 0.0

    return CostSimulateResponse(
        version_id=version.id,
        original_total_cost=round(original_total, 4),
        new_total_cost=round(new_total, 4),
        total_delta=round(total_delta, 4),
        delta_percentage=round(delta_percentage, 2),
        items=items,
        missing_quotes=missing_quotes
    )
