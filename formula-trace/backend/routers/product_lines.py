from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from models import ProductLine, FormulaVersion
from schemas import ProductLineCreate, ProductLineResponse

router = APIRouter(prefix="/api/product-lines", tags=["product-lines"])


@router.post("", response_model=ProductLineResponse, status_code=201)
async def create_product_line(data: ProductLineCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ProductLine).where(ProductLine.name == data.name))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"产品线名称 '{data.name}' 已存在")
    product_line = ProductLine(**data.model_dump())
    db.add(product_line)
    await db.commit()
    await db.refresh(product_line)
    return ProductLineResponse(
        id=product_line.id,
        name=product_line.name,
        target_effect=product_line.target_effect,
        version_count=0
    )


@router.get("", response_model=list[ProductLineResponse])
async def list_product_lines(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            ProductLine.id,
            ProductLine.name,
            ProductLine.target_effect,
            func.count(FormulaVersion.id).label("version_count")
        ).outerjoin(FormulaVersion).group_by(ProductLine.id)
    )
    rows = result.all()
    return [
        ProductLineResponse(
            id=row.id,
            name=row.name,
            target_effect=row.target_effect,
            version_count=row.version_count or 0
        )
        for row in rows
    ]


@router.get("/{product_line_id}", response_model=ProductLineResponse)
async def get_product_line(product_line_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ProductLine).where(ProductLine.id == product_line_id))
    product_line = result.scalar_one_or_none()
    if not product_line:
        raise HTTPException(status_code=404, detail="产品线不存在")
    count_result = await db.execute(
        select(func.count(FormulaVersion.id)).where(FormulaVersion.product_line_id == product_line_id)
    )
    version_count = count_result.scalar_one() or 0
    return ProductLineResponse(
        id=product_line.id,
        name=product_line.name,
        target_effect=product_line.target_effect,
        version_count=version_count
    )
