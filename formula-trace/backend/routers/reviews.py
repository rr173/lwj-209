from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from database import get_db
from models import ReviewMeeting, ReviewScore, ReviewDecision, FormulaVersion, ApprovalRecord
from schemas import (
    ReviewMeetingCreate,
    ReviewScoreSubmit,
    ReviewMeetingResponse,
    ReviewMeetingListItem,
    ReviewDecisionResponse,
    ReviewScoreResponse,
    VersionReviewRecord,
)
from routers.versions import get_ingredients_summary, build_version_response
from datetime import datetime
from collections import defaultdict

router = APIRouter(prefix="/api/reviews", tags=["reviews"])


def get_decision(final_score: float) -> str:
    if final_score >= 8:
        return "approve"
    elif final_score >= 6:
        return "conditional"
    else:
        return "reject"


def get_meeting_status_label(status: str) -> str:
    return {
        "pending": "待开始",
        "ongoing": "进行中",
        "ended": "已结束",
    }.get(status, status)


async def build_meeting_response(meeting: ReviewMeeting, db: AsyncSession) -> ReviewMeetingResponse:
    scores_result = await db.execute(
        select(ReviewScore).where(ReviewScore.meeting_id == meeting.id)
    )
    scores = scores_result.scalars().all()

    decisions_result = await db.execute(
        select(ReviewDecision).where(ReviewDecision.meeting_id == meeting.id)
    )
    decisions = decisions_result.scalars().all()

    decision_responses = []
    for d in decisions:
        version_result = await db.execute(
            select(FormulaVersion).where(FormulaVersion.id == d.version_id)
        )
        version = version_result.scalar_one_or_none()
        decision_responses.append(
            ReviewDecisionResponse(
                id=d.id,
                meeting_id=d.meeting_id,
                version_id=d.version_id,
                version_number=version.version_number if version else None,
                ingredients_summary=get_ingredients_summary(version.ingredients) if version else None,
                avg_rationality=d.avg_rationality,
                avg_cost=d.avg_cost,
                avg_feasibility=d.avg_feasibility,
                final_score=d.final_score,
                decision=d.decision,
                created_at=d.created_at,
            )
        )

    return ReviewMeetingResponse(
        id=meeting.id,
        title=meeting.title,
        review_date=meeting.review_date,
        status=meeting.status,
        judges=meeting.judges,
        version_ids=meeting.version_ids,
        version_count=len(meeting.version_ids),
        judge_count=len(meeting.judges),
        created_at=meeting.created_at,
        started_at=meeting.started_at,
        ended_at=meeting.ended_at,
        scores=[ReviewScoreResponse.model_validate(s) for s in scores],
        decisions=decision_responses,
    )


@router.post("", response_model=ReviewMeetingResponse, status_code=201)
async def create_review_meeting(data: ReviewMeetingCreate, db: AsyncSession = Depends(get_db)):
    for vid in data.version_ids:
        result = await db.execute(
            select(FormulaVersion).where(FormulaVersion.id == vid)
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail=f"配方版本 {vid} 不存在")

    meeting = ReviewMeeting(
        title=data.title,
        review_date=data.review_date,
        status="pending",
        judges=[j.strip() for j in data.judges],
        version_ids=data.version_ids,
    )
    db.add(meeting)
    await db.commit()
    await db.refresh(meeting)

    return await build_meeting_response(meeting, db)


@router.get("", response_model=list[ReviewMeetingListItem])
async def list_review_meetings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ReviewMeeting).order_by(ReviewMeeting.created_at.desc())
    )
    meetings = result.scalars().all()
    return [
        ReviewMeetingListItem(
            id=m.id,
            title=m.title,
            review_date=m.review_date,
            status=m.status,
            version_count=len(m.version_ids),
            judge_count=len(m.judges),
            created_at=m.created_at,
        )
        for m in meetings
    ]


@router.get("/{meeting_id}", response_model=ReviewMeetingResponse)
async def get_review_meeting(meeting_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ReviewMeeting).where(ReviewMeeting.id == meeting_id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="评审会议不存在")
    return await build_meeting_response(meeting, db)


@router.post("/{meeting_id}/start", response_model=ReviewMeetingResponse)
async def start_review_meeting(meeting_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ReviewMeeting).where(ReviewMeeting.id == meeting_id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="评审会议不存在")

    if meeting.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"当前状态「{get_meeting_status_label(meeting.status)}」无法开始会议，仅待开始状态可开始"
        )

    meeting.status = "ongoing"
    meeting.started_at = datetime.now()
    await db.commit()
    await db.refresh(meeting)

    return await build_meeting_response(meeting, db)


@router.post("/{meeting_id}/score", response_model=ReviewScoreResponse)
async def submit_review_score(
    meeting_id: int,
    data: ReviewScoreSubmit,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ReviewMeeting).where(ReviewMeeting.id == meeting_id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="评审会议不存在")

    if meeting.status != "ongoing":
        raise HTTPException(
            status_code=400,
            detail=f"当前状态「{get_meeting_status_label(meeting.status)}」无法提交评分，仅进行中状态可提交"
        )

    if data.judge_name not in meeting.judges:
        raise HTTPException(
            status_code=400,
            detail=f"「{data.judge_name}」不在本次会议的评委名单中"
        )

    if data.version_id not in meeting.version_ids:
        raise HTTPException(
            status_code=400,
            detail=f"配方版本 {data.version_id} 不在本次会议的评审列表中"
        )

    existing_result = await db.execute(
        select(ReviewScore).where(
            and_(
                ReviewScore.meeting_id == meeting_id,
                ReviewScore.version_id == data.version_id,
                ReviewScore.judge_name == data.judge_name,
            )
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"评委「{data.judge_name}」已对版本 {data.version_id} 提交过评分，不可重复提交"
        )

    score = ReviewScore(
        meeting_id=meeting_id,
        version_id=data.version_id,
        judge_name=data.judge_name,
        rationality_score=data.rationality_score,
        cost_score=data.cost_score,
        feasibility_score=data.feasibility_score,
        comment=data.comment,
    )
    db.add(score)
    await db.commit()
    await db.refresh(score)

    return ReviewScoreResponse.model_validate(score)


@router.post("/{meeting_id}/end", response_model=ReviewMeetingResponse)
async def end_review_meeting(meeting_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ReviewMeeting).where(ReviewMeeting.id == meeting_id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="评审会议不存在")

    if meeting.status != "ongoing":
        raise HTTPException(
            status_code=400,
            detail=f"当前状态「{get_meeting_status_label(meeting.status)}」无法结束会议，仅进行中状态可结束"
        )

    scores_result = await db.execute(
        select(ReviewScore).where(ReviewScore.meeting_id == meeting_id)
    )
    scores = scores_result.scalars().all()

    expected_count = len(meeting.judges) * len(meeting.version_ids)
    if len(scores) != expected_count:
        missing = []
        for judge in meeting.judges:
            for vid in meeting.version_ids:
                found = any(
                    s.judge_name == judge and s.version_id == vid for s in scores
                )
                if not found:
                    missing.append(f"评委[{judge}]对版本[{vid}]")
        raise HTTPException(
            status_code=400,
            detail=f"还有 {expected_count - len(scores)} 个评分未提交：{'; '.join(missing)}"
        )

    version_scores = defaultdict(list)
    for s in scores:
        version_scores[s.version_id].append(s)

    decisions = []
    for version_id, judge_scores in version_scores.items():
        avg_rationality = sum(s.rationality_score for s in judge_scores) / len(judge_scores)
        avg_cost = sum(s.cost_score for s in judge_scores) / len(judge_scores)
        avg_feasibility = sum(s.feasibility_score for s in judge_scores) / len(judge_scores)
        final_score = (avg_rationality + avg_cost + avg_feasibility) / 3
        decision = get_decision(final_score)

        d = ReviewDecision(
            meeting_id=meeting_id,
            version_id=version_id,
            avg_rationality=round(avg_rationality, 2),
            avg_cost=round(avg_cost, 2),
            avg_feasibility=round(avg_feasibility, 2),
            final_score=round(final_score, 2),
            decision=decision,
        )
        db.add(d)
        decisions.append((version_id, decision, final_score))

    meeting.status = "ended"
    meeting.ended_at = datetime.now()
    await db.commit()
    await db.refresh(meeting)

    for version_id, decision, final_score in decisions:
        v_result = await db.execute(
            select(FormulaVersion).where(FormulaVersion.id == version_id)
        )
        version = v_result.scalar_one_or_none()
        if not version:
            continue

        if decision == "approve":
            if version.approval_status in ("draft", "rejected"):
                version.approval_status = "pending"
                record = ApprovalRecord(
                    version_id=version_id,
                    action="submit",
                    operator="评审会议自动提交",
                    remark=f"评审会议通过，平均分{final_score:.2f}，自动提交审批"
                )
                db.add(record)
            else:
                record = ApprovalRecord(
                    version_id=version_id,
                    action="review_approve",
                    operator="评审会议",
                    remark=f"评审会议通过，平均分{final_score:.2f}（当前版本已发布，未改变审批状态）"
                )
                db.add(record)
        elif decision == "conditional":
            record = ApprovalRecord(
                version_id=version_id,
                action="review_conditional",
                operator="评审会议",
                remark=f"评审会议有条件通过，平均分{final_score:.2f}，请根据评委意见完善后手动提交审批"
            )
            db.add(record)
        elif decision == "reject":
            record = ApprovalRecord(
                version_id=version_id,
                action="review_reject",
                operator="评审会议",
                remark=f"评审会议否决，平均分{final_score:.2f}"
            )
            db.add(record)

    await db.commit()

    return await build_meeting_response(meeting, db)


@router.get("/version/{version_id}", response_model=list[VersionReviewRecord])
async def get_version_reviews(version_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(FormulaVersion).where(FormulaVersion.id == version_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="配方版本不存在")

    decisions_result = await db.execute(
        select(ReviewDecision).where(ReviewDecision.version_id == version_id)
    )
    decisions = decisions_result.scalars().all()
    decision_meeting_ids = {d.meeting_id for d in decisions}

    scores_result = await db.execute(
        select(ReviewScore).where(ReviewScore.version_id == version_id)
    )
    scores = scores_result.scalars().all()
    score_meeting_ids = {s.meeting_id for s in scores}

    direct_meetings_result = await db.execute(
        select(ReviewMeeting)
        .order_by(ReviewMeeting.created_at.desc())
    )
    direct_meetings = direct_meetings_result.scalars().all()
    direct_meeting_ids = {m.id for m in direct_meetings if version_id in m.version_ids}

    all_meeting_ids = decision_meeting_ids | score_meeting_ids | direct_meeting_ids

    meetings_result = await db.execute(
        select(ReviewMeeting)
        .where(ReviewMeeting.id.in_(list(all_meeting_ids)))
        .order_by(ReviewMeeting.created_at.desc())
    )
    meetings = meetings_result.scalars().all()

    records = []
    for meeting in meetings:
        meeting_scores_result = await db.execute(
            select(ReviewScore).where(
                and_(
                    ReviewScore.meeting_id == meeting.id,
                    ReviewScore.version_id == version_id,
                )
            )
        )
        meeting_scores = meeting_scores_result.scalars().all()

        decision_result = await db.execute(
            select(ReviewDecision).where(
                and_(
                    ReviewDecision.meeting_id == meeting.id,
                    ReviewDecision.version_id == version_id,
                )
            )
        )
        decision = decision_result.scalar_one_or_none()

        if meeting_scores:
            avg_rationality = sum(s.rationality_score for s in meeting_scores) / len(meeting_scores)
            avg_cost = sum(s.cost_score for s in meeting_scores) / len(meeting_scores)
            avg_feasibility = sum(s.feasibility_score for s in meeting_scores) / len(meeting_scores)
            final_score = (avg_rationality + avg_cost + avg_feasibility) / 3
        else:
            avg_rationality = None
            avg_cost = None
            avg_feasibility = None
            final_score = None

        records.append(
            VersionReviewRecord(
                meeting_id=meeting.id,
                meeting_title=meeting.title,
                meeting_date=meeting.review_date,
                meeting_status=meeting.status,
                avg_rationality=round(avg_rationality, 2) if avg_rationality is not None else None,
                avg_cost=round(avg_cost, 2) if avg_cost is not None else None,
                avg_feasibility=round(avg_feasibility, 2) if avg_feasibility is not None else None,
                final_score=round(final_score, 2) if final_score is not None else None,
                decision=decision.decision if decision else None,
                judge_scores=[ReviewScoreResponse.model_validate(s) for s in meeting_scores],
            )
        )

    return records
