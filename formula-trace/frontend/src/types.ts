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
  children?: FormulaVersion[];
}

export interface VersionTreeNode {
  id: number;
  version_number: number;
  ingredients_summary: string;
  batch_count: number;
  best_batch_score: number | null;
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
