import axios from 'axios';
import type {
  ProductLine,
  VersionTreeNode,
  FormulaVersion,
  Batch,
  TracePathResponse,
  CompareResponse
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
