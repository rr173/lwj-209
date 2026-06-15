import { useState, useEffect } from 'react';
import { Modal, Table, Tag, Space, Spin, message } from 'antd';
import type { CompareResponse } from '../types';
import { api } from '../api';

interface Props {
  visible: boolean;
  leftId: number;
  rightId: number;
  onClose: () => void;
}

export default function CompareModal({ visible, leftId, rightId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CompareResponse | null>(null);

  useEffect(() => {
    if (visible && leftId && rightId) {
      loadData();
    }
  }, [visible, leftId, rightId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await api.compareVersions(leftId, rightId);
      setData(result);
    } catch (e) {
      message.error('加载对比数据失败');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '成分名称',
      dataIndex: 'name',
      key: 'name',
      render: (v: string, record: any) => (
        <Space>
          {record.change_type === 'added' && <Tag color="green">新增</Tag>}
          {record.change_type === 'removed' && <Tag color="red">删除</Tag>}
          {record.change_type === 'changed' && <Tag color="orange">调整</Tag>}
          {v}
        </Space>
      )
    },
    {
      title: `版本 ${data?.left_version}`,
      dataIndex: 'left_percentage',
      key: 'left',
      width: 150,
      align: 'right' as const,
      render: (v: number | null, record: any) => {
        if (v === null) return <span style={{ color: '#999' }}>-</span>;
        let color = '';
        if (record.change_type === 'removed') color = '#f5222d';
        if (record.change_type === 'changed') color = '#faad14';
        return <span style={{ fontFamily: 'monospace', fontWeight: 600, color }}>{v.toFixed(2)}%</span>;
      },
      onCell: (_: any, record: any) => ({
        className: record.change_type
      })
    },
    {
      title: `版本 ${data?.right_version}`,
      dataIndex: 'right_percentage',
      key: 'right',
      width: 150,
      align: 'right' as const,
      render: (v: number | null, record: any) => {
        if (v === null) return <span style={{ color: '#999' }}>-</span>;
        let color = '';
        if (record.change_type === 'added') color = '#52c41a';
        if (record.change_type === 'changed') color = '#faad14';
        return <span style={{ fontFamily: 'monospace', fontWeight: 600, color }}>{v.toFixed(2)}%</span>;
      },
      onCell: (_: any, record: any) => ({
        className: record.change_type
      })
    },
    {
      title: '变化',
      key: 'delta',
      width: 120,
      align: 'right' as const,
      render: (_: any, record: any) => {
        if (record.change_type === 'unchanged' || record.change_type === 'added' || record.change_type === 'removed') {
          return null;
        }
        const delta = (record.right_percentage || 0) - (record.left_percentage || 0);
        const color = delta > 0 ? '#52c41a' : '#f5222d';
        return (
          <span style={{ fontFamily: 'monospace', fontWeight: 600, color }}>
            {delta > 0 ? '+' : ''}{delta.toFixed(2)}
          </span>
        );
      }
    }
  ];

  const summary = data ? {
    added: data.diff.filter(d => d.change_type === 'added').length,
    removed: data.diff.filter(d => d.change_type === 'removed').length,
    changed: data.diff.filter(d => d.change_type === 'changed').length,
    unchanged: data.diff.filter(d => d.change_type === 'unchanged').length,
  } : null;

  return (
    <Modal
      title={
        <Space>
          <span>版本对比</span>
          <Tag color="blue">V{data?.left_version}</Tag>
          <span>VS</span>
          <Tag color="green">V{data?.right_version}</Tag>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={700}
      bodyStyle={{ minHeight: 400 }}
    >
      <Spin spinning={loading}>
        {summary && (
          <Space style={{ marginBottom: 16 }}>
            <Tag color="green">新增 {summary.added}</Tag>
            <Tag color="red">删除 {summary.removed}</Tag>
            <Tag color="orange">调整 {summary.changed}</Tag>
            <Tag>不变 {summary.unchanged}</Tag>
          </Space>
        )}
        <Table
          className="compare-panel"
          size="small"
          dataSource={data?.diff || []}
          columns={columns}
          rowKey="name"
          pagination={false}
        />
      </Spin>
    </Modal>
  );
}
