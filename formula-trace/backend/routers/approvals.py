from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import FormulaVersion, ApprovalRecord
from schemas import ApprovalSubmitRequest, ApprovalActionRequest, ApprovalRejectRequest, ApprovalRecordResponse, FormulaVersionResponse, IngredientItem
from routers.versions import get_ingredients_summary, build_version_response

router = APIRouter(prefix="/api/approvals", tags=["approvals"])

VALID_TRANSITIONS = {
    "draft": ["pending"],
    "pending": ["published", "rejected"],
    "rejected": ["pending"],
    "published": [],
}


@router.post("/{version_id}/submit", response_model=FormulaVersionResponse)
async def submit_for_approval(version_id: int, data: ApprovalSubmitRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FormulaVersion).where(FormulaVersion.id == version_id))
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")

    if version.approval_status not in ("draft", "rejected"):
        raise HTTPException(status_code=400, detail=f"当前状态「{version.approval_status}」无法提交审批，仅草稿或已驳回状态可提交")

    version.approval_status = "pending"
    record = ApprovalRecord(
        version_id=version_id,
        action="submit",
        operator=data.operator,
        remark=data.remark
    )
    db.add(record)
    await db.commit()
    await db.refresh(version)

    return await build_version_response(version, db)


@router.post("/{version_id}/approve", response_model=FormulaVersionResponse)
async def approve_version(version_id: int, data: ApprovalActionRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FormulaVersion).where(FormulaVersion.id == version_id))
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")

    if version.approval_status != "pending":
        raise HTTPException(status_code=400, detail=f"当前状态「{version.approval_status}」无法审批，仅待审批状态可审批")

    version.approval_status = "published"
    record = ApprovalRecord(
        version_id=version_id,
        action="approve",
        operator=data.operator,
        remark=data.remark
    )
    db.add(record)
    await db.commit()
    await db.refresh(version)

    return await build_version_response(version, db)


@router.post("/{version_id}/reject", response_model=FormulaVersionResponse)
async def reject_version(version_id: int, data: ApprovalRejectRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FormulaVersion).where(FormulaVersion.id == version_id))
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")

    if version.approval_status != "pending":
        raise HTTPException(status_code=400, detail=f"当前状态「{version.approval_status}」无法驳回，仅待审批状态可驳回")

    version.approval_status = "rejected"
    record = ApprovalRecord(
        version_id=version_id,
        action="reject",
        operator=data.operator,
        remark=data.remark
    )
    db.add(record)
    await db.commit()
    await db.refresh(version)

    return await build_version_response(version, db)


@router.get("/{version_id}/history", response_model=list[ApprovalRecordResponse])
async def get_approval_history(version_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FormulaVersion).where(FormulaVersion.id == version_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="版本不存在")

    records_result = await db.execute(
        select(ApprovalRecord)
        .where(ApprovalRecord.version_id == version_id)
        .order_by(ApprovalRecord.created_at.asc())
    )
    records = records_result.scalars().all()
    return [ApprovalRecordResponse(
        id=r.id,
        version_id=r.version_id,
        action=r.action,
        operator=r.operator,
        remark=r.remark,
        created_at=r.created_at
    ) for r in records]
