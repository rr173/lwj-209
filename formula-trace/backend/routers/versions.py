from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from database import get_db
from models import FormulaVersion, ProductLine, ExclusionGroup, Batch, SupplierQuote, Regulation, CompatibilityRule, CostBudget, BudgetAlert
from schemas import (
    FormulaVersionCreate, FormulaVersionResponse, VersionTreeNode, CompareResponse, CompareDiffItem,
    IngredientItem, ImpactAnalysisRequest, ImpactAnalysisResponse,
    CostImpactAnalysis, CostImpactDetail,
    ComplianceRiskAnalysis, ComplianceRiskItem,
    StabilityImpactAnalysis, StabilityRiskPairChange,
    ExclusionConflictItem
)
from utils import compute_batch_scores
from datetime import date, datetime
from routers.costs import get_best_price_for_ingredient
from routers.sustainability import calculate_sustainability_score

router = APIRouter(prefix="/api/versions", tags=["versions"])

MAX_VERSIONS_PER_LINE = 500


def get_ingredients_summary(ingredients: list) -> str:
    sorted_ings = sorted(ingredients, key=lambda x: x["percentage"], reverse=True)
    top3 = sorted_ings[:3]
    names = [ing["name"] for ing in top3]
    if len(sorted_ings) > 3:
        names.append(f"...(+{len(sorted_ings)-3})")
    return ", ".join(names)


def check_exclusion_conflicts(ingredient_names: list[str], exclusion_groups: list[ExclusionGroup]) -> list[dict]:
    conflicts = []
    for group in exclusion_groups:
        found = []
        for ing in group.ingredients:
            if ing in ingredient_names:
                found.append(ing)
        if len(found) >= 2:
            conflicts.append({
                "group_name": group.name,
                "conflicting_ingredients": found
            })
    return conflicts


async def build_version_response(version: FormulaVersion, db: AsyncSession) -> FormulaVersionResponse:
    all_batches_result = await db.execute(
        select(Batch).where(
            Batch.version_id.in_(
                select(FormulaVersion.id).where(FormulaVersion.product_line_id == version.product_line_id)
            ),
            Batch.skin_feel_score.isnot(None)
        )
    )
    all_batches = all_batches_result.scalars().all()
    score_map, _, _ = compute_batch_scores(all_batches)

    version_batches = [b for b in all_batches if b.version_id == version.id]
    scores = [score_map.get(b.id) for b in version_batches if b.id in score_map]
    best_score = max(scores) if scores else None

    return FormulaVersionResponse(
        id=version.id,
        product_line_id=version.product_line_id,
        version_number=version.version_number,
        parent_id=version.parent_id,
        ingredients=[IngredientItem(**ing) for ing in version.ingredients],
        ingredients_summary=get_ingredients_summary(version.ingredients),
        batch_count=len(version_batches),
        best_batch_score=best_score,
        approval_status=version.approval_status
    )


@router.post("", response_model=FormulaVersionResponse, status_code=201)
async def create_version(data: FormulaVersionCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ProductLine).where(ProductLine.id == data.product_line_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="产品线不存在")

    count_result = await db.execute(
        select(func.count(FormulaVersion.id)).where(FormulaVersion.product_line_id == data.product_line_id)
    )
    current_count = count_result.scalar_one() or 0
    if current_count >= MAX_VERSIONS_PER_LINE:
        raise HTTPException(
            status_code=400,
            detail=f"单个产品线版本总数不能超过{MAX_VERSIONS_PER_LINE}，当前已达{current_count}"
        )

    if data.parent_id is not None:
        parent_result = await db.execute(
            select(FormulaVersion).where(
                FormulaVersion.id == data.parent_id,
                FormulaVersion.product_line_id == data.product_line_id
            )
        )
        if not parent_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="父版本不存在或不属于该产品线")

    exclusion_result = await db.execute(
        select(ExclusionGroup).where(ExclusionGroup.product_line_id == data.product_line_id)
    )
    exclusion_groups = exclusion_result.scalars().all()
    ingredient_names = [ing.name for ing in data.ingredients]
    conflicts = check_exclusion_conflicts(ingredient_names, exclusion_groups)
    if conflicts:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "存在互斥成分冲突",
                "conflicts": conflicts
            }
        )

    max_vn_result = await db.execute(
        select(func.max(FormulaVersion.version_number)).where(
            FormulaVersion.product_line_id == data.product_line_id
        )
    )
    max_vn = max_vn_result.scalar_one() or 0
    version_number = max_vn + 1

    ingredients_dict = [{"name": ing.name, "percentage": ing.percentage} for ing in data.ingredients]
    version = FormulaVersion(
        product_line_id=data.product_line_id,
        version_number=version_number,
        parent_id=data.parent_id,
        ingredients=ingredients_dict,
        approval_status="draft"
    )
    db.add(version)
    await db.commit()
    await db.refresh(version)

    budget_result = await db.execute(
        select(CostBudget).where(
            CostBudget.product_line_id == data.product_line_id,
            CostBudget.is_active == True
        )
    )
    active_budget = budget_result.scalar_one_or_none()
    if active_budget:
        total_cost = 0.0
        has_unknown = False
        for ing in version.ingredients:
            best_quote = await get_best_price_for_ingredient(db, ing["name"])
            if best_quote is None:
                has_unknown = True
                break
            cost = (ing["percentage"] / 100.0) * best_quote.unit_price
            total_cost += cost

        if not has_unknown:
            total_cost = round(total_cost, 4)
            existing_alert = await db.execute(
                select(BudgetAlert).where(
                    BudgetAlert.budget_id == active_budget.id,
                    BudgetAlert.version_id == version.id
                )
            )
            if not existing_alert.scalar_one_or_none():
                exceed_ratio = total_cost / active_budget.target_cost_per_kg
                if total_cost > active_budget.target_cost_per_kg:
                    alert_type = "over_budget"
                elif total_cost >= active_budget.warning_cost:
                    alert_type = "warning"
                else:
                    alert_type = None

                if alert_type:
                    alert = BudgetAlert(
                        budget_id=active_budget.id,
                        version_id=version.id,
                        actual_cost=total_cost,
                        budget_limit=active_budget.target_cost_per_kg,
                        exceed_ratio=exceed_ratio,
                        alert_type=alert_type,
                        status="pending"
                    )
                    db.add(alert)
                    await db.commit()

    return FormulaVersionResponse(
        id=version.id,
        product_line_id=version.product_line_id,
        version_number=version.version_number,
        parent_id=version.parent_id,
        ingredients=data.ingredients,
        ingredients_summary=get_ingredients_summary(ingredients_dict),
        batch_count=0,
        best_batch_score=None,
        approval_status="draft"
    )


@router.get("/compare", response_model=CompareResponse)
async def compare_versions(left_id: int, right_id: int, db: AsyncSession = Depends(get_db)):
    left_result = await db.execute(select(FormulaVersion).where(FormulaVersion.id == left_id))
    right_result = await db.execute(select(FormulaVersion).where(FormulaVersion.id == right_id))
    left = left_result.scalar_one_or_none()
    right = right_result.scalar_one_or_none()

    if not left or not right:
        raise HTTPException(status_code=404, detail="版本不存在")

    left_map = {ing["name"]: ing["percentage"] for ing in left.ingredients}
    right_map = {ing["name"]: ing["percentage"] for ing in right.ingredients}

    all_names = sorted(set(left_map.keys()) | set(right_map.keys()))
    diff = []

    for name in all_names:
        left_pct = left_map.get(name)
        right_pct = right_map.get(name)
        if left_pct is None:
            change_type = "added"
        elif right_pct is None:
            change_type = "removed"
        elif abs(left_pct - right_pct) > 0.01:
            change_type = "changed"
        else:
            change_type = "unchanged"
        diff.append(CompareDiffItem(
            name=name,
            left_percentage=left_pct,
            right_percentage=right_pct,
            change_type=change_type
        ))

    return CompareResponse(
        left_version=left.version_number,
        right_version=right.version_number,
        diff=diff
    )


@router.get("/product-line/{product_line_id}/tree", response_model=list[VersionTreeNode])
async def get_version_tree(product_line_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ProductLine).where(ProductLine.id == product_line_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="产品线不存在")

    versions_result = await db.execute(
        select(FormulaVersion).where(FormulaVersion.product_line_id == product_line_id)
    )
    versions = versions_result.scalars().all()

    all_batches_result = await db.execute(
        select(Batch).where(
            Batch.version_id.in_([v.id for v in versions]),
            Batch.skin_feel_score.isnot(None)
        )
    )
    all_batches = all_batches_result.scalars().all()
    score_map, _, _ = compute_batch_scores(all_batches)

    version_batches = {}
    for b in all_batches:
        version_batches.setdefault(b.version_id, []).append(b)

    batch_info = {}
    for v in versions:
        vb = version_batches.get(v.id, [])
        scores = [score_map.get(b.id) for b in vb if b.id in score_map]
        best_score = max(scores) if scores else None
        batch_info[v.id] = {
            "count": len(vb),
            "best_score": best_score
        }

    version_map = {}
    for v in versions:
        info = batch_info[v.id]
        sustainability_data = await calculate_sustainability_score(v, db)
        version_map[v.id] = VersionTreeNode(
            id=v.id,
            version_number=v.version_number,
            ingredients_summary=get_ingredients_summary(v.ingredients),
            batch_count=info["count"],
            best_batch_score=info["best_score"],
            approval_status=v.approval_status,
            sustainability_score=sustainability_data.total_score if sustainability_data.is_reliable else None,
            children=[]
        )

    roots = []
    for v in versions:
        node = version_map[v.id]
        if v.parent_id is None:
            roots.append(node)
        else:
            if v.parent_id in version_map:
                version_map[v.parent_id].children.append(node)

    return roots


@router.get("/{version_id}", response_model=FormulaVersionResponse)
async def get_version(version_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FormulaVersion).where(FormulaVersion.id == version_id))
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")

    return await build_version_response(version, db)


def normalize_pair(a: str, b: str) -> tuple[str, str]:
    return (a, b) if a <= b else (b, a)


def get_risk_level(score: float) -> str:
    if score >= 80:
        return "低风险"
    elif score >= 60:
        return "中风险"
    else:
        return "高风险"


CATEGORY_FALLBACK_ORDER = ["眼部", "唇部", "面部", "防晒", "染发", "烫发", "全身"]
STATUS_COMPLIANT = "合规"
STATUS_OVER_LIMIT = "超限"
STATUS_BANNED = "禁用"
STATUS_UNLISTED = "未收录"


def _find_best_regulation(
    ingredient_name: str,
    regulations_map: dict[tuple[str, str], Regulation],
    product_category: str
) -> Regulation | None:
    key_specific = (ingredient_name, product_category)
    if key_specific in regulations_map:
        return regulations_map[key_specific]

    if product_category != "全身":
        key_general = (ingredient_name, "全身")
        if key_general in regulations_map:
            return regulations_map[key_general]

    for cat in CATEGORY_FALLBACK_ORDER:
        key = (ingredient_name, cat)
        if key in regulations_map:
            return regulations_map[key]

    return None


def _check_ingredient_compliance(
    ingredient: dict,
    regulations_map: dict[tuple[str, str], Regulation],
    product_category: str
) -> dict:
    name = ingredient["name"]
    percentage = ingredient["percentage"]

    reg = _find_best_regulation(name, regulations_map, product_category)

    if reg is None:
        return {
            "ingredient_name": name,
            "percentage": percentage,
            "status": STATUS_UNLISTED,
            "max_percentage": None,
            "is_banned": None,
            "product_category": None,
            "matched_regulation_category": None,
            "notes": "未收录,需人工确认",
            "regulation_reference": None
        }

    if reg.is_banned:
        return {
            "ingredient_name": name,
            "percentage": percentage,
            "status": STATUS_BANNED,
            "max_percentage": reg.max_percentage,
            "is_banned": True,
            "product_category": reg.product_category,
            "matched_regulation_category": reg.product_category,
            "notes": reg.notes,
            "regulation_reference": reg.regulation_reference
        }

    if reg.max_percentage is not None and percentage > reg.max_percentage:
        return {
            "ingredient_name": name,
            "percentage": percentage,
            "status": STATUS_OVER_LIMIT,
            "max_percentage": reg.max_percentage,
            "is_banned": False,
            "product_category": reg.product_category,
            "matched_regulation_category": reg.product_category,
            "notes": reg.notes,
            "regulation_reference": reg.regulation_reference
        }

    return {
        "ingredient_name": name,
        "percentage": percentage,
        "status": STATUS_COMPLIANT,
        "max_percentage": reg.max_percentage,
        "is_banned": False,
        "product_category": reg.product_category,
        "matched_regulation_category": reg.product_category,
        "notes": reg.notes,
        "regulation_reference": reg.regulation_reference
    }


async def _get_best_price_for_ingredient(
    db: AsyncSession,
    ingredient_name: str,
    target_date: date | None = None
) -> SupplierQuote | None:
    if target_date is None:
        target_date = date.today()

    result = await db.execute(
        select(SupplierQuote).where(
            SupplierQuote.ingredient_name == ingredient_name,
            SupplierQuote.valid_from <= target_date,
            SupplierQuote.valid_to >= target_date
        ).order_by(SupplierQuote.unit_price.asc())
    )
    quotes = result.scalars().all()
    return quotes[0] if quotes else None


async def _calculate_stability_risk(
    ingredients: list[dict],
    db: AsyncSession
) -> tuple[float, list[dict], float]:
    if len(ingredients) < 2:
        return 100.0, [], 0.0

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
        if rule.compatibility_level in ["轻微不相容", "严重不相容"]:
            pct_a = ingredient_map[ing_a]
            pct_b = ingredient_map[ing_b]
            deduction = (pct_a * pct_b * (100 - rule.compatibility_score)) / 1000
            deduction = round(deduction, 4)
            total_deduction += deduction

            risk_pairs.append({
                "ingredient_a": ing_a,
                "ingredient_b": ing_b,
                "percentage_a": pct_a,
                "percentage_b": pct_b,
                "compatibility_score": rule.compatibility_score,
                "compatibility_level": rule.compatibility_level,
                "manifestation": rule.manifestation,
                "deduction": deduction
            })

    total_score = max(0.0, round(100 - total_deduction, 2))
    risk_pairs.sort(key=lambda x: x["deduction"], reverse=True)

    return total_score, risk_pairs, total_deduction


@router.post("/impact-analysis", response_model=ImpactAnalysisResponse)
async def analyze_impact(data: ImpactAnalysisRequest, db: AsyncSession = Depends(get_db)):
    parent_result = await db.execute(
        select(FormulaVersion).where(FormulaVersion.id == data.parent_version_id)
    )
    parent = parent_result.scalar_one_or_none()
    if not parent:
        raise HTTPException(status_code=404, detail="父版本不存在")

    original_ing_map = {ing["name"]: ing["percentage"] for ing in parent.ingredients}

    adjust_map = {adj.name: adj.percentage for adj in data.adjustments}

    for name in adjust_map.keys():
        if name not in original_ing_map:
            raise HTTPException(
                status_code=400,
                detail=f"成分「{name}」不存在于父版本配方中"
            )

    new_ingredients = []
    for name, pct in original_ing_map.items():
        new_pct = adjust_map.get(name, pct)
        new_ingredients.append({"name": name, "percentage": new_pct})

    total_pct = round(sum(ing["percentage"] for ing in new_ingredients), 2)
    if abs(total_pct - 100.0) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"所有成分百分比之和必须等于100%，当前为{total_pct}%"
        )

    exclusion_result = await db.execute(
        select(ExclusionGroup).where(ExclusionGroup.product_line_id == parent.product_line_id)
    )
    exclusion_groups = exclusion_result.scalars().all()
    ingredient_names = [ing["name"] for ing in new_ingredients]
    exclusion_conflicts = []
    for group in exclusion_groups:
        found = []
        for ing in group.ingredients:
            if ing in ingredient_names:
                found.append(ing)
        if len(found) >= 2:
            exclusion_conflicts.append(ExclusionConflictItem(
                group_name=group.name,
                conflicting_ingredients=found
            ))

    cost_details = []
    missing_quotes = []
    original_total_cost = 0.0
    new_total_cost = 0.0

    all_names = sorted(original_ing_map.keys())
    for name in all_names:
        original_pct = original_ing_map[name]
        new_pct = adjust_map.get(name, original_pct)

        best_quote = await _get_best_price_for_ingredient(db, name)
        has_quote = best_quote is not None
        unit_price = best_quote.unit_price if has_quote else None
        supplier_name = best_quote.supplier_name if has_quote else None

        original_cost = (original_pct / 100.0) * unit_price if has_quote else None
        new_cost = (new_pct / 100.0) * unit_price if has_quote else None
        cost_delta = (new_cost - original_cost) if (original_cost is not None and new_cost is not None) else None

        if original_cost is not None:
            original_total_cost += original_cost
        if new_cost is not None:
            new_total_cost += new_cost

        if not has_quote:
            missing_quotes.append(name)

        cost_details.append(CostImpactDetail(
            ingredient_name=name,
            original_percentage=original_pct,
            new_percentage=new_pct,
            original_cost=original_cost,
            new_cost=new_cost,
            cost_delta=cost_delta,
            unit_price=unit_price,
            supplier_name=supplier_name
        ))

    total_delta = new_total_cost - original_total_cost
    delta_percentage = (total_delta / original_total_cost * 100) if original_total_cost > 0 else 0.0

    cost_impact = CostImpactAnalysis(
        original_total_cost=round(original_total_cost, 4),
        new_total_cost=round(new_total_cost, 4),
        total_delta=round(total_delta, 4),
        delta_percentage=round(delta_percentage, 2),
        details=cost_details,
        missing_quotes=missing_quotes
    )

    target_markets = ["中国", "欧盟"]
    regulations_maps = {}
    for market in target_markets:
        reg_result = await db.execute(
            select(Regulation).where(Regulation.target_market == market)
        )
        regulations = reg_result.scalars().all()
        regulations_maps[market] = {(r.ingredient_name, r.product_category): r for r in regulations}

    original_compliance_status = {}
    new_compliance_status = {}

    for market in target_markets:
        original_statuses = []
        new_statuses = []
        for ing in parent.ingredients:
            status = _check_ingredient_compliance(ing, regulations_maps[market], data.product_category)
            original_statuses.append(status)
        for ing in new_ingredients:
            status = _check_ingredient_compliance(ing, regulations_maps[market], data.product_category)
            new_statuses.append(status)
        original_compliance_status[market] = {s["ingredient_name"]: s for s in original_statuses}
        new_compliance_status[market] = {s["ingredient_name"]: s for s in new_statuses}

    new_risks = []
    for market in target_markets:
        for ing_name, new_status in new_compliance_status[market].items():
            original_status = original_compliance_status[market].get(ing_name)
            if original_status and original_status["status"] == STATUS_COMPLIANT and new_status["status"] in [STATUS_OVER_LIMIT, STATUS_BANNED]:
                risk_type = "超限" if new_status["status"] == STATUS_OVER_LIMIT else "禁用"
                new_risks.append(ComplianceRiskItem(
                    ingredient_name=ing_name,
                    target_market=market,
                    percentage=new_status["percentage"],
                    status=new_status["status"],
                    max_percentage=new_status["max_percentage"],
                    is_banned=new_status["is_banned"],
                    regulation_reference=new_status["regulation_reference"],
                    notes=new_status["notes"],
                    risk_type=risk_type
                ))

    compliance_risk = ComplianceRiskAnalysis(
        new_risks=new_risks,
        markets=target_markets
    )

    original_score, original_risk_pairs, original_deduction = await _calculate_stability_risk(parent.ingredients, db)
    new_score, new_risk_pairs, new_deduction = await _calculate_stability_risk(new_ingredients, db)

    original_pair_map = {}
    for pair in original_risk_pairs:
        key = (pair["ingredient_a"], pair["ingredient_b"])
        original_pair_map[key] = pair

    new_pair_map = {}
    for pair in new_risk_pairs:
        key = (pair["ingredient_a"], pair["ingredient_b"])
        new_pair_map[key] = pair

    all_pair_keys = set(original_pair_map.keys()) | set(new_pair_map.keys())
    all_pair_changes = []

    for key in all_pair_keys:
        original_pair = original_pair_map.get(key)
        new_pair = new_pair_map.get(key)

        if original_pair and new_pair:
            deduction_delta = round(new_pair["deduction"] - original_pair["deduction"], 4)
            all_pair_changes.append({
                "ingredient_a": key[0],
                "ingredient_b": key[1],
                "original_deduction": original_pair["deduction"],
                "new_deduction": new_pair["deduction"],
                "deduction_delta": deduction_delta,
                "compatibility_level": new_pair["compatibility_level"],
                "compatibility_score": new_pair["compatibility_score"],
                "manifestation": new_pair["manifestation"],
                "is_significant": abs(deduction_delta) > 5.0
            })
        elif original_pair:
            all_pair_changes.append({
                "ingredient_a": key[0],
                "ingredient_b": key[1],
                "original_deduction": original_pair["deduction"],
                "new_deduction": 0.0,
                "deduction_delta": round(-original_pair["deduction"], 4),
                "compatibility_level": original_pair["compatibility_level"],
                "compatibility_score": original_pair["compatibility_score"],
                "manifestation": original_pair["manifestation"],
                "is_significant": abs(round(-original_pair["deduction"], 4)) > 5.0
            })
        elif new_pair:
            all_pair_changes.append({
                "ingredient_a": key[0],
                "ingredient_b": key[1],
                "original_deduction": 0.0,
                "new_deduction": new_pair["deduction"],
                "deduction_delta": round(new_pair["deduction"], 4),
                "compatibility_level": new_pair["compatibility_level"],
                "compatibility_score": new_pair["compatibility_score"],
                "manifestation": new_pair["manifestation"],
                "is_significant": new_pair["deduction"] > 5.0
            })

    all_pair_changes.sort(key=lambda x: abs(x["deduction_delta"]), reverse=True)

    significant_changes = [
        StabilityRiskPairChange(**change)
        for change in all_pair_changes
        if change["is_significant"]
    ]
    all_pairs = [StabilityRiskPairChange(**change) for change in all_pair_changes]

    stability_impact = StabilityImpactAnalysis(
        original_total_score=original_score,
        new_total_score=new_score,
        score_delta=round(new_score - original_score, 2),
        original_risk_level=get_risk_level(original_score),
        new_risk_level=get_risk_level(new_score),
        significant_changes=significant_changes,
        all_pairs=all_pairs
    )

    adjusted_ingredients = [
        IngredientItem(name=ing["name"], percentage=ing["percentage"])
        for ing in new_ingredients
    ]

    return ImpactAnalysisResponse(
        parent_version_id=parent.id,
        parent_version_number=parent.version_number,
        adjusted_ingredients=adjusted_ingredients,
        cost_impact=cost_impact,
        compliance_risk=compliance_risk,
        stability_impact=stability_impact,
        exclusion_conflicts=exclusion_conflicts
    )
