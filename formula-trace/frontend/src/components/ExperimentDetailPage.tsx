import { useState, useEffect } from 'react';
import {
  Card,
  Tag,
  Space,
  Button,
  Typography,
  Descriptions,
  List,
  Modal,
  Form,
  Select,
  DatePicker,
  InputNumber,
  message,
  Table,
  Popconfirm,
  Tooltip,
  Progress,
  Divider,
  Slider,
  Layout,
  Menu,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  LinkOutlined,
  DeleteOutlined,
  TrophyOutlined,
  SettingOutlined,
  ExperimentOutlined,
  ReloadOutlined,
  HomeOutlined,
  AuditOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import type {
  ExperimentDetailResponse,
  ExperimentComparisonResponse,
  Batch,
  ExperimentVersionDetail,
} from '../types';
import {
  api,
  getExperimentStatusLabel,
  getExperimentStatusTagColor,
  getScoreColor,
} from '../api';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

const COLOR_PALETTE = [
  '#1890ff',
  '#52c41a',
  '#faad14',
  '#f5222d',
  '#722ed1',
  '#eb2f96',
  '#13c2c2',
  '#fa8c16',
];

const GOLD_COLOR = '#d4af37';

function WeightEditModal({
  visible,
  onClose,
  onSubmit,
  initialWeights,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (weights: { skin_feel_weight: number; stability_weight: number; cost_weight: number }) => void;
  initialWeights: { skin_feel_weight: number; stability_weight: number; cost_weight: number };
}) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible) {
      form.setFieldsValue(initialWeights);
    }
  }, [visible, initialWeights, form]);

  const skinFeelWeight = Form.useWatch('skin_feel_weight', form) ?? 0;
  const stabilityWeight = Form.useWatch('stability_weight', form) ?? 0;
  const costWeight = Form.useWatch('cost_weight', form) ?? 0;
  const totalWeight = skinFeelWeight + stabilityWeight + costWeight;

  return (
    <Modal
      title="修改评估指标权重"
      open={visible}
      onCancel={onClose}
      okText="保存"
      onOk={async () => {
        try {
          const values = await form.validateFields();
          if (Math.abs(totalWeight - 1.0) > 0.0001) {
            message.error(`三个权重之和必须等于1.0，当前为${totalWeight.toFixed(4)}`);
            return;
          }
          onSubmit(values);
          onClose();
        } catch {}
      }}
    >
      <Form form={form} layout="vertical">
        <Form.Item label="肤感权重" required style={{ marginBottom: 8 }}>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="skin_feel_weight" noStyle>
              <Slider min={0} max={1} step={0.05} style={{ flex: 1, margin: '0 12px' }} />
            </Form.Item>
            <Form.Item name="skin_feel_weight" noStyle>
              <InputNumber
                min={0}
                max={1}
                step={0.05}
                style={{ width: 90 }}
                formatter={v => v !== undefined ? `${(v * 100).toFixed(0)}%` : ''}
                parser={(v: any) => v !== undefined ? parseFloat(v) / 100 : 0}
              />
            </Form.Item>
          </Space.Compact>
        </Form.Item>

        <Form.Item label="稳定性权重" required style={{ marginBottom: 8 }}>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="stability_weight" noStyle>
              <Slider min={0} max={1} step={0.05} style={{ flex: 1, margin: '0 12px' }} />
            </Form.Item>
            <Form.Item name="stability_weight" noStyle>
              <InputNumber
                min={0}
                max={1}
                step={0.05}
                style={{ width: 90 }}
                formatter={v => v !== undefined ? `${(v * 100).toFixed(0)}%` : ''}
                parser={(v: any) => v !== undefined ? parseFloat(v) / 100 : 0}
              />
            </Form.Item>
          </Space.Compact>
        </Form.Item>

        <Form.Item label="成本权重" required>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="cost_weight" noStyle>
              <Slider min={0} max={1} step={0.05} style={{ flex: 1, margin: '0 12px' }} />
            </Form.Item>
            <Form.Item name="cost_weight" noStyle>
              <InputNumber
                min={0}
                max={1}
                step={0.05}
                style={{ width: 90 }}
                formatter={v => v !== undefined ? `${(v * 100).toFixed(0)}%` : ''}
                parser={(v: any) => v !== undefined ? parseFloat(v) / 100 : 0}
              />
            </Form.Item>
          </Space.Compact>
        </Form.Item>

        <Tag color={Math.abs(totalWeight - 1.0) < 0.0001 ? 'green' : 'red'}>
          合计: {(totalWeight * 100).toFixed(1)}%
          {Math.abs(totalWeight - 1.0) > 0.0001 && ' (需为100%)'}
        </Tag>
      </Form>
    </Modal>
  );
}

function LinkBatchModal({
  visible,
  onClose,
  onSubmit,
  experimentId,
  versions,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (versionId: number, batchId: number) => void;
  experimentId: number;
  versions: ExperimentVersionDetail[];
}) {
  const [form] = Form.useForm();
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [availableBatches, setAvailableBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      form.resetFields();
      setSelectedVersion(null);
      setAvailableBatches([]);
    }
  }, [visible, form]);

  useEffect(() => {
    if (selectedVersion) {
      setLoading(true);
      api.getAvailableBatches(experimentId, selectedVersion)
        .then(data => setAvailableBatches(data))
        .finally(() => setLoading(false));
    } else {
      setAvailableBatches([]);
    }
  }, [selectedVersion, experimentId]);

  return (
    <Modal
      title="关联已有批次"
      open={visible}
      onCancel={onClose}
      okText="关联"
      onOk={async () => {
        try {
          const values = await form.validateFields();
          onSubmit(values.version_id, values.batch_id);
          onClose();
        } catch {}
      }}
    >
      <Form form={form} layout="vertical">
        <Form.Item label="选择配方版本" name="version_id" rules={[{ required: true }]}>
          <Select
            placeholder="选择要关联批次的配方版本"
            onChange={v => {
              setSelectedVersion(v);
              form.setFieldValue('batch_id', null);
            }}
            options={versions.map(v => ({
              label: `V${v.version_number} - ${v.ingredients_summary}`,
              value: v.version_id,
            }))}
          />
        </Form.Item>
        <Form.Item label="选择批次" name="batch_id" rules={[{ required: true }]}>
          <Select
            placeholder={selectedVersion ? '选择要关联的批次' : '请先选择配方版本'}
            disabled={!selectedVersion}
            loading={loading}
            options={availableBatches.map(b => ({
              label: `${b.batch_number} | ${b.production_date} | ${b.production_amount}kg | ${
                b.has_test_result || (b.skin_feel_score !== null && b.stability_score !== null && b.cost_per_kg !== null)
                  ? '✓ 已检测'
                  : '待检测'
              }`,
              value: b.id,
            }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function CreateBatchModal({
  visible,
  onClose,
  onSubmit,
  versions,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: { version_id: number; production_date: string; production_amount: number }) => void;
  versions: ExperimentVersionDetail[];
}) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible) {
      form.resetFields();
    }
  }, [visible, form]);

  return (
    <Modal
      title="创建新批次"
      open={visible}
      onCancel={onClose}
      okText="创建并关联"
      onOk={async () => {
        try {
          const values = await form.validateFields();
          onSubmit({
            version_id: values.version_id,
            production_date: values.production_date.format('YYYY-MM-DD'),
            production_amount: values.production_amount,
          });
          onClose();
        } catch {}
      }}
    >
      <Form form={form} layout="vertical">
        <Form.Item label="选择配方版本" name="version_id" rules={[{ required: true }]}>
          <Select
            placeholder="选择要创建批次的配方版本"
            options={versions.map(v => ({
              label: `V${v.version_number} - ${v.ingredients_summary}`,
              value: v.version_id,
            }))}
          />
        </Form.Item>
        <Form.Item label="生产日期" name="production_date" rules={[{ required: true }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="生产数量 (kg)" name="production_amount" rules={[{ required: true }]}>
          <InputNumber min={0.01} step={0.1} style={{ width: '100%' }} placeholder="例如：10.0" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

const { Header } = Layout;

export default function ExperimentDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const experimentId = id ? parseInt(id) : 0;
  const location = typeof window !== 'undefined' ? window.location.pathname : '';

  const [experiment, setExperiment] = useState<ExperimentDetailResponse | null>(null);
  const [comparison, setComparison] = useState<ExperimentComparisonResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [weightEditVisible, setWeightEditVisible] = useState(false);
  const [linkBatchVisible, setLinkBatchVisible] = useState(false);
  const [createBatchVisible, setCreateBatchVisible] = useState(false);

  const menuItems = [
    { key: '/', icon: <HomeOutlined />, label: '配方管理' },
    { key: '/benchmarking', icon: <TrophyOutlined />, label: '对标分析' },
    { key: '/experiments', icon: <ExperimentOutlined />, label: '实验测试' },
    { key: '/reviews', icon: <AuditOutlined />, label: '评审会议' },
    { key: '/inventory', icon: <DatabaseOutlined />, label: '库存管理' },
  ];

  const loadExperiment = async () => {
    setLoading(true);
    try {
      const data = await api.getExperiment(experimentId);
      setExperiment(data);
      if (data.status === 'completed' || data.versions.every(v => v.tested_batch_count >= 1)) {
        try {
          const comp = await api.getExperimentComparison(experimentId);
          setComparison(comp);
        } catch {}
      }
    } catch {
      message.error('加载实验详情失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (experimentId) {
      loadExperiment();
    }
  }, [experimentId]);

  const handleStart = async () => {
    try {
      await api.startExperiment(experimentId);
      message.success('实验已启动');
      loadExperiment();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '启动失败');
    }
  };

  const handleComplete = async () => {
    try {
      await api.completeExperiment(experimentId);
      message.success('实验已完成');
      loadExperiment();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '完成失败');
    }
  };

  const handleUpdateWeights = async (weights: { skin_feel_weight: number; stability_weight: number; cost_weight: number }) => {
    try {
      await api.updateExperimentWeights(experimentId, weights);
      message.success('权重已更新');
      loadExperiment();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '更新失败');
    }
  };

  const handleLinkBatch = async (versionId: number, batchId: number) => {
    try {
      await api.linkBatchToExperiment(experimentId, versionId, batchId);
      message.success('批次关联成功');
      loadExperiment();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '关联失败');
    }
  };

  const handleCreateBatch = async (data: { version_id: number; production_date: string; production_amount: number }) => {
    try {
      await api.createBatchInExperiment(experimentId, data);
      message.success('批次创建成功');
      loadExperiment();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '创建失败');
    }
  };

  const handleUnlinkBatch = async (versionId: number, batchId: number) => {
    try {
      await api.unlinkBatchFromExperiment(experimentId, versionId, batchId);
      message.success('已取消关联');
      loadExperiment();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '操作失败');
    }
  };

  const canEditWeights = experiment?.status === 'planning';
  const canManageBatches = experiment?.status !== 'completed';
  const allVersionsHaveData = experiment?.versions.every(v => v.tested_batch_count >= 1);

  if (!experiment && !loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>加载中...</div>;
  }

  const chartData = comparison?.version_scores.map(vs => ({
    name: `V${vs.version_number}`,
    version_id: vs.version_id,
    综合得分: Number(vs.composite_score.toFixed(2)),
    肤感均分: Number((vs.avg_skin_feel * comparison.skin_feel_weight).toFixed(2)),
    稳定性均分: Number((vs.avg_stability * comparison.stability_weight).toFixed(2)),
    成本归一化: Number((vs.avg_cost_normalized * 10 * comparison.cost_weight).toFixed(2)),
    is_recommended: vs.is_recommended,
  })) || [];

  const diffMatrixColumns = [
    {
      title: '版本A',
      dataIndex: 'version_a_number',
      key: 'version_a_number',
      render: (n: number) => <Tag color="blue">V{n}</Tag>,
    },
    {
      title: '版本B',
      dataIndex: 'version_b_number',
      key: 'version_b_number',
      render: (n: number) => <Tag color="blue">V{n}</Tag>,
    },
    {
      title: '得分差距',
      dataIndex: 'score_delta',
      key: 'score_delta',
      render: (delta: number) => (
        <Text strong style={{ color: getScoreColor(delta > 1 ? 10 - delta * 2 : delta * 10) }}>
          {delta.toFixed(2)}
        </Text>
      ),
    },
    {
      title: '差距占比',
      dataIndex: 'score_delta_percentage',
      key: 'score_delta_percentage',
      render: (pct: number) => <Progress percent={pct} showInfo size="small" />,
    },
    {
      title: '显著性判定',
      dataIndex: 'significance_label',
      key: 'significance_label',
      render: (label: string, record: any) => (
        <Tag color={record.is_significant ? 'red' : 'green'}>
          {record.is_significant ? '⚠️ ' : '✓ '}{label}
        </Tag>
      ),
    },
  ];

  const rankingColumns = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
      render: (r: number, record: any) => (
        <Space>
          <Text strong style={{ fontSize: 16 }}>
            {r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`}
          </Text>
          {record.is_recommended && <Tag color="gold">推荐</Tag>}
        </Space>
      ),
    },
    {
      title: '版本',
      dataIndex: 'version_number',
      key: 'version_number',
      width: 100,
      render: (n: number) => <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>V{n}</Tag>,
    },
    {
      title: '配方概况',
      dataIndex: 'ingredients_summary',
      key: 'ingredients_summary',
    },
    {
      title: '肤感均分',
      dataIndex: 'avg_skin_feel',
      key: 'avg_skin_feel',
      width: 100,
      render: (v: number) => (
        <Text strong style={{ color: getScoreColor(v) }}>{v.toFixed(2)}</Text>
      ),
    },
    {
      title: '稳定性均分',
      dataIndex: 'avg_stability',
      key: 'avg_stability',
      width: 100,
      render: (v: number) => (
        <Text strong style={{ color: getScoreColor(v) }}>{v.toFixed(2)}</Text>
      ),
    },
    {
      title: '成本归一化',
      dataIndex: 'avg_cost_normalized',
      key: 'avg_cost_normalized',
      width: 110,
      render: (v: number) => <Text strong>{(v * 10).toFixed(2)}</Text>,
    },
    {
      title: '综合得分',
      dataIndex: 'composite_score',
      key: 'composite_score',
      width: 110,
      render: (v: number) => (
        <Text strong style={{ fontSize: 16, color: getScoreColor(v) }}>{v.toFixed(2)}</Text>
      ),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header className="app-header" style={{ padding: '0 24px' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <h1 style={{ color: 'white', margin: 0, fontSize: 20 }}>化妆品配方版本管理与批次追溯系统</h1>
          </Space>
          <Menu
            theme="dark"
            mode="horizontal"
            selectedKeys={[location.startsWith('/experiments') ? '/experiments' : location]}
            items={menuItems}
            onClick={({ key }) => navigate(key as string)}
            style={{ minWidth: 300, background: 'transparent' }}
          />
        </Space>
      </Header>
      <div style={{ padding: 20, background: '#f5f7fa' }}>
      <div style={{ padding: 24, background: 'white', borderRadius: 8, marginBottom: 20 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/experiments')}>
              返回列表
            </Button>
            <Title level={3} style={{ margin: 0 }}>
              <ExperimentOutlined /> {experiment?.name}
            </Title>
            <Tag color={getExperimentStatusTagColor(experiment?.status || '')} style={{ fontSize: 14, padding: '4px 12px' }}>
              {getExperimentStatusLabel(experiment?.status || '')}
            </Tag>
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadExperiment} loading={loading}>
              刷新
            </Button>
            {experiment?.status === 'planning' && (
              <Tooltip title="开始实验后不可修改权重配置">
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handleStart}
                >
                  启动实验
                </Button>
              </Tooltip>
            )}
            {experiment?.status === 'ongoing' && (
              <Tooltip
                title={allVersionsHaveData ? '所有版本均有检测数据，可以完成实验' : '每个版本至少需要1个已检测批次'}
              >
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={handleComplete}
                  disabled={!allVersionsHaveData}
                  style={{ background: allVersionsHaveData ? '#52c41a' : undefined }}
                >
                  完成实验
                </Button>
              </Tooltip>
            )}
          </Space>
        </Space>

        <Divider />

        <Descriptions column={2} size="small">
          <Descriptions.Item label="实验目的">
            <Paragraph style={{ margin: 0, maxWidth: 500 }}>{experiment?.purpose}</Paragraph>
          </Descriptions.Item>
          <Descriptions.Item label="产品线">{experiment?.product_line_name}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {experiment?.created_at ? new Date(experiment.created_at).toLocaleString('zh-CN') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="启动时间">
            {experiment?.started_at ? new Date(experiment.started_at).toLocaleString('zh-CN') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="完成时间">
            {experiment?.completed_at ? new Date(experiment.completed_at).toLocaleString('zh-CN') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="纳入版本">
            <Tag color="blue">{experiment?.versions.length} 个</Tag>
          </Descriptions.Item>
        </Descriptions>

        <Divider />

        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Text strong style={{ fontSize: 14 }}>评估指标权重</Text>
            {canEditWeights && (
              <Button size="small" icon={<SettingOutlined />} onClick={() => setWeightEditVisible(true)}>
                修改
              </Button>
            )}
            {!canEditWeights && experiment?.status === 'ongoing' && (
              <Tag color="default">实验进行中，权重不可修改</Tag>
            )}
          </Space>
          <Space size="large">
            <Space>
              <Text>肤感：</Text>
              <Progress
                type="dashboard"
                percent={(experiment?.skin_feel_weight || 0) * 100}
                size={60}
                strokeColor="#1890ff"
                format={p => `${p}%`}
              />
            </Space>
            <Space>
              <Text>稳定性：</Text>
              <Progress
                type="dashboard"
                percent={(experiment?.stability_weight || 0) * 100}
                size={60}
                strokeColor="#52c41a"
                format={p => `${p}%`}
              />
            </Space>
            <Space>
              <Text>成本：</Text>
              <Progress
                type="dashboard"
                percent={(experiment?.cost_weight || 0) * 100}
                size={60}
                strokeColor="#faad14"
                format={p => `${p}%`}
              />
            </Space>
          </Space>
        </Space>
      </div>

      <div style={{ padding: 24, background: 'white', borderRadius: 8, marginBottom: 20 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>纳入的配方版本</Title>
          {canManageBatches && (
            <Space>
              <Button icon={<LinkOutlined />} onClick={() => setLinkBatchVisible(true)}>
                关联已有批次
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateBatchVisible(true)}>
                创建新批次
              </Button>
            </Space>
          )}
        </Space>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min((experiment?.versions.length || 1), 3)}, 1fr)`,
            gap: 16,
          }}
        >
          {experiment?.versions.map((v, idx) => {
            const score = comparison?.version_scores.find(s => s.version_id === v.version_id);
            const isRecommended = score?.is_recommended;
            const borderColor = isRecommended ? GOLD_COLOR : '#e8e8e8';
            const boxShadow = isRecommended
              ? `0 0 0 2px ${GOLD_COLOR}40, 0 4px 16px ${GOLD_COLOR}30`
              : '0 2px 8px rgba(0,0,0,0.06)';

            return (
              <Card
                key={v.version_id}
                style={{
                  border: `2px solid ${borderColor}`,
                  boxShadow,
                  borderRadius: 8,
                }}
                size="small"
                title={
                  <Space>
                    <Tag color={COLOR_PALETTE[idx % COLOR_PALETTE.length]} style={{ fontSize: 14, padding: '4px 12px' }}>
                      V{v.version_number}
                    </Tag>
                    {isRecommended && (
                      <Tag color="gold" icon={<TrophyOutlined />}>
                        推荐版本
                      </Tag>
                    )}
                    {score && <Text type="secondary">排名 #{score.rank}</Text>}
                  </Space>
                }
                extra={
                  score && (
                    <Text strong style={{ fontSize: 18, color: getScoreColor(score.composite_score) }}>
                      {score.composite_score.toFixed(2)}
                    </Text>
                  )
                }
              >
                <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 12, color: '#666', minHeight: 40 }}>
                  {v.ingredients_summary}
                </Paragraph>

                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">关联批次数</Text>
                    <Space>
                      <Tag>{v.batch_count} 个</Tag>
                      <Tag color={v.tested_batch_count > 0 ? 'green' : 'red'}>
                        已检测 {v.tested_batch_count}/{v.batch_count}
                      </Tag>
                    </Space>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">肤感均分</Text>
                    <Text strong style={{ color: getScoreColor(v.avg_skin_feel) }}>
                      {v.avg_skin_feel !== null ? v.avg_skin_feel.toFixed(2) : '—'}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">稳定性均分</Text>
                    <Text strong style={{ color: getScoreColor(v.avg_stability) }}>
                      {v.avg_stability !== null ? v.avg_stability.toFixed(2) : '—'}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">成本归一化(10分制)</Text>
                    <Text strong>
                      {v.avg_cost_normalized !== null ? (v.avg_cost_normalized * 10).toFixed(2) : '—'}
                    </Text>
                  </div>
                </Space>

                {v.batches.length > 0 && (
                  <>
                    <Divider style={{ margin: '12px 0 8px' }} />
                    <Text type="secondary" style={{ fontSize: 12 }}>关联批次：</Text>
                    <List
                      size="small"
                      dataSource={v.batches}
                      style={{ maxHeight: 180, overflow: 'auto' }}
                      renderItem={(item) => (
                        <List.Item
                          key={item.id}
                          actions={
                            canManageBatches
                              ? [
                                  <Popconfirm
                                    key="unlink"
                                    title="确定取消该批次的关联？"
                                    onConfirm={() => handleUnlinkBatch(v.version_id, item.batch_id)}
                                  >
                                    <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                                  </Popconfirm>,
                                ]
                              : []
                          }
                        >
                          <List.Item.Meta
                            title={
                              <Space size="small">
                                <Text strong>{item.batch_number}</Text>
                                {item.has_test_result
                                  ? <Tag color="green">已检测</Tag>
                                  : <Tag color="default">待检测</Tag>
                                }
                              </Space>
                            }
                            description={
                              <Space size="small" wrap>
                                <Text type="secondary">{item.production_date}</Text>
                                {item.skin_feel_score !== null && (
                                  <Text style={{ color: getScoreColor(item.skin_feel_score) }}>
                                    肤感:{item.skin_feel_score.toFixed(1)}
                                  </Text>
                                )}
                                {item.stability_score !== null && (
                                  <Text style={{ color: getScoreColor(item.stability_score) }}>
                                    稳:{item.stability_score.toFixed(1)}
                                  </Text>
                                )}
                                {item.cost_per_kg !== null && (
                                  <Text type="secondary">成本:{item.cost_per_kg.toFixed(2)}</Text>
                                )}
                              </Space>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  </>
                )}

                {v.batches.length === 0 && (
                  <div style={{ padding: 16, textAlign: 'center', color: '#999', fontSize: 12 }}>
                    暂无关联批次
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {comparison && (
        <div style={{ padding: 24, background: 'white', borderRadius: 8, marginBottom: 20 }}>
          <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
            <Title level={4} style={{ margin: 0 }}>
              <TrophyOutlined /> 统计对比结果
            </Title>
            <Space>
              <Tag color="gold">
                推荐版本: V{comparison.recommended_version_number}
              </Tag>
              <Tag color="blue">显著性阈值: {comparison.significance_threshold} (总分的10%)</Tag>
            </Space>
          </Space>

          <Card
            size="small"
            title="综合得分排名"
            style={{ marginBottom: 16 }}
          >
            <Table
              rowKey="version_id"
              columns={rankingColumns}
              dataSource={comparison.version_scores}
              pagination={false}
              rowClassName={(_, idx) => idx === 0 ? 'recommended-row' : ''}
              components={{
                body: {
                  row: (props: any) => {
                    const isRec = props?.['data-row-key'] === comparison.recommended_version_id;
                    return (
                      <tr
                        {...props}
                        style={
                          isRec
                            ? {
                                background: `linear-gradient(90deg, ${GOLD_COLOR}15 0%, white 30%)`,
                                borderLeft: `3px solid ${GOLD_COLOR}`,
                                fontWeight: 500,
                              }
                            : undefined
                        }
                      />
                    );
                  },
                },
              }}
            />
          </Card>

          <Card
            size="small"
            title="综合得分柱状图"
            style={{ marginBottom: 16 }}
          >
            <div style={{ width: '100%', height: 360 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" style={{ fontSize: 14, fontWeight: 500 }} />
                  <YAxis domain={[0, 10]} style={{ fontSize: 12 }} />
                  <ReTooltip
                    formatter={(value: any, name: any) => [
                      typeof value === 'number' ? value.toFixed(2) : value,
                      name,
                    ]}
                  />
                  <Legend />
                  <Bar dataKey="肤感均分" stackId="a" fill="#1890ff" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="稳定性均分" stackId="a" fill="#52c41a" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="成本归一化" stackId="a" fill="#faad14" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="综合得分" position="top" style={{ fontSize: 14, fontWeight: 'bold' }} />
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.is_recommended ? GOLD_COLOR : '#faad14'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ textAlign: 'center', color: '#999', marginTop: 8, fontSize: 12 }}>
              注：柱子高度为各维度按权重加权后的综合得分；金色高亮为推荐版本
            </div>
          </Card>

          <Card size="small" title="两两版本差异显著性矩阵">
            <Table
              rowKey={(record: any) => `${record.version_a_id}-${record.version_b_id}`}
              columns={diffMatrixColumns}
              dataSource={comparison.pairwise_diffs}
              pagination={false}
            />
            <div style={{ marginTop: 12, padding: 12, background: '#fffbe6', borderRadius: 4 }}>
              <Space>
                <Text type="warning">💡 判定规则：</Text>
                <Text type="secondary">
                  两版本综合得分差距 &gt; {(comparison.max_possible_score * 0.1).toFixed(2)} (满分的10%)
                  则标记为「显著差异」，否则为「无显著差异」
                </Text>
              </Space>
            </div>
          </Card>
        </div>
      )}

      {!comparison && allVersionsHaveData && experiment?.status !== 'planning' && (
        <div style={{ padding: 24, background: 'white', borderRadius: 8, textAlign: 'center' }}>
          <Button type="primary" icon={<ReloadOutlined />} onClick={loadExperiment}>
            加载对比分析结果
          </Button>
        </div>
      )}

      {!comparison && !allVersionsHaveData && experiment?.status !== 'completed' && (
        <div style={{ padding: 40, background: 'white', borderRadius: 8, textAlign: 'center', color: '#999' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
          <div>当所有纳入版本都至少关联1个已检测批次后，将自动生成统计对比分析</div>
        </div>
      )}

      {experiment && (
        <>
          <WeightEditModal
            visible={weightEditVisible}
            onClose={() => setWeightEditVisible(false)}
            onSubmit={handleUpdateWeights}
            initialWeights={{
              skin_feel_weight: experiment.skin_feel_weight,
              stability_weight: experiment.stability_weight,
              cost_weight: experiment.cost_weight,
            }}
          />

          <LinkBatchModal
            visible={linkBatchVisible}
            onClose={() => setLinkBatchVisible(false)}
            onSubmit={handleLinkBatch}
            experimentId={experimentId}
            versions={experiment.versions}
          />

          <CreateBatchModal
            visible={createBatchVisible}
            onClose={() => setCreateBatchVisible(false)}
            onSubmit={handleCreateBatch}
            versions={experiment.versions}
          />
        </>
      )}
      </div>
    </Layout>
  );
}
