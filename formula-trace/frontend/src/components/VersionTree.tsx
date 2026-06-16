import type { VersionTreeNode } from '../types';
import { getScoreGradient, getApprovalStatusColor, getApprovalStatusLabel } from '../api';
import { Checkbox, Tag } from 'antd';

interface Props {
  tree: VersionTreeNode[];
  selectedId: number | null;
  compareSelection: number[];
  onSelect: (id: number) => void;
  onToggleCompare: (id: number) => void;
}

function renderNode(
  node: VersionTreeNode,
  level: number,
  selectedId: number | null,
  compareSelection: number[],
  onSelect: (id: number) => void,
  onToggleCompare: (id: number) => void
) {
  const hasBatches = node.batch_count > 0;
  const isSelected = selectedId === node.id;
  const isCompareSelected = compareSelection.includes(node.id);
  const scoreColor = hasBatches ? getScoreGradient(node.best_batch_score) : '#bfbfbf';
  const statusColor = getApprovalStatusColor(node.approval_status);

  return (
    <div key={node.id} style={{ marginLeft: level > 0 ? 20 : 0 }}>
      <div
        className={`tree-node ${isSelected ? 'selected' : ''} ${!hasBatches ? 'no-batches' : ''}`}
        onClick={() => onSelect(node.id)}
        style={{ borderLeftColor: statusColor }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Checkbox
            checked={isCompareSelected}
            onClick={e => e.stopPropagation()}
            onChange={() => onToggleCompare(node.id)}
          />
          <span className="version-badge" style={{ background: scoreColor, color: 'white' }}>
            V{node.version_number}
          </span>
          <Tag
            style={{
              fontSize: 11,
              lineHeight: '18px',
              padding: '0 4px',
              margin: 0,
              borderRadius: 4,
              background: `${statusColor}20`,
              color: statusColor,
              border: `1px solid ${statusColor}40`,
            }}
          >
            {getApprovalStatusLabel(node.approval_status)}
          </Tag>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.ingredients_summary}
          </span>
        </div>
        <div style={{ marginTop: 4, paddingLeft: 28, fontSize: 12, color: '#999' }}>
          {node.batch_count > 0 ? (
            <span>
              <span className="score-color" style={{ background: scoreColor }} />
              <span style={{ marginLeft: 4 }}>
                {node.batch_count} 个批次 · 最高评分 {node.best_batch_score?.toFixed(1)}
              </span>
            </span>
          ) : (
            <span>暂无批次数据</span>
          )}
        </div>
      </div>
      {node.children.length > 0 && (
        <div>
          {node.children.map(child =>
            renderNode(child, level + 1, selectedId, compareSelection, onSelect, onToggleCompare)
          )}
        </div>
      )}
    </div>
  );
}

export default function VersionTree({ tree, selectedId, compareSelection, onSelect, onToggleCompare }: Props) {
  if (tree.length === 0) {
    return <div style={{ textAlign: 'center', color: '#999', padding: 30 }}>暂无版本数据</div>;
  }
  return (
    <div>
      {tree.map(root =>
        renderNode(root, 0, selectedId, compareSelection, onSelect, onToggleCompare)
      )}
    </div>
  );
}
