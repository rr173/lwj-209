from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from database import get_db
from models import (
    FormulaVersion,
    ApprovalRecord,
    Batch,
    ReviewMeeting,
    ReviewDecision,
    ComplianceCheckRecord,
    Milestone,
    ProductLine,
)
from schemas import (
    LifecycleEvent,
    LifecycleTimelineResponse,
    MilestoneCreate,
    MilestoneComplete,
    MilestoneResponse,
    ProductLineLifecycleStats,
)
from datetime import datetime, date

router = APIRouter(prefix="/api/lifecycle", tags=["lifecycle"])


APPROVAL_ACTION_LABELS = {
    "submit": "提交审批",
    "approve": "审批通过",
    "reject": "审批驳回",
    "review_approve": "评审会议通过",
    "review_conditional": "评审会议有条件通过",
    "review_reject": "评审会议否决",
}


def get_milestone_status(milestone: Milestone, today: date) -> str:
    if milestone.status == "completed":
        return "completed"
    if milestone.target_date < today:
        return "overdue"
    return "pending"


async def build_milestone_response(
    milestone: Milestone,
    db: AsyncSession,
    include_version_info: bool = False,
) -> MilestoneResponse:
    today = date.today()
    status = get_milestone_status(milestone, today)

    version_number = None
    product_line_id = None

    if include_version_info:
        v_result = await db.execute(
            select(FormulaVersion).where(FormulaVersion.id == milestone.version_id)
        )
        version = v_result.scalar_one_or_none()
        if version:
            version_number = version.version_number
            product_line_id = version.product_line_id

    return MilestoneResponse(
        id=milestone.id,
        version_id=milestone.version_id,
        version_number=version_number,
        product_line_id=product_line_id,
        name=milestone.name,
        target_date=milestone.target_date,
        status=status,
        actual_completion_date=milestone.actual_completion_date,
        created_at=milestone.created_at,
        updated_at=milestone.updated_at,
    )


@router.get("/version/{version_id}/timeline", response_model=LifecycleTimelineResponse)
async def get_version_timeline(version_id: int, db: AsyncSession = Depends(get_db)):
    v_result = await db.execute(
        select(FormulaVersion).where(FormulaVersion.id == version_id)
    )
    version = v_result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="配方版本不存在")

    events: list[LifecycleEvent] = []

    derived_from = None
    if version.parent_id is not None:
        p_result = await db.execute(
            select(FormulaVersion).where(FormulaVersion.id == version.parent_id)
        )
        parent = p_result.scalar_one_or_none()
        if parent:
            derived_from = {
                "parent_id": parent.id,
                "parent_version_number": parent.version_number,
            }

    create_time = version.created_at if hasattr(version, 'created_at') else datetime.now()
    if not hasattr(version, 'created_at'):
        events.append(LifecycleEvent(
            event_type="version_created",
            event_time=datetime.min,
            description=f"版本 V{version.version_number} 创建",
            operator=None,
        ))
    else:
        events.append(LifecycleEvent(
            event_type="version_created",
            event_time=version.created_at,
            description=f"版本 V{version.version_number} 创建",
            operator=None,
        ))

    approval_result = await db.execute(
        select(ApprovalRecord)
        .where(ApprovalRecord.version_id == version_id)
        .order_by(ApprovalRecord.created_at.asc())
    )
    approval_records = approval_result.scalars().all()
    for record in approval_records:
        action_label = APPROVAL_ACTION_LABELS.get(record.action, record.action)
        desc = f"{action_label}"
        if record.remark:
            desc += f" — {record.remark}"
        events.append(LifecycleEvent(
            event_type=f"approval_{record.action}",
            event_time=record.created_at,
            description=desc,
            operator=record.operator,
            extra={"action": record.action, "remark": record.remark},
        ))

    batch_result = await db.execute(
        select(Batch)
        .where(Batch.version_id == version_id)
        .order_by(Batch.production_date.asc())
    )
    batches = batch_result.scalars().all()
    first_batch_added = False
    for batch in batches:
        batch_time = datetime.combine(batch.production_date, datetime.min.time())
        if not first_batch_added:
            events.append(LifecycleEvent(
                event_type="first_batch_created",
                event_time=batch_time,
                description=f"首个试产批次创建：{batch.batch_number}，产量 {batch.production_amount}kg",
                operator=None,
                extra={"batch_id": batch.id, "batch_number": batch.batch_number},
            ))
            first_batch_added = True
        if batch.has_test_result:
            events.append(LifecycleEvent(
                event_type="batch_test_result",
                event_time=batch_time,
                description=f"批次 {batch.batch_number} 检测结果已录入 — 肤感{batch.skin_feel_score:.1f} / 稳定性{batch.stability_score:.1f} / 成本{batch.cost_per_kg:.2f}元/kg",
                operator=None,
                extra={
                    "batch_id": batch.id,
                    "batch_number": batch.batch_number,
                    "skin_feel_score": batch.skin_feel_score,
                    "stability_score": batch.stability_score,
                    "cost_per_kg": batch.cost_per_kg,
                },
            ))

    all_meetings_result = await db.execute(select(ReviewMeeting))
    all_meetings = all_meetings_result.scalars().all()
    referenced_meetings = []
    for meeting in all_meetings:
        if version_id in (meeting.version_ids or []):
            referenced_meetings.append(meeting)

    decision_result = await db.execute(
        select(ReviewDecision).where(ReviewDecision.version_id == version_id)
    )
    decisions = decision_result.scalars().all()
    decision_meeting_ids = {d.meeting_id for d in decisions}

    meeting_ids = {m.id for m in referenced_meetings} | decision_meeting_ids
    if meeting_ids:
        meetings_result = await db.execute(
            select(ReviewMeeting).where(ReviewMeeting.id.in_(list(meeting_ids)))
        )
        meetings = meetings_result.scalars().all()
        for meeting in meetings:
            meeting_time = datetime.combine(meeting.review_date, datetime.min.time())
            decision_map = {d.meeting_id: d for d in decisions if d.version_id == version_id}
            decision = decision_map.get(meeting.id)
            if decision:
                decision_label = {
                    "approve": "通过",
                    "conditional": "有条件通过",
                    "reject": "否决",
                }.get(decision.decision, decision.decision)
                desc = f"评审会议「{meeting.title}」引用并作出结论：{decision_label}（综合评分{decision.final_score:.2f}）"
            else:
                desc = f"评审会议「{meeting.title}」引用该版本"
            events.append(LifecycleEvent(
                event_type="review_referenced",
                event_time=meeting_time,
                description=desc,
                operator=None,
                extra={
                    "meeting_id": meeting.id,
                    "meeting_title": meeting.title,
                    "meeting_status": meeting.status,
                    "decision": decision.decision if decision else None,
                    "final_score": decision.final_score if decision else None,
                },
            ))

    compliance_result = await db.execute(
        select(ComplianceCheckRecord)
        .where(ComplianceCheckRecord.version_id == version_id)
        .order_by(ComplianceCheckRecord.created_at.asc())
    )
    compliance_records = compliance_result.scalars().all()
    first_compliance_added = False
    for record in compliance_records:
        if not first_compliance_added:
            events.append(LifecycleEvent(
                event_type="first_compliance_check",
                event_time=record.created_at,
                description=f"首次合规检测 — 目标市场：{record.target_market}，品类：{record.product_category}，结论：{record.overall_conclusion}（合规率 {record.compliance_rate:.1f}%）",
                operator=None,
                extra={
                    "target_market": record.target_market,
                    "product_category": record.product_category,
                    "overall_conclusion": record.overall_conclusion,
                    "compliance_rate": record.compliance_rate,
                },
            ))
            first_compliance_added = True
        else:
            events.append(LifecycleEvent(
                event_type="compliance_check",
                event_time=record.created_at,
                description=f"合规检测 — {record.target_market} / {record.product_category}：{record.overall_conclusion}",
                operator=None,
                extra={
                    "target_market": record.target_market,
                    "product_category": record.product_category,
                    "overall_conclusion": record.overall_conclusion,
                    "compliance_rate": record.compliance_rate,
                },
            ))

    milestone_result = await db.execute(
        select(Milestone)
        .where(Milestone.version_id == version_id)
    )
    milestones = milestone_result.scalars().all()
    today = date.today()
    for ms in milestones:
        ms_status = get_milestone_status(ms, today)
        status_label = {
            "pending": "待完成",
            "completed": "已完成",
            "overdue": "已逾期",
        }.get(ms_status, ms_status)
        if ms_status == "completed":
            ms_time = datetime.combine(ms.actual_completion_date or ms.target_date, datetime.min.time())
            desc = f"里程碑「{ms.name}」已完成（目标 {ms.target_date.isoformat()}，实际 {(ms.actual_completion_date or ms.target_date).isoformat()}）"
        elif ms_status == "overdue":
            ms_time = datetime.combine(ms.target_date, datetime.min.time())
            desc = f"里程碑「{ms.name}」已逾期（目标日期 {ms.target_date.isoformat()}，仍未完成）"
        else:
            ms_time = datetime.combine(ms.target_date, datetime.min.time())
            desc = f"里程碑「{ms.name}」目标日期 {ms.target_date.isoformat()}（{status_label}）"
        events.append(LifecycleEvent(
            event_type=f"milestone_{ms_status}",
            event_time=ms_time,
            description=desc,
            operator=None,
            extra={
                "milestone_id": ms.id,
                "milestone_name": ms.name,
                "milestone_status": ms_status,
                "target_date": ms.target_date.isoformat(),
                "actual_completion_date": ms.actual_completion_date.isoformat() if ms.actual_completion_date else None,
            },
        ))

    events.sort(key=lambda e: e.event_time)

    return LifecycleTimelineResponse(
        version_id=version.id,
        version_number=version.version_number,
        derived_from=derived_from,
        events=events,
    )


@router.post("/milestones", response_model=MilestoneResponse, status_code=201)
async def create_milestone(data: MilestoneCreate, db: AsyncSession = Depends(get_db)):
    v_result = await db.execute(
        select(FormulaVersion).where(FormulaVersion.id == data.version_id)
    )
    if not v_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="配方版本不存在")

    existing_result = await db.execute(
        select(Milestone).where(
            and_(
                Milestone.version_id == data.version_id,
                Milestone.name == data.name,
            )
        )
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail=f"该版本下已存在同名里程碑「{data.name}」，请勿重复创建",
        )

    milestone = Milestone(
        version_id=data.version_id,
        name=data.name.strip(),
        target_date=data.target_date,
        status="pending",
    )
    db.add(milestone)
    await db.commit()
    await db.refresh(milestone)

    return await build_milestone_response(milestone, db, include_version_info=True)


@router.get("/version/{version_id}/milestones", response_model=list[MilestoneResponse])
async def get_version_milestones(version_id: int, db: AsyncSession = Depends(get_db)):
    v_result = await db.execute(
        select(FormulaVersion).where(FormulaVersion.id == version_id)
    )
    if not v_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="配方版本不存在")

    result = await db.execute(
        select(Milestone)
        .where(Milestone.version_id == version_id)
        .order_by(Milestone.target_date.asc())
    )
    milestones = result.scalars().all()

    return [
        await build_milestone_response(m, db, include_version_info=True)
        for m in milestones
    ]


@router.get("/product-line/{product_line_id}/milestones/pending", response_model=list[MilestoneResponse])
async def get_product_line_pending_milestones(
    product_line_id: int,
    include_overdue: bool = Query(True, description="是否包含已逾期的里程碑"),
    db: AsyncSession = Depends(get_db),
):
    pl_result = await db.execute(
        select(ProductLine).where(ProductLine.id == product_line_id)
    )
    if not pl_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="产品线不存在")

    version_result = await db.execute(
        select(FormulaVersion.id).where(FormulaVersion.product_line_id == product_line_id)
    )
    version_ids = [row[0] for row in version_result.all()]
    if not version_ids:
        return []

    today = date.today()
    result = await db.execute(
        select(Milestone)
        .where(Milestone.version_id.in_(version_ids))
        .order_by(Milestone.target_date.asc())
    )
    all_milestones = result.scalars().all()

    filtered = []
    for m in all_milestones:
        status = get_milestone_status(m, today)
        if status == "pending":
            filtered.append(m)
        elif status == "overdue" and include_overdue:
            filtered.append(m)

    return [
        await build_milestone_response(m, db, include_version_info=True)
        for m in filtered
    ]


@router.post("/milestones/{milestone_id}/complete", response_model=MilestoneResponse)
async def complete_milestone(
    milestone_id: int,
    data: MilestoneComplete,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Milestone).where(Milestone.id == milestone_id)
    )
    milestone = result.scalar_one_or_none()
    if not milestone:
        raise HTTPException(status_code=404, detail="里程碑不存在")

    milestone.status = "completed"
    milestone.actual_completion_date = data.actual_completion_date or date.today()
    await db.commit()
    await db.refresh(milestone)

    return await build_milestone_response(milestone, db, include_version_info=True)


@router.delete("/milestones/{milestone_id}")
async def delete_milestone(milestone_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Milestone).where(Milestone.id == milestone_id)
    )
    milestone = result.scalar_one_or_none()
    if not milestone:
        raise HTTPException(status_code=404, detail="里程碑不存在")

    await db.delete(milestone)
    await db.commit()
    return {"status": "ok", "message": "里程碑已删除"}


@router.get("/product-line/{product_line_id}/stats", response_model=ProductLineLifecycleStats)
async def get_product_line_lifecycle_stats(
    product_line_id: int,
    db: AsyncSession = Depends(get_db),
):
    pl_result = await db.execute(
        select(ProductLine).where(ProductLine.id == product_line_id)
    )
    if not pl_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="产品线不存在")

    version_result = await db.execute(
        select(FormulaVersion).where(FormulaVersion.product_line_id == product_line_id)
    )
    versions = version_result.scalars().all()
    version_ids = [v.id for v in versions]
    version_map = {v.id: v for v in versions}

    days_to_first_batch_list: list[float] = []
    days_from_batch_to_approval_list: list[float] = []
    version_survival_rounds_list: list[float] = []

    for version in versions:
        batch_result = await db.execute(
            select(Batch)
            .where(Batch.version_id == version.id)
            .order_by(Batch.production_date.asc())
        )
        version_batches = batch_result.scalars().all()
        first_batch_date = version_batches[0].production_date if version_batches else None

        if first_batch_date and hasattr(version, 'created_at'):
            create_date = version.created_at.date() if isinstance(version.created_at, datetime) else version.created_at
            delta = (first_batch_date - create_date).days
            if delta >= 0:
                days_to_first_batch_list.append(float(delta))

        if first_batch_date:
            approve_result = await db.execute(
                select(ApprovalRecord).where(
                    and_(
                        ApprovalRecord.version_id == version.id,
                        ApprovalRecord.action == "approve",
                    )
                ).order_by(ApprovalRecord.created_at.asc())
            )
            approve_records = approve_result.scalars().all()
            if approve_records:
                first_approve_date = approve_records[0].created_at.date()
                delta = (first_approve_date - first_batch_date).days
                if delta >= 0:
                    days_from_batch_to_approval_list.append(float(delta))

        child_count_result = await db.execute(
            select(func.count(FormulaVersion.id)).where(
                FormulaVersion.parent_id == version.id
            )
        )
        child_count = child_count_result.scalar_one() or 0
        version_survival_rounds_list.append(float(child_count))

    avg_days_to_first_batch = (
        round(sum(days_to_first_batch_list) / len(days_to_first_batch_list), 1)
        if days_to_first_batch_list
        else None
    )
    avg_days_from_batch_to_approval = (
        round(sum(days_from_batch_to_approval_list) / len(days_from_batch_to_approval_list), 1)
        if days_from_batch_to_approval_list
        else None
    )
    avg_version_survival_rounds = (
        round(sum(version_survival_rounds_list) / len(version_survival_rounds_list), 2)
        if version_survival_rounds_list
        else None
    )

    today = date.today()
    overdue_count = 0
    if version_ids:
        ms_result = await db.execute(
            select(Milestone).where(Milestone.version_id.in_(version_ids))
        )
        milestones = ms_result.scalars().all()
        for m in milestones:
            if get_milestone_status(m, today) == "overdue":
                overdue_count += 1

    return ProductLineLifecycleStats(
        product_line_id=product_line_id,
        avg_days_to_first_batch=avg_days_to_first_batch,
        avg_days_from_batch_to_approval=avg_days_from_batch_to_approval,
        avg_version_survival_rounds=avg_version_survival_rounds,
        overdue_milestone_count=overdue_count,
    )
