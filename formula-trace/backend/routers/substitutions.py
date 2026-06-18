from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from database import get_db
from models import (
    IngredientSubstitution, FormulaVersion, ExclusionGroup,
    SupplierQuote, CompatibilityRule, IngredientTypeConfig, Regulation
)
from schemas import (
    IngredientSubstitutionCreate,
    IngredientSubstitutionResponse,
    SubstitutionPlan,
    SubstitutionPlanIngredient,
    SubstitutionPlanRequest,
    SubstitutionPlanListResponse,
)
from datetime import date

router = APIRouter(prefix="/api/substitutions", tags=["substitutions"])


def normalize_pair(a: str, b: str) -> tuple[str, str]:
    return (a, b) if a <= b else (b, a)


@router.post("", response_model=IngredientSubstitutionResponse, status_code=201)
async def create_substitution(
    data: IngredientSubstitutionCreate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(IngredientSubstitution).where(
            and_(
                IngredientSubstitution.primary_ingredient == data.primary_ingredient,
                IngredientSubstitution.substitute_ingredient == data.substitute_ingredient
            )
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="该主成分和替代成分的替代关系已存在")

    sub = IngredientSubstitution(
        primary_ingredient=data.primary_ingredient,
        substitute_ingredient=data.substitute_ingredient,
        fitness_score=data.fitness_score,
        suggested_ratio=data.suggested_ratio
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return sub


@router.get("", response_model=list[IngredientSubstitutionResponse])
async def list_substitutions(
    primary_ingredient: str | None = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(IngredientSubstitution)
    if primary_ingredient:
        query = query.where(
            IngredientSubstitution.primary_ingredient == primary_ingredient
        )
    result = await db.execute(
        query.order_by(IngredientSubstitution.fitness_score.desc())
    )
    return result.scalars().all()


@router.get("/{substitution_id}", response_model=IngredientSubstitutionResponse)
async def get_substitution(
    substitution_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(IngredientSubstitution).where(IngredientSubstitution.id == substitution_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="替代关系不存在")
    return sub


@router.delete("/{substitution_id}", status_code=204)
async def delete_substitution(
    substitution_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(IngredientSubstitution).where(IngredientSubstitution.id == substitution_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="替代关系不存在")
    await db.delete(sub)
    await db.commit()


async def _get_best_price(db: AsyncSession, ingredient_name: str) -> float | None:
    target_date = date.today()
    result = await db.execute(
        select(SupplierQuote).where(
            SupplierQuote.ingredient_name == ingredient_name,
            SupplierQuote.valid_from <= target_date,
            SupplierQuote.valid_to >= target_date
        ).order_by(SupplierQuote.unit_price.asc())
    )
    quote = result.scalar_one_or_none()
    return quote.unit_price if quote else None


async def _calculate_stability_score(ingredients: list[dict], db: AsyncSession) -> float:
    if len(ingredients) < 2:
        return 100.0

    ingredient_map = {ing["name"]: ing["percentage"] for ing in ingredients}
    ingredient_names = sorted(ingredient_map.keys())

    pairs = []
    for i in range(len(ingredient_names)):
        for j in range(i + 1, len(ingredient_names)):
            pairs.append((ingredient_names[i], ingredient_names[j]))

    total_deduction = 0.0
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
        if rule and rule.compatibility_level in ["轻微不相容", "严重不相容"]:
            pct_a = ingredient_map[ing_a]
            pct_b = ingredient_map[ing_b]
            deduction = (pct_a * pct_b * (100 - rule.compatibility_score)) / 1000
            total_deduction += deduction

    return max(0.0, round(100 - total_deduction, 2))


async def _check_exclusion_conflicts(
    ingredient_names: list[str],
    product_line_id: int,
    db: AsyncSession
) -> list[str]:
    result = await db.execute(
        select(ExclusionGroup).where(ExclusionGroup.product_line_id == product_line_id)
    )
    groups = result.scalars().all()
    conflicts = []
    for group in groups:
        found = [ing for ing in group.ingredients if ing in ingredient_names]
        if len(found) >= 2:
            conflicts.append(f"互斥组「{group.name}」：{', '.join(found)} 同时存在")
    return conflicts


async def _check_compliance_risks(
    ingredients: list[dict],
    db: AsyncSession
) -> list[str]:
    risks = []
    target_markets = ["中国", "欧盟"]

    for market in target_markets:
        reg_result = await db.execute(
            select(Regulation).where(Regulation.target_market == market)
        )
        regulations = reg_result.scalars().all()

        for ing in ingredients:
            name = ing["name"]
            pct = ing["percentage"]
            for reg in regulations:
                if reg.ingredient_name != name:
                    continue
                if reg.is_banned:
                    risks.append(f"{market}法规：{name}为禁用成分")
                    break
                if reg.max_percentage is not None and pct > reg.max_percentage:
                    risks.append(
                        f"{market}法规：{name}用量{pct:.2f}%超过限值{reg.max_percentage}%"
                    )
                    break

    return risks


async def _get_ingredient_type(ingredient_name: str, db: AsyncSession) -> str:
    result = await db.execute(
        select(IngredientTypeConfig).where(
            IngredientTypeConfig.ingredient_name == ingredient_name
        )
    )
    config = result.scalar_one_or_none()
    return config.ingredient_type if config else "基础原料"


@router.post("/plans", response_model=SubstitutionPlanListResponse)
async def generate_substitution_plans(
    data: SubstitutionPlanRequest,
    db: AsyncSession = Depends(get_db)
):
    version_result = await db.execute(
        select(FormulaVersion).where(FormulaVersion.id == data.version_id)
    )
    version = version_result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")

    original_ingredients = version.ingredients
    original_map = {ing["name"]: ing["percentage"] for ing in original_ingredients}

    if data.ingredient_name not in original_map:
        raise HTTPException(status_code=400, detail=f"成分「{data.ingredient_name}」不存在于该版本配方中")

    original_percentage = original_map[data.ingredient_name]

    sub_result = await db.execute(
        select(IngredientSubstitution).where(
            IngredientSubstitution.primary_ingredient == data.ingredient_name
        ).order_by(IngredientSubstitution.fitness_score.desc())
    )
    substitutions = sub_result.scalars().all()

    if not substitutions:
        return SubstitutionPlanListResponse(
            version_id=data.version_id,
            ingredient_name=data.ingredient_name,
            original_percentage=original_percentage,
            plans=[]
        )

    original_stability = await _calculate_stability_score(original_ingredients, db)

    original_type = await _get_ingredient_type(data.ingredient_name, db)

    original_cost_total = 0.0
    original_prices = {}
    for ing in original_ingredients:
        price = await _get_best_price(db, ing["name"])
        original_prices[ing["name"]] = price
        if price is not None:
            original_cost_total += (ing["percentage"] / 100.0) * price

    plans = []
    for sub in substitutions:
        sub_percentage = round(original_percentage * sub.suggested_ratio, 2)
        remaining = round(original_percentage - sub_percentage, 2)

        new_ingredients = []
        other_total = 0.0
        for ing in original_ingredients:
            if ing["name"] == data.ingredient_name:
                continue
            new_ingredients.append({"name": ing["name"], "percentage": ing["percentage"]})
            other_total += ing["percentage"]

        redistributed = []
        if remaining > 0 and other_total > 0:
            for ing in new_ingredients:
                adjusted_pct = round(
                    ing["percentage"] + (ing["percentage"] / other_total) * remaining,
                    2
                )
                redistributed.append({
                    "name": ing["name"],
                    "percentage": adjusted_pct,
                    "is_new": False
                })
        else:
            for ing in new_ingredients:
                redistributed.append({
                    "name": ing["name"],
                    "percentage": ing["percentage"],
                    "is_new": False
                })

        sub_entry_exists = any(ing["name"] == sub.substitute_ingredient for ing in redistributed)
        if sub_entry_exists:
            for ing in redistributed:
                if ing["name"] == sub.substitute_ingredient:
                    ing["percentage"] = round(ing["percentage"] + sub_percentage, 2)
                    break
        else:
            redistributed.append({
                "name": sub.substitute_ingredient,
                "percentage": sub_percentage,
                "is_new": True
            })

        total_check = round(sum(ing["percentage"] for ing in redistributed), 2)
        if abs(total_check - 100.0) > 0.02:
            diff = round(100.0 - total_check, 2)
            if redistributed:
                redistributed[0]["percentage"] = round(redistributed[0]["percentage"] + diff, 2)

        full_ingredients = [
            SubstitutionPlanIngredient(**ing) for ing in redistributed
        ]

        ingredient_names = [ing["name"] for ing in redistributed]
        conflict_details = await _check_exclusion_conflicts(
            ingredient_names, version.product_line_id, db
        )

        compliance_details = await _check_compliance_risks(redistributed, db)

        new_stability = await _calculate_stability_score(redistributed, db)
        stability_change = round(new_stability - original_stability, 2)

        new_cost_total = 0.0
        for ing in redistributed:
            price = await _get_best_price(db, ing["name"])
            if price is not None:
                new_cost_total += (ing["percentage"] / 100.0) * price

        if original_cost_total > 0:
            cost_change_rate = round(
                ((new_cost_total - original_cost_total) / original_cost_total) * 100, 2
            )
        else:
            cost_change_rate = None

        sub_type = await _get_ingredient_type(sub.substitute_ingredient, db)
        if sub_type != original_type:
            sensory_impact = "感官可能有变化"
        else:
            sensory_impact = "感官影响较小"

        if cost_change_rate is not None:
            cost_change_score = max(0.0, 1.0 - abs(cost_change_rate) / 50.0)
        else:
            cost_change_score = None

        stability_score = new_stability / 100.0

        if cost_change_score is not None:
            overall = (
                (sub.fitness_score / 100.0) * 0.5
                + cost_change_score * 0.3
                + stability_score * 0.2
            )
        else:
            overall = (
                (sub.fitness_score / 100.0) * 0.7
                + stability_score * 0.3
            )
        overall = round(overall * 100, 2)

        plans.append(SubstitutionPlan(
            substitute_ingredient=sub.substitute_ingredient,
            fitness_score=sub.fitness_score,
            suggested_ratio=sub.suggested_ratio,
            new_percentage=sub_percentage,
            remaining_redistributed=[
                SubstitutionPlanIngredient(**ing) for ing in redistributed
                if not ing["is_new"] and ing["name"] != sub.substitute_ingredient
            ],
            full_ingredients=full_ingredients,
            has_conflict=len(conflict_details) > 0,
            conflict_details=conflict_details,
            has_compliance_risk=len(compliance_details) > 0,
            compliance_risk_details=compliance_details,
            cost_change_rate=cost_change_rate,
            stability_risk_change=stability_change,
            sensory_impact=sensory_impact,
            cost_change_score=round(cost_change_score * 100, 2) if cost_change_score is not None else None,
            stability_score=round(stability_score * 100, 2),
            overall_recommendation=overall
        ))

    plans.sort(key=lambda p: p.overall_recommendation, reverse=True)

    return SubstitutionPlanListResponse(
        version_id=data.version_id,
        ingredient_name=data.ingredient_name,
        original_percentage=original_percentage,
        plans=plans
    )
