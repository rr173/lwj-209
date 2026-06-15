from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_
from database import get_db
from models import FormulaVersion, IngredientTypeConfig, CompatibilityRule
from schemas import (
    IngredientTypeConfigCreate,
    IngredientTypeConfigResponse,
    CompatibilityRuleCreate,
    CompatibilityRuleUpdate,
    CompatibilityRuleResponse,
    CompatibilityListResponse,
    CompatibilityListItem,
    StabilityRiskResponse,
    RiskPairDetail,
    AgingSimulationResponse,
    AgingSimulationItem,
)
import math

router = APIRouter(prefix="/api/stability", tags=["stability"])


def get_risk_level(score: float) -> str:
    if score >= 80:
        return "低风险"
    elif score >= 60:
        return "中风险"
    else:
        return "高风险"


@router.post("/ingredient-types", response_model=IngredientTypeConfigResponse, status_code=201)
async def create_ingredient_type(
    data: IngredientTypeConfigCreate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(IngredientTypeConfig).where(
            IngredientTypeConfig.ingredient_name == data.ingredient_name
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.ingredient_type = data.ingredient_type
        await db.commit()
        await db.refresh(existing)
        return existing

    config = IngredientTypeConfig(
        ingredient_name=data.ingredient_name,
        ingredient_type=data.ingredient_type
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return config


@router.get("/ingredient-types", response_model=list[IngredientTypeConfigResponse])
async def get_ingredient_types(
    ingredient_name: str | None = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(IngredientTypeConfig)
    if ingredient_name:
        query = query.where(IngredientTypeConfig.ingredient_name == ingredient_name)
    result = await db.execute(query.order_by(IngredientTypeConfig.ingredient_name))
    return result.scalars().all()


@router.get("/ingredient-types/{ingredient_name}", response_model=IngredientTypeConfigResponse)
async def get_ingredient_type(
    ingredient_name: str,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(IngredientTypeConfig).where(
            IngredientTypeConfig.ingredient_name == ingredient_name
        )
    )
    config = result.scalar_one_or_none()
    if not config:
        config = IngredientTypeConfig(
            ingredient_name=ingredient_name,
            ingredient_type="基础原料"
        )
    return config


@router.delete("/ingredient-types/{config_id}", status_code=204)
async def delete_ingredient_type(
    config_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(IngredientTypeConfig).where(IngredientTypeConfig.id == config_id)
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="成分类型配置不存在")
    await db.delete(config)
    await db.commit()


def normalize_pair(a: str, b: str) -> tuple[str, str]:
    return (a, b) if a <= b else (b, a)


@router.post("/compatibility-rules", response_model=CompatibilityRuleResponse, status_code=201)
async def create_compatibility_rule(
    data: CompatibilityRuleCreate,
    db: AsyncSession = Depends(get_db)
):
    ing_a, ing_b = normalize_pair(data.ingredient_a, data.ingredient_b)
    if ing_a == ing_b:
        raise HTTPException(status_code=400, detail="不能与自身配置相容性规则")

    result = await db.execute(
        select(CompatibilityRule).where(
            and_(
                CompatibilityRule.ingredient_a == ing_a,
                CompatibilityRule.ingredient_b == ing_b
            )
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="该成分对的相容性规则已存在")

    rule = CompatibilityRule(
        ingredient_a=ing_a,
        ingredient_b=ing_b,
        compatibility_level=data.compatibility_level,
        compatibility_score=data.compatibility_score,
        manifestation=data.manifestation,
        notes=data.notes
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.get("/compatibility-rules", response_model=list[CompatibilityRuleResponse])
async def get_compatibility_rules(
    ingredient: str | None = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(CompatibilityRule)
    if ingredient:
        query = query.where(
            or_(
                CompatibilityRule.ingredient_a == ingredient,
                CompatibilityRule.ingredient_b == ingredient
            )
        )
    result = await db.execute(query.order_by(CompatibilityRule.ingredient_a, CompatibilityRule.ingredient_b))
    return result.scalars().all()


@router.get("/compatibility-rules/by-ingredient/{ingredient_name}", response_model=CompatibilityListResponse)
async def get_compatibility_by_ingredient(
    ingredient_name: str,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(CompatibilityRule).where(
            or_(
                CompatibilityRule.ingredient_a == ingredient_name,
                CompatibilityRule.ingredient_b == ingredient_name
            )
        )
    )
    rules = result.scalars().all()

    relations = []
    for rule in rules:
        other = rule.ingredient_b if rule.ingredient_a == ingredient_name else rule.ingredient_a
        relations.append(CompatibilityListItem(
            other_ingredient=other,
            compatibility_level=rule.compatibility_level,
            compatibility_score=rule.compatibility_score,
            manifestation=rule.manifestation,
            notes=rule.notes
        ))

    return CompatibilityListResponse(
        ingredient_name=ingredient_name,
        relations=sorted(relations, key=lambda x: x.compatibility_score)
    )


@router.put("/compatibility-rules/{rule_id}", response_model=CompatibilityRuleResponse)
async def update_compatibility_rule(
    rule_id: int,
    data: CompatibilityRuleUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(CompatibilityRule).where(CompatibilityRule.id == rule_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="相容性规则不存在")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rule, field, value)

    await db.commit()
    await db.refresh(rule)
    return rule


@router.delete("/compatibility-rules/{rule_id}", status_code=204)
async def delete_compatibility_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(CompatibilityRule).where(CompatibilityRule.id == rule_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="相容性规则不存在")
    await db.delete(rule)
    await db.commit()


@router.get("/risk-assessment/{version_id}", response_model=StabilityRiskResponse)
async def get_stability_risk_assessment(
    version_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(FormulaVersion).where(FormulaVersion.id == version_id)
    )
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")

    ingredients = version.ingredients
    if len(ingredients) < 2:
        return StabilityRiskResponse(
            version_id=version.id,
            version_number=version.version_number,
            total_score=100.0,
            risk_level="低风险",
            risk_pairs=[],
            total_deduction=0.0
        )

    ingredient_map = {ing["name"]: ing["percentage"] for ing in ingredients}
    ingredient_names = sorted(ingredient_map.keys())

    pairs = []
    for i in range(len(ingredient_names)):
        for j in range(i + 1, len(ingredient_names)):
            pairs.append((ingredient_names[i], ingredient_names[j]))

    all_rules = {}
    for ing_a, ing_b in pairs:
        norm_a, norm_b = normalize_pair(ing_a, ing_b)
        rule_result = await db.execute(
            select(CompatibilityRule).where(
                and_(
                    CompatibilityRule.ingredient_a == norm_a,
                    CompatibilityRule.ingredient_b == norm_b
                )
            )
        )
        rule = rule_result.scalar_one_or_none()
        if rule:
            all_rules[(ing_a, ing_b)] = rule

    risk_pairs = []
    total_deduction = 0.0

    for (ing_a, ing_b), rule in all_rules.items():
        if rule.compatibility_score < 100:
            pct_a = ingredient_map[ing_a]
            pct_b = ingredient_map[ing_b]
            deduction = (pct_a * pct_b * (100 - rule.compatibility_score)) / 1000
            deduction = round(deduction, 4)
            total_deduction += deduction

            risk_pairs.append(RiskPairDetail(
                ingredient_a=ing_a,
                ingredient_b=ing_b,
                percentage_a=pct_a,
                percentage_b=pct_b,
                compatibility_score=rule.compatibility_score,
                compatibility_level=rule.compatibility_level,
                manifestation=rule.manifestation,
                deduction=deduction
            ))

    total_score = max(0.0, round(100 - total_deduction, 2))
    risk_pairs.sort(key=lambda x: x.deduction, reverse=True)

    return StabilityRiskResponse(
        version_id=version.id,
        version_number=version.version_number,
        total_score=total_score,
        risk_level=get_risk_level(total_score),
        risk_pairs=risk_pairs,
        total_deduction=round(total_deduction, 4)
    )


@router.get("/aging-simulation/{version_id}", response_model=AgingSimulationResponse)
async def get_aging_simulation(
    version_id: int,
    days: int = Query(..., ge=1, le=180, description="模拟天数，范围1-180天"),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(FormulaVersion).where(FormulaVersion.id == version_id)
    )
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")

    ingredients = version.ingredients

    type_results = {
        "活性成分": {"initial": 0.0, "residual": 0.0},
        "防腐剂": {"initial": 0.0, "residual": 0.0},
        "基础原料": {"initial": 0.0, "residual": 0.0}
    }

    items = []
    for ing in ingredients:
        name = ing["name"]
        initial_pct = ing["percentage"]

        type_result = await db.execute(
            select(IngredientTypeConfig).where(
                IngredientTypeConfig.ingredient_name == name
            )
        )
        type_config = type_result.scalar_one_or_none()

        if type_config:
            ing_type = type_config.ingredient_type
            k = type_config.degradation_rate
        else:
            ing_type = "基础原料"
            k = 0.001

        residual = initial_pct * math.exp(-k * days)
        residual = round(residual, 4)
        degradation = round(initial_pct - residual, 4)

        type_results[ing_type]["initial"] += initial_pct
        type_results[ing_type]["residual"] += residual

        items.append(AgingSimulationItem(
            ingredient_name=name,
            initial_percentage=initial_pct,
            ingredient_type=ing_type,
            degradation_rate=k,
            residual_percentage=residual,
            degradation_amount=degradation
        ))

    def calc_retention(initial: float, residual: float) -> float:
        if initial == 0:
            return 100.0
        return round((residual / initial) * 100, 2)

    overall_active = calc_retention(
        type_results["活性成分"]["initial"],
        type_results["活性成分"]["residual"]
    )
    overall_preservative = calc_retention(
        type_results["防腐剂"]["initial"],
        type_results["防腐剂"]["residual"]
    )
    overall_base = calc_retention(
        type_results["基础原料"]["initial"],
        type_results["基础原料"]["residual"]
    )

    items.sort(key=lambda x: x.degradation_amount, reverse=True)

    return AgingSimulationResponse(
        version_id=version.id,
        version_number=version.version_number,
        simulation_days=days,
        items=items,
        overall_active_retention_rate=overall_active,
        overall_preservative_retention_rate=overall_preservative,
        overall_base_retention_rate=overall_base
    )
