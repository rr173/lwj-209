import type { VersionTreeNode, BudgetStatusItem } from '../types';
import { getScoreGradient, getApprovalStatusColor, getApprovalStatusLabel, getBudgetStatusColor, getBudgetStatusLabel } from '../api';
import { Checkbox, Tag, Tooltip } from 'antd';

interface Props {
  tree: VersionTreeNode[];
  selectedId: number | null;
  compareSelection: number[];
  onSelect: (id: number) => void;
  onToggleCompare: (id: number) => void;
  budgetStatusMap: Record<number, BudgetStatusItem>;
}

function renderNode(
  node: VersionTreeNode,
  level: number,
  selectedId: number | null,
  compareSelection: number[],
  onSelect: (id: number) => void,
  onToggleCompare: (id: number) => void,
  budgetStatusMap: Record<number, BudgetStatusItem>
) {
  const hasBatches = node.batch_count > 0;
  const isSelected = selectedId === node.id;
  const isCompareSelected = compareSelection.includes(node.id);
  const scoreColor = hasBatches ? getScoreGradient(node.best_batch_score) : '#bfbfbf';
  const statusColor = getApprovalStatusColor(node.approval_status);

  const budgetStatus = budgetStatusMap[node.id];
  const budgetColor = budgetStatus ? getBudgetStatusColor(budgetStatus.budget_status) : null;
  const budgetLabel = budgetStatus ? getBudgetStatusLabel(budgetStatus.budget_status) : null;

  const renderBudgetIcon = () => {
    if (!budgetStatus || !budgetColor) return null;

    const iconStyle: React.CSSProperties = {
      width: 8,
      height: 8,
      borderRadius: '50%',
      display: 'inline-block',
      flexShrink: 0,
    };

    const tooltipTitle = (
      <div style={{ fontSize: 12 }}>
        <div><strong>预算状态：</strong>{budgetLabel}</div>
        {budgetStatus.actual_cost !== null && (
          <div><strong>实际成本：</strong>¥{budgetStatus.actual_cost.toFixed(2)}/kg</div>
        )}
        <div><strong>预算上限：</strong>¥{budgetStatus.budget_limit.toFixed(2)}/kg</div>
        {budgetStatus.budget_ratio !== null && (
          <div><strong>占预算比例：</strong>{(budgetStatus.budget_ratio * 100).toFixed(1)}%</div>
        )}
        {budgetStatus.has_unknown_cost && (
          <div style={{ color: '#faad14' }}>
            <strong>⚠️ 成本不可靠：</strong>
            {budgetStatus.missing_quotes.join('、')} 暂无报价
          </div>
        )}
      </div>
    );

    return (
      <Tooltip title={tooltipTitle} placement="right">
        <span style={iconStyle} />
      </Tooltip>
    );
  };

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
          {renderBudgetIcon()}
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
              {budgetStatus && budgetStatus.actual_cost !== null && (
                <span style={{ marginLeft: 12 }}>
                  · 成本 ¥{budgetStatus.actual_cost.toFixed(2)}/kg
                  {budgetStatus.budget_ratio !== null && (
                    <span style={{ color: budgetColor || '#999', marginLeft: 4 }}>
                      ({(budgetStatus.budget_ratio * 100).toFixed(0)}%)
                    </span>
                  )}
                </span>
              )}
              {budgetStatus && budgetStatus.has_unknown_cost && (
                <Tag color="warning" style={{ marginLeft: 8, fontSize: 10 }}>
                  预算不可靠
                </Tag>
              )}
            </span>
          ) : (
            <span>暂无批次数据</span>
          )}
        </div>
      </div>
      {node.children.length > 0 && (
        <div>
          {node.children.map(child =>
            renderNode(child, level + 1, selectedId, compareSelection, onSelect, onToggleCompare, budgetStatusMap)
          )}
        </div>
      )}
    </div>
  );
}

export default function VersionTree({ tree, selectedId, compareSelection, onSelect, onToggleCompare, budgetStatusMap }: Props) {
  if (tree.length === 0) {
    return <div style={{ textAlign: 'center', color: '#999', padding: 30 }}>暂无版本数据</div>;
  }
  return (
    <div>
      {tree.map(root =>
        renderNode(root, 0, selectedId, compareSelection, onSelect, onToggleCompare, budgetStatusMap)
      )}
    </div>
  );
}
