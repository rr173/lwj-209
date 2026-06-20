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
  sustainability_score: number | null;
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

export interface Regulation {
  id: number;
  target_market: string;
  ingredient_name: string;
  max_percentage: number | null;
  is_banned: boolean;
  product_category: string;
  regulation_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegulationCreate {
  target_market: string;
  ingredient_name: string;
  max_percentage?: number | null;
  is_banned?: boolean;
  product_category?: string;
  regulation_reference?: string | null;
  notes?: string | null;
}

export interface RegulationBatchImportResult {
  success_count: number;
  skipped_count: number;
  total_count: number;
}

export interface ComplianceCheckItem {
  ingredient_name: string;
  percentage: number;
  status: '合规' | '超限' | '禁用' | '未收录';
  max_percentage: number | null;
  is_banned: boolean | null;
  product_category: string | null;
  matched_regulation_category: string | null;
  notes: string | null;
  regulation_reference: string | null;
}

export interface ComplianceReportResponse {
  version_id: number;
  version_number: number;
  target_market: string;
  overall_conclusion: '全部合规' | '存在超限' | '存在禁用成分';
  compliance_rate: number;
  total_ingredients: number;
  compliant_count: number;
  over_limit_count: number;
  banned_count: number;
  unlisted_count: number;
  items: ComplianceCheckItem[];
}

export interface MultiMarketCompareItem {
  ingredient_name: string;
  percentage: number;
  market_statuses: Record<string, '合规' | '超限' | '禁用' | '未收录'>;
  has_inconsistency: boolean;
}

export interface MultiMarketCompareResponse {
  version_id: number;
  version_number: number;
  target_markets: string[];
  items: MultiMarketCompareItem[];
  inconsistent_ingredients: string[];
}

export interface CostImpactDetail {
  ingredient_name: string;
  original_percentage: number;
  new_percentage: number;
  original_cost: number | null;
  new_cost: number | null;
  cost_delta: number | null;
  unit_price: number | null;
  supplier_name: string | null;
}

export interface CostImpactAnalysis {
  original_total_cost: number;
  new_total_cost: number;
  total_delta: number;
  delta_percentage: number;
  details: CostImpactDetail[];
  missing_quotes: string[];
}

export interface ComplianceRiskItem {
  ingredient_name: string;
  target_market: string;
  percentage: number;
  status: '合规' | '超限' | '禁用' | '未收录';
  max_percentage: number | null;
  is_banned: boolean | null;
  regulation_reference: string | null;
  notes: string | null;
  risk_type: string;
}

export interface ComplianceRiskAnalysis {
  new_risks: ComplianceRiskItem[];
  markets: string[];
}

export interface StabilityRiskPairChange {
  ingredient_a: string;
  ingredient_b: string;
  original_deduction: number;
  new_deduction: number;
  deduction_delta: number;
  compatibility_level: string;
  compatibility_score: number;
  manifestation: string;
  is_significant: boolean;
}

export interface StabilityImpactAnalysis {
  original_total_score: number;
  new_total_score: number;
  score_delta: number;
  original_risk_level: string;
  new_risk_level: string;
  significant_changes: StabilityRiskPairChange[];
  all_pairs: StabilityRiskPairChange[];
}

export interface ExclusionConflictItem {
  group_name: string;
  conflicting_ingredients: string[];
}

export interface ImpactAnalysisResponse {
  parent_version_id: number;
  parent_version_number: number;
  adjusted_ingredients: IngredientItem[];
  cost_impact: CostImpactAnalysis;
  compliance_risk: ComplianceRiskAnalysis;
  stability_impact: StabilityImpactAnalysis;
  exclusion_conflicts: ExclusionConflictItem[];
}

export interface CompetitorIngredientItem {
  name: string;
}

export interface CompetitorFormula {
  id: number;
  competitor_name: string;
  product_name: string;
  ingredients: CompetitorIngredientItem[];
  created_at: string;
  updated_at: string;
}

export interface CompetitorFormulaListItem {
  id: number;
  competitor_name: string;
  product_name: string;
  ingredient_count: number;
  created_at: string;
  updated_at: string;
}

export interface CompetitorFormulaCreate {
  competitor_name: string;
  product_name: string;
  ingredients: CompetitorIngredientItem[];
}

export interface EstimatedIngredientItem {
  rank: number;
  name: string;
  lower_bound: number;
  upper_bound: number;
  median_estimate: number;
  is_banned: boolean;
}

export interface EstimationResponse {
  competitor_id: number;
  competitor_name: string;
  product_name: string;
  ingredients: EstimatedIngredientItem[];
}

export interface GapAnalysisItem {
  name: string;
  competitor_lower: number | null;
  competitor_upper: number | null;
  our_percentage: number | null;
  gap_status: string;
  score: number;
}

export interface GapAnalysisResponse {
  competitor_id: number;
  competitor_name: string;
  product_name: string;
  our_version_id: number;
  our_version_number: number;
  items: GapAnalysisItem[];
  total_score: number;
  max_score: number;
  gap_score_percentage: number;
}

export type ExperimentStatus = 'planning' | 'ongoing' | 'completed';

export interface ExperimentCreate {
  name: string;
  purpose: string;
  version_ids: number[];
  skin_feel_weight: number;
  stability_weight: number;
  cost_weight: number;
}

export interface ExperimentBatchLinkItem {
  id: number;
  batch_id: number;
  batch_number: string;
  production_date: string;
  skin_feel_score: number | null;
  stability_score: number | null;
  cost_per_kg: number | null;
  has_test_result: boolean;
}

export interface ExperimentVersionDetail {
  link_id: number;
  version_id: number;
  version_number: number;
  ingredients_summary: string;
  batch_count: number;
  tested_batch_count: number;
  avg_skin_feel: number | null;
  avg_stability: number | null;
  avg_cost_normalized: number | null;
  batches: ExperimentBatchLinkItem[];
}

export interface ExperimentListItem {
  id: number;
  name: string;
  status: ExperimentStatus;
  version_count: number;
  product_line_id: number;
  product_line_name: string;
  created_at: string;
}

export interface ExperimentDetailResponse {
  id: number;
  name: string;
  purpose: string;
  product_line_id: number;
  product_line_name: string;
  status: ExperimentStatus;
  skin_feel_weight: number;
  stability_weight: number;
  cost_weight: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  versions: ExperimentVersionDetail[];
}

export interface ExperimentVersionScore {
  version_id: number;
  version_number: number;
  ingredients_summary: string;
  avg_skin_feel: number;
  avg_stability: number;
  avg_cost_normalized: number;
  composite_score: number;
  rank: number;
  is_recommended: boolean;
}

export interface ExperimentPairDiff {
  version_a_id: number;
  version_a_number: number;
  version_b_id: number;
  version_b_number: number;
  score_delta: number;
  score_delta_percentage: number;
  is_significant: boolean;
  significance_label: string;
}

export interface ExperimentComparisonResponse {
  experiment_id: number;
  experiment_name: string;
  skin_feel_weight: number;
  stability_weight: number;
  cost_weight: number;
  max_possible_score: number;
  significance_threshold: number;
  version_scores: ExperimentVersionScore[];
  pairwise_diffs: ExperimentPairDiff[];
  recommended_version_id: number;
  recommended_version_number: number;
}

export interface LifecycleEvent {
  event_type: string;
  event_time: string;
  description: string;
  operator: string | null;
  extra: Record<string, any> | null;
}

export interface LifecycleTimelineResponse {
  version_id: number;
  version_number: number;
  derived_from: {
    parent_id: number;
    parent_version_number: number;
  } | null;
  events: LifecycleEvent[];
}

export type MilestoneStatus = 'pending' | 'completed' | 'overdue';

export interface Milestone {
  id: number;
  version_id: number;
  version_number: number | null;
  product_line_id: number | null;
  name: string;
  target_date: string;
  status: MilestoneStatus;
  actual_completion_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface MilestoneCreate {
  version_id: number;
  name: string;
  target_date: string;
}

export interface ProductLineLifecycleStats {
  product_line_id: number;
  avg_days_to_first_batch: number | null;
  avg_days_from_batch_to_approval: number | null;
  avg_version_survival_rounds: number | null;
  overdue_milestone_count: number;
}

export interface IngredientSubstitution {
  id: number;
  primary_ingredient: string;
  substitute_ingredient: string;
  fitness_score: number;
  suggested_ratio: number;
}

export interface IngredientSubstitutionCreate {
  primary_ingredient: string;
  substitute_ingredient: string;
  fitness_score: number;
  suggested_ratio: number;
}

export interface SubstitutionPlanIngredient {
  name: string;
  percentage: number;
  is_new: boolean;
}

export interface SubstitutionPlan {
  substitute_ingredient: string;
  fitness_score: number;
  suggested_ratio: number;
  new_percentage: number;
  final_percentage: number;
  remaining_redistributed: SubstitutionPlanIngredient[];
  full_ingredients: SubstitutionPlanIngredient[];
  has_conflict: boolean;
  conflict_details: string[];
  has_compliance_risk: boolean;
  compliance_risk_details: string[];
  cost_change_rate: number | null;
  stability_risk_change: number | null;
  sensory_impact: string;
  cost_change_score: number | null;
  stability_score: number | null;
  overall_recommendation: number;
}

export interface SubstitutionPlanListResponse {
  version_id: number;
  ingredient_name: string;
  original_percentage: number;
  plans: SubstitutionPlan[];
}

export interface CostBudget {
  id: number;
  product_line_id: number;
  target_cost_per_kg: number;
  warning_threshold: number;
  is_active: boolean;
  created_by: string;
  remark: string | null;
  created_at: string;
  deactivated_at: string | null;
  deactivated_by: string | null;
  warning_cost: number;
}

export interface CostBudgetCreate {
  product_line_id: number;
  target_cost_per_kg: number;
  warning_threshold: number;
  created_by: string;
  remark?: string | null;
}

export interface BudgetAlert {
  id: number;
  budget_id: number;
  version_id: number;
  version_number?: number | null;
  actual_cost: number;
  budget_limit: number;
  exceed_ratio: number;
  alert_type: 'warning' | 'over_budget';
  status: 'pending' | 'handled';
  handled_by: string | null;
  handle_remark: string | null;
  handled_at: string | null;
  created_at: string;
}

export interface BudgetStatusItem {
  version_id: number;
  version_number: number;
  actual_cost: number | null;
  budget_limit: number;
  budget_ratio: number | null;
  budget_status: 'normal' | 'warning' | 'over' | 'unknown' | 'no_budget';
  has_unknown_cost: boolean;
  is_budget_reliable: boolean;
  missing_quotes: string[];
}

export interface BudgetMonitoringResponse {
  product_line_id: number;
  active_budget: CostBudget | null;
  items: BudgetStatusItem[];
}

export interface EnvironmentalAttribute {
  id: number;
  ingredient_name: string;
  biodegradability_score: number;
  carbon_footprint: number;
  source_category: string;
  has_microplastic_risk: boolean;
  source_score: number;
  created_at: string;
  updated_at: string;
}

export interface IngredientEnvironmentalContribution {
  ingredient_name: string;
  percentage: number;
  has_data: boolean;
  biodegradability_score?: number | null;
  carbon_footprint?: number | null;
  source_category?: string | null;
  has_microplastic_risk?: boolean | null;
  weighted_biodegradability?: number | null;
  weighted_carbon?: number | null;
  weighted_source?: number | null;
}

export interface SustainabilityScoreResponse {
  version_id: number;
  version_number: number;
  total_score: number;
  biodegradability_score: number;
  carbon_footprint_score: number;
  source_score: number;
  microplastic_penalty: number;
  is_reliable: boolean;
  missing_ingredients: string[];
  missing_percentage: number;
  contributions: IngredientEnvironmentalContribution[];
  has_microplastic_ingredient: boolean;
}

export interface CompareSustainabilityDimension {
  left_value: number;
  right_value: number;
  delta: number;
  delta_percentage: number;
}

export interface CompareIngredientContribution {
  ingredient_name: string;
  left_percentage?: number | null;
  right_percentage?: number | null;
  change_type: string;
  left_environmental_score?: number | null;
  right_environmental_score?: number | null;
  environmental_impact_delta?: number | null;
  impact_label: string;
}

export interface SustainabilityCompareResponse {
  left_version_id: number;
  left_version_number: number;
  right_version_id: number;
  right_version_number: number;
  total_score: CompareSustainabilityDimension;
  biodegradability_score: CompareSustainabilityDimension;
  carbon_footprint_score: CompareSustainabilityDimension;
  source_score: CompareSustainabilityDimension;
  left_reliable: boolean;
  right_reliable: boolean;
  ingredient_comparisons: CompareIngredientContribution[];
  positive_impact_ingredients: string[];
  negative_impact_ingredients: string[];
}

export type ProcessCardStyle = 'standard' | 'high_precision' | 'rapid' | 'custom';

export interface ProcessStep {
  id: number;
  process_card_id: number;
  step_order: number;
  name: string;
  target_temperature: number | null;
  target_duration: number;
  stirring_speed: number | null;
  temperature_tolerance: number;
  duration_tolerance: number;
  speed_tolerance: number;
  requires_photo: boolean;
  notes: string | null;
}

export interface ProcessCard {
  id: number;
  version_id: number;
  version_number: number | null;
  name: string;
  style: ProcessCardStyle;
  description: string | null;
  created_by: string;
  step_count: number;
  total_duration_minutes: number;
  created_at: string;
  updated_at: string;
  steps: ProcessStep[];
}

export interface ProcessCardListItem {
  id: number;
  version_id: number;
  version_number: number | null;
  name: string;
  style: ProcessCardStyle;
  description: string | null;
  step_count: number;
  total_duration_minutes: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type StepExecutionStatus = 'pending' | 'in_progress' | 'completed' | 'interrupted';
export type ExecutionStatus = 'pending' | 'in_progress' | 'completed' | 'interrupted';

export interface DeviationDetail {
  parameter: string;
  target_value: number | null;
  actual_value: number | null;
  tolerance: number;
  deviation: number;
  deviation_percentage: number;
}

export interface StepExecution {
  id: number;
  execution_id: number;
  process_step_id: number;
  step_order: number;
  name: string | null;
  status: StepExecutionStatus;
  target_temperature: number | null;
  target_duration: number | null;
  stirring_speed: number | null;
  temperature_tolerance: number | null;
  duration_tolerance: number | null;
  speed_tolerance: number | null;
  actual_temperature: number | null;
  actual_duration: number | null;
  actual_stirring_speed: number | null;
  start_time: string | null;
  end_time: string | null;
  interrupted_at: string | null;
  resumed_at: string | null;
  photo_url: string | null;
  remark: string | null;
  requires_photo: boolean;
  notes: string | null;
  has_deviation: boolean;
  deviation_details: DeviationDetail[] | null;
  deviation_deduction: number;
  completed_by: string | null;
}

export interface BatchProcessExecution {
  id: number;
  batch_id: number;
  batch_number: string;
  process_card_id: number;
  process_card_name: string;
  process_card_style: ProcessCardStyle;
  operator: string;
  status: ExecutionStatus;
  consistency_score: number | null;
  total_deviation_count: number;
  started_at: string | null;
  completed_at: string | null;
  was_interrupted: boolean;
  interruption_reason: string | null;
  interrupted_at: string | null;
  resumed_at: string | null;
  step_executions: StepExecution[];
}

export interface TimelineEvent {
  event_type: string;
  timestamp: string;
  step_order: number | null;
  step_name: string | null;
  description: string;
  extra: Record<string, any> | null;
}

export interface ExecutionTimelineResponse {
  execution_id: number;
  batch_id: number;
  batch_number: string;
  process_card_id: number;
  process_card_name: string;
  status: ExecutionStatus;
  consistency_score: number | null;
  total_deviation_count: number;
  operator: string;
  started_at: string | null;
  completed_at: string | null;
  was_interrupted: boolean;
  interruption_reason: string | null;
  interrupted_at: string | null;
  resumed_at: string | null;
  step_executions: StepExecution[];
  timeline_events: TimelineEvent[];
}

export interface BatchStepDiff {
  step_order: number;
  step_name: string;
  parameter: string;
  left_value: number | null;
  right_value: number | null;
  target_value: number | null;
  difference: number | null;
  has_diff: boolean;
  diff_level: 'minor' | 'significant' | null;
}

export interface ProcessCompareResponse {
  left_batch_id: number;
  left_batch_number: string;
  right_batch_id: number;
  right_batch_number: string;
  left_consistency_score: number | null;
  right_consistency_score: number | null;
  left_deviation_count: number;
  right_deviation_count: number;
  left_status: ExecutionStatus;
  right_status: ExecutionStatus;
  step_diffs: BatchStepDiff[];
  summary: {
    total_steps_left: number;
    total_steps_right: number;
    total_parameters_compared: number;
    total_parameters_different: number;
    difference_rate_percentage: number;
    temperature_differences: number;
    duration_differences: number;
    speed_differences: number;
    consistency_score_diff: number;
    deviation_count_diff: number;
  };
  significant_diff_steps: number[];
}

export interface ProcessCardCreate {
  version_id: number;
  name: string;
  style: ProcessCardStyle;
  description?: string;
  created_by: string;
  steps: Array<{
    step_order: number;
    name: string;
    target_temperature?: number | null;
    target_duration: number;
    stirring_speed?: number | null;
    temperature_tolerance?: number;
    duration_tolerance?: number;
    speed_tolerance?: number;
    requires_photo?: boolean;
    notes?: string;
  }>;
}

export interface ExecutionCreate {
  batch_id: number;
  process_card_id: number;
  operator: string;
}

export interface CompleteStepRequest {
  operator: string;
  actual_temperature?: number | null;
  actual_duration: number;
  actual_stirring_speed?: number | null;
  photo_url?: string;
  remark?: string;
}
