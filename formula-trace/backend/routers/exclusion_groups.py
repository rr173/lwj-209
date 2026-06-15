from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import ExclusionGroup, ProductLine
from schemas import ExclusionGroupCreate, ExclusionGroupResponse

router = APIRouter(prefix="/api/exclusion-groups", tags=["exclusion-groups"])


@router.post("", response_model=ExclusionGroupResponse, status_code=201)
async def create_exclusion_group(data: ExclusionGroupCreate, product_line_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ProductLine).where(ProductLine.id == product_line_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="产品线不存在")
    if len(data.ingredients) < 2:
        raise HTTPException(status_code=400, detail="互斥组至少需要2个成分")
    group = ExclusionGroup(
        product_line_id=product_line_id,
        name=data.name,
        ingredients=data.ingredients
    )
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return group


@router.get("", response_model=list[ExclusionGroupResponse])
async def list_exclusion_groups(product_line_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ExclusionGroup).where(ExclusionGroup.product_line_id == product_line_id)
    )
    return result.scalars().all()
