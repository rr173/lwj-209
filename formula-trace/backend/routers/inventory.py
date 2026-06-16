from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, timedelta
from database import get_db
from models import IngredientInventory, InventoryTransaction, Batch, FormulaVersion
from schemas import (
    IngredientInventoryCreate,
    IngredientInventoryUpdate,
    IngredientInventoryResponse,
    StockInRequest,
    StockOutRequest,
    InventoryTransactionResponse,
    InventoryWithTransactionsResponse,
    PurchaseWarningResponse,
    PurchaseWarningItem,
)

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


@router.post("", response_model=IngredientInventoryResponse, status_code=201)
async def create_inventory(data: IngredientInventoryCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(IngredientInventory).where(IngredientInventory.ingredient_name == data.ingredient_name)
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail=f"原料「{data.ingredient_name}」已存在")

    inventory = IngredientInventory(
        ingredient_name=data.ingredient_name,
        current_quantity=data.current_quantity,
        safety_stock=data.safety_stock,
        storage_location=data.storage_location,
    )
    db.add(inventory)
    await db.commit()
    await db.refresh(inventory)

    if data.current_quantity > 0:
        transaction = InventoryTransaction(
            inventory_id=inventory.id,
            transaction_type="stock_in",
            quantity=data.current_quantity,
            remark="初始库存录入",
        )
        db.add(transaction)
        await db.commit()

    return inventory


@router.get("", response_model=list[IngredientInventoryResponse])
async def list_inventories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(IngredientInventory).order_by(IngredientInventory.ingredient_name))
    return result.scalars().all()


@router.get("/{inventory_id}", response_model=InventoryWithTransactionsResponse)
async def get_inventory(inventory_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(IngredientInventory).where(IngredientInventory.id == inventory_id))
    inventory = result.scalar_one_or_none()
    if not inventory:
        raise HTTPException(status_code=404, detail="库存记录不存在")

    thirty_days_ago = datetime.now() - timedelta(days=30)
    tx_result = await db.execute(
        select(InventoryTransaction)
        .where(
            and_(
                InventoryTransaction.inventory_id == inventory_id,
                InventoryTransaction.created_at >= thirty_days_ago,
            )
        )
        .order_by(InventoryTransaction.created_at.desc())
    )
    transactions = tx_result.scalars().all()

    return InventoryWithTransactionsResponse(
        id=inventory.id,
        ingredient_name=inventory.ingredient_name,
        current_quantity=inventory.current_quantity,
        safety_stock=inventory.safety_stock,
        storage_location=inventory.storage_location,
        stock_status=inventory.stock_status,
        created_at=inventory.created_at,
        updated_at=inventory.updated_at,
        recent_transactions=[
            InventoryTransactionResponse(
                id=t.id,
                inventory_id=t.inventory_id,
                transaction_type=t.transaction_type,
                quantity=t.quantity,
                batch_number=t.batch_number,
                remark=t.remark,
                created_at=t.created_at,
            )
            for t in transactions
        ],
    )


@router.put("/{inventory_id}", response_model=IngredientInventoryResponse)
async def update_inventory(
    inventory_id: int, data: IngredientInventoryUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(IngredientInventory).where(IngredientInventory.id == inventory_id))
    inventory = result.scalar_one_or_none()
    if not inventory:
        raise HTTPException(status_code=404, detail="库存记录不存在")

    if data.current_quantity is not None:
        inventory.current_quantity = data.current_quantity
    if data.safety_stock is not None:
        inventory.safety_stock = data.safety_stock
    if data.storage_location is not None:
        inventory.storage_location = data.storage_location

    await db.commit()
    await db.refresh(inventory)
    return inventory


@router.delete("/{inventory_id}", status_code=204)
async def delete_inventory(inventory_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(IngredientInventory).where(IngredientInventory.id == inventory_id))
    inventory = result.scalar_one_or_none()
    if not inventory:
        raise HTTPException(status_code=404, detail="库存记录不存在")

    await db.delete(inventory)
    await db.commit()


@router.post("/{inventory_id}/stock-in", response_model=IngredientInventoryResponse)
async def stock_in(inventory_id: int, data: StockInRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(IngredientInventory).where(IngredientInventory.id == inventory_id))
    inventory = result.scalar_one_or_none()
    if not inventory:
        raise HTTPException(status_code=404, detail="库存记录不存在")

    inventory.current_quantity += data.quantity

    transaction = InventoryTransaction(
        inventory_id=inventory_id,
        transaction_type="stock_in",
        quantity=data.quantity,
        batch_number=data.batch_number,
        remark=data.remark or "原料入库",
    )
    db.add(transaction)
    await db.commit()
    await db.refresh(inventory)
    return inventory


@router.post("/{inventory_id}/stock-out", response_model=IngredientInventoryResponse)
async def stock_out(inventory_id: int, data: StockOutRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(IngredientInventory).where(IngredientInventory.id == inventory_id))
    inventory = result.scalar_one_or_none()
    if not inventory:
        raise HTTPException(status_code=404, detail="库存记录不存在")

    if inventory.current_quantity < data.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"库存不足：当前库存 {inventory.current_quantity} kg，需要扣减 {data.quantity} kg",
        )

    inventory.current_quantity -= data.quantity

    transaction = InventoryTransaction(
        inventory_id=inventory_id,
        transaction_type="stock_out",
        quantity=data.quantity,
        batch_number=data.batch_number,
        remark=data.remark or "原料出库",
    )
    db.add(transaction)
    await db.commit()
    await db.refresh(inventory)
    return inventory


@router.get("/{inventory_id}/transactions", response_model=list[InventoryTransactionResponse])
async def get_inventory_transactions(
    inventory_id: int, days: int = 30, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(IngredientInventory).where(IngredientInventory.id == inventory_id))
    inventory = result.scalar_one_or_none()
    if not inventory:
        raise HTTPException(status_code=404, detail="库存记录不存在")

    start_date = datetime.now() - timedelta(days=days)
    tx_result = await db.execute(
        select(InventoryTransaction)
        .where(
            and_(
                InventoryTransaction.inventory_id == inventory_id,
                InventoryTransaction.created_at >= start_date,
            )
        )
        .order_by(InventoryTransaction.created_at.desc())
    )
    return tx_result.scalars().all()


async def calculate_average_daily_consumption(
    db: AsyncSession, ingredient_name: str
) -> float | None:
    three_months_ago = datetime.now() - timedelta(days=90)

    batch_result = await db.execute(
        select(Batch)
        .join(FormulaVersion, Batch.version_id == FormulaVersion.id)
        .where(Batch.production_date >= three_months_ago.date())
        .order_by(Batch.production_date.desc())
        .limit(3)
    )
    recent_batches = batch_result.scalars().all()

    if len(recent_batches) < 1:
        return None

    total_consumption = 0.0
    for batch in recent_batches:
        for ing in batch.version.ingredients:
            if ing["name"] == ingredient_name:
                consumption = batch.production_amount * (ing["percentage"] / 100.0)
                total_consumption += consumption
                break

    if total_consumption <= 0:
        return None

    if len(recent_batches) >= 2:
        date_range = (recent_batches[0].production_date - recent_batches[-1].production_date).days
        if date_range > 0:
            return total_consumption / date_range

    return total_consumption / 7.0


@router.get("/warnings", response_model=PurchaseWarningResponse)
async def get_purchase_warnings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(IngredientInventory).order_by(IngredientInventory.ingredient_name))
    inventories = result.scalars().all()

    items: list[PurchaseWarningItem] = []
    urgent_count = 0
    warning_count = 0
    normal_count = 0

    for inv in inventories:
        avg_daily = await calculate_average_daily_consumption(db, inv.ingredient_name)

        estimated_days: float | None = None
        if avg_daily and avg_daily > 0 and inv.current_quantity > 0:
            estimated_days = inv.current_quantity / avg_daily

        shortage = max(0.0, inv.safety_stock - inv.current_quantity)

        if estimated_days is not None:
            if estimated_days < 7:
                warning_level = "urgent"
                urgent_count += 1
            elif estimated_days < 14:
                warning_level = "warning"
                warning_count += 1
            else:
                warning_level = "normal"
                normal_count += 1
        else:
            if inv.current_quantity < inv.safety_stock:
                warning_level = "urgent"
                urgent_count += 1
            else:
                warning_level = "normal"
                normal_count += 1

        items.append(
            PurchaseWarningItem(
                id=inv.id,
                ingredient_name=inv.ingredient_name,
                current_quantity=inv.current_quantity,
                safety_stock=inv.safety_stock,
                storage_location=inv.storage_location,
                average_daily_consumption=round(avg_daily, 4) if avg_daily else None,
                estimated_days_left=round(estimated_days, 1) if estimated_days else None,
                warning_level=warning_level,
                shortage_amount=round(shortage, 4),
            )
        )

    return PurchaseWarningResponse(
        urgent_count=urgent_count,
        warning_count=warning_count,
        normal_count=normal_count,
        items=items,
    )
