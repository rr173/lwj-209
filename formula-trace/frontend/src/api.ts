import axios from 'axios';
import type {
  ProductLine,
  VersionTreeNode,
  FormulaVersion,
  Batch,
  TracePathResponse,
  CompareResponse,
  IngredientTrendResponse,
  FormulaRecommendationResponse,
  ProductLineIngredientsResponse,
  SupplierQuote,
  SupplierQuoteCreate,
  CostBreakdownResponse,
  CostSimulateResponse,
  CostSimulateItem,
  StabilityRiskResponse,
  AgingSimulationResponse,
  CompatibilityListItem,
  ApprovalRecord,
  IngredientInventory,
  InventoryWithTransactions,
  InventoryTransaction,
  PurchaseWarningResponse,
  IngredientInventoryCreate,
  IngredientInventoryUpdate,
  StockInRequest,
  StockOutRequest,
  ReviewMeeting,
  ReviewMeetingListItem,
  ReviewMeetingCreate,
  ReviewScoreSubmit,
  ReviewScore,
  VersionReviewRecord,
  ComplianceReportResponse,
  MultiMarketCompareResponse,
  Regulation,
  RegulationCreate,
  RegulationBatchImportResult,
  ImpactAnalysisResponse,
  IngredientItem,
  CompetitorFormulaListItem,
  CompetitorFormula,
  CompetitorFormulaCreate,
  EstimationResponse,
  GapAnalysisResponse,
  ExperimentCreate,
  ExperimentListItem,
  ExperimentDetailResponse,
  ExperimentComparisonResponse,
} from './types';

const API_BASE = '/api';

export const api = {
  getProductLines: (): Promise<ProductLine[]> =>
    axios.get(`${API_BASE}/product-lines`).then(r => r.data),

  getVersionTree: (productLineId: number): Promise<VersionTreeNode[]> =>
    axios.get(`${API_BASE}/versions/product-line/${productLineId}/tree`).then(r => r.data),

  getVersion: (versionId: number): Promise<FormulaVersion> =>
    axios.get(`${API_BASE}/versions/${versionId}`).then(r => r.data),

  getVersionBatches: (productLineId: number): Promise<Batch[]> =>
    axios.get(`${API_BASE}/batches/product-line/${productLineId}`).then(r => r.data),

  getBatchByNumber: (batchNumber: string): Promise<Batch> =>
    axios.get(`${API_BASE}/batches/by-number/${batchNumber}`).then(r => r.data),

  traceBatch: (batchNumber: string): Promise<TracePathResponse> =>
    axios.get(`${API_BASE}/batches/trace/${batchNumber}`).then(r => r.data),

  compareVersions: (leftId: number, rightId: number): Promise<CompareResponse> =>
    axios.get(`${API_BASE}/versions/compare`, { params: { left_id: leftId, right_id: rightId } }).then(r => r.data),

  analyzeImpact: (parentVersionId: number, adjustments: IngredientItem[], productCategory: string = '全身'): Promise<ImpactAnalysisResponse> =>
    axios.post(`${API_BASE}/versions/impact-analysis`, {
      parent_version_id: parentVersionId,
      adjustments,
      product_category: productCategory
    }).then(r => r.data),

  getIngredientTrend: (productLineId: number, ingredientName: string): Promise<IngredientTrendResponse> =>
    axios.get(`${API_BASE}/analytics/ingredient-trend`, {
      params: { product_line_id: productLineId, ingredient_name: ingredientName }
    }).then(r => r.data),

  getFormulaRecommendation: (productLineId: number): Promise<FormulaRecommendationResponse> =>
    axios.get(`${API_BASE}/analytics/recommend-formula`, {
      params: { product_line_id: productLineId }
    }).then(r => r.data),

  getProductLineIngredients: (productLineId: number): Promise<ProductLineIngredientsResponse> =>
    axios.get(`${API_BASE}/analytics/product-line-ingredients`, {
      params: { product_line_id: productLineId }
    }).then(r => r.data),

  createSupplierQuote: (data: SupplierQuoteCreate): Promise<SupplierQuote> =>
    axios.post(`${API_BASE}/costs/quotes`, data).then(r => r.data),

  getQuotesByIngredient: (ingredientName: string): Promise<SupplierQuote[]> =>
    axios.get(`${API_BASE}/costs/quotes/ingredient/${encodeURIComponent(ingredientName)}`).then(r => r.data),

  deleteSupplierQuote: (quoteId: number): Promise<void> =>
    axios.delete(`${API_BASE}/costs/quotes/${quoteId}`).then(r => r.data),

  getCostBreakdown: (versionId: number): Promise<CostBreakdownResponse> =>
    axios.get(`${API_BASE}/costs/breakdown/${versionId}`).then(r => r.data),

  simulateCost: (versionId: number, ingredients: CostSimulateItem[]): Promise<CostSimulateResponse> =>
    axios.post(`${API_BASE}/costs/simulate`, {
      version_id: versionId,
      ingredients
    }).then(r => r.data),

  getStabilityRisk: (versionId: number): Promise<StabilityRiskResponse> =>
    axios.get(`${API_BASE}/stability/risk-assessment/${versionId}`).then(r => r.data),

  getAgingSimulation: (versionId: number, days: number): Promise<AgingSimulationResponse> =>
    axios.get(`${API_BASE}/stability/aging-simulation/${versionId}`, { params: { days } }).then(r => r.data),

  getCompatibilityByIngredient: (ingredientName: string, versionId?: number): Promise<{
    ingredient_name: string;
    relations: CompatibilityListItem[];
  }> =>
    axios.get(`${API_BASE}/stability/compatibility-rules/by-ingredient/${ingredientName}`, {
      params: versionId ? { version_id: versionId } : {}
    }).then(r => r.data),

  submitForApproval: (versionId: number, operator: string, remark?: string): Promise<FormulaVersion> =>
    axios.post(`${API_BASE}/approvals/${versionId}/submit`, { operator, remark }).then(r => r.data),

  approveVersion: (versionId: number, operator: string, remark?: string): Promise<FormulaVersion> =>
    axios.post(`${API_BASE}/approvals/${versionId}/approve`, { operator, remark }).then(r => r.data),

  rejectVersion: (versionId: number, operator: string, remark: string): Promise<FormulaVersion> =>
    axios.post(`${API_BASE}/approvals/${versionId}/reject`, { operator, remark }).then(r => r.data),

  getApprovalHistory: (versionId: number): Promise<ApprovalRecord[]> =>
    axios.get(`${API_BASE}/approvals/${versionId}/history`).then(r => r.data),

  getInventories: (): Promise<IngredientInventory[]> =>
    axios.get(`${API_BASE}/inventory`).then(r => r.data),

  getInventory: (inventoryId: number): Promise<InventoryWithTransactions> =>
    axios.get(`${API_BASE}/inventory/${inventoryId}`).then(r => r.data),

  createInventory: (data: IngredientInventoryCreate): Promise<IngredientInventory> =>
    axios.post(`${API_BASE}/inventory`, data).then(r => r.data),

  updateInventory: (inventoryId: number, data: IngredientInventoryUpdate): Promise<IngredientInventory> =>
    axios.put(`${API_BASE}/inventory/${inventoryId}`, data).then(r => r.data),

  deleteInventory: (inventoryId: number): Promise<void> =>
    axios.delete(`${API_BASE}/inventory/${inventoryId}`).then(r => r.data),

  stockIn: (inventoryId: number, data: StockInRequest): Promise<IngredientInventory> =>
    axios.post(`${API_BASE}/inventory/${inventoryId}/stock-in`, data).then(r => r.data),

  stockOut: (inventoryId: number, data: StockOutRequest): Promise<IngredientInventory> =>
    axios.post(`${API_BASE}/inventory/${inventoryId}/stock-out`, data).then(r => r.data),

  getInventoryTransactions: (inventoryId: number, days: number = 30): Promise<InventoryTransaction[]> =>
    axios.get(`${API_BASE}/inventory/${inventoryId}/transactions`, { params: { days } }).then(r => r.data),

  getPurchaseWarnings: (): Promise<PurchaseWarningResponse> =>
    axios.get(`${API_BASE}/inventory/warnings`).then(r => r.data),

  createReviewMeeting: (data: ReviewMeetingCreate): Promise<ReviewMeeting> =>
    axios.post(`${API_BASE}/reviews`, data).then(r => r.data),

  getReviewMeetings: (): Promise<ReviewMeetingListItem[]> =>
    axios.get(`${API_BASE}/reviews`).then(r => r.data),

  getReviewMeeting: (meetingId: number): Promise<ReviewMeeting> =>
    axios.get(`${API_BASE}/reviews/${meetingId}`).then(r => r.data),

  startReviewMeeting: (meetingId: number): Promise<ReviewMeeting> =>
    axios.post(`${API_BASE}/reviews/${meetingId}/start`).then(r => r.data),

  submitReviewScore: (meetingId: number, data: ReviewScoreSubmit): Promise<ReviewScore> =>
    axios.post(`${API_BASE}/reviews/${meetingId}/score`, data).then(r => r.data),

  endReviewMeeting: (meetingId: number): Promise<ReviewMeeting> =>
    axios.post(`${API_BASE}/reviews/${meetingId}/end`).then(r => r.data),

  getVersionReviews: (versionId: number): Promise<VersionReviewRecord[]> =>
    axios.get(`${API_BASE}/reviews/version/${versionId}`).then(r => r.data),

  getAvailableMarkets: (): Promise<string[]> =>
    axios.get(`${API_BASE}/regulations/markets`).then(r => r.data),

  getAvailableCategories: (): Promise<string[]> =>
    axios.get(`${API_BASE}/regulations/categories`).then(r => r.data),

  listRegulations: (targetMarket?: string, ingredientName?: string, productCategory?: string): Promise<Regulation[]> =>
    axios.get(`${API_BASE}/regulations`, {
      params: { target_market: targetMarket, ingredient_name: ingredientName, product_category: productCategory }
    }).then(r => r.data),

  createRegulation: (data: RegulationCreate): Promise<Regulation> =>
    axios.post(`${API_BASE}/regulations`, data).then(r => r.data),

  batchImportRegulations: (items: RegulationCreate[]): Promise<RegulationBatchImportResult> =>
    axios.post(`${API_BASE}/regulations/batch-import`, items).then(r => r.data),

  checkCompliance: (versionId: number, targetMarket: string, productCategory: string = '全身'): Promise<ComplianceReportResponse> =>
    axios.post(`${API_BASE}/regulations/check-compliance`, {
      version_id: versionId,
      target_market: targetMarket,
      product_category: productCategory
    }).then(r => r.data),

  multiMarketCompare: (versionId: number, targetMarkets: string[], productCategory: string = '全身'): Promise<MultiMarketCompareResponse> =>
    axios.post(`${API_BASE}/regulations/multi-market-compare`, {
      version_id: versionId,
      target_markets: targetMarkets,
      product_category: productCategory
    }).then(r => r.data),

  exportCompliancePdf: (versionId: number, targetMarkets: string[], productCategory: string = '全身'): Promise<Blob> =>
    axios.post(`${API_BASE}/regulations/export-pdf`, {
      version_id: versionId,
      target_markets: targetMarkets,
      product_category: productCategory
    }, { responseType: 'blob' }).then(r => r.data),

  getCompetitors: (competitorName?: string, productName?: string): Promise<CompetitorFormulaListItem[]> =>
    axios.get(`${API_BASE}/benchmarking`, {
      params: { competitor_name: competitorName, product_name: productName }
    }).then(r => r.data),

  getCompetitor: (competitorId: number): Promise<CompetitorFormula> =>
    axios.get(`${API_BASE}/benchmarking/${competitorId}`).then(r => r.data),

  createCompetitor: (data: CompetitorFormulaCreate): Promise<CompetitorFormula> =>
    axios.post(`${API_BASE}/benchmarking`, data).then(r => r.data),

  updateCompetitorIngredients: (competitorId: number, ingredients: { name: string }[]): Promise<CompetitorFormula> =>
    axios.put(`${API_BASE}/benchmarking/${competitorId}/ingredients`, { ingredients }).then(r => r.data),

  deleteCompetitor: (competitorId: number): Promise<void> =>
    axios.delete(`${API_BASE}/benchmarking/${competitorId}`).then(r => r.data),

  estimatePercentages: (competitorId: number, targetMarket: string = '中国', productCategory: string = '全身'): Promise<EstimationResponse> =>
    axios.get(`${API_BASE}/benchmarking/${competitorId}/estimate`, {
      params: { target_market: targetMarket, product_category: productCategory }
    }).then(r => r.data),

  gapAnalysis: (competitorId: number, versionId: number, targetMarket: string = '中国', productCategory: string = '全身'): Promise<GapAnalysisResponse> =>
    axios.get(`${API_BASE}/benchmarking/${competitorId}/compare/${versionId}`, {
      params: { target_market: targetMarket, product_category: productCategory }
    }).then(r => r.data),

  createExperiment: (data: ExperimentCreate): Promise<ExperimentDetailResponse> =>
    axios.post(`${API_BASE}/experiments`, data).then(r => r.data),

  listExperiments: (): Promise<ExperimentListItem[]> =>
    axios.get(`${API_BASE}/experiments`).then(r => r.data),

  getExperiment: (experimentId: number): Promise<ExperimentDetailResponse> =>
    axios.get(`${API_BASE}/experiments/${experimentId}`).then(r => r.data),

  updateExperimentWeights: (experimentId: number, data: {
    skin_feel_weight: number;
    stability_weight: number;
    cost_weight: number;
  }): Promise<ExperimentDetailResponse> =>
    axios.put(`${API_BASE}/experiments/${experimentId}/weights`, data).then(r => r.data),

  startExperiment: (experimentId: number): Promise<ExperimentDetailResponse> =>
    axios.post(`${API_BASE}/experiments/${experimentId}/start`).then(r => r.data),

  completeExperiment: (experimentId: number): Promise<ExperimentDetailResponse> =>
    axios.post(`${API_BASE}/experiments/${experimentId}/complete`).then(r => r.data),

  linkBatchToExperiment: (experimentId: number, versionId: number, batchId: number): Promise<ExperimentDetailResponse> =>
    axios.post(`${API_BASE}/experiments/${experimentId}/link-batch`, {
      version_id: versionId,
      batch_id: batchId,
    }).then(r => r.data),

  unlinkBatchFromExperiment: (experimentId: number, versionId: number, batchId: number): Promise<ExperimentDetailResponse> =>
    axios.post(`${API_BASE}/experiments/${experimentId}/unlink-batch`, {
      version_id: versionId,
      batch_id: batchId,
    }).then(r => r.data),

  createBatchInExperiment: (experimentId: number, data: {
    version_id: number;
    production_date: string;
    production_amount: number;
  }): Promise<Batch> =>
    axios.post(`${API_BASE}/experiments/${experimentId}/create-batch`, data).then(r => r.data),

  getAvailableBatches: (experimentId: number, versionId: number): Promise<Batch[]> =>
    axios.get(`${API_BASE}/experiments/${experimentId}/available-batches/${versionId}`).then(r => r.data),

  getExperimentComparison: (experimentId: number): Promise<ExperimentComparisonResponse> =>
    axios.get(`${API_BASE}/experiments/${experimentId}/comparison`).then(r => r.data),
};

export function getScoreColor(score: number | null): string {
  if (score === null) return '#bfbfbf';
  if (score >= 8) return '#52c41a';
  if (score >= 6) return '#faad14';
  return '#f5222d';
}

export function getScoreGradient(score: number | null): string {
  if (score === null) return '#bfbfbf';
  const ratio = Math.min(Math.max((score - 4) / 4, 0), 1);
  const r = Math.round(245 - ratio * (245 - 82));
  const g = Math.round(34 + ratio * (196 - 34));
  const b = Math.round(42 + ratio * (26 - 42));
  return `rgb(${r}, ${g}, ${b})`;
}

export function collectVersionIds(node: VersionTreeNode, ids: number[] = []): number[] {
  ids.push(node.id);
  for (const child of node.children) {
    collectVersionIds(child, ids);
  }
  return ids;
}

export function getApprovalStatusColor(status: string): string {
  switch (status) {
    case 'draft': return '#8c8c8c';
    case 'pending': return '#faad14';
    case 'published': return '#52c41a';
    case 'rejected': return '#f5222d';
    default: return '#8c8c8c';
  }
}

export function getApprovalStatusLabel(status: string): string {
  switch (status) {
    case 'draft': return '草稿';
    case 'pending': return '待审批';
    case 'published': return '已发布';
    case 'rejected': return '已驳回';
    default: return status;
  }
}

export function getApprovalStatusTagColor(status: string): string {
  switch (status) {
    case 'draft': return 'default';
    case 'pending': return 'warning';
    case 'published': return 'success';
    case 'rejected': return 'error';
    default: return 'default';
  }
}

export function getReviewStatusLabel(status: string): string {
  switch (status) {
    case 'pending': return '待开始';
    case 'ongoing': return '进行中';
    case 'ended': return '已结束';
    default: return status;
  }
}

export function getReviewStatusColor(status: string): string {
  switch (status) {
    case 'pending': return '#8c8c8c';
    case 'ongoing': return '#1890ff';
    case 'ended': return '#52c41a';
    default: return '#8c8c8c';
  }
}

export function getReviewStatusTagColor(status: string): string {
  switch (status) {
    case 'pending': return 'default';
    case 'ongoing': return 'processing';
    case 'ended': return 'success';
    default: return 'default';
  }
}

export function getDecisionLabel(decision: string): string {
  switch (decision) {
    case 'approve': return '通过';
    case 'conditional': return '有条件通过';
    case 'reject': return '否决';
    default: return decision;
  }
}

export function getDecisionColor(decision: string): string {
  switch (decision) {
    case 'approve': return '#52c41a';
    case 'conditional': return '#faad14';
    case 'reject': return '#f5222d';
    default: return '#8c8c8c';
  }
}

export function getDecisionTagColor(decision: string): string {
  switch (decision) {
    case 'approve': return 'success';
    case 'conditional': return 'warning';
    case 'reject': return 'error';
    default: return 'default';
  }
}

export function getExperimentStatusLabel(status: string): string {
  switch (status) {
    case 'planning': return '规划中';
    case 'ongoing': return '进行中';
    case 'completed': return '已完成';
    default: return status;
  }
}

export function getExperimentStatusColor(status: string): string {
  switch (status) {
    case 'planning': return '#8c8c8c';
    case 'ongoing': return '#1890ff';
    case 'completed': return '#52c41a';
    default: return '#8c8c8c';
  }
}

export function getExperimentStatusTagColor(status: string): string {
  switch (status) {
    case 'planning': return 'default';
    case 'ongoing': return 'processing';
    case 'completed': return 'success';
    default: return 'default';
  }
}
