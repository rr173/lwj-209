import { useState } from 'react';
import { Card, Table, Tag, Space, Button, Modal, Form, Input, InputNumber, DatePicker, message, Progress } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import type { FormulaVersion, Batch } from '../types';
import { getScoreColor, api } from '../api';

interface Props {
  version: FormulaVersion;
  batches: Batch[];
  allBatches: Batch[];
}

export default function VersionDetail({ version, batches, allBatches }: Props) {
  const [traceModalVisible, setTraceModalVisible] = useState(false);
  const [traceData, setTraceData] = useState<any>(null);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [createBatchVisible, setCreateBatchVisible] = useState(false);
  const [submitResultVisible, setSubmitResultVisible] = useState(false);
  const [form] = Form.useForm();
  const [resultForm] = Form.useForm();

  const allIngredients = [...version.ingredients].sort((a, b) => b.percentage - a.percentage);
  const batchesForVersion = allBatches.filter(b => b.version_id === version.id);

  const handleTrace = async (batch: Batch) => {
    setSelectedBatch(batch);
    try {
      const data = await api.traceBatch(batch.batch_number);
      setTraceData(data);
      setTraceModalVisible(true);
    } catch (e) {
      message.error('追溯失败');
    }
  };

  const handleCreateBatch = async (values: any) => {
    try {
      await fetch('/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version_id: version.id,
          production_date: values.production_date.format('YYYY-MM-DD'),
          production_amount: values.production_amount
        })
      });
      message.success('批次创建成功');
      setCreateBatchVisible(false);
      form.resetFields();
      window.location.reload();
    } catch (e) {
      message.error('创建失败');
    }
  };

  const handleSubmitResult = async (values: any) => {
    try {
      await fetch(`/api/batches/${selectedBatch?.id}/test-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      message.success('检测结果提交成功');
      setSubmitResultVisible(false);
      resultForm.resetFields();
      window.location.reload();
    } catch (e) {
      message.error('提交失败');
    }
  };

  const batchColumns = [
    {
      title: '批次号',
      dataIndex: 'batch_number',
      key: 'batch_number',
      render: (v: string) => <code style={{ background: '#f5f7fa', padding: '2px 6px', borderRadius: 4 }}>{v}</code>
    },
    {
      title: '生产日期',
      dataIndex: 'production_date',
      key: 'production_date',
      width: 120
    },
    {
      title: '生产量(kg)',
      dataIndex: 'production_amount',
      key: 'production_amount',
      width: 100
    },
    {
      title: '肤感评分',
      dataIndex: 'skin_feel_score',
      key: 'skin_feel_score',
      width: 100,
      render: (v: number | null) => v ? (
        <Progress
          type="dashboard"
          percent={v * 10}
          format={() => v.toFixed(1)}
          width={40}
          strokeColor={getScoreColor(v)}
        />
      ) : <Tag color="default">未检测</Tag>
    },
    {
      title: '稳定性评分',
      dataIndex: 'stability_score',
      key: 'stability_score',
      width: 100,
      render: (v: number | null) => v ? (
        <Progress
          type="dashboard"
          percent={v * 10}
          format={() => v.toFixed(1)}
          width={40}
          strokeColor={getScoreColor(v)}
        />
      ) : <Tag color="default">未检测</Tag>
    },
    {
      title: '成本(元/kg)',
      dataIndex: 'cost_per_kg',
      key: 'cost_per_kg',
      width: 100,
      render: (v: number | null) => v ? `¥${v.toFixed(0)}` : <Tag color="default">未检测</Tag>
    },
    {
      title: '综合评分',
      dataIndex: 'overall_score',
      key: 'overall_score',
      width: 100,
      render: (v: number | null) => v ? (
        <Tag color={v >= 7 ? 'green' : v >= 5 ? 'orange' : 'red'} style={{ fontSize: 14, padding: '4px 12px' }}>
          {v.toFixed(2)}
        </Tag>
      ) : <Tag color="default">未计算</Tag>
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_: any, record: Batch) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleTrace(record)}>追溯</Button>
          {!(record.skin_feel_score !== null && record.stability_score !== null && record.cost_per_kg !== null) && (
            <Button
              size="small"
              type="primary"
              onClick={() => {
                setSelectedBatch(record);
                setSubmitResultVisible(true);
              }}
            >
              提交检测
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Card
        title={
          <Space>
            <span className="version-badge" style={{ background: version.batch_count > 0 ? getScoreColor(version.best_batch_score) : '#bfbfbf', color: 'white' }}>
              V{version.version_number}
            </span>
            <span>配方版本详情</span>
            {version.parent_id && (
              <Tag color="blue">父版本: V{version.parent_id}</Tag>
            )}
          </Space>
        }
        extra={
          <Button type="primary" onClick={() => setCreateBatchVisible(true)}>
            + 创建试产批次
          </Button>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <h4 style={{ marginBottom: 16 }}>成分列表（按含量降序）</h4>
            <Table
              size="small"
              pagination={false}
              dataSource={allIngredients}
              rowKey="name"
              columns={[
                { title: '成分名称', dataIndex: 'name', key: 'name' },
                {
                  title: '百分比',
                  dataIndex: 'percentage',
                  key: 'percentage',
                  width: 120,
                  render: (v: number) => (
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v.toFixed(2)}%</span>
                  )
                },
                {
                  title: '',
                  key: 'bar',
                  render: (_: any, record: { percentage: number }) => (
                    <div style={{ width: 100, height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${record.percentage}%`,
                          background: 'linear-gradient(90deg, #667eea, #764ba2)'
                        }}
                      />
                    </div>
                  )
                }
              ]}
            />
          </div>
          <div>
            <h4 style={{ marginBottom: 16 }}>统计信息</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Card size="small" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#1890ff' }}>{allIngredients.length}</div>
                <div style={{ color: '#666', fontSize: 12 }}>成分总数</div>
              </Card>
              <Card size="small" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#52c41a' }}>{batchesForVersion.length}</div>
                <div style={{ color: '#666', fontSize: 12 }}>关联批次数</div>
              </Card>
              <Card size="small" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: version.best_batch_score ? getScoreColor(version.best_batch_score) : '#bfbfbf' }}>
                  {version.best_batch_score ? version.best_batch_score.toFixed(1) : '-'}
                </div>
                <div style={{ color: '#666', fontSize: 12 }}>最优批次评分</div>
              </Card>
              <Card size="small" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#faad14' }}>
                  {version.children?.length || 0}
                </div>
                <div style={{ color: '#666', fontSize: 12 }}>派生分支数</div>
              </Card>
            </div>
          </div>
        </div>
      </Card>

      <Card
        title={
          <Space>
            <span>关联批次列表</span>
            <Tag color="blue">{batchesForVersion.length} 个批次</Tag>
          </Space>
        }
      >
        <Table
          size="small"
          dataSource={batchesForVersion}
          rowKey="id"
          columns={batchColumns}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={`追溯批次: ${selectedBatch?.batch_number}`}
        open={traceModalVisible}
        onCancel={() => {
          setTraceModalVisible(false);
          setTraceData(null);
        }}
        footer={null}
        width={700}
      >
        {traceData && (
          <div className="trace-path">
            {traceData.path.map((step: any, index: number) => (
              <div key={step.version_id} className="trace-step">
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  <Tag color="blue">V{step.version_number}</Tag>
                  {index === 0 && <Tag color="green">当前批次所在版本</Tag>}
                  {index === traceData.path.length - 1 && <Tag color="gold">根版本</Tag>}
                </div>
                {step.added.length > 0 && (
                  <div style={{ background: '#f6ffed', padding: 8, borderRadius: 4, marginBottom: 4 }}>
                    <Tag color="green">新增</Tag>
                    {step.added.map((ing: any) => `${ing.name} ${ing.percentage}%`).join(', ')}
                  </div>
                )}
                {step.removed.length > 0 && (
                  <div style={{ background: '#fff1f0', padding: 8, borderRadius: 4, marginBottom: 4 }}>
                    <Tag color="red">删除</Tag>
                    {step.removed.map((ing: any) => `${ing.name} ${ing.percentage}%`).join(', ')}
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

      <Modal
        title="创建试产批次"
        open={createBatchVisible}
        onCancel={() => setCreateBatchVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="production_date" label="生产日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="production_amount" label="生产量(kg)" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="提交检测结果"
        open={submitResultVisible}
        onCancel={() => setSubmitResultVisible(false)}
        onOk={() => resultForm.submit()}
      >
        <Form form={resultForm} layout="vertical">
          <Form.Item name="skin_feel_score" label="肤感评分(1-10)" rules={[{ required: true }]}>
            <InputNumber min={1} max={10} step={0.1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="stability_score" label="稳定性评分(1-10)" rules={[{ required: true }]}>
            <InputNumber min={1} max={10} step={0.1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="cost_per_kg" label="原料成本(元/kg)" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} prefix="¥" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
