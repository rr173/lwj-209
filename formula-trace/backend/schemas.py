from pydantic import BaseModel, Field, field_validator
from datetime import date, datetime
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
    approval_status: str = "draft"

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
    approval_status: str = "draft"
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


class ApprovalSubmitRequest(BaseModel):
    operator: str = Field(..., min_length=1, max_length=200)
    remark: Optional[str] = Field(None, max_length=1000)


class ApprovalActionRequest(BaseModel):
    operator: str = Field(..., min_length=1, max_length=200)
    remark: Optional[str] = Field(None, max_length=1000)


class ApprovalRejectRequest(BaseModel):
    operator: str = Field(..., min_length=1, max_length=200)
    remark: str = Field(..., min_length=1, max_length=1000)


class ApprovalRecordResponse(BaseModel):
    id: int
    version_id: int
    action: str
    operator: str
    remark: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class IngredientInventoryCreate(BaseModel):
    ingredient_name: str = Field(..., min_length=1, max_length=200)
    current_quantity: float = Field(..., ge=0)
    safety_stock: float = Field(..., ge=0)
    storage_location: Optional[str] = Field(None, max_length=200)


class IngredientInventoryUpdate(BaseModel):
    current_quantity: Optional[float] = Field(None, ge=0)
    safety_stock: Optional[float] = Field(None, ge=0)
    storage_location: Optional[str] = Field(None, max_length=200)


class IngredientInventoryResponse(BaseModel):
    id: int
    ingredient_name: str
    current_quantity: float
    safety_stock: float
    storage_location: Optional[str]
    stock_status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StockInRequest(BaseModel):
    quantity: float = Field(..., gt=0)
    batch_number: Optional[str] = Field(None, max_length=50)
    remark: Optional[str] = Field(None, max_length=500)


class StockOutRequest(BaseModel):
    quantity: float = Field(..., gt=0)
    batch_number: Optional[str] = Field(None, max_length=50)
    remark: Optional[str] = Field(None, max_length=500)


class InventoryTransactionResponse(BaseModel):
    id: int
    inventory_id: int
    transaction_type: str
    quantity: float
    batch_number: Optional[str]
    remark: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class InventoryWithTransactionsResponse(IngredientInventoryResponse):
    recent_transactions: list[InventoryTransactionResponse]


class PurchaseWarningItem(BaseModel):
    id: int
    ingredient_name: str
    current_quantity: float
    safety_stock: float
    storage_location: Optional[str]
    average_daily_consumption: float | None
    estimated_days_left: float | None
    warning_level: str
    shortage_amount: float


class PurchaseWarningResponse(BaseModel):
    urgent_count: int
    warning_count: int
    normal_count: int
    items: list[PurchaseWarningItem]


class ReviewMeetingCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    review_date: date
    version_ids: list[int] = Field(..., min_length=1, max_length=5)
    judges: list[str] = Field(..., min_length=1)

    @field_validator('judges')
    @classmethod
    def validate_judges(cls, v):
        if len(v) != len(set(v)):
            raise ValueError("评委不能重复")
        for name in v:
            if not name.strip():
                raise ValueError("评委名称不能为空")
            if len(name) > 200:
                raise ValueError("评委名称不能超过200字符")
        return v


class ReviewScoreSubmit(BaseModel):
    version_id: int
    judge_name: str = Field(..., min_length=1, max_length=200)
    rationality_score: float = Field(..., ge=1, le=10)
    cost_score: float = Field(..., ge=1, le=10)
    feasibility_score: float = Field(..., ge=1, le=10)
    comment: Optional[str] = Field(None, max_length=1000)


class ReviewScoreResponse(BaseModel):
    id: int
    meeting_id: int
    version_id: int
    judge_name: str
    rationality_score: float
    cost_score: float
    feasibility_score: float
    comment: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewDecisionResponse(BaseModel):
    id: int
    meeting_id: int
    version_id: int
    version_number: Optional[int] = None
    ingredients_summary: Optional[str] = None
    avg_rationality: float
    avg_cost: float
    avg_feasibility: float
    final_score: float
    decision: str
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewMeetingResponse(BaseModel):
    id: int
    title: str
    review_date: date
    status: str
    judges: list[str]
    version_ids: list[int]
    version_count: int
    judge_count: int
    created_at: datetime
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    scores: list[ReviewScoreResponse]
    decisions: list[ReviewDecisionResponse]

    class Config:
        from_attributes = True


class ReviewMeetingListItem(BaseModel):
    id: int
    title: str
    review_date: date
    status: str
    version_count: int
    judge_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class VersionReviewRecord(BaseModel):
    meeting_id: int
    meeting_title: str
    meeting_date: date
    meeting_status: str
    avg_rationality: Optional[float]
    avg_cost: Optional[float]
    avg_feasibility: Optional[float]
    final_score: Optional[float]
    decision: Optional[str]
    judge_scores: list[ReviewScoreResponse]

    class Config:
        from_attributes = True


class RegulationBase(BaseModel):
    target_market: str = Field(..., min_length=1, max_length=50)
    ingredient_name: str = Field(..., min_length=1, max_length=200)
    max_percentage: Optional[float] = Field(None, ge=0, le=100)
    is_banned: bool = False
    product_category: str = Field("全身", min_length=1, max_length=100)
    regulation_reference: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=1000)


class RegulationCreate(RegulationBase):
    @field_validator('max_percentage')
    @classmethod
    def check_max_percentage(cls, v, values):
        if values.data.get('is_banned') and v is not None:
            raise ValueError('禁用成分不需要设置限用上限')
        if not values.data.get('is_banned') and v is None:
            raise ValueError('非禁用成分必须设置限用上限')
        return v


class RegulationUpdate(BaseModel):
    max_percentage: Optional[float] = Field(None, ge=0, le=100)
    is_banned: Optional[bool] = None
    product_category: Optional[str] = Field(None, min_length=1, max_length=100)
    regulation_reference: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=1000)


class RegulationResponse(RegulationBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RegulationBatchImportResult(BaseModel):
    success_count: int
    skipped_count: int
    total_count: int


class ComplianceCheckItem(BaseModel):
    ingredient_name: str
    percentage: float
    status: str
    max_percentage: Optional[float]
    is_banned: Optional[bool]
    product_category: Optional[str]
    matched_regulation_category: Optional[str] = None
    notes: Optional[str]
    regulation_reference: Optional[str]


class ComplianceCheckRequest(BaseModel):
    version_id: int
    target_market: str
    product_category: str = Field("全身", min_length=1, max_length=100)


class MultiMarketCompareRequest(BaseModel):
    version_id: int
    target_markets: list[str] = Field(..., min_length=2, max_length=5)
    product_category: str = Field("全身", min_length=1, max_length=100)


class ExportPdfRequest(BaseModel):
    version_id: int
    target_markets: list[str] = Field(..., min_length=1, max_length=5)
    product_category: str = Field("全身", min_length=1, max_length=100)


class ComplianceReportResponse(BaseModel):
    version_id: int
    version_number: int
    target_market: str
    overall_conclusion: str
    compliance_rate: float
    total_ingredients: int
    compliant_count: int
    over_limit_count: int
    banned_count: int
    unlisted_count: int
    items: list[ComplianceCheckItem]


class MultiMarketCompareItem(BaseModel):
    ingredient_name: str
    percentage: float
    market_statuses: dict[str, str]
    has_inconsistency: bool


class MultiMarketCompareResponse(BaseModel):
    version_id: int
    version_number: int
    target_markets: list[str]
    items: list[MultiMarketCompareItem]
    inconsistent_ingredients: list[str]
