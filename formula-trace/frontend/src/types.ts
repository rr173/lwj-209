export interface IngredientItem {
  name: string;
  percentage: number;
}

export interface ProductLine {
  id: number;
  name: string;
  target_effect: string;
  version_count: number;
}

export interface FormulaVersion {
  id: number;
  product_line_id: number;
  version_number: number;
  parent_id: number | null;
  ingredients: IngredientItem[];
  ingredients_summary: string;
  batch_count: number;
  best_batch_score: number | null;
  approval_status: string;
  children?: FormulaVersion[];
}

export interface VersionTreeNode {
  id: number;
  version_number: number;
  ingredients_summary: string;
  batch_count: number;
  best_batch_score: number | null;
  approval_status: string;
  children: VersionTreeNode[];
}

export interface Batch {
  id: number;
  version_id: number;
  batch_number: string;
  production_date: string;
  production_amount: number;
  skin_feel_score: number | null;
  stability_score: number | null;
  cost_per_kg: number | null;
  overall_score: number | null;
  has_test_result?: boolean;
}

export interface TraceDiff {
  version_id: number;
  version_number: number;
  added: IngredientItem[];
  removed: IngredientItem[];
  changed: {
    name: string;
    old_percentage: number;
    new_percentage: number;
    delta: number;
  }[];
}

export interface TracePathResponse {
  path: TraceDiff[];
}

export interface CompareDiffItem {
  name: string;
  left_percentage: number | null;
  right_percentage: number | null;
  change_type: 'added' | 'removed' | 'changed' | 'unchanged';
}

export interface CompareResponse {
  left_version: number;
  right_version: number;
  diff: CompareDiffItem[];
}

export interface IngredientTrendRecord {
  version_number: number;
  version_id: number;
  percentage: number;
  best_batch_score: number;
}

export interface IngredientTrendResponse {
  product_line_id: number;
  ingredient_name: string;
  records: IngredientTrendRecord[];
  pearson_correlation: number | null;
  is_strong_correlation: boolean;
  data_point_count: number;
}

export interface RecommendedIngredient {
  name: string;
  original_percentage: number;
  recommended_percentage: number;
  adjustment: string;
  correlation: number | null;
  reason: string;
}

export interface FormulaRecommendationResponse {
  product_line_id: number;
  base_version_id: number;
  base_version_number: number;
  base_version_score: number;
  recommended_ingredients: RecommendedIngredient[];
  notes: string[];
}

export interface ProductLineIngredientsResponse {
  product_line_id: number;
  ingredients: string[];
}

export interface SupplierQuote {
  id: number;
  ingredient_name: string;
  supplier_name: string;
  unit_price: number;
  min_order_quantity: number;
  valid_from: string;
  valid_to: string;
  is_active: boolean;
}

export interface SupplierQuoteCreate {
  ingredient_name: string;
  supplier_name: string;
  unit_price: number;
  min_order_quantity: number;
  valid_from: string;
  valid_to: string;
}

export interface CostBreakdownItem {
  ingredient_name: string;
  percentage: number;
  unit_price: number | null;
  supplier_name: string | null;
  cost: number | null;
  has_quote: boolean;
}

export interface CostBreakdownResponse {
  version_id: number;
  version_number: number;
  total_cost: number;
  breakdown: CostBreakdownItem[];
  missing_quotes: string[];
}

export interface CostSimulateItem {
  name: string;
  percentage: number;
}

export interface CostSimulateComparison {
  ingredient_name: string;
  original_percentage: number;
  new_percentage: number;
  original_cost: number | null;
  new_cost: number | null;
  cost_delta: number | null;
}

export interface CostSimulateResponse {
  version_id: number;
  original_total_cost: number;
  new_total_cost: number;
  total_delta: number;
  delta_percentage: number;
  items: CostSimulateComparison[];
  missing_quotes: string[];
}

export interface CompatibilityListItem {
  other_ingredient: string;
  compatibility_level: string;
  compatibility_score: number | null;
  manifestation: string | null;
  notes: string | null;
  percentage: number | null;
}

export interface IngredientTypeConfig {
  id: number;
  ingredient_name: string;
  ingredient_type: string;
  degradation_rate: number;
}

export interface CompatibilityRule {
  id: number;
  ingredient_a: string;
  ingredient_b: string;
  compatibility_level: string;
  compatibility_score: number;
  manifestation: string;
  notes: string | null;
}

export interface RiskPairDetail {
  ingredient_a: string;
  ingredient_b: string;
  percentage_a: number;
  percentage_b: number;
  compatibility_score: number;
  compatibility_level: string;
  manifestation: string;
  deduction: number;
}

export interface StabilityRiskResponse {
  version_id: number;
  version_number: number;
  total_score: number;
  risk_level: string;
  risk_pairs: RiskPairDetail[];
  total_deduction: number;
}

export interface AgingSimulationItem {
  ingredient_name: string;
  initial_percentage: number;
  ingredient_type: string;
  degradation_rate: number;
  residual_percentage: number;
  degradation_amount: number;
}

export interface AgingSimulationResponse {
  version_id: number;
  version_number: number;
  simulation_days: number;
  items: AgingSimulationItem[];
  overall_active_retention_rate: number;
  overall_preservative_retention_rate: number;
  overall_base_retention_rate: number;
}

export interface ApprovalRecord {
  id: number;
  version_id: number;
  action: string;
  operator: string;
  remark: string | null;
  created_at: string;
}

export type ApprovalStatus = 'draft' | 'pending' | 'published' | 'rejected';

export interface IngredientInventory {
  id: number;
  ingredient_name: string;
  current_quantity: number;
  safety_stock: number;
  storage_location: string | null;
  stock_status: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryTransaction {
  id: number;
  inventory_id: number;
  transaction_type: 'stock_in' | 'stock_out';
  quantity: number;
  batch_number: string | null;
  remark: string | null;
  created_at: string;
}

export interface InventoryWithTransactions extends IngredientInventory {
  recent_transactions: InventoryTransaction[];
}

export interface PurchaseWarningItem {
  id: number;
  ingredient_name: string;
  current_quantity: number;
  safety_stock: number;
  storage_location: string | null;
  average_daily_consumption: number | null;
  estimated_days_left: number | null;
  warning_level: 'urgent' | 'warning' | 'normal';
  shortage_amount: number;
}

export interface PurchaseWarningResponse {
  urgent_count: number;
  warning_count: number;
  normal_count: number;
  items: PurchaseWarningItem[];
}

export interface IngredientInventoryCreate {
  ingredient_name: string;
  current_quantity: number;
  safety_stock: number;
  storage_location?: string | null;
}

export interface IngredientInventoryUpdate {
  current_quantity?: number | null;
  safety_stock?: number | null;
  storage_location?: string | null;
}

export interface StockInRequest {
  quantity: number;
  batch_number?: string | null;
  remark?: string | null;
}

export interface StockOutRequest {
  quantity: number;
  batch_number?: string | null;
  remark?: string | null;
}

export interface ReviewScore {
  id: number;
  meeting_id: number;
  version_id: number;
  judge_name: string;
  rationality_score: number;
  cost_score: number;
  feasibility_score: number;
  comment: string | null;
  created_at: string;
}

export interface ReviewDecision {
  id: number;
  meeting_id: number;
  version_id: number;
  version_number?: number | null;
  ingredients_summary?: string | null;
  avg_rationality: number;
  avg_cost: number;
  avg_feasibility: number;
  final_score: number;
  decision: 'approve' | 'conditional' | 'reject';
  created_at: string;
}

export interface ReviewMeeting {
  id: number;
  title: string;
  review_date: string;
  status: 'pending' | 'ongoing' | 'ended';
  judges: string[];
  version_ids: number[];
  version_count: number;
  judge_count: number;
  created_at: string;
  started_at?: string | null;
  ended_at?: string | null;
  scores: ReviewScore[];
  decisions: ReviewDecision[];
}

export interface ReviewMeetingListItem {
  id: number;
  title: string;
  review_date: string;
  status: 'pending' | 'ongoing' | 'ended';
  version_count: number;
  judge_count: number;
  created_at: string;
}

export interface ReviewMeetingCreate {
  title: string;
  review_date: string;
  version_ids: number[];
  judges: string[];
}

export interface ReviewScoreSubmit {
  version_id: number;
  judge_name: string;
  rationality_score: number;
  cost_score: number;
  feasibility_score: number;
  comment?: string | null;
}

export interface VersionReviewRecord {
  meeting_id: number;
  meeting_title: string;
  meeting_date: string;
  meeting_status: string;
  avg_rationality: number | null;
  avg_cost: number | null;
  avg_feasibility: number | null;
  final_score: number | null;
  decision: string | null;
  judge_scores: ReviewScore[];
}
