import { Modal, Tag, Space } from 'antd';
import type { TracePathResponse } from '../types';

interface Props {
  visible: boolean;
  data: TracePathResponse | null;
  onClose: () => void;
}

export default function TraceModal({ visible, data, onClose }: Props) {
  return (
    <Modal
      title="配方演变路径追溯"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={700}
    >
      {data && (
        <div className="trace-path">
          {data.path.map((step, index) => (
            <div key={step.version_id} className="trace-step">
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                <Space>
                  <Tag color="blue">V{step.version_number}</Tag>
                  {index === 0 && <Tag color="green">当前批次所在版本</Tag>}
                  {index === data.path.length - 1 && <Tag color="gold">根版本</Tag>}
                </Space>
              </div>
              {step.added.length > 0 && (
                <div style={{ background: '#f6ffed', padding: 8, borderRadius: 4, marginBottom: 4 }}>
                  <Tag color="green">新增</Tag>
                  {step.added.map(ing => `${ing.name} ${ing.percentage}%`).join(', ')}
                </div>
              )}
              {step.removed.length > 0 && (
                <div style={{ background: '#fff1f0', padding: 8, borderRadius: 4, marginBottom: 4 }}>
                  <Tag color="red">删除</Tag>
                  {step.removed.map(ing => `${ing.name} ${ing.percentage}%`).join(', ')}
                </div>
              )}
              {step.changed.length > 0 && (
                <div style={{ background: '#fffbe6', padding: 8, borderRadius: 4 }}>
                  <Tag color="gold">调整</Tag>
                  {step.changed.map((c: any) => (
                    <span key={c.name} style={{ marginRight: 12 }}>
                      {c.name}: {c.old_percentage}% → {c.new_percentage}%
                      <span style={{ color: c.delta > 0 ? '#52c41a' : '#f5222d', marginLeft: 4 }}>
                        ({c.delta > 0 ? '+' : ''}{c.delta.toFixed(2)})
                      </span>
                    </span>
                  ))}
                </div>
              )}
              {step.added.length === 0 && step.removed.length === 0 && step.changed.length === 0 && (
                <div style={{ color: '#999', fontSize: 12 }}>根版本，无父版本对比</div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
