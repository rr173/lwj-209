from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta
from database import get_db
from models import (
    ProcessCard, ProcessStep, ProcessExecution, StepExecution,
    FormulaVersion, Batch
)
from schemas import (
    ProcessCardCreate, ProcessCardUpdate, ProcessCardResponse, ProcessCardListItem,
    ProcessExecutionCreate, ProcessExecutionTimelineResponse, ProcessExecutionTimelineEvent,
    StepExecutionResponse, DeviationDetail, StartStepRequest, CompleteStepRequest,
    InterruptExecutionRequest, ResumeExecutionRequest, BatchProcessExecutionResponse,
    ProcessCompareResponse, BatchStepDiff
)

router = APIRouter(prefix="/api/process", tags=["process"])


def calculate_deviation(
    target: float | int | None,
    actual: float | int | None,
    tolerance: float | int,
    parameter: str
) -> tuple[bool, DeviationDetail | None, float]:
    if target is None or actual is None:
        return False, None, 0.0
    deviation = abs(actual - target)
    if deviation <= tolerance:
        return False, None, 0.0
    deviation_pct = round((deviation / target * 100) if target != 0 else 0, 2)
    deduction = round(deviation_pct * 0.5, 2)
    detail = DeviationDetail(
        parameter=parameter,
        target_value=target,
        actual_value=actual,
        tolerance=tolerance,
        deviation=round(deviation, 2),
        deviation_percentage=deviation_pct
    )
    return True, detail, min(deduction, 20.0)


async def _build_step_execution_response(
    step_exec: StepExecution,
    step: ProcessStep | None = None
) -> StepExecutionResponse:
    if step is None:
        step = step_exec.process_step
    return StepExecutionResponse(
        id=step_exec.id,
        execution_id=step_exec.execution_id,
        process_step_id=step_exec.process_step_id,
        step_order=step_exec.step_order,
        name=step.name if step else None,
        status=step_exec.status,
        target_temperature=step.target_temperature if step else None,
        target_duration=step.target_duration if step else None,
        stirring_speed=step.stirring_speed if step else None,
        temperature_tolerance=step.temperature_tolerance if step else None,
        duration_tolerance=step.duration_tolerance if step else None,
        speed_tolerance=step.speed_tolerance if step else None,
        actual_temperature=step_exec.actual_temperature,
        actual_duration=step_exec.actual_duration,
        actual_stirring_speed=step_exec.actual_stirring_speed,
        start_time=step_exec.start_time,
        end_time=step_exec.end_time,
        interrupted_at=step_exec.interrupted_at,
        resumed_at=step_exec.resumed_at,
        photo_url=step_exec.photo_url,
        remark=step_exec.remark,
        requires_photo=step.requires_photo if step else False,
        notes=step.notes if step else None,
        has_deviation=step_exec.has_deviation,
        deviation_details=step_exec.deviation_details,
        deviation_deduction=step_exec.deviation_deduction,
        completed_by=step_exec.completed_by
    )


@router.post("/cards", response_model=ProcessCardResponse, status_code=201)
async def create_process_card(data: ProcessCardCreate, db: AsyncSession = Depends(get_db)):
    v_result = await db.execute(select(FormulaVersion).where(FormulaVersion.id == data.version_id))
    version = v_result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="配方版本不存在")

    total_duration = sum(s.target_duration for s in data.steps)

    card = ProcessCard(
        version_id=data.version_id,
        name=data.name,
        style=data.style,
        description=data.description,
        created_by=data.created_by
    )
    db.add(card)
    await db.flush()

    for step_data in data.steps:
        step = ProcessStep(
            process_card_id=card.id,
            step_order=step_data.step_order,
            name=step_data.name,
            target_temperature=step_data.target_temperature,
            target_duration=step_data.target_duration,
            stirring_speed=step_data.stirring_speed,
            temperature_tolerance=step_data.temperature_tolerance,
            duration_tolerance=step_data.duration_tolerance,
            speed_tolerance=step_data.speed_tolerance,
            requires_photo=step_data.requires_photo,
            notes=step_data.notes
        )
        db.add(step)

    await db.commit()
    await db.refresh(card)

    return ProcessCardResponse(
        id=card.id,
        version_id=card.version_id,
        version_number=version.version_number,
        name=card.name,
        style=card.style,
        description=card.description,
        created_by=card.created_by,
        step_count=len(data.steps),
        total_duration_minutes=round(total_duration / 60),
        created_at=card.created_at,
        updated_at=card.updated_at,
        steps=[],
    )


@router.get("/cards/version/{version_id}", response_model=list[ProcessCardListItem])
async def list_process_cards(version_id: int, db: AsyncSession = Depends(get_db)):
    v_result = await db.execute(select(FormulaVersion).where(FormulaVersion.id == version_id))
    version = v_result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="配方版本不存在")

    result = await db.execute(
        select(ProcessCard).where(ProcessCard.version_id == version_id)
    )
    cards = result.scalars().all()

    response = []
    for card in cards:
        steps_result = await db.execute(
            select(ProcessStep).where(ProcessStep.process_card_id == card.id)
        )
        steps = steps_result.scalars().all()
        total_duration = sum(s.target_duration for s in steps)
        response.append(ProcessCardListItem(
            id=card.id,
            version_id=card.version_id,
            version_number=version.version_number,
            name=card.name,
            style=card.style,
            description=card.description,
            step_count=len(steps),
            total_duration_minutes=round(total_duration / 60),
            created_by=card.created_by,
            created_at=card.created_at,
            updated_at=card.updated_at
        ))
    return response


@router.get("/cards/{card_id}", response_model=ProcessCardResponse)
async def get_process_card(card_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ProcessCard).where(ProcessCard.id == card_id))
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="工艺卡不存在")

    v_result = await db.execute(select(FormulaVersion).where(FormulaVersion.id == card.version_id))
    version = v_result.scalar_one_or_none()

    steps_result = await db.execute(
        select(ProcessStep).where(ProcessStep.process_card_id == card.id).order_by(ProcessStep.step_order)
    )
    steps = steps_result.scalars().all()
    total_duration = sum(s.target_duration for s in steps)

    step_responses = []
    for step in steps:
        step_responses.append({
            "id": step.id,
            "process_card_id": step.process_card_id,
            "step_order": step.step_order,
            "name": step.name,
            "target_temperature": step.target_temperature,
            "target_duration": step.target_duration,
            "stirring_speed": step.stirring_speed,
            "temperature_tolerance": step.temperature_tolerance,
            "duration_tolerance": step.duration_tolerance,
            "speed_tolerance": step.speed_tolerance,
            "requires_photo": step.requires_photo,
            "notes": step.notes,
        })

    return ProcessCardResponse(
        id=card.id,
        version_id=card.version_id,
        version_number=version.version_number if version else None,
        name=card.name,
        style=card.style,
        description=card.description,
        created_by=card.created_by,
        step_count=len(steps),
        total_duration_minutes=round(total_duration / 60),
        created_at=card.created_at,
        updated_at=card.updated_at,
        steps=step_responses
    )


@router.put("/cards/{card_id}", response_model=ProcessCardResponse)
async def update_process_card(card_id: int, data: ProcessCardUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ProcessCard).where(ProcessCard.id == card_id))
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="工艺卡不存在")

    if data.name is not None:
        card.name = data.name
    if data.style is not None:
        card.style = data.style
    if data.description is not None:
        card.description = data.description
    card.updated_at = datetime.now()

    if data.steps is not None:
        delete_result = await db.execute(
            select(ProcessStep).where(ProcessStep.process_card_id == card_id)
        )
        old_steps = delete_result.scalars().all()
        for s in old_steps:
            await db.delete(s)

        for step_data in data.steps:
            step = ProcessStep(
                process_card_id=card.id,
                step_order=step_data.step_order,
                name=step_data.name,
                target_temperature=step_data.target_temperature,
                target_duration=step_data.target_duration,
                stirring_speed=step_data.stirring_speed,
                temperature_tolerance=step_data.temperature_tolerance,
                duration_tolerance=step_data.duration_tolerance,
                speed_tolerance=step_data.speed_tolerance,
                requires_photo=step_data.requires_photo,
                notes=step_data.notes
            )
            db.add(step)

    await db.commit()
    return await get_process_card(card_id, db)


@router.delete("/cards/{card_id}")
async def delete_process_card(card_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ProcessCard).where(ProcessCard.id == card_id))
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="工艺卡不存在")

    exec_count_result = await db.execute(
        select(func.count(ProcessExecution.id)).where(ProcessExecution.process_card_id == card_id)
    )
    exec_count = exec_count_result.scalar_one() or 0
    if exec_count > 0:
        raise HTTPException(status_code=400, detail="该工艺卡已有执行记录，无法删除")

    await db.delete(card)
    await db.commit()
    return {"status": "ok"}


@router.post("/executions", response_model=BatchProcessExecutionResponse, status_code=201)
async def create_process_execution(data: ProcessExecutionCreate, db: AsyncSession = Depends(get_db)):
    b_result = await db.execute(select(Batch).where(Batch.id == data.batch_id))
    batch = b_result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    c_result = await db.execute(select(ProcessCard).where(ProcessCard.id == data.process_card_id))
    card = c_result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="工艺卡不存在")

    existing_result = await db.execute(
        select(ProcessExecution).where(ProcessExecution.batch_id == data.batch_id)
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该批次已有工艺执行任务")

    steps_result = await db.execute(
        select(ProcessStep).where(ProcessStep.process_card_id == card.id).order_by(ProcessStep.step_order)
    )
    steps = steps_result.scalars().all()

    execution = ProcessExecution(
        batch_id=data.batch_id,
        process_card_id=data.process_card_id,
        operator=data.operator,
        status="pending"
    )
    db.add(execution)
    await db.flush()

    for step in steps:
        step_exec = StepExecution(
            execution_id=execution.id,
            process_step_id=step.id,
            step_order=step.step_order,
            status="pending"
        )
        db.add(step_exec)

    await db.commit()
    await db.refresh(execution)
    return await get_batch_execution(data.batch_id, db)


@router.get("/executions/batch/{batch_id}", response_model=BatchProcessExecutionResponse)
async def get_batch_execution(batch_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ProcessExecution).where(ProcessExecution.batch_id == batch_id)
    )
    execution = result.scalar_one_or_none()
    if not execution:
        raise HTTPException(status_code=404, detail="该批次尚未创建工艺执行任务")

    b_result = await db.execute(select(Batch).where(Batch.id == execution.batch_id))
    batch = b_result.scalar_one_or_none()

    c_result = await db.execute(select(ProcessCard).where(ProcessCard.id == execution.process_card_id))
    card = c_result.scalar_one_or_none()

    steps_result = await db.execute(
        select(StepExecution).where(StepExecution.execution_id == execution.id).order_by(StepExecution.step_order)
    )
    step_execs = steps_result.scalars().all()

    step_responses = []
    for se in step_execs:
        step_result = await db.execute(select(ProcessStep).where(ProcessStep.id == se.process_step_id))
        step = step_result.scalar_one_or_none()
        step_responses.append(await _build_step_execution_response(se, step))

    return BatchProcessExecutionResponse(
        id=execution.id,
        batch_id=execution.batch_id,
        batch_number=batch.batch_number if batch else "",
        process_card_id=execution.process_card_id,
        process_card_name=card.name if card else "",
        process_card_style=card.style if card else "standard",
        operator=execution.operator,
        status=execution.status,
        consistency_score=execution.consistency_score,
        total_deviation_count=execution.total_deviation_count,
        started_at=execution.started_at,
        completed_at=execution.completed_at,
        was_interrupted=execution.was_interrupted,
        interruption_reason=execution.interruption_reason,
        interrupted_at=execution.interrupted_at,
        resumed_at=execution.resumed_at,
        step_executions=step_responses
    )


@router.post("/executions/{execution_id}/steps/{step_id}/start", response_model=StepExecutionResponse)
async def start_step(execution_id: int, step_id: int, data: StartStepRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ProcessExecution).where(ProcessExecution.id == execution_id)
    )
    execution = result.scalar_one_or_none()
    if not execution:
        raise HTTPException(status_code=404, detail="执行任务不存在")
    if execution.status == "completed":
        raise HTTPException(status_code=400, detail="执行任务已完成")

    se_result = await db.execute(
        select(StepExecution).where(StepExecution.id == step_id)
    )
    step_exec = se_result.scalar_one_or_none()
    if not step_exec or step_exec.execution_id != execution_id:
        raise HTTPException(status_code=404, detail="工序执行记录不存在")

    steps_result = await db.execute(
        select(StepExecution).where(StepExecution.execution_id == execution_id).order_by(StepExecution.step_order)
    )
    all_steps = steps_result.scalars().all()

    for s in all_steps:
        if s.step_order < step_exec.step_order and s.status != "completed":
            raise HTTPException(status_code=400, detail="前序工序未完成，不能开始当前工序")

    if step_exec.status == "in_progress":
        raise HTTPException(status_code=400, detail="该工序已在进行中")
    if step_exec.status == "completed":
        raise HTTPException(status_code=400, detail="该工序已完成")

    step_exec.status = "in_progress"
    step_exec.start_time = datetime.now()

    if execution.status == "pending":
        execution.status = "in_progress"
        execution.started_at = datetime.now()
    if execution.status == "interrupted":
        execution.status = "in_progress"
        step_exec.resumed_at = datetime.now()

    await db.commit()
    await db.refresh(step_exec)

    ps_result = await db.execute(select(ProcessStep).where(ProcessStep.id == step_exec.process_step_id))
    process_step = ps_result.scalar_one_or_none()
    return await _build_step_execution_response(step_exec, process_step)


@router.post("/executions/{execution_id}/steps/{step_id}/complete", response_model=StepExecutionResponse)
async def complete_step(execution_id: int, step_id: int, data: CompleteStepRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ProcessExecution).where(ProcessExecution.id == execution_id)
    )
    execution = result.scalar_one_or_none()
    if not execution:
        raise HTTPException(status_code=404, detail="执行任务不存在")

    se_result = await db.execute(
        select(StepExecution).where(StepExecution.id == step_id)
    )
    step_exec = se_result.scalar_one_or_none()
    if not step_exec or step_exec.execution_id != execution_id:
        raise HTTPException(status_code=404, detail="工序执行记录不存在")

    if step_exec.status == "pending":
        raise HTTPException(status_code=400, detail="该工序尚未开始")
    if step_exec.status == "completed":
        raise HTTPException(status_code=400, detail="该工序已完成")

    ps_result = await db.execute(select(ProcessStep).where(ProcessStep.id == step_exec.process_step_id))
    process_step = ps_result.scalar_one_or_none()

    if process_step and process_step.requires_photo and not data.photo_url:
        raise HTTPException(status_code=400, detail="该工序要求拍照确认，请上传照片")

    deviation_details = []
    total_deduction = 0.0
    has_any_deviation = False

    if process_step:
        temp_dev, temp_detail, temp_deduct = calculate_deviation(
            process_step.target_temperature,
            data.actual_temperature,
            process_step.temperature_tolerance,
            "temperature"
        )
        if temp_dev:
            has_any_deviation = True
            deviation_details.append(temp_detail.model_dump())
            total_deduction += temp_deduct

        dur_dev, dur_detail, dur_deduct = calculate_deviation(
            process_step.target_duration,
            data.actual_duration,
            process_step.duration_tolerance,
            "duration"
        )
        if dur_dev:
            has_any_deviation = True
            deviation_details.append(dur_detail.model_dump())
            total_deduction += dur_deduct

        speed_dev, speed_detail, speed_deduct = calculate_deviation(
            process_step.stirring_speed,
            data.actual_stirring_speed,
            process_step.speed_tolerance,
            "speed"
        )
        if speed_dev:
            has_any_deviation = True
            deviation_details.append(speed_detail.model_dump())
            total_deduction += speed_deduct

    step_exec.status = "completed"
    step_exec.end_time = datetime.now()
    step_exec.actual_temperature = data.actual_temperature
    step_exec.actual_duration = data.actual_duration
    step_exec.actual_stirring_speed = data.actual_stirring_speed
    step_exec.photo_url = data.photo_url
    step_exec.remark = data.remark
    step_exec.has_deviation = has_any_deviation
    step_exec.deviation_details = deviation_details if deviation_details else None
    step_exec.deviation_deduction = round(total_deduction, 2)
    step_exec.completed_by = data.operator

    if has_any_deviation:
        execution.total_deviation_count += 1

    steps_result = await db.execute(
        select(StepExecution).where(StepExecution.execution_id == execution_id).order_by(StepExecution.step_order)
    )
    all_steps = steps_result.scalars().all()
    all_completed = all(s.status == "completed" for s in all_steps)

    if all_completed:
        execution.status = "completed"
        execution.completed_at = datetime.now()
        max_possible = len(all_steps) * 20.0
        total_deduct_all = sum(s.deviation_deduction for s in all_steps)
        if max_possible > 0:
            score = round(100.0 - (total_deduct_all / max_possible) * 100.0, 1)
            execution.consistency_score = max(0.0, min(100.0, score))

    await db.commit()
    await db.refresh(step_exec)
    return await _build_step_execution_response(step_exec, process_step)


@router.post("/executions/{execution_id}/interrupt", response_model=BatchProcessExecutionResponse)
async def interrupt_execution(execution_id: int, data: InterruptExecutionRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ProcessExecution).where(ProcessExecution.id == execution_id)
    )
    execution = result.scalar_one_or_none()
    if not execution:
        raise HTTPException(status_code=404, detail="执行任务不存在")
    if execution.status != "in_progress":
        raise HTTPException(status_code=400, detail="只有进行中的任务可以中断")

    execution.status = "interrupted"
    execution.interrupted_at = datetime.now()
    execution.interruption_reason = data.reason
    execution.was_interrupted = True

    steps_result = await db.execute(
        select(StepExecution).where(
            StepExecution.execution_id == execution_id,
            StepExecution.status == "in_progress"
        )
    )
    active_steps = steps_result.scalars().all()
    for s in active_steps:
        s.status = "interrupted"
        s.interrupted_at = datetime.now()

    await db.commit()
    return await get_batch_execution(execution.batch_id, db)


@router.post("/executions/{execution_id}/resume", response_model=BatchProcessExecutionResponse)
async def resume_execution(execution_id: int, data: ResumeExecutionRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ProcessExecution).where(ProcessExecution.id == execution_id)
    )
    execution = result.scalar_one_or_none()
    if not execution:
        raise HTTPException(status_code=404, detail="执行任务不存在")
    if execution.status != "interrupted":
        raise HTTPException(status_code=400, detail="只有中断的任务可以恢复")

    execution.status = "in_progress"
    execution.resumed_at = datetime.now()

    steps_result = await db.execute(
        select(StepExecution).where(
            StepExecution.execution_id == execution_id,
            StepExecution.status == "interrupted"
        )
    )
    interrupted_steps = steps_result.scalars().all()
    for s in interrupted_steps:
        s.status = "in_progress"
        s.resumed_at = datetime.now()

    await db.commit()
    return await get_batch_execution(execution.batch_id, db)


@router.get("/executions/batch/{batch_id}/timeline", response_model=ProcessExecutionTimelineResponse)
async def get_execution_timeline(batch_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ProcessExecution).where(ProcessExecution.batch_id == batch_id)
    )
    execution = result.scalar_one_or_none()
    if not execution:
        raise HTTPException(status_code=404, detail="该批次尚未创建工艺执行任务")

    b_result = await db.execute(select(Batch).where(Batch.id == execution.batch_id))
    batch = b_result.scalar_one_or_none()

    c_result = await db.execute(select(ProcessCard).where(ProcessCard.id == execution.process_card_id))
    card = c_result.scalar_one_or_none()

    steps_result = await db.execute(
        select(StepExecution).where(StepExecution.execution_id == execution.id).order_by(StepExecution.step_order)
    )
    step_execs = steps_result.scalars().all()

    step_responses = []
    timeline_events = []

    if execution.started_at:
        timeline_events.append(ProcessExecutionTimelineEvent(
            event_type="execution_start",
            timestamp=execution.started_at,
            description=f"工艺执行开始，操作员：{execution.operator}"
        ))

    for se in step_execs:
        ps_result = await db.execute(select(ProcessStep).where(ProcessStep.id == se.process_step_id))
        step = ps_result.scalar_one_or_none()
        step_resp = await _build_step_execution_response(se, step)
        step_responses.append(step_resp)

        if se.start_time:
            timeline_events.append(ProcessExecutionTimelineEvent(
                event_type="step_start",
                timestamp=se.start_time,
                step_order=se.step_order,
                step_name=step.name if step else f"步骤{se.step_order}",
                description=f"开始工序：{step.name if step else f'步骤{se.step_order}'}"
            ))
        if se.interrupted_at:
            timeline_events.append(ProcessExecutionTimelineEvent(
                event_type="step_interrupt",
                timestamp=se.interrupted_at,
                step_order=se.step_order,
                step_name=step.name if step else f"步骤{se.step_order}",
                description=f"工序中断：{step.name if step else f'步骤{se.step_order}'}"
            ))
        if se.resumed_at:
            timeline_events.append(ProcessExecutionTimelineEvent(
                event_type="step_resume",
                timestamp=se.resumed_at,
                step_order=se.step_order,
                step_name=step.name if step else f"步骤{se.step_order}",
                description=f"工序恢复：{step.name if step else f'步骤{se.step_order}'}"
            ))
        if se.end_time:
            extra = None
            if se.has_deviation and se.deviation_details:
                extra = {"deviations": se.deviation_details}
            timeline_events.append(ProcessExecutionTimelineEvent(
                event_type="step_complete",
                timestamp=se.end_time,
                step_order=se.step_order,
                step_name=step.name if step else f"步骤{se.step_order}",
                description=f"完成工序：{step.name if step else f'步骤{se.step_order}'}" +
                            (f"（存在工艺偏差，扣{se.deviation_deduction}分）" if se.has_deviation else ""),
                extra=extra
            ))

    if execution.interrupted_at:
        timeline_events.append(ProcessExecutionTimelineEvent(
            event_type="execution_interrupt",
            timestamp=execution.interrupted_at,
            description=f"任务中断：{execution.interruption_reason or '未说明原因'}"
        ))
    if execution.resumed_at:
        timeline_events.append(ProcessExecutionTimelineEvent(
            event_type="execution_resume",
            timestamp=execution.resumed_at,
            description=f"任务恢复执行"
        ))
    if execution.completed_at:
        timeline_events.append(ProcessExecutionTimelineEvent(
            event_type="execution_complete",
            timestamp=execution.completed_at,
            description=f"工艺执行完成，一致性评分：{execution.consistency_score or 'N/A'}分，偏差数：{execution.total_deviation_count}"
        ))

    timeline_events.sort(key=lambda e: e.timestamp)

    return ProcessExecutionTimelineResponse(
        execution_id=execution.id,
        batch_id=execution.batch_id,
        batch_number=batch.batch_number if batch else "",
        process_card_id=execution.process_card_id,
        process_card_name=card.name if card else "",
        status=execution.status,
        consistency_score=execution.consistency_score,
        total_deviation_count=execution.total_deviation_count,
        operator=execution.operator,
        started_at=execution.started_at,
        completed_at=execution.completed_at,
        was_interrupted=execution.was_interrupted,
        interruption_reason=execution.interruption_reason,
        interrupted_at=execution.interrupted_at,
        resumed_at=execution.resumed_at,
        step_executions=step_responses,
        timeline_events=timeline_events
    )


@router.get("/compare/batches/{left_batch_id}/{right_batch_id}", response_model=ProcessCompareResponse)
async def compare_batch_processes(left_batch_id: int, right_batch_id: int, db: AsyncSession = Depends(get_db)):
    left_exec = await _get_execution_by_batch(left_batch_id, db)
    right_exec = await _get_execution_by_batch(right_batch_id, db)

    if not left_exec:
        raise HTTPException(status_code=404, detail=f"批次{left_batch_id}无工艺执行记录")
    if not right_exec:
        raise HTTPException(status_code=404, detail=f"批次{right_batch_id}无工艺执行记录")

    left_batch = (await db.execute(select(Batch).where(Batch.id == left_batch_id))).scalar_one_or_none()
    right_batch = (await db.execute(select(Batch).where(Batch.id == right_batch_id))).scalar_one_or_none()

    left_steps_result = await db.execute(
        select(StepExecution).where(StepExecution.execution_id == left_exec.id).order_by(StepExecution.step_order)
    )
    left_step_execs = left_steps_result.scalars().all()

    right_steps_result = await db.execute(
        select(StepExecution).where(StepExecution.execution_id == right_exec.id).order_by(StepExecution.step_order)
    )
    right_step_execs = right_steps_result.scalars().all()

    max_steps = max(len(left_step_execs), len(right_step_execs))
    step_diffs = []
    significant_diff_steps = set()

    total_params_diff = 0
    total_params_compared = 0
    temp_diff_count = 0
    dur_diff_count = 0
    speed_diff_count = 0

    for i in range(max_steps):
        left_se = left_step_execs[i] if i < len(left_step_execs) else None
        right_se = right_step_execs[i] if i < len(right_step_execs) else None

        left_step = None
        right_step = None
        step_name = f"步骤{i+1}"
        if left_se:
            result = await db.execute(select(ProcessStep).where(ProcessStep.id == left_se.process_step_id))
            left_step = result.scalar_one_or_none()
            if left_step:
                step_name = left_step.name
        elif right_se:
            result = await db.execute(select(ProcessStep).where(ProcessStep.id == right_se.process_step_id))
            right_step = result.scalar_one_or_none()
            if right_step:
                step_name = right_step.name

        for param_name, field, target_field in [
            ("temperature", "actual_temperature", "target_temperature"),
            ("duration", "actual_duration", "target_duration"),
            ("speed", "actual_stirring_speed", "stirring_speed")
        ]:
            left_val = getattr(left_se, field) if left_se else None
            right_val = getattr(right_se, field) if right_se else None
            target_val = None
            if left_step:
                target_val = getattr(left_step, target_field)

            has_diff = False
            diff_level = None
            difference = None

            if left_val is not None and right_val is not None:
                total_params_compared += 1
                difference = abs(left_val - right_val)
                if param_name == "temperature" and difference > 2:
                    has_diff = True
                    temp_diff_count += 1
                    diff_level = "significant" if difference > 5 else "minor"
                elif param_name == "duration" and difference > 300:
                    has_diff = True
                    dur_diff_count += 1
                    diff_level = "significant" if difference > 600 else "minor"
                elif param_name == "speed" and difference > 50:
                    has_diff = True
                    speed_diff_count += 1
                    diff_level = "significant" if difference > 100 else "minor"

            if has_diff:
                total_params_diff += 1
                if diff_level == "significant":
                    significant_diff_steps.add(i + 1)

            step_diffs.append(BatchStepDiff(
                step_order=i + 1,
                step_name=step_name,
                parameter=param_name,
                left_value=left_val,
                right_value=right_val,
                target_value=target_val,
                difference=difference,
                has_diff=has_diff,
                diff_level=diff_level
            ))

    diff_rate = round(total_params_diff / total_params_compared * 100, 1) if total_params_compared > 0 else 0

    summary = {
        "total_steps_left": len(left_step_execs),
        "total_steps_right": len(right_step_execs),
        "total_parameters_compared": total_params_compared,
        "total_parameters_different": total_params_diff,
        "difference_rate_percentage": diff_rate,
        "temperature_differences": temp_diff_count,
        "duration_differences": dur_diff_count,
        "speed_differences": speed_diff_count,
        "consistency_score_diff": round((left_exec.consistency_score or 0) - (right_exec.consistency_score or 0), 1),
        "deviation_count_diff": left_exec.total_deviation_count - right_exec.total_deviation_count
    }

    return ProcessCompareResponse(
        left_batch_id=left_batch_id,
        left_batch_number=left_batch.batch_number if left_batch else "",
        right_batch_id=right_batch_id,
        right_batch_number=right_batch.batch_number if right_batch else "",
        left_consistency_score=left_exec.consistency_score,
        right_consistency_score=right_exec.consistency_score,
        left_deviation_count=left_exec.total_deviation_count,
        right_deviation_count=right_exec.total_deviation_count,
        left_status=left_exec.status,
        right_status=right_exec.status,
        step_diffs=step_diffs,
        summary=summary,
        significant_diff_steps=sorted(list(significant_diff_steps))
    )


async def _get_execution_by_batch(batch_id: int, db: AsyncSession):
    result = await db.execute(
        select(ProcessExecution).where(ProcessExecution.batch_id == batch_id)
    )
    return result.scalar_one_or_none()


@router.get("/executions/product-line/{product_line_id}", response_model=list[BatchProcessExecutionResponse])
async def list_executions_by_product_line(product_line_id: int, db: AsyncSession = Depends(get_db)):
    version_result = await db.execute(
        select(FormulaVersion.id).where(FormulaVersion.product_line_id == product_line_id)
    )
    version_ids = [row[0] for row in version_result.all()]
    if not version_ids:
        return []

    batch_result = await db.execute(
        select(Batch.id).where(Batch.version_id.in_(version_ids))
    )
    batch_ids = [row[0] for row in batch_result.all()]
    if not batch_ids:
        return []

    exec_result = await db.execute(
        select(ProcessExecution).where(ProcessExecution.batch_id.in_(batch_ids))
    )
    executions = exec_result.scalars().all()

    responses = []
    for exec in executions:
        responses.append(await get_batch_execution(exec.batch_id, db))
    return responses
