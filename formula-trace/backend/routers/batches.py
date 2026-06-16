from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime
from database import get_db
from models import Batch, FormulaVersion, ProductLine, IngredientInventory, InventoryTransaction
from schemas import BatchCreate, BatchTestResult, BatchResponse, TracePathResponse, TraceDiff, IngredientItem
from utils import compute_batch_scores

router = APIRouter(prefix="/api/batches", tags=["batches"])


def generate_batch_number(version_id: int, count: int) -> str:
    timestamp = datetime.now().strftime("%Y%m%d")
    return f"B{version_id:04d}-{timestamp}-{count+1:03d}"


@router.post("", response_model=BatchResponse, status_code=201)
async def create_batch(data: BatchCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FormulaVersion).where(FormulaVersion.id == data.version_id))
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="配方版本不存在")

    if version.approval_status != "published":
        raise HTTPException(status_code=400, detail=f"只有已发布的版本才能创建试产批次，当前状态为「{version.approval_status}」")

    consumption_map: dict[str, float] = {}
    for ing in version.ingredients:
        consumption = data.production_amount * (ing["percentage"] / 100.0)
        consumption_map[ing["name"]] = consumption

    for ing_name, qty in consumption_map.items():
        inv_result = await db.execute(
            select(IngredientInventory).where(IngredientInventory.ingredient_name == ing_name)
        )
        inventory = inv_result.scalar_one_or_none()
        if inventory and inventory.current_quantity < qty:
            raise HTTPException(
                status_code=400,
                detail=f"原料「{ing_name}」库存不足：当前库存 {inventory.current_quantity:.4f} kg，需要 {qty:.4f} kg",
            )

    count_result = await db.execute(
        select(func.count(Batch.id)).where(Batch.version_id == data.version_id)
    )
    count = count_result.scalar_one() or 0
    batch_number = generate_batch_number(data.version_id, count)

    batch = Batch(
        version_id=data.version_id,
        batch_number=batch_number,
        production_date=data.production_date,
        production_amount=data.production_amount
    )
    db.add(batch)
    await db.flush()

    for ing_name, qty in consumption_map.items():
        inv_result = await db.execute(
            select(IngredientInventory).where(IngredientInventory.ingredient_name == ing_name)
        )
        inventory = inv_result.scalar_one_or_none()
        if inventory:
            inventory.current_quantity -= qty
            transaction = InventoryTransaction(
                inventory_id=inventory.id,
                transaction_type="stock_out",
                quantity=qty,
                batch_number=batch_number,
                remark=f"试产批次 {batch_number} 生产消耗",
            )
            db.add(transaction)

    await db.commit()
    await db.refresh(batch)
    return BatchResponse(
        id=batch.id,
        version_id=batch.version_id,
        batch_number=batch.batch_number,
        production_date=batch.production_date,
        production_amount=batch.production_amount,
        skin_feel_score=batch.skin_feel_score,
        stability_score=batch.stability_score,
        cost_per_kg=batch.cost_per_kg,
        overall_score=None
    )


@router.post("/{batch_id}/test-result", response_model=BatchResponse)
async def submit_test_result(batch_id: int, data: BatchTestResult, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Batch).where(Batch.id == batch_id))
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    batch.skin_feel_score = data.skin_feel_score
    batch.stability_score = data.stability_score
    batch.cost_per_kg = data.cost_per_kg
    await db.commit()
    await db.refresh(batch)

    v_result = await db.execute(
        select(Batch).where(
            Batch.version_id.in_(
                select(FormulaVersion.id).where(FormulaVersion.product_line_id == batch.version.product_line_id)
            ),
            Batch.skin_feel_score.isnot(None)
        )
    )
    all_batches = v_result.scalars().all()
    score_map, _, _ = compute_batch_scores(all_batches)
    overall = score_map.get(batch.id)

    return BatchResponse(
        id=batch.id,
        version_id=batch.version_id,
        batch_number=batch.batch_number,
        production_date=batch.production_date,
        production_amount=batch.production_amount,
        skin_feel_score=batch.skin_feel_score,
        stability_score=batch.stability_score,
        cost_per_kg=batch.cost_per_kg,
        overall_score=overall
    )


@router.get("/product-line/{product_line_id}", response_model=list[BatchResponse])
async def list_batches_by_product_line(product_line_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ProductLine).where(ProductLine.id == product_line_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="产品线不存在")

    version_result = await db.execute(
        select(FormulaVersion.id).where(FormulaVersion.product_line_id == product_line_id)
    )
    version_ids = [row[0] for row in version_result.all()]
    if not version_ids:
        return []

    batch_result = await db.execute(
        select(Batch).where(
            Batch.version_id.in_(version_ids),
            Batch.skin_feel_score.isnot(None)
        )
    )
    batches = batch_result.scalars().all()

    if not batches:
        return []

    score_map, _, _ = compute_batch_scores(batches)

    batches_with_score = []
    for b in batches:
        overall = score_map.get(b.id)
        batches_with_score.append((b, overall))

    batches_with_score.sort(key=lambda x: x[1] if x[1] is not None else -1, reverse=True)

    return [
        BatchResponse(
            id=b.id,
            version_id=b.version_id,
            batch_number=b.batch_number,
            production_date=b.production_date,
            production_amount=b.production_amount,
            skin_feel_score=b.skin_feel_score,
            stability_score=b.stability_score,
            cost_per_kg=b.cost_per_kg,
            overall_score=overall
        )
        for b, overall in batches_with_score
    ]


@router.get("/{batch_id}", response_model=BatchResponse)
async def get_batch(batch_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Batch).where(Batch.id == batch_id))
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    v_result = await db.execute(
        select(Batch).where(
            Batch.version_id.in_(
                select(FormulaVersion.id).where(FormulaVersion.product_line_id == batch.version.product_line_id)
            ),
            Batch.skin_feel_score.isnot(None)
        )
    )
    all_batches = v_result.scalars().all()
    score_map, _, _ = compute_batch_scores(all_batches)
    overall = score_map.get(batch.id)

    return BatchResponse(
        id=batch.id,
        version_id=batch.version_id,
        batch_number=batch.batch_number,
        production_date=batch.production_date,
        production_amount=batch.production_amount,
        skin_feel_score=batch.skin_feel_score,
        stability_score=batch.stability_score,
        cost_per_kg=batch.cost_per_kg,
        overall_score=overall
    )


@router.get("/by-number/{batch_number}", response_model=BatchResponse)
async def get_batch_by_number(batch_number: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Batch).where(Batch.batch_number == batch_number))
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    v_result = await db.execute(
        select(Batch).where(
            Batch.version_id.in_(
                select(FormulaVersion.id).where(FormulaVersion.product_line_id == batch.version.product_line_id)
            ),
            Batch.skin_feel_score.isnot(None)
        )
    )
    all_batches = v_result.scalars().all()
    score_map, _, _ = compute_batch_scores(all_batches)
    overall = score_map.get(batch.id)

    return BatchResponse(
        id=batch.id,
        version_id=batch.version_id,
        batch_number=batch.batch_number,
        production_date=batch.production_date,
        production_amount=batch.production_amount,
        skin_feel_score=batch.skin_feel_score,
        stability_score=batch.stability_score,
        cost_per_kg=batch.cost_per_kg,
        overall_score=overall
    )


@router.get("/trace/{batch_number}", response_model=TracePathResponse)
async def trace_batch(batch_number: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Batch).where(Batch.batch_number == batch_number))
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    path = []
    current_id = batch.version_id
    while current_id is not None:
        v_result = await db.execute(select(FormulaVersion).where(FormulaVersion.id == current_id))
        version = v_result.scalar_one_or_none()
        if not version:
            break

        diff = TraceDiff(
            version_id=version.id,
            version_number=version.version_number
        )

        if version.parent_id is not None:
            parent_result = await db.execute(select(FormulaVersion).where(FormulaVersion.id == version.parent_id))
            parent = parent_result.scalar_one_or_none()
            if parent:
                parent_ings = {ing["name"]: ing["percentage"] for ing in parent.ingredients}
                current_ings = {ing["name"]: ing["percentage"] for ing in version.ingredients}

                for name, pct in current_ings.items():
                    if name not in parent_ings:
                        diff.added.append(IngredientItem(name=name, percentage=pct))
                    elif abs(pct - parent_ings[name]) > 0.01:
                        diff.changed.append({
                            "name": name,
                            "old_percentage": parent_ings[name],
                            "new_percentage": pct,
                            "delta": round(pct - parent_ings[name], 2)
                        })

                for name, pct in parent_ings.items():
                    if name not in current_ings:
                        diff.removed.append(IngredientItem(name=name, percentage=pct))

        path.append(diff)
        current_id = version.parent_id

    return TracePathResponse(path=path)
