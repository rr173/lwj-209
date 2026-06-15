from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import FormulaVersion, ProductLine, Batch, ExclusionGroup
from schemas import (
    IngredientTrendResponse,
    IngredientTrendRecord,
    FormulaRecommendationResponse,
    RecommendedIngredient,
)
from utils import compute_batch_scores, pearson_correlation

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def topological_sort_versions(versions: list[FormulaVersion]) -> list[FormulaVersion]:
    version_map = {v.id: v for v in versions}
    in_degree = {v.id: 0 for v in versions}
    for v in versions:
        if v.parent_id and v.parent_id in version_map:
            in_degree[v.id] += 1
    queue = [v.id for v in versions if in_degree[v.id] == 0]
    result = []
    while queue:
        queue.sort(key=lambda vid: version_map[vid].version_number)
        vid = queue.pop(0)
        result.append(version_map[vid])
        for v in versions:
            if v.parent_id == vid:
                in_degree[v.id] -= 1
                if in_degree[v.id] == 0:
                    queue.append(v.id)
    return result


@router.get("/ingredient-trend", response_model=IngredientTrendResponse)
async def get_ingredient_trend(
    product_line_id: int,
    ingredient_name: str,
    db: AsyncSession = Depends(get_db)
):
    pl_result = await db.execute(select(ProductLine).where(ProductLine.id == product_line_id))
    if not pl_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="产品线不存在")

    versions_result = await db.execute(
        select(FormulaVersion).where(FormulaVersion.product_line_id == product_line_id)
    )
    all_versions = versions_result.scalars().all()

    all_batches_result = await db.execute(
        select(Batch).where(
            Batch.version_id.in_([v.id for v in all_versions]),
            Batch.skin_feel_score.isnot(None),
            Batch.stability_score.isnot(None),
            Batch.cost_per_kg.isnot(None)
        )
    )
    all_batches = all_batches_result.scalars().all()
    score_map, _, _ = compute_batch_scores(all_batches)

    version_batches = {}
    for b in all_batches:
        version_batches.setdefault(b.version_id, []).append(b)

    version_best_score = {}
    for v in all_versions:
        vb = version_batches.get(v.id, [])
        scores = [score_map.get(b.id) for b in vb if b.id in score_map]
        if scores:
            version_best_score[v.id] = max(scores)

    sorted_versions = topological_sort_versions(all_versions)

    records = []
    percentages = []
    scores = []
    for v in sorted_versions:
        if v.id not in version_best_score:
            continue
        ing_map = {ing["name"]: ing["percentage"] for ing in v.ingredients}
        pct = ing_map.get(ingredient_name, 0.0)
        score = version_best_score[v.id]
        records.append(IngredientTrendRecord(
            version_number=v.version_number,
            version_id=v.id,
            percentage=pct,
            best_batch_score=score
        ))
        percentages.append(pct)
        scores.append(score)

    correlation = pearson_correlation(percentages, scores) if len(percentages) >= 3 else None
    is_strong = correlation is not None and abs(correlation) > 0.5

    return IngredientTrendResponse(
        product_line_id=product_line_id,
        ingredient_name=ingredient_name,
        records=records,
        pearson_correlation=correlation,
        is_strong_correlation=is_strong,
        data_point_count=len(records)
    )


@router.get("/recommend-formula", response_model=FormulaRecommendationResponse)
async def recommend_formula(
    product_line_id: int,
    db: AsyncSession = Depends(get_db)
):
    pl_result = await db.execute(select(ProductLine).where(ProductLine.id == product_line_id))
    if not pl_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="产品线不存在")

    versions_result = await db.execute(
        select(FormulaVersion).where(FormulaVersion.product_line_id == product_line_id)
    )
    all_versions = versions_result.scalars().all()

    all_batches_result = await db.execute(
        select(Batch).where(
            Batch.version_id.in_([v.id for v in all_versions]),
            Batch.skin_feel_score.isnot(None),
            Batch.stability_score.isnot(None),
            Batch.cost_per_kg.isnot(None)
        )
    )
    all_batches = all_batches_result.scalars().all()
    score_map, _, _ = compute_batch_scores(all_batches)

    version_batches = {}
    for b in all_batches:
        version_batches.setdefault(b.version_id, []).append(b)

    version_best_score = {}
    for v in all_versions:
        vb = version_batches.get(v.id, [])
        scores = [score_map.get(b.id) for b in vb if b.id in score_map]
        if scores:
            version_best_score[v.id] = max(scores)

    if len(version_best_score) < 3:
        raise HTTPException(
            status_code=400,
            detail=f"有效数据点不足（需要至少3个有检测结果的版本，当前仅有{len(version_best_score)}个）"
        )

    best_vid = max(version_best_score, key=lambda vid: version_best_score[vid])
    best_version = next((v for v in all_versions if v.id == best_vid), None)
    if best_version is None:
        raise HTTPException(status_code=404, detail="未找到最优版本")

    exclusion_result = await db.execute(
        select(ExclusionGroup).where(ExclusionGroup.product_line_id == product_line_id)
    )
    exclusion_groups = exclusion_result.scalars().all()

    sorted_versions = topological_sort_versions(all_versions)
    versions_with_scores = [v for v in sorted_versions if v.id in version_best_score]

    all_ingredient_names = set()
    for v in all_versions:
        for ing in v.ingredients:
            all_ingredient_names.add(ing["name"])

    base_ingredients = {ing["name"]: ing["percentage"] for ing in best_version.ingredients}

    correlations = {}
    for ing_name in all_ingredient_names:
        percentages = []
        scores = []
        for v in versions_with_scores:
            ing_map = {ing["name"]: ing["percentage"] for ing in v.ingredients}
            pct = ing_map.get(ing_name, 0.0)
            percentages.append(pct)
            scores.append(version_best_score[v.id])
        corr = pearson_correlation(percentages, scores)
        correlations[ing_name] = corr

    adjustments = {}
    notes = []
    final_ingredients = dict(base_ingredients)

    for ing_name, corr in correlations.items():
        if corr is None or abs(corr) <= 0.5:
            continue
        abs_corr = abs(corr)
        delta_pct = 1 + 2 * (abs_corr - 0.5) / 0.5
        delta_pct = max(1.0, min(3.0, delta_pct))
        if corr > 0:
            direction = 1
        else:
            direction = -1

        original_pct = base_ingredients.get(ing_name, 0.0)
        tentative_pct = round(original_pct + direction * delta_pct, 2)
        tentative_pct = max(0.0, min(100.0, tentative_pct))

        test_names = list(final_ingredients.keys())
        if tentative_pct > 0 and ing_name not in test_names:
            test_names.append(ing_name)

        conflicts = []
        if tentative_pct > 0:
            for group in exclusion_groups:
                found = []
                if ing_name in group.ingredients:
                    for other_ing in group.ingredients:
                        if other_ing == ing_name:
                            continue
                        if final_ingredients.get(other_ing, 0) > 0 or (tentative_pct > 0 and other_ing == ing_name):
                            found.append(other_ing)
                    if ing_name in group.ingredients and tentative_pct > 0:
                        all_in_group = [n for n in group.ingredients if final_ingredients.get(n, 0) > 0]
                        if ing_name in all_in_group:
                            pass
                        else:
                            in_final = [n for n in group.ingredients if final_ingredients.get(n, 0) > 0]
                            if len(in_final) >= 1 and tentative_pct > 0:
                                conflicts.append({
                                    "group_name": group.name,
                                    "conflicts_with": in_final
                                })

        if conflicts:
            conflict_names = ", ".join([f"{c['group_name']}({', '.join(c['conflicts_with'])})" for c in conflicts])
            notes.append(f"成分「{ing_name}」调整因互斥冲突被跳过：{conflict_names}")
            adjustments[ing_name] = {
                "adjustment": "不变",
                "delta": 0.0,
                "correlation": corr,
                "reason": f"互斥冲突，跳过调整，相关系数={corr:.4f}"
            }
            continue

        adjustments[ing_name] = {
            "adjustment": "涨" if direction > 0 else "降",
            "delta": round(direction * delta_pct, 2),
            "correlation": corr,
            "reason": f"{'强正相关' if corr > 0 else '强负相关'}，相关系数={corr:.4f}，{'增加' if direction > 0 else '减少'}{delta_pct:.2f}%"
        }
        if tentative_pct > 0 or ing_name in final_ingredients:
            final_ingredients[ing_name] = tentative_pct

    total = sum(v for v in final_ingredients.values() if v > 0)
    if abs(total) < 0.0001:
        raise HTTPException(status_code=400, detail="调整后成分总和为0，无法归一化")

    normalized = {}
    for name, pct in final_ingredients.items():
        if pct > 0:
            normalized[name] = round(pct * 100.0 / total, 2)
        else:
            normalized[name] = 0.0

    non_zero_normalized = {k: v for k, v in normalized.items() if v > 0}
    rounding_diff = round(100.0 - sum(non_zero_normalized.values()), 2)
    if abs(rounding_diff) > 0 and non_zero_normalized:
        max_name = max(non_zero_normalized, key=lambda k: non_zero_normalized[k])
        normalized[max_name] = round(normalized[max_name] + rounding_diff, 2)

    all_names = set()
    for name in base_ingredients.keys():
        all_names.add(name)
    for name in normalized.keys():
        all_names.add(name)
    for name in adjustments.keys():
        all_names.add(name)

    recommended = []
    for name in sorted(all_names):
        orig_pct = base_ingredients.get(name, 0.0)
        rec_pct = normalized.get(name, 0.0)
        if name in adjustments:
            adj_info = adjustments[name]
            adjustment = adj_info["adjustment"]
            corr = adj_info["correlation"]
            reason = adj_info["reason"]
            if rec_pct == 0 and orig_pct > 0:
                adjustment = "移除"
                reason = adj_info["reason"] + "，已从配方中移除"
        else:
            diff = round(rec_pct - orig_pct, 2)
            if rec_pct == 0 and orig_pct > 0:
                adjustment = "移除"
                reason = f"归一化调整，从配方中移除（原占比{orig_pct:.2f}%）"
            elif abs(diff) < 0.01:
                adjustment = "不变"
                reason = "无显著相关性，保持不变"
            elif diff > 0:
                adjustment = "涨"
                reason = f"归一化调整，增加{diff:.2f}%"
            else:
                adjustment = "降"
                reason = f"归一化调整，减少{abs(diff):.2f}%"
            corr = correlations.get(name)

        recommended.append(RecommendedIngredient(
            name=name,
            original_percentage=orig_pct,
            recommended_percentage=rec_pct,
            adjustment=adjustment,
            correlation=corr,
            reason=reason
        ))

    return FormulaRecommendationResponse(
        product_line_id=product_line_id,
        base_version_id=best_version.id,
        base_version_number=best_version.version_number,
        base_version_score=version_best_score[best_version.id],
        recommended_ingredients=recommended,
        notes=notes
    )


@router.get("/product-line-ingredients")
async def get_product_line_ingredients(
    product_line_id: int,
    db: AsyncSession = Depends(get_db)
):
    pl_result = await db.execute(select(ProductLine).where(ProductLine.id == product_line_id))
    if not pl_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="产品线不存在")

    versions_result = await db.execute(
        select(FormulaVersion).where(FormulaVersion.product_line_id == product_line_id)
    )
    all_versions = versions_result.scalars().all()

    all_ingredient_names = set()
    for v in all_versions:
        for ing in v.ingredients:
            all_ingredient_names.add(ing["name"])

    return {
        "product_line_id": product_line_id,
        "ingredients": sorted(list(all_ingredient_names))
    }
