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
