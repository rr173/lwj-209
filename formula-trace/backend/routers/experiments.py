from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime
from database import get_db
from models import (
    ExperimentPlan,
    ExperimentVersionLink,
    ExperimentBatchLink,
    FormulaVersion,
    ProductLine,
    Batch,
    IngredientInventory,
    InventoryTransaction,
)
from schemas import (
    ExperimentCreate,
    ExperimentUpdateWeights,
    ExperimentListItem,
    ExperimentDetailResponse,
    ExperimentVersionDetail,
    ExperimentBatchLinkItem,
    ExperimentLinkBatchRequest,
    ExperimentCreateBatchRequest,
    ExperimentUnlinkBatchRequest,
    ExperimentComparisonResponse,
    ExperimentVersionScore,
    ExperimentPairDiff,
    BatchResponse,
)

router = APIRouter(prefix="/api/experiments", tags=["experiments"])


STATUS_FLOW = {
    "planning": "ongoing",
    "ongoing": "completed",
}


def get_experiment_status_label(status: str) -> str:
    labels = {
        "planning": "规划中",
        "ongoing": "进行中",
        "completed": "已完成",
    }
    return labels.get(status, status)


def generate_batch_number(version_id: int, count: int) -> str:
    timestamp = datetime.now().strftime("%Y%m%d")
    return f"B{version_id:04d}-{timestamp}-{count+1:03d}"


def get_ingredients_summary(ingredients: list) -> str:
    names = [ing["name"] for ing in ingredients[:3]]
    summary = "、".join(names)
    if len(ingredients) > 3:
        summary += f"等{len(ingredients)}种成分"
    return summary


def compute_version_metrics(tested_batches: list[Batch]):
    if not tested_batches:
        return None, None, None
    skin_feels = [b.skin_feel_score for b in tested_batches if b.skin_feel_score is not None]
    stabilities = [b.stability_score for b in tested_batches if b.stability_score is not None]
    costs = [b.cost_per_kg for b in tested_batches if b.cost_per_kg is not None]
    if not skin_feels or not stabilities or not costs:
        return None, None, None
    avg_skin = round(sum(skin_feels) / len(skin_feels), 4)
    avg_stab = round(sum(stabilities) / len(stabilities), 4)
    avg_cost = sum(costs) / len(costs)
    return avg_skin, avg_stab, avg_cost


async def build_experiment_detail(
    experiment: ExperimentPlan,
    db: AsyncSession,
) -> ExperimentDetailResponse:
    versions_detail: list[ExperimentVersionDetail] = []
    all_tested_costs: list[float] = []

    for vl in experiment.version_links:
        batch_items: list[ExperimentBatchLinkItem] = []
        tested_batches: list[Batch] = []

        for bl in vl.batch_links:
            batch = bl.batch
            has_result = batch.has_test_result
            batch_items.append(
                ExperimentBatchLinkItem(
                    id=bl.id,
                    batch_id=batch.id,
                    batch_number=batch.batch_number,
                    production_date=batch.production_date,
                    skin_feel_score=batch.skin_feel_score,
                    stability_score=batch.stability_score,
                    cost_per_kg=batch.cost_per_kg,
                    has_test_result=has_result,
                )
            )
            if has_result and batch.cost_per_kg is not None:
                tested_batches.append(batch)
                all_tested_costs.append(batch.cost_per_kg)

        avg_skin, avg_stab, avg_cost_raw = compute_version_metrics(tested_batches)
        avg_cost_norm = None
        if avg_cost_raw is not None and all_tested_costs:
            min_cost = min(all_tested_costs)
            max_cost = max(all_tested_costs)
            if max_cost > min_cost:
                avg_cost_norm = round(1.0 - (avg_cost_raw - min_cost) / (max_cost - min_cost), 4)
            else:
                avg_cost_norm = 1.0

        versions_detail.append(
            ExperimentVersionDetail(
                link_id=vl.id,
                version_id=vl.version_id,
                version_number=vl.version.version_number,
                ingredients_summary=get_ingredients_summary(vl.version.ingredients),
                batch_count=vl.batch_count,
                tested_batch_count=len(tested_batches),
                avg_skin_feel=avg_skin,
                avg_stability=avg_stab,
                avg_cost_normalized=avg_cost_norm,
                batches=batch_items,
            )
        )

    return ExperimentDetailResponse(
        id=experiment.id,
        name=experiment.name,
        purpose=experiment.purpose,
        product_line_id=experiment.product_line_id,
        product_line_name=experiment.product_line.name if experiment.product_line else "",
        status=experiment.status,
        skin_feel_weight=experiment.skin_feel_weight,
        stability_weight=experiment.stability_weight,
        cost_weight=experiment.cost_weight,
        created_at=experiment.created_at,
        started_at=experiment.started_at,
        completed_at=experiment.completed_at,
        versions=versions_detail,
    )


@router.post("", response_model=ExperimentDetailResponse, status_code=201)
async def create_experiment(data: ExperimentCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(ExperimentPlan).where(ExperimentPlan.name == data.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="实验名称已存在，请使用其他名称")

    version_result = await db.execute(
        select(FormulaVersion).where(FormulaVersion.id.in_(data.version_ids))
    )
    versions = {v.id: v for v in version_result.scalars().all()}

    if len(versions) != len(data.version_ids):
        missing = [vid for vid in data.version_ids if vid not in versions]
        raise HTTPException(status_code=400, detail=f"以下配方版本不存在: {missing}")

    product_line_ids = set()
    for vid in data.version_ids:
        v = versions[vid]
        if v.approval_status != "published":
            raise HTTPException(
                status_code=400,
                detail=f"配方版本 #{v.version_number} 未发布，不能纳入实验",
            )
        product_line_ids.add(v.product_line_id)

    if len(product_line_ids) > 1:
        raise HTTPException(status_code=400, detail="纳入实验的配方版本必须属于同一产品线")

    product_line_id = list(product_line_ids)[0]

    experiment = ExperimentPlan(
        name=data.name,
        purpose=data.purpose,
        product_line_id=product_line_id,
        status="planning",
        skin_feel_weight=data.skin_feel_weight,
        stability_weight=data.stability_weight,
        cost_weight=data.cost_weight,
    )
    db.add(experiment)
    await db.flush()

    for vid in data.version_ids:
        link = ExperimentVersionLink(
            experiment_id=experiment.id,
            version_id=vid,
        )
        db.add(link)

    await db.commit()
    await db.refresh(experiment)

    return await build_experiment_detail(experiment, db)


@router.get("", response_model=list[ExperimentListItem])
async def list_experiments(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ExperimentPlan).order_by(ExperimentPlan.created_at.desc())
    )
    experiments = result.scalars().all()

    items = []
    for exp in experiments:
        pl_result = await db.execute(
            select(ProductLine).where(ProductLine.id == exp.product_line_id)
        )
        pl = pl_result.scalar_one_or_none()
        items.append(
            ExperimentListItem(
                id=exp.id,
                name=exp.name,
                status=exp.status,
                version_count=exp.version_count,
                product_line_id=exp.product_line_id,
                product_line_name=pl.name if pl else "",
                created_at=exp.created_at,
            )
        )
    return items


@router.get("/{experiment_id}", response_model=ExperimentDetailResponse)
async def get_experiment(experiment_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ExperimentPlan).where(ExperimentPlan.id == experiment_id)
    )
    experiment = result.scalar_one_or_none()
    if not experiment:
        raise HTTPException(status_code=404, detail="实验计划不存在")
    return await build_experiment_detail(experiment, db)


@router.put("/{experiment_id}/weights", response_model=ExperimentDetailResponse)
async def update_experiment_weights(
    experiment_id: int,
    data: ExperimentUpdateWeights,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ExperimentPlan).where(ExperimentPlan.id == experiment_id)
    )
    experiment = result.scalar_one_or_none()
    if not experiment:
        raise HTTPException(status_code=404, detail="实验计划不存在")

    if experiment.status == "ongoing":
        raise HTTPException(status_code=400, detail="实验进行中，不可修改评估指标权重")
    if experiment.status == "completed":
        raise HTTPException(status_code=400, detail="实验已完成，不可修改评估指标权重")

    experiment.skin_feel_weight = data.skin_feel_weight
    experiment.stability_weight = data.stability_weight
    experiment.cost_weight = data.cost_weight

    await db.commit()
    await db.refresh(experiment)
    return await build_experiment_detail(experiment, db)


@router.post("/{experiment_id}/start", response_model=ExperimentDetailResponse)
async def start_experiment(experiment_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ExperimentPlan).where(ExperimentPlan.id == experiment_id)
    )
    experiment = result.scalar_one_or_none()
    if not experiment:
        raise HTTPException(status_code=404, detail="实验计划不存在")

    if experiment.status != "planning":
        raise HTTPException(
            status_code=400,
            detail=f"当前状态为「{get_experiment_status_label(experiment.status)}」，无法启动实验",
        )

    experiment.status = "ongoing"
    experiment.started_at = datetime.now()

    await db.commit()
    await db.refresh(experiment)
    return await build_experiment_detail(experiment, db)


@router.post("/{experiment_id}/complete", response_model=ExperimentDetailResponse)
async def complete_experiment(experiment_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ExperimentPlan).where(ExperimentPlan.id == experiment_id)
    )
    experiment = result.scalar_one_or_none()
    if not experiment:
        raise HTTPException(status_code=404, detail="实验计划不存在")

    if experiment.status != "ongoing":
        raise HTTPException(
            status_code=400,
            detail=f"当前状态为「{get_experiment_status_label(experiment.status)}」，无法完成实验",
        )

    for vl in experiment.version_links:
        tested_count = sum(
            1 for bl in vl.batch_links if bl.batch and bl.batch.has_test_result
        )
        if tested_count < 1:
            raise HTTPException(
                status_code=400,
                detail=f"配方版本 #{vl.version.version_number} 还没有已检测的批次，不能完成实验",
            )

    experiment.status = "completed"
    experiment.completed_at = datetime.now()

    await db.commit()
    await db.refresh(experiment)
    return await build_experiment_detail(experiment, db)


@router.post("/{experiment_id}/link-batch", response_model=ExperimentDetailResponse)
async def link_batch_to_experiment(
    experiment_id: int,
    data: ExperimentLinkBatchRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ExperimentPlan).where(ExperimentPlan.id == experiment_id)
    )
    experiment = result.scalar_one_or_none()
    if not experiment:
        raise HTTPException(status_code=404, detail="实验计划不存在")

    if experiment.status == "completed":
        raise HTTPException(status_code=400, detail="实验已完成，不能再关联批次")

    vl_result = await db.execute(
        select(ExperimentVersionLink).where(
            ExperimentVersionLink.experiment_id == experiment_id,
            ExperimentVersionLink.version_id == data.version_id,
        )
    )
    version_link = vl_result.scalar_one_or_none()
    if not version_link:
        raise HTTPException(status_code=404, detail="该配方版本不在此实验中")

    batch_result = await db.execute(select(Batch).where(Batch.id == data.batch_id))
    batch = batch_result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    if batch.version_id != data.version_id:
        raise HTTPException(status_code=400, detail="该批次不属于指定的配方版本")

    existing_link = await db.execute(
        select(ExperimentBatchLink).where(
            ExperimentBatchLink.experiment_version_link_id == version_link.id,
            ExperimentBatchLink.batch_id == data.batch_id,
        )
    )
    if existing_link.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该批次已经关联到此实验版本")

    link = ExperimentBatchLink(
        experiment_version_link_id=version_link.id,
        batch_id=data.batch_id,
    )
    db.add(link)
    await db.commit()
    await db.refresh(experiment)
    return await build_experiment_detail(experiment, db)


@router.post("/{experiment_id}/unlink-batch", response_model=ExperimentDetailResponse)
async def unlink_batch_from_experiment(
    experiment_id: int,
    data: ExperimentUnlinkBatchRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ExperimentPlan).where(ExperimentPlan.id == experiment_id)
    )
    experiment = result.scalar_one_or_none()
    if not experiment:
        raise HTTPException(status_code=404, detail="实验计划不存在")

    if experiment.status == "completed":
        raise HTTPException(status_code=400, detail="实验已完成，不能取消关联批次")

    vl_result = await db.execute(
        select(ExperimentVersionLink).where(
            ExperimentVersionLink.experiment_id == experiment_id,
            ExperimentVersionLink.version_id == data.version_id,
        )
    )
    version_link = vl_result.scalar_one_or_none()
    if not version_link:
        raise HTTPException(status_code=404, detail="该配方版本不在此实验中")

    link_result = await db.execute(
        select(ExperimentBatchLink).where(
            ExperimentBatchLink.experiment_version_link_id == version_link.id,
            ExperimentBatchLink.batch_id == data.batch_id,
        )
    )
    batch_link = link_result.scalar_one_or_none()
    if not batch_link:
        raise HTTPException(status_code=404, detail="该批次未关联到此实验版本")

    await db.delete(batch_link)
    await db.commit()
    await db.refresh(experiment)
    return await build_experiment_detail(experiment, db)


@router.post("/{experiment_id}/create-batch", response_model=BatchResponse, status_code=201)
async def create_batch_in_experiment(
    experiment_id: int,
    data: ExperimentCreateBatchRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ExperimentPlan).where(ExperimentPlan.id == experiment_id)
    )
    experiment = result.scalar_one_or_none()
    if not experiment:
        raise HTTPException(status_code=404, detail="实验计划不存在")

    if experiment.status == "completed":
        raise HTTPException(status_code=400, detail="实验已完成，不能创建新批次")

    vl_result = await db.execute(
        select(ExperimentVersionLink).where(
            ExperimentVersionLink.experiment_id == experiment_id,
            ExperimentVersionLink.version_id == data.version_id,
        )
    )
    version_link = vl_result.scalar_one_or_none()
    if not version_link:
        raise HTTPException(status_code=404, detail="该配方版本不在此实验中")

    version = version_link.version
    if version.approval_status != "published":
        raise HTTPException(status_code=400, detail=f"只有已发布的版本才能创建试产批次")

    consumption_map: dict[str, float] = {}
    for ing in version.ingredients:
        consumption = data.production_amount * (ing["percentage"] / 100.0)
        consumption_map[ing["name"]] = consumption

    inventory_map: dict[str, IngredientInventory] = {}
    missing_ingredients: list[str] = []
    for ing_name, qty in consumption_map.items():
        inv_result = await db.execute(
            select(IngredientInventory).where(IngredientInventory.ingredient_name == ing_name)
        )
        inventory = inv_result.scalar_one_or_none()
        if not inventory:
            missing_ingredients.append(ing_name)
        elif inventory.current_quantity < qty:
            raise HTTPException(
                status_code=400,
                detail=f"原料「{ing_name}」库存不足：当前库存 {inventory.current_quantity:.4f} kg，需要 {qty:.4f} kg",
            )
        else:
            inventory_map[ing_name] = inventory

    if missing_ingredients:
        raise HTTPException(
            status_code=400,
            detail=f"以下原料未录入库存，请先在库存管理中添加：{', '.join(missing_ingredients)}",
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
        production_amount=data.production_amount,
    )
    db.add(batch)
    await db.flush()

    batch_link = ExperimentBatchLink(
        experiment_version_link_id=version_link.id,
        batch_id=batch.id,
    )
    db.add(batch_link)

    for ing_name, qty in consumption_map.items():
        inventory = inventory_map[ing_name]
        inventory.current_quantity -= qty
        transaction = InventoryTransaction(
            inventory_id=inventory.id,
            transaction_type="stock_out",
            quantity=qty,
            batch_number=batch_number,
            remark=f"实验「{experiment.name}」试产批次 {batch_number} 生产消耗",
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
        overall_score=None,
    )


@router.get("/{experiment_id}/available-batches/{version_id}", response_model=list[BatchResponse])
async def get_available_batches(
    experiment_id: int,
    version_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ExperimentPlan).where(ExperimentPlan.id == experiment_id)
    )
    experiment = result.scalar_one_or_none()
    if not experiment:
        raise HTTPException(status_code=404, detail="实验计划不存在")

    vl_result = await db.execute(
        select(ExperimentVersionLink).where(
            ExperimentVersionLink.experiment_id == experiment_id,
            ExperimentVersionLink.version_id == version_id,
        )
    )
    version_link = vl_result.scalar_one_or_none()
    if not version_link:
        raise HTTPException(status_code=404, detail="该配方版本不在此实验中")

    linked_batch_ids = [bl.batch_id for bl in version_link.batch_links]

    batch_result = await db.execute(
        select(Batch).where(Batch.version_id == version_id)
    )
    all_batches = batch_result.scalars().all()

    available = [b for b in all_batches if b.id not in linked_batch_ids]

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
            overall_score=b.overall_score,
        )
        for b in available
    ]


@router.get("/{experiment_id}/comparison", response_model=ExperimentComparisonResponse)
async def get_experiment_comparison(
    experiment_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ExperimentPlan).where(ExperimentPlan.id == experiment_id)
    )
    experiment = result.scalar_one_or_none()
    if not experiment:
        raise HTTPException(status_code=404, detail="实验计划不存在")

    all_tested_batches_map: dict[int, list[Batch]] = {}
    all_costs: list[float] = []

    for vl in experiment.version_links:
        tested: list[Batch] = []
        for bl in vl.batch_links:
            if bl.batch and bl.batch.has_test_result:
                tested.append(bl.batch)
                if bl.batch.cost_per_kg is not None:
                    all_costs.append(bl.batch.cost_per_kg)
        all_tested_batches_map[vl.version_id] = tested

    for vid, batches in all_tested_batches_map.items():
        if len(batches) < 1:
            vl_result = await db.execute(
                select(ExperimentVersionLink).where(
                    ExperimentVersionLink.experiment_id == experiment_id,
                    ExperimentVersionLink.version_id == vid,
                )
            )
            vl = vl_result.scalar_one_or_none()
            vnum = vl.version.version_number if vl else vid
            raise HTTPException(
                status_code=400,
                detail=f"配方版本 #{vnum} 还没有已检测的批次，无法进行对比分析",
            )

    min_cost = min(all_costs) if all_costs else 1.0
    max_cost = max(all_costs) if all_costs else 1.0

    version_scores: list[ExperimentVersionScore] = []
    score_map: dict[int, float] = {}

    for vl in experiment.version_links:
        batches = all_tested_batches_map[vl.version_id]
        avg_skin, avg_stab, avg_cost_raw = compute_version_metrics(batches)

        if avg_cost_raw is not None and max_cost > min_cost:
            avg_cost_norm = round(1.0 - (avg_cost_raw - min_cost) / (max_cost - min_cost), 4)
        elif avg_cost_raw is not None:
            avg_cost_norm = 1.0
        else:
            avg_cost_norm = 0.0

        composite = round(
            (avg_skin or 0) * experiment.skin_feel_weight
            + (avg_stab or 0) * experiment.stability_weight
            + avg_cost_norm * experiment.cost_weight,
            4,
        )
        score_map[vl.version_id] = composite

        version_scores.append(
            ExperimentVersionScore(
                version_id=vl.version_id,
                version_number=vl.version.version_number,
                ingredients_summary=get_ingredients_summary(vl.version.ingredients),
                avg_skin_feel=avg_skin or 0,
                avg_stability=avg_stab or 0,
                avg_cost_normalized=avg_cost_norm,
                composite_score=composite,
                rank=0,
                is_recommended=False,
            )
        )

    version_scores.sort(key=lambda x: x.composite_score, reverse=True)
    for i, vs in enumerate(version_scores):
        vs.rank = i + 1
    if version_scores:
        version_scores[0].is_recommended = True
        recommended_id = version_scores[0].version_id
        recommended_num = version_scores[0].version_number
    else:
        recommended_id = 0
        recommended_num = 0

    max_possible_score = 10.0
    significance_threshold = round(max_possible_score * 0.1, 4)

    pairwise_diffs: list[ExperimentPairDiff] = []
    for i in range(len(version_scores)):
        for j in range(i + 1, len(version_scores)):
            a = version_scores[i]
            b = version_scores[j]
            delta = round(abs(a.composite_score - b.composite_score), 4)
            delta_pct = round(delta / max_possible_score * 100, 2)
            is_sig = delta > significance_threshold
            pairwise_diffs.append(
                ExperimentPairDiff(
                    version_a_id=a.version_id,
                    version_a_number=a.version_number,
                    version_b_id=b.version_id,
                    version_b_number=b.version_number,
                    score_delta=delta,
                    score_delta_percentage=delta_pct,
                    is_significant=is_sig,
                    significance_label="显著差异" if is_sig else "无显著差异",
                )
            )

    return ExperimentComparisonResponse(
        experiment_id=experiment.id,
        experiment_name=experiment.name,
        skin_feel_weight=experiment.skin_feel_weight,
        stability_weight=experiment.stability_weight,
        cost_weight=experiment.cost_weight,
        max_possible_score=max_possible_score,
        significance_threshold=significance_threshold,
        version_scores=version_scores,
        pairwise_diffs=pairwise_diffs,
        recommended_version_id=recommended_id,
        recommended_version_number=recommended_num,
    )
