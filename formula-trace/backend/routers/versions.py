from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from models import FormulaVersion, ProductLine, ExclusionGroup, Batch
from schemas import FormulaVersionCreate, FormulaVersionResponse, VersionTreeNode, CompareResponse, CompareDiffItem
from utils import compute_batch_scores

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
        ingredients=ingredients_dict
    )
    db.add(version)
    await db.commit()
    await db.refresh(version)

    return FormulaVersionResponse(
        id=version.id,
        product_line_id=version.product_line_id,
        version_number=version.version_number,
        parent_id=version.parent_id,
        ingredients=data.ingredients,
        ingredients_summary=get_ingredients_summary(ingredients_dict),
        batch_count=0,
        best_batch_score=None
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
        version_map[v.id] = VersionTreeNode(
            id=v.id,
            version_number=v.version_number,
            ingredients_summary=get_ingredients_summary(v.ingredients),
            batch_count=info["count"],
            best_batch_score=info["best_score"],
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

    from schemas import IngredientItem
    return FormulaVersionResponse(
        id=version.id,
        product_line_id=version.product_line_id,
        version_number=version.version_number,
        parent_id=version.parent_id,
        ingredients=[IngredientItem(**ing) for ing in version.ingredients],
        ingredients_summary=get_ingredients_summary(version.ingredients),
        batch_count=len(version_batches),
        best_batch_score=best_score
    )
