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


class SupplierQuoteCreate(BaseModel):
    ingredient_name: str = Field(..., min_length=1, max_length=200)
    supplier_name: str = Field(..., min_length=1, max_length=200)
    unit_price: float = Field(..., gt=0)
    min_order_quantity: float = Field(..., ge=0)
    valid_from: date
    valid_to: date

    @field_validator('valid_to')
    @classmethod
    def check_date_order(cls, v, values):
        if 'valid_from' in values.data and v < values.data['valid_from']:
            raise ValueError('有效期截止日期不能早于开始日期')
        return v


class SupplierQuoteResponse(BaseModel):
    id: int
    ingredient_name: str
    supplier_name: str
    unit_price: float
    min_order_quantity: float
    valid_from: date
    valid_to: date
    is_active: bool

    class Config:
        from_attributes = True


class CostBreakdownItem(BaseModel):
    ingredient_name: str
    percentage: float
    unit_price: float | None
    supplier_name: str | None
    cost: float | None
    has_quote: bool


class CostBreakdownResponse(BaseModel):
    version_id: int
    version_number: int
    total_cost: float
    breakdown: list[CostBreakdownItem]
    missing_quotes: list[str]


class CostSimulateItem(BaseModel):
    name: str
    percentage: float


class CostSimulateRequest(BaseModel):
    version_id: int
    ingredients: list[CostSimulateItem]


class CostSimulateComparison(BaseModel):
    ingredient_name: str
    original_percentage: float
    new_percentage: float
    original_cost: float | None
    new_cost: float | None
    cost_delta: float | None


class CostSimulateResponse(BaseModel):
    version_id: int
    original_total_cost: float
    new_total_cost: float
    total_delta: float
    delta_percentage: float
    items: list[CostSimulateComparison]
    missing_quotes: list[str]


class IngredientTypeConfigCreate(BaseModel):
    ingredient_name: str = Field(..., min_length=1, max_length=200)
    ingredient_type: str = Field(..., pattern="^(活性成分|防腐剂|基础原料)$")


class IngredientTypeConfigResponse(BaseModel):
    id: int
    ingredient_name: str
    ingredient_type: str
    degradation_rate: float

    class Config:
        from_attributes = True


class CompatibilityRuleCreate(BaseModel):
    ingredient_a: str = Field(..., min_length=1, max_length=200)
    ingredient_b: str = Field(..., min_length=1, max_length=200)
    compatibility_level: str = Field(..., pattern="^(相容|轻微不相容|严重不相容)$")
    compatibility_score: float = Field(..., ge=0, le=100)
    manifestation: str = Field(..., min_length=1, max_length=200)
    notes: Optional[str] = Field(None, max_length=500)


class CompatibilityRuleUpdate(BaseModel):
    compatibility_level: Optional[str] = Field(None, pattern="^(相容|轻微不相容|严重不相容)$")
    compatibility_score: Optional[float] = Field(None, ge=0, le=100)
    manifestation: Optional[str] = Field(None, min_length=1, max_length=200)
    notes: Optional[str] = Field(None, max_length=500)


class CompatibilityRuleResponse(BaseModel):
    id: int
    ingredient_a: str
    ingredient_b: str
    compatibility_level: str
    compatibility_score: float
    manifestation: str
    notes: Optional[str]

    class Config:
        from_attributes = True


class CompatibilityListItem(BaseModel):
    other_ingredient: str
    compatibility_level: str
    compatibility_score: Optional[float]
    manifestation: Optional[str]
    notes: Optional[str]
    percentage: Optional[float] = None


class CompatibilityListResponse(BaseModel):
    ingredient_name: str
    relations: list[CompatibilityListItem]


class RiskPairDetail(BaseModel):
    ingredient_a: str
    ingredient_b: str
    percentage_a: float
    percentage_b: float
    compatibility_score: float
    compatibility_level: str
    manifestation: str
    deduction: float


class StabilityRiskResponse(BaseModel):
    version_id: int
    version_number: int
    total_score: float
    risk_level: str
    risk_pairs: list[RiskPairDetail]
    total_deduction: float


class AgingSimulationItem(BaseModel):
    ingredient_name: str
    initial_percentage: float
    ingredient_type: str
    degradation_rate: float
    residual_percentage: float
    degradation_amount: float


class AgingSimulationResponse(BaseModel):
    version_id: int
    version_number: int
    simulation_days: int
    items: list[AgingSimulationItem]
    overall_active_retention_rate: float
    overall_preservative_retention_rate: float
    overall_base_retention_rate: float
