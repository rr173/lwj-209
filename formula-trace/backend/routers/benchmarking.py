from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import CompetitorFormula, Regulation, FormulaVersion
from schemas import (
    CompetitorFormulaCreate,
    CompetitorFormulaUpdateIngredients,
    CompetitorFormulaResponse,
    CompetitorFormulaListItem,
    EstimationResponse,
    EstimatedIngredientItem,
    GapAnalysisResponse,
    GapAnalysisItem,
)
from datetime import datetime

router = APIRouter(prefix="/api/benchmarking", tags=["benchmarking"])


def _get_estimation_range(rank: int) -> tuple[float, float]:
    if rank == 1:
        return (30.0, 80.0)
    elif rank == 2:
        return (10.0, 30.0)
    elif rank == 3:
        return (5.0, 15.0)
    elif 4 <= rank <= 6:
        return (2.0, 8.0)
    else:
        return (0.1, 3.0)


@router.get("", response_model=list[CompetitorFormulaListItem])
async def list_competitors(
    competitor_name: str | None = Query(None, description="竞品名称（模糊搜索）"),
    product_name: str | None = Query(None, description="产品名称（模糊搜索）"),
    db: AsyncSession = Depends(get_db),
):
    query = select(CompetitorFormula)
    conditions = []

    if competitor_name:
        conditions.append(CompetitorFormula.competitor_name.like(f"%{competitor_name}%"))
    if product_name:
        conditions.append(CompetitorFormula.product_name.like(f"%{product_name}%"))

    if conditions:
        from sqlalchemy import and_
        query = query.where(and_(*conditions))

    query = query.order_by(CompetitorFormula.competitor_name, CompetitorFormula.product_name)
    result = await db.execute(query)
    formulas = result.scalars().all()

    items = []
    for f in formulas:
        items.append(
            CompetitorFormulaListItem(
                id=f.id,
                competitor_name=f.competitor_name,
                product_name=f.product_name,
                ingredient_count=len(f.ingredients),
                created_at=f.created_at,
                updated_at=f.updated_at,
            )
        )
    return items


@router.post("", response_model=CompetitorFormulaResponse, status_code=201)
async def create_competitor(data: CompetitorFormulaCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(
        select(CompetitorFormula).where(
            CompetitorFormula.competitor_name == data.competitor_name,
            CompetitorFormula.product_name == data.product_name,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail=f"竞品 {data.competitor_name} 的 {data.product_name} 已存在",
        )

    ingredients_list = [ing.model_dump() for ing in data.ingredients]
    formula = CompetitorFormula(
        competitor_name=data.competitor_name,
        product_name=data.product_name,
        ingredients=ingredients_list,
    )
    db.add(formula)
    await db.commit()
    await db.refresh(formula)
    return formula


@router.get("/{competitor_id}", response_model=CompetitorFormulaResponse)
async def get_competitor(competitor_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CompetitorFormula).where(CompetitorFormula.id == competitor_id))
    formula = result.scalar_one_or_none()
    if not formula:
        raise HTTPException(status_code=404, detail="竞品配方不存在")
    return formula


@router.put("/{competitor_id}/ingredients", response_model=CompetitorFormulaResponse)
async def update_competitor_ingredients(
    competitor_id: int,
    data: CompetitorFormulaUpdateIngredients,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CompetitorFormula).where(CompetitorFormula.id == competitor_id))
    formula = result.scalar_one_or_none()
    if not formula:
        raise HTTPException(status_code=404, detail="竞品配方不存在")

    formula.ingredients = [ing.model_dump() for ing in data.ingredients]
    formula.updated_at = datetime.now()
    await db.commit()
    await db.refresh(formula)
    return formula


@router.delete("/{competitor_id}", status_code=204)
async def delete_competitor(competitor_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CompetitorFormula).where(CompetitorFormula.id == competitor_id))
    formula = result.scalar_one_or_none()
    if not formula:
        raise HTTPException(status_code=404, detail="竞品配方不存在")

    await db.delete(formula)
    await db.commit()


@router.get("/{competitor_id}/estimate", response_model=EstimationResponse)
async def estimate_percentages(
    competitor_id: int,
    target_market: str = Query("中国", description="目标市场，用于检测禁用成分"),
    product_category: str = Query("全身", description="产品品类"),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CompetitorFormula).where(CompetitorFormula.id == competitor_id))
    formula = result.scalar_one_or_none()
    if not formula:
        raise HTTPException(status_code=404, detail="竞品配方不存在")

    reg_result = await db.execute(
        select(Regulation).where(
            Regulation.target_market == target_market,
            Regulation.is_banned == True,
        )
    )
    banned_ingredients = {r.ingredient_name for r in reg_result.scalars().all()}

    estimated_items = []
    for idx, ing in enumerate(formula.ingredients):
        rank = idx + 1
        lower, upper = _get_estimation_range(rank)
        median = round((lower + upper) / 2, 2)
        is_banned = ing["name"] in banned_ingredients

        estimated_items.append(
            EstimatedIngredientItem(
                rank=rank,
                name=ing["name"],
                lower_bound=lower,
                upper_bound=upper,
                median_estimate=median,
                is_banned=is_banned,
            )
        )

    return EstimationResponse(
        competitor_id=formula.id,
        competitor_name=formula.competitor_name,
        product_name=formula.product_name,
        ingredients=estimated_items,
    )


@router.get("/{competitor_id}/compare/{version_id}", response_model=GapAnalysisResponse)
async def gap_analysis(
    competitor_id: int,
    version_id: int,
    target_market: str = Query("中国", description="目标市场，用于检测禁用成分"),
    product_category: str = Query("全身", description="产品品类"),
    db: AsyncSession = Depends(get_db),
):
    comp_result = await db.execute(select(CompetitorFormula).where(CompetitorFormula.id == competitor_id))
    competitor = comp_result.scalar_one_or_none()
    if not competitor:
        raise HTTPException(status_code=404, detail="竞品配方不存在")

    ver_result = await db.execute(select(FormulaVersion).where(FormulaVersion.id == version_id))
    version = ver_result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")

    reg_result = await db.execute(
        select(Regulation).where(
            Regulation.target_market == target_market,
            Regulation.is_banned == True,
        )
    )
    banned_ingredients = {r.ingredient_name for r in reg_result.scalars().all()}

    competitor_ing_map = {}
    for idx, ing in enumerate(competitor.ingredients):
        rank = idx + 1
        lower, upper = _get_estimation_range(rank)
        median = round((lower + upper) / 2, 2)
        competitor_ing_map[ing["name"]] = {
            "rank": rank,
            "lower": lower,
            "upper": upper,
            "median": median,
            "is_banned": ing["name"] in banned_ingredients,
        }

    our_ing_map = {ing["name"]: ing["percentage"] for ing in version.ingredients}

    all_names = set(competitor_ing_map.keys()) | set(our_ing_map.keys())

    items = []
    total_score = 0.0
    max_score = 0.0

    for name in sorted(all_names, key=lambda n: (
        competitor_ing_map.get(n, {}).get("rank", 999),
        -our_ing_map.get(n, 0),
    )):
        comp_data = competitor_ing_map.get(name)
        our_pct = our_ing_map.get(name)

        if comp_data and our_pct is not None:
            if our_pct < comp_data["lower"]:
                status = "我方偏低"
                score = 0.5
            elif our_pct > comp_data["upper"]:
                status = "我方偏高"
                score = 0.5
            else:
                status = "接近"
                score = 1.0
            max_score += 1.0
            total_score += score

            items.append(
                GapAnalysisItem(
                    name=name,
                    competitor_lower=comp_data["lower"],
                    competitor_upper=comp_data["upper"],
                    our_percentage=our_pct,
                    gap_status=status,
                    score=score,
                )
            )
        elif comp_data and our_pct is None:
            status = "我方缺失"
            score = 0.0
            max_score += 1.0
            total_score += score

            items.append(
                GapAnalysisItem(
                    name=name,
                    competitor_lower=comp_data["lower"],
                    competitor_upper=comp_data["upper"],
                    our_percentage=None,
                    gap_status=status,
                    score=score,
                )
            )
        else:
            status = "我方独有"
            score = 0.0

            items.append(
                GapAnalysisItem(
                    name=name,
                    competitor_lower=None,
                    competitor_upper=None,
                    our_percentage=our_pct,
                    gap_status=status,
                    score=score,
                )
            )

    gap_score_percentage = round((total_score / max_score) * 100, 2) if max_score > 0 else 0.0

    return GapAnalysisResponse(
        competitor_id=competitor.id,
        competitor_name=competitor.competitor_name,
        product_name=competitor.product_name,
        our_version_id=version.id,
        our_version_number=version.version_number,
        items=items,
        total_score=round(total_score, 2),
        max_score=round(max_score, 2),
        gap_score_percentage=gap_score_percentage,
    )
