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
  CostSimulateItem
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
