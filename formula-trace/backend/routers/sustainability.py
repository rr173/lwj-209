from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from models import FormulaVersion, IngredientEnvironmentalAttribute
from schemas import (
    EnvironmentalAttributeCreate,
    EnvironmentalAttributeUpdate,
    EnvironmentalAttributeResponse,
    EnvironmentalAttributeBatchRequest,
    EnvironmentalAttributeBatchResponse,
    SustainabilityScoreResponse,
    IngredientEnvironmentalContribution,
    SustainabilityCompareResponse,
    CompareSustainabilityDimension,
    CompareIngredientContribution,
)
from typing import Optional

router = APIRouter(prefix="/api/sustainability", tags=["sustainability"])


async def calculate_sustainability_score(
    version: FormulaVersion,
    db: AsyncSession
) -> SustainabilityScoreResponse:
    ingredients = version.ingredients
    total_ingredients = len(ingredients)

    ingredient_names = [ing["name"] for ing in ingredients]
    result = await db.execute(
        select(IngredientEnvironmentalAttribute).where(
            IngredientEnvironmentalAttribute.ingredient_name.in_(ingredient_names)
        )
    )
    env_attrs = result.scalars().all()
    env_map = {attr.ingredient_name: attr for attr in env_attrs}

    missing_ingredients = []
    contributions = []
    weighted_biodegradability_sum = 0.0
    weighted_carbon_sum = 0.0
    weighted_source_sum = 0.0
    has_microplastic = False
    has_data_count = 0

    for ing in ingredients:
        name = ing["name"]
        percentage = ing["percentage"]
        env_attr = env_map.get(name)

        if env_attr is None:
            missing_ingredients.append(name)
            contributions.append(IngredientEnvironmentalContribution(
                ingredient_name=name,
                percentage=percentage,
                has_data=False
            ))
        else:
            has_data_count += 1
            if env_attr.has_microplastic_risk:
                has_microplastic = True

            w_bio = env_attr.biodegradability_score * percentage / 100
            w_carbon = env_attr.carbon_footprint * percentage / 100
            w_source = env_attr.source_score * percentage / 100

            weighted_biodegradability_sum += w_bio
            weighted_carbon_sum += w_carbon
            weighted_source_sum += w_source

            contributions.append(IngredientEnvironmentalContribution(
                ingredient_name=name,
                percentage=percentage,
                has_data=True,
                biodegradability_score=env_attr.biodegradability_score,
                carbon_footprint=env_attr.carbon_footprint,
                source_category=env_attr.source_category,
                has_microplastic_risk=env_attr.has_microplastic_risk,
                weighted_biodegradability=w_bio,
                weighted_carbon=w_carbon,
                weighted_source=w_source
            ))

    missing_percentage = (len(missing_ingredients) / total_ingredients) * 100 if total_ingredients > 0 else 0
    is_reliable = missing_percentage <= 30

    if has_data_count > 0:
        avg_biodegradability = weighted_biodegradability_sum * 100 / sum(ing["percentage"] for ing in ingredients if env_map.get(ing["name"]))
    else:
        avg_biodegradability = 0.0

    carbon_score = max(0.0, 100.0 - weighted_carbon_sum * 2)

    if has_data_count > 0:
        avg_source = weighted_source_sum * 100 / sum(ing["percentage"] for ing in ingredients if env_map.get(ing["name"]))
    else:
        avg_source = 0.0

    total_before_penalty = (
        avg_biodegradability * 0.4 +
        carbon_score * 0.35 +
        avg_source * 0.25
    )

    microplastic_penalty = 20.0 if has_microplastic else 0.0
    total_score = max(0.0, total_before_penalty - microplastic_penalty)

    return SustainabilityScoreResponse(
        version_id=version.id,
        version_number=version.version_number,
        total_score=round(total_score, 2),
        biodegradability_score=round(avg_biodegradability, 2),
        carbon_footprint_score=round(carbon_score, 2),
        source_score=round(avg_source, 2),
        microplastic_penalty=microplastic_penalty,
        is_reliable=is_reliable,
        missing_ingredients=missing_ingredients,
        missing_percentage=round(missing_percentage, 2),
        contributions=contributions,
        has_microplastic_ingredient=has_microplastic
    )


@router.post("/attributes", response_model=EnvironmentalAttributeResponse, status_code=201)
async def create_environmental_attribute(
    data: EnvironmentalAttributeCreate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(IngredientEnvironmentalAttribute).where(
            IngredientEnvironmentalAttribute.ingredient_name == data.ingredient_name
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail=f"成分 '{data.ingredient_name}' 的环境属性已存在，不允许重复录入"
        )

    attr = IngredientEnvironmentalAttribute(
        ingredient_name=data.ingredient_name,
        biodegradability_score=data.biodegradability_score,
        carbon_footprint=data.carbon_footprint,
        source_category=data.source_category,
        has_microplastic_risk=data.has_microplastic_risk
    )
    db.add(attr)
    await db.commit()
    await db.refresh(attr)
    return attr


@router.get("/attributes", response_model=list[EnvironmentalAttributeResponse])
async def list_environmental_attributes(
    source_category: Optional[str] = Query(None, pattern="^(天然|半合成|全合成)$"),
    db: AsyncSession = Depends(get_db)
):
    query = select(IngredientEnvironmentalAttribute)
    if source_category:
        query = query.where(IngredientEnvironmentalAttribute.source_category == source_category)
    query = query.order_by(IngredientEnvironmentalAttribute.ingredient_name)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/attributes/{ingredient_name}", response_model=EnvironmentalAttributeResponse)
async def get_environmental_attribute(
    ingredient_name: str,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(IngredientEnvironmentalAttribute).where(
            IngredientEnvironmentalAttribute.ingredient_name == ingredient_name
        )
    )
    attr = result.scalar_one_or_none()
    if not attr:
        raise HTTPException(status_code=404, detail=f"成分 '{ingredient_name}' 的环境属性不存在")
    return attr


@router.put("/attributes/{ingredient_name}", response_model=EnvironmentalAttributeResponse)
async def update_environmental_attribute(
    ingredient_name: str,
    data: EnvironmentalAttributeUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(IngredientEnvironmentalAttribute).where(
            IngredientEnvironmentalAttribute.ingredient_name == ingredient_name
        )
    )
    attr = result.scalar_one_or_none()
    if not attr:
        raise HTTPException(status_code=404, detail=f"成分 '{ingredient_name}' 的环境属性不存在")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(attr, key, value)

    await db.commit()
    await db.refresh(attr)
    return attr


@router.delete("/attributes/{ingredient_name}", status_code=204)
async def delete_environmental_attribute(
    ingredient_name: str,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(IngredientEnvironmentalAttribute).where(
            IngredientEnvironmentalAttribute.ingredient_name == ingredient_name
        )
    )
    attr = result.scalar_one_or_none()
    if not attr:
        raise HTTPException(status_code=404, detail=f"成分 '{ingredient_name}' 的环境属性不存在")

    await db.delete(attr)
    await db.commit()


@router.post("/attributes/batch", response_model=EnvironmentalAttributeBatchResponse)
async def batch_update_environmental_attributes(
    data: EnvironmentalAttributeBatchRequest,
    db: AsyncSession = Depends(get_db)
):
    if len(data.items) == 0:
        raise HTTPException(status_code=400, detail="批量更新数据不能为空")
    if len(data.items) > 50:
        raise HTTPException(status_code=400, detail="批量更新最多支持50条记录")

    created_count = 0
    updated_count = 0

    for item in data.items:
        result = await db.execute(
            select(IngredientEnvironmentalAttribute).where(
                IngredientEnvironmentalAttribute.ingredient_name == item.ingredient_name
            )
        )
        attr = result.scalar_one_or_none()

        if attr:
            attr.biodegradability_score = item.biodegradability_score
            attr.carbon_footprint = item.carbon_footprint
            attr.source_category = item.source_category
            attr.has_microplastic_risk = item.has_microplastic_risk
            updated_count += 1
        else:
            attr = IngredientEnvironmentalAttribute(
                ingredient_name=item.ingredient_name,
                biodegradability_score=item.biodegradability_score,
                carbon_footprint=item.carbon_footprint,
                source_category=item.source_category,
                has_microplastic_risk=item.has_microplastic_risk
            )
            db.add(attr)
            created_count += 1

    await db.commit()

    return EnvironmentalAttributeBatchResponse(
        success_count=created_count + updated_count,
        updated_count=updated_count,
        created_count=created_count,
        total_count=len(data.items)
    )


@router.get("/score/{version_id}", response_model=SustainabilityScoreResponse)
async def get_sustainability_score(
    version_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(FormulaVersion).where(FormulaVersion.id == version_id)
    )
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="配方版本不存在")

    return await calculate_sustainability_score(version, db)


@router.get("/compare", response_model=SustainabilityCompareResponse)
async def compare_sustainability(
    left_id: int,
    right_id: int,
    db: AsyncSession = Depends(get_db)
):
    left_result = await db.execute(
        select(FormulaVersion).where(FormulaVersion.id == left_id)
    )
    left_version = left_result.scalar_one_or_none()
    if not left_version:
        raise HTTPException(status_code=404, detail=f"版本 {left_id} 不存在")

    right_result = await db.execute(
        select(FormulaVersion).where(FormulaVersion.id == right_id)
    )
    right_version = right_result.scalar_one_or_none()
    if not right_version:
        raise HTTPException(status_code=404, detail=f"版本 {right_id} 不存在")

    left_score = await calculate_sustainability_score(left_version, db)
    right_score = await calculate_sustainability_score(right_version, db)

    def calc_dimension(left_val: float, right_val: float) -> CompareSustainabilityDimension:
        delta = right_val - left_val
        delta_pct = (delta / left_val * 100) if left_val != 0 else (100 if right_val > 0 else 0)
        return CompareSustainabilityDimension(
            left_value=round(left_val, 2),
            right_value=round(right_val, 2),
            delta=round(delta, 2),
            delta_percentage=round(delta_pct, 2)
        )

    left_ingredients = {ing["name"]: ing["percentage"] for ing in left_version.ingredients}
    right_ingredients = {ing["name"]: ing["percentage"] for ing in right_version.ingredients}

    left_contrib_map = {c.ingredient_name: c for c in left_score.contributions}
    right_contrib_map = {c.ingredient_name: c for c in right_score.contributions}

    all_names = sorted(set(list(left_ingredients.keys()) + list(right_ingredients.keys())))

    ingredient_comparisons = []
    positive_impact = []
    negative_impact = []

    for name in all_names:
        left_pct = left_ingredients.get(name)
        right_pct = right_ingredients.get(name)
        left_contrib = left_contrib_map.get(name)
        right_contrib = right_contrib_map.get(name)

        if left_pct is None and right_pct is not None:
            change_type = "added"
        elif left_pct is not None and right_pct is None:
            change_type = "removed"
        elif abs((left_pct or 0) - (right_pct or 0)) < 0.01:
            change_type = "unchanged"
        else:
            change_type = "changed"

        def calc_ingredient_score(contrib):
            if not contrib or not contrib.has_data:
                return None
            bio = contrib.biodegradability_score or 0
            carbon = max(0, 100 - (contrib.carbon_footprint or 0) * 2)
            source = 100 if contrib.source_category == "天然" else (60 if contrib.source_category == "半合成" else 30)
            return bio * 0.4 + carbon * 0.35 + source * 0.25

        left_env_score = calc_ingredient_score(left_contrib)
        right_env_score = calc_ingredient_score(right_contrib)

        left_weighted = (left_env_score * left_pct / 100) if left_env_score is not None and left_pct is not None else None
        right_weighted = (right_env_score * right_pct / 100) if right_env_score is not None and right_pct is not None else None

        env_delta = None
        impact_label = "无变化"

        if left_weighted is not None and right_weighted is not None:
            env_delta = right_weighted - left_weighted
            if env_delta > 0.1:
                impact_label = "正面环境影响"
                positive_impact.append(name)
            elif env_delta < -0.1:
                impact_label = "负面环境影响"
                negative_impact.append(name)
        elif change_type == "added" and right_env_score is not None:
            impact_label = "新增环境负担" if right_env_score < 60 else "新增环保成分"
            if right_env_score < 60:
                negative_impact.append(name)
            else:
                positive_impact.append(name)
        elif change_type == "removed" and left_env_score is not None:
            impact_label = "移除环境负担" if left_env_score < 60 else "移除环保成分"
            if left_env_score < 60:
                positive_impact.append(name)
            else:
                negative_impact.append(name)

        ingredient_comparisons.append(CompareIngredientContribution(
            ingredient_name=name,
            left_percentage=left_pct,
            right_percentage=right_pct,
            change_type=change_type,
            left_environmental_score=round(left_env_score, 2) if left_env_score is not None else None,
            right_environmental_score=round(right_env_score, 2) if right_env_score is not None else None,
            environmental_impact_delta=round(env_delta, 2) if env_delta is not None else None,
            impact_label=impact_label
        ))

    return SustainabilityCompareResponse(
        left_version_id=left_id,
        left_version_number=left_version.version_number,
        right_version_id=right_id,
        right_version_number=right_version.version_number,
        total_score=calc_dimension(left_score.total_score, right_score.total_score),
        biodegradability_score=calc_dimension(left_score.biodegradability_score, right_score.biodegradability_score),
        carbon_footprint_score=calc_dimension(left_score.carbon_footprint_score, right_score.carbon_footprint_score),
        source_score=calc_dimension(left_score.source_score, right_score.source_score),
        left_reliable=left_score.is_reliable,
        right_reliable=right_score.is_reliable,
        ingredient_comparisons=ingredient_comparisons,
        positive_impact_ingredients=positive_impact,
        negative_impact_ingredients=negative_impact
    )
