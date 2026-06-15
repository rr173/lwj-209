import { useState, useEffect, useMemo } from 'react';
import { Card, Table, Tag, Space, Button, Modal, Form, Input, InputNumber, DatePicker, message, Progress, Row, Col, Divider, Typography, Tabs, Select, Alert, Empty, Statistic } from 'antd';
import { EyeOutlined, PlusOutlined, DeleteOutlined, MinusCircleOutlined, LineChartOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { FormulaVersion, Batch, IngredientItem, IngredientTrendResponse, FormulaRecommendationResponse } from '../types';
import { getScoreColor, api } from '../api';

const { Title, Text } = Typography;

interface Props {
  version: FormulaVersion;
  batches: Batch[];
  allBatches: Batch[];
  onVersionCreated?: () => void;
}

export default function VersionDetail({ version, batches, allBatches, onVersionCreated }: Props) {
  const [traceModalVisible, setTraceModalVisible] = useState(false);
  const [traceData, setTraceData] = useState<any>(null);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [createBatchVisible, setCreateBatchVisible] = useState(false);
  const [submitResultVisible, setSubmitResultVisible] = useState(false);
  const [createVersionVisible, setCreateVersionVisible] = useState(false);
  const [recommendVisible, setRecommendVisible] = useState(false);
  const [form] = Form.useForm();
  const [resultForm] = Form.useForm();
  const [versionForm] = Form.useForm();

  const [selectedIngredient, setSelectedIngredient] = useState<string | undefined>();
  const [trendData, setTrendData] = useState<IngredientTrendResponse | null>(null);
  const [trendLoading, setTrendLoading] = useState(false);

  const [recommendData, setrecommendData] = useState<FormulaRecommendationResponse | null>(null);
  const [recommendLoading, setrecommendLoading] = useState(false);

  const allIngredients = [...version.ingredients].sort((a, b) => b.percentage - a.percentage);
  const batchesForVersion = allBatches.filter(b => b.version_id === version.id);

  const ingredientOptions = useMemo(() => {
    const names = new Set<string>();
    version.ingredients.forEach(ing => names.add(ing.name));
    return Array.from(names).map(name => ({ label: name, value: name }));
  }, [version.ingredients]);

  useEffect(() => {
    if (ingredientOptions.length > 0 && !selectedIngredient) {
      setSelectedIngredient(ingredientOptions[0].value);
    }
  }, [ingredientOptions, selectedIngredient]);

  useEffect(() => {
    if (!selectedIngredient) return;
    let cancelled = false;
    setTrendLoading(true);
    api.getIngredientTrend(version.product_line_id, selectedIngredient)
      .then(data => {
        if (!cancelled) setTrendData(data);
      })
      .catch(e => {
        if (!cancelled) {
          message.error('获取成分趋势失败');
          setTrendData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setTrendLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedIngredient, version.product_line_id]);

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

  const handleCreateVersion = async (values: any) => {
    const ingredients = values.ingredients
      .filter((item: any) => item.name && item.percentage !== undefined && item.percentage !== null)
      .map((item: any) => ({
        name: item.name.trim(),
        percentage: Number(Number(item.percentage).toFixed(2))
      }));

    try {
      const resp = await fetch('/api/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_line_id: version.product_line_id,
          parent_id: version.id,
          ingredients
        })
      });
      const data = await resp.json();
      if (!resp.ok) {
        let errMsg = '创建失败';
        if (data?.detail) {
          if (typeof data.detail === 'object' && data.detail.message) {
            errMsg = `${data.detail.message}: ${JSON.stringify(data.detail.conflicts)}`;
          } else if (Array.isArray(data.detail)) {
            errMsg = data.detail.map((e: any) => e.msg).join('; ');
          } else {
            errMsg = String(data.detail);
          }
        }
        message.error(errMsg);
        return;
      }
      message.success(`新版本 V${data.version_number} 创建成功，已挂在当前版本下方！`);
      setCreateVersionVisible(false);
      versionForm.resetFields();
      if (onVersionCreated) {
        onVersionCreated();
      }
      setTimeout(() => window.location.reload(), 800);
    } catch (e: any) {
      message.error(e?.message || '创建失败');
    }
  };

  const openCreateVersion = () => {
    versionForm.setFieldsValue({
      ingredients: version.ingredients.map(ing => ({
        name: ing.name,
        percentage: ing.percentage
      }))
    });
    setCreateVersionVisible(true);
  };

  const openRecommend = async () => {
    setRecommendVisible(true);
    setrecommendLoading(true);
    setrecommendData(null);
    try {
      const data = await api.getFormulaRecommendation(version.product_line_id);
      setrecommendData(data);
    } catch (e: any) {
      let errMsg = '获取推荐失败';
      if (e?.response?.data?.detail) {
        errMsg = typeof e.response.data.detail === 'string'
          ? e.response.data.detail
          : JSON.stringify(e.response.data.detail);
      }
      message.error(errMsg);
    } finally {
      setrecommendLoading(false);
    }
  };

  const applyRecommendation = () => {
    if (!recommendData) return;
    versionForm.setFieldsValue({
      ingredients: recommendData.recommended_ingredients.map(ing => ({
        name: ing.name,
        percentage: ing.recommended_percentage
      }))
    });
    setRecommendVisible(false);
    setCreateVersionVisible(true);
  };

  const calcTotal = (values: any[]) => {
    if (!values) return 0;
    return values.reduce((sum, item) => sum + (Number(item?.percentage) || 0), 0);
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

  const chartData = useMemo(() => {
    if (!trendData) return [];
    return trendData.records.map(r => ({
      version: `V${r.version_number}`,
      percentage: r.percentage,
      score: r.best_batch_score
    }));
  }, [trendData]);

  const renderOverviewTab = () => (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
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

      <Divider />

      <div>
        <Space>
          <span style={{ fontWeight: 600 }}>关联批次列表</span>
          <Tag color="blue">{batchesForVersion.length} 个批次</Tag>
        </Space>
        <Table
          size="small"
          style={{ marginTop: 16 }}
          dataSource={batchesForVersion}
          rowKey="id"
          columns={batchColumns}
          pagination={{ pageSize: 10 }}
        />
      </div>
    </Space>
  );

  const renderTrendTab = () => (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Card size="small">
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Text strong>选择成分：</Text>
            <Select
              style={{ minWidth: 240 }}
              showSearch
              placeholder="搜索或选择成分..."
              optionFilterProp="label"
              value={selectedIngredient}
              onChange={setSelectedIngredient}
              options={ingredientOptions}
            />
            {trendData && (
              <Space>
                <Text type="secondary">数据点：{trendData.data_point_count}</Text>
                {trendData.data_point_count < 3 && (
                  <Tag color="orange">数据不足，无法计算相关系数</Tag>
                )}
              </Space>
            )}
          </div>

          {trendData && trendData.pearson_correlation !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <Statistic
                title="皮尔逊相关系数"
                value={trendData.pearson_correlation}
                precision={4}
                valueStyle={{
                  color: trendData.is_strong_correlation
                    ? (trendData.pearson_correlation > 0 ? '#52c41a' : '#f5222d')
                    : '#8c8c8c',
                  fontSize: 20,
                  fontWeight: 700
                }}
              />
              {trendData.is_strong_correlation && (
                <Tag color={trendData.pearson_correlation! > 0 ? 'green' : 'red'} style={{ fontSize: 14, padding: '4px 16px' }}>
                  强{trendData.pearson_correlation! > 0 ? '正' : '负'}相关 (|r| {'>'} 0.5)
                </Tag>
              )}
              {!trendData.is_strong_correlation && (
                <Tag color="default">相关性较弱</Tag>
              )}
            </div>
          )}
        </Space>
      </Card>

      <Card title="成分用量与综合评分趋势图" loading={trendLoading}>
        {chartData.length > 0 ? (
          <div style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 60, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="version"
                  tick={{ fontSize: 12 }}
                  label={{ value: '版本号', position: 'insideBottom', offset: -10 }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12 }}
                  label={{ value: '成分百分比 (%)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
                  domain={[0, 'auto']}
                  tickFormatter={(v) => v.toFixed(1)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  label={{ value: '综合评分', angle: 90, position: 'insideRight', style: { textAnchor: 'middle' } }}
                  domain={[0, 10]}
                  tickFormatter={(v) => v.toFixed(1)}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 8 }}
                  formatter={(value: any, name: any) => [
                    name === 'percentage' ? `${Number(value).toFixed(2)}%` : Number(value).toFixed(2),
                    name === 'percentage' ? '成分用量' : '综合评分'
                  ]}
                />
                <Legend
                  formatter={(value: any) =>
                    value === 'percentage' ? '成分用量 (%)' : '综合评分'
                  }
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="percentage"
                  stroke="#667eea"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#667eea' }}
                  activeDot={{ r: 7 }}
                  name="percentage"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="score"
                  stroke="#fa8c16"
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  dot={{ r: 5, fill: '#fa8c16' }}
                  activeDot={{ r: 7 }}
                  name="score"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          !trendLoading && (
            <Empty description="暂无趋势数据（该产品线无足够检测结果的版本）" />
          )
        )}
      </Card>

      {chartData.length > 0 && (
        <Card title="原始数据明细" size="small">
          <Table
            size="small"
            dataSource={trendData?.records.map(r => ({
              key: r.version_id,
              version: `V${r.version_number}`,
              percentage: `${r.percentage.toFixed(2)}%`,
              score: r.best_batch_score.toFixed(2)
            })) || []}
            pagination={{ pageSize: 10 }}
            columns={[
              { title: '版本号', dataIndex: 'version', key: 'version', width: 120 },
              { title: `${selectedIngredient || '成分'} 用量`, dataIndex: 'percentage', key: 'percentage', width: 160 },
              { title: '最优批次综合评分', dataIndex: 'score', key: 'score' }
            ]}
          />
        </Card>
      )}
    </Space>
  );

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
          <Space>
            <Button type="dashed" onClick={openRecommend} icon={<ThunderboltOutlined />}>
              智能推荐
            </Button>
            <Button type="dashed" onClick={openCreateVersion}>
              <PlusOutlined /> 派生新版本
            </Button>
            <Button type="primary" onClick={() => setCreateBatchVisible(true)}>
              + 创建试产批次
            </Button>
          </Space>
        }
      >
        <Tabs
          defaultActiveKey="overview"
          items={[
            {
              key: 'overview',
              label: <span><LineChartOutlined /> 概览与批次</span>,
              children: renderOverviewTab()
            },
            {
              key: 'trend',
              label: <span><LineChartOutlined /> 成分趋势</span>,
              children: renderTrendTab()
            }
          ]}
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

      <Modal
        title={
          <Space>
            <span>从 V{version.version_number} 派生新版本</span>
            <Tag color="blue">parent_id={version.id}</Tag>
          </Space>
        }
        open={createVersionVisible}
        onCancel={() => setCreateVersionVisible(false)}
        onOk={() => versionForm.submit()}
        width={680}
        okText="创建新版本"
      >
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          系统已预填父版本的成分，请直接修改。百分比之和必须精确等于 100.00%。
        </Typography.Paragraph>
        <Form
          form={versionForm}
          layout="vertical"
          onFinish={handleCreateVersion}
        >
          <Form.List
            name="ingredients"
            rules={[
              {
                validator: async (_, ingredients) => {
                  const total = calcTotal(ingredients);
                  if (Math.abs(total - 100.0) > 0.01) {
                    return Promise.reject(new Error(`百分比总和需等于100%，当前为 ${total.toFixed(2)}%`));
                  }
                }
              }
            ]}
          >
            {(fields, { add, remove }, { errors }) => (
              <>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 120px 40px',
                  gap: 8,
                  fontWeight: 600,
                  padding: '0 4px 8px 4px',
                  borderBottom: '1px solid #f0f0f0',
                  marginBottom: 8
                }}>
                  <span>成分名称</span>
                  <span style={{ textAlign: 'right' }}>百分比%</span>
                  <span></span>
                </div>
                {fields.map(({ key, name, ...restField }) => (
                  <Row key={key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                    <Col flex="auto">
                      <Form.Item
                        {...restField}
                        name={[name, 'name']}
                        rules={[{ required: true, message: '必填' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Input placeholder="成分名称" />
                      </Form.Item>
                    </Col>
                    <Col style={{ width: 130 }}>
                      <Form.Item
                        {...restField}
                        name={[name, 'percentage']}
                        rules={[
                          { required: true, message: '必填' },
                          { type: 'number', min: 0, max: 100, message: '0-100之间' }
                        ]}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber
                          min={0}
                          max={100}
                          step={0.01}
                          precision={2}
                          style={{ width: '100%' }}
                          suffix="%"
                        />
                      </Form.Item>
                    </Col>
                    <Col style={{ width: 40 }}>
                      <MinusCircleOutlined
                        onClick={() => remove(name)}
                        style={{ color: '#f5222d', fontSize: 18, cursor: 'pointer' }}
                      />
                    </Col>
                  </Row>
                ))}
                <Form.Item style={{ marginTop: 16 }}>
                  <Button
                    type="dashed"
                    onClick={() => add({ name: '', percentage: 0 })}
                    block
                    icon={<PlusOutlined />}
                  >
                    添加成分
                  </Button>
                  <Form.ErrorList errors={errors} />
                </Form.Item>
              </>
            )}
          </Form.List>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.ingredients !== curr.ingredients}>
            {({ getFieldsValue }) => {
              const values = getFieldsValue();
              const total = calcTotal(values.ingredients);
              const ok = Math.abs(total - 100.0) <= 0.01;
              return (
                <div style={{
                  padding: 12,
                  background: ok ? '#f6ffed' : '#fff1f0',
                  borderRadius: 6,
                  border: `1px solid ${ok ? '#b7eb8f' : '#ffa39e'}`,
                  textAlign: 'center',
                  fontWeight: 600
                }}>
                  <span style={{ color: ok ? '#52c41a' : '#f5222d' }}>
                    当前合计：{total.toFixed(2)}%
                    {ok ? ' ✓ 符合要求' : ' ✗ 需调整至100.00%'}
                  </span>
                </div>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <Space>
            <ThunderboltOutlined style={{ color: '#fa8c16' }} />
            <span>智能配方推荐</span>
          </Space>
        }
        open={recommendVisible}
        onCancel={() => {
          setRecommendVisible(false);
          setrecommendData(null);
        }}
        width={820}
        footer={recommendData ? (
          <Space>
            <Button onClick={() => setRecommendVisible(false)}>关闭</Button>
            <Button type="primary" onClick={applyRecommendation}>
              应用推荐并创建新版本
            </Button>
          </Space>
        ) : null}
        confirmLoading={recommendLoading}
      >
        {recommendLoading ? (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <div>正在分析历史数据并生成推荐...</div>
          </div>
        ) : recommendData ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message={
                <Space direction="vertical" size={4}>
                  <span>基准版本：<Tag color="blue" style={{ margin: 0 }}>V{recommendData.base_version_number}</Tag>（ID: {recommendData.base_version_id}）</span>
                  <span>基准版本最优批次综合评分：<Text strong style={{ color: getScoreColor(recommendData.base_version_score) }}>{recommendData.base_version_score.toFixed(2)}</Text></span>
                </Space>
              }
              description="基于该产品线所有有检测结果的版本，计算每个成分用量与评分的皮尔逊相关系数，对强相关成分(|r|>0.5)给出调整建议，幅度1-3%与相关强度线性映射。"
            />

            {recommendData.notes.length > 0 && (
              <Alert
                type="warning"
                showIcon
                message="以下调整因互斥冲突被跳过"
                description={
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {recommendData.notes.map((note, i) => <li key={i}>{note}</li>)}
                  </ul>
                }
              />
            )}

            <Table
              size="small"
              pagination={false}
              dataSource={recommendData.recommended_ingredients.map((ing, idx) => ({ key: idx, ...ing }))}
              columns={[
                {
                  title: '成分名称',
                  dataIndex: 'name',
                  key: 'name',
                  width: 140,
                  fixed: 'left'
                },
                {
                  title: '原百分比',
                  dataIndex: 'original_percentage',
                  key: 'original_percentage',
                  width: 100,
                  align: 'right',
                  render: (v: number) => <span style={{ fontFamily: 'monospace' }}>{v.toFixed(2)}%</span>
                },
                {
                  title: '推荐百分比',
                  dataIndex: 'recommended_percentage',
                  key: 'recommended_percentage',
                  width: 110,
                  align: 'right',
                  render: (v: number) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v.toFixed(2)}%</span>
                },
                {
                  title: '调整',
                  dataIndex: 'adjustment',
                  key: 'adjustment',
                  width: 70,
                  align: 'center',
                  render: (v: string, record: any) => {
                    const color = v === '涨' ? 'green' : v === '降' ? 'red' : 'default';
                    const delta = round2(record.recommended_percentage - record.original_percentage);
                    const sign = delta > 0 ? '+' : '';
                    return (
                      <Space direction="vertical" size={2} align="center">
                        <Tag color={color} style={{ margin: 0 }}>{v}</Tag>
                        {delta !== 0 && (
                          <Text style={{ fontSize: 11, color: delta > 0 ? '#52c41a' : '#f5222d' }}>
                            {sign}{delta.toFixed(2)}%
                          </Text>
                        )}
                      </Space>
                    );
                  }
                },
                {
                  title: '相关系数',
                  dataIndex: 'correlation',
                  key: 'correlation',
                  width: 100,
                  align: 'right',
                  render: (v: number | null) => {
                    if (v === null) return <Text type="secondary">-</Text>;
                    const strong = Math.abs(v) > 0.5;
                    const color = strong ? (v > 0 ? '#52c41a' : '#f5222d') : '#8c8c8c';
                    return <span style={{ fontFamily: 'monospace', color, fontWeight: strong ? 600 : 400 }}>{v.toFixed(4)}</span>;
                  }
                },
                {
                  title: '调整理由',
                  dataIndex: 'reason',
                  key: 'reason',
                  ellipsis: false
                }
              ]}
              scroll={{ x: 760 }}
            />

            <div style={{
              padding: 12,
              background: '#f6ffed',
              borderRadius: 6,
              border: '1px solid #b7eb8f',
              textAlign: 'center',
              fontWeight: 600
            }}>
              <span style={{ color: '#52c41a' }}>
                推荐配方合计：{recommendData.recommended_ingredients.reduce((s, i) => s + i.recommended_percentage, 0).toFixed(2)}% ✓
              </span>
            </div>
          </Space>
        ) : null}
      </Modal>
    </Space>
  );
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}
