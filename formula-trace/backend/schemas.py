from pydantic import BaseModel, Field, field_validator
from datetime import date
from typing import Optional


class IngredientItem(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    percentage: float = Field(..., ge=0, le=100)


class ProductLineBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    target_effect: str = Field(..., min_length=1, max_length=500)


class ProductLineCreate(ProductLineBase):
    pass


class ProductLineResponse(ProductLineBase):
    id: int
    version_count: int

    class Config:
        from_attributes = True


class ExclusionGroupBase(BaseModel):
    name: str
    ingredients: list[str]


class ExclusionGroupCreate(ExclusionGroupBase):
    pass


class ExclusionGroupResponse(ExclusionGroupBase):
    id: int
    product_line_id: int

    class Config:
        from_attributes = True


class FormulaVersionCreate(BaseModel):
    product_line_id: int
    parent_id: Optional[int] = None
    ingredients: list[IngredientItem]

    @field_validator('ingredients')
    @classmethod
    def validate_ingredients(cls, v):
        if not v:
            raise ValueError("配方至少需要一个成分")
        names = [item.name for item in v]
        if len(names) != len(set(names)):
            raise ValueError("成分名称不能重复")
        total = round(sum(item.percentage for item in v), 2)
        if abs(total - 100.0) > 0.01:
            raise ValueError(f"所有成分百分比之和必须等于100%，当前为{total}%")
        for item in v:
            if round(item.percentage, 2) != item.percentage:
                raise ValueError(f"成分百分比必须精确到小数点后两位")
        return v


class FormulaVersionResponse(BaseModel):
    id: int
    product_line_id: int
    version_number: int
    parent_id: Optional[int]
    ingredients: list[IngredientItem]
    ingredients_summary: str
    batch_count: int
    best_batch_score: Optional[float]

    class Config:
        from_attributes = True


class BatchCreate(BaseModel):
    version_id: int
    production_date: date
    production_amount: float = Field(..., gt=0)


class BatchTestResult(BaseModel):
    skin_feel_score: float = Field(..., ge=1, le=10)
    stability_score: float = Field(..., ge=1, le=10)
    cost_per_kg: float = Field(..., gt=0)


class BatchResponse(BaseModel):
    id: int
    version_id: int
    batch_number: str
    production_date: date
    production_amount: float
    skin_feel_score: Optional[float]
    stability_score: Optional[float]
    cost_per_kg: Optional[float]
    overall_score: Optional[float]

    class Config:
        from_attributes = True


class VersionTreeNode(BaseModel):
    id: int
    version_number: int
    ingredients_summary: str
    batch_count: int
    best_batch_score: Optional[float]
    children: list["VersionTreeNode"] = []


class TraceDiff(BaseModel):
    version_id: int
    version_number: int
    added: list[IngredientItem] = []
    removed: list[IngredientItem] = []
    changed: list[dict] = []


class TracePathResponse(BaseModel):
    path: list[TraceDiff]


class CompareDiffItem(BaseModel):
    name: str
    left_percentage: Optional[float] = None
    right_percentage: Optional[float] = None
    change_type: str


class CompareResponse(BaseModel):
    left_version: int
    right_version: int
    diff: list[CompareDiffItem]


class IngredientTrendRecord(BaseModel):
    version_number: int
    version_id: int
    percentage: float
    best_batch_score: float


class IngredientTrendResponse(BaseModel):
    product_line_id: int
    ingredient_name: str
    records: list[IngredientTrendRecord]
    pearson_correlation: float | None
    is_strong_correlation: bool
    data_point_count: int


class RecommendedIngredient(BaseModel):
    name: str
    original_percentage: float
    recommended_percentage: float
    adjustment: str
    correlation: float | None
    reason: str


class FormulaRecommendationResponse(BaseModel):
    product_line_id: int
    base_version_id: int
    base_version_number: int
    base_version_score: float
    recommended_ingredients: list[RecommendedIngredient]
    notes: list[str]
