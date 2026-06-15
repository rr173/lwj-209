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
