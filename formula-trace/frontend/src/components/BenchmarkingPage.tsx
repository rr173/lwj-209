import { useState, useEffect } from 'react';
import {
  Layout,
  List,
  Button,
  Space,
  Table,
  Tag,
  Modal,
  Form,
  Input,
  message,
  Popconfirm,
  Select,
  Typography,
  Card,
  Statistic,
  Row,
  Col,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  BarChartOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type {
  CompetitorFormulaListItem,
  EstimationResponse,
  EstimatedIngredientItem,
  GapAnalysisResponse,
  GapAnalysisItem,
  ProductLine,
} from '../types';
import { api, collectVersionIds } from '../api';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

interface VersionOption {
  label: string;
  value: number;
  product_line_id: number;
}

export default function BenchmarkingPage() {
  const [competitors, setCompetitors] = useState<CompetitorFormulaListItem[]>([]);
  const [selectedCompetitor, setSelectedCompetitor] = useState<number | null>(null);
  const [estimationData, setEstimationData] = useState<EstimationResponse | null>(null);
  const [gapAnalysisData, setGapAnalysisData] = useState<GapAnalysisResponse | null>(null);
  const [productLines, setProductLines] = useState<ProductLine[]>([]);
  const [versionOptions, setVersionOptions] = useState<VersionOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [gapLoading, setGapLoading] = useState(false);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [gapModalVisible, setGapModalVisible] = useState(false);
  const [editingCompetitor, setEditingCompetitor] = useState<number | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [ingredientsText, setIngredientsText] = useState('');

  const [addForm] = Form.useForm();
  const [gapForm] = Form.useForm();

  useEffect(() => {
    loadCompetitors();
    loadProductLines();
  }, []);

  useEffect(() => {
    if (productLines.length > 0) {
      loadAllVersions();
    }
  }, [productLines]);

  const loadCompetitors = async () => {
    try {
      const data = await api.getCompetitors();
      setCompetitors(data);
    } catch (e) {
      message.error('加载竞品列表失败');
    }
  };

  const loadProductLines = async () => {
    try {
      const data = await api.getProductLines();
      setProductLines(data);
    } catch (e) {
      message.error('加载产品线失败');
    }
  };

  const loadAllVersions = async () => {
    try {
      const allVersions: VersionOption[] = [];
      for (const pl of productLines) {
        const tree = await api.getVersionTree(pl.id);
        const ids: number[] = [];
        tree.forEach((node: any) => collectVersionIds(node, ids));
        for (const id of ids) {
          try {
            const v = await api.getVersion(id);
            allVersions.push({
              label: `${pl.name} - V${v.version_number}`,
              value: v.id,
              product_line_id: pl.id,
            });
          } catch (e) {
            // ignore
          }
        }
      }
      setVersionOptions(allVersions);
    } catch (e) {
      message.error('加载版本列表失败');
    }
  };

  const handleSelectCompetitor = async (id: number) => {
    setSelectedCompetitor(id);
    setGapAnalysisData(null);
    setLoading(true);
    try {
      const data = await api.estimatePercentages(id);
      setEstimationData(data);
    } catch (e) {
      message.error('加载推算结果失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCompetitor = async (values: any) => {
    try {
      const ingredientNames = ingredientsText
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (ingredientNames.length === 0) {
        message.error('请至少输入一个成分');
        return;
      }

      const ingredients = ingredientNames.map((name) => ({ name }));

      await api.createCompetitor({
        competitor_name: values.competitor_name,
        product_name: values.product_name,
        ingredients,
      });

      message.success('添加成功');
      setAddModalVisible(false);
      addForm.resetFields();
      setIngredientsText('');
      loadCompetitors();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '添加失败');
    }
  };

  const handleEditCompetitor = async (id: number) => {
    try {
      const data = await api.getCompetitor(id);
      setEditingCompetitor(id);
      setIngredientsText(data.ingredients.map((i) => i.name).join('\n'));
      setEditModalVisible(true);
    } catch (e) {
      message.error('加载竞品详情失败');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingCompetitor) return;

    try {
      const ingredientNames = ingredientsText
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (ingredientNames.length === 0) {
        message.error('请至少输入一个成分');
        return;
      }

      const ingredients = ingredientNames.map((name) => ({ name }));

      await api.updateCompetitorIngredients(editingCompetitor, ingredients);

      message.success('保存成功');
      setEditModalVisible(false);
      setEditingCompetitor(null);
      setIngredientsText('');
      loadCompetitors();

      if (selectedCompetitor === editingCompetitor) {
        handleSelectCompetitor(editingCompetitor);
      }
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '保存失败');
    }
  };

  const handleDeleteCompetitor = async (id: number) => {
    try {
      await api.deleteCompetitor(id);
      message.success('删除成功');
      if (selectedCompetitor === id) {
        setSelectedCompetitor(null);
        setEstimationData(null);
        setGapAnalysisData(null);
      }
      loadCompetitors();
    } catch (e) {
      message.error('删除失败');
    }
  };

  const handleGapAnalysis = async () => {
    if (!selectedCompetitor || !selectedVersionId) return;

    setGapLoading(true);
    try {
      const data = await api.gapAnalysis(selectedCompetitor, selectedVersionId);
      setGapAnalysisData(data);
      setGapModalVisible(false);
    } catch (e) {
      message.error('差距分析失败');
    } finally {
      setGapLoading(false);
    }
  };

  const getGapStatusTag = (status: string) => {
    switch (status) {
      case '接近':
        return <Tag color="success">接近</Tag>;
      case '我方偏高':
        return <Tag color="orange">我方偏高</Tag>;
      case '我方偏低':
        return <Tag color="blue">我方偏低</Tag>;
      case '我方缺失':
        return <Tag color="red">我方缺失</Tag>;
      case '我方独有':
        return <Tag color="purple">我方独有</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const estimateColumns = [
    {
      title: '排序',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
    },
    {
      title: '成分名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '推算区间',
      key: 'range',
      render: (_: any, record: EstimatedIngredientItem) => (
        <span>
          {record.lower_bound}% ~ {record.upper_bound}%
        </span>
      ),
    },
    {
      title: '中位估算',
      dataIndex: 'median_estimate',
      key: 'median_estimate',
      render: (val: number) => `${val}%`,
    },
    {
      title: '禁用标记',
      key: 'banned',
      render: (_: any, record: EstimatedIngredientItem) =>
        record.is_banned ? (
          <Tag color="red" icon={<ExclamationCircleOutlined />}>
            禁用
          </Tag>
        ) : (
          <Tag color="default">正常</Tag>
        ),
    },
  ];

  const gapColumns = [
    {
      title: '成分名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '竞品区间',
      key: 'competitor_range',
      render: (_: any, record: GapAnalysisItem) =>
        record.competitor_lower !== null && record.competitor_upper !== null ? (
          <span>
            {record.competitor_lower}% ~ {record.competitor_upper}%
          </span>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: '我方实际',
      key: 'our_percentage',
      render: (_: any, record: GapAnalysisItem) =>
        record.our_percentage !== null ? `${record.our_percentage}%` : <Text type="secondary">-</Text>,
    },
    {
      title: '差距状态',
      key: 'status',
      render: (_: any, record: GapAnalysisItem) => getGapStatusTag(record.gap_status),
    },
    {
      title: '得分',
      dataIndex: 'score',
      key: 'score',
      width: 80,
      render: (val: number) => val.toFixed(1),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout style={{ padding: '20px' }}>
        <Sider
          width={320}
          style={{ background: 'white', borderRadius: 8, marginRight: 20, padding: 16 }}
          theme="light"
        >
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 600, fontSize: 16 }}>竞品配方列表</div>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                size="small"
                onClick={() => setAddModalVisible(true)}
              >
                新增
              </Button>
            </div>

            <List
              dataSource={competitors}
              loading={loading && !selectedCompetitor}
              renderItem={(item) => (
                <List.Item
                  key={item.id}
                  onClick={() => handleSelectCompetitor(item.id)}
                  style={{
                    cursor: 'pointer',
                    padding: '12px',
                    borderRadius: 6,
                    background: selectedCompetitor === item.id ? '#e6f7ff' : 'transparent',
                    border: selectedCompetitor === item.id ? '1px solid #1890ff' : '1px solid transparent',
                  }}
                  actions={[
                    <Tooltip title="编辑成分">
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditCompetitor(item.id);
                        }}
                      />
                    </Tooltip>,
                    <Popconfirm
                      title="确定删除这个竞品配方吗？"
                      onConfirm={() => handleDeleteCompetitor(item.id)}
                    >
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <span>
                        {item.competitor_name} · {item.product_name}
                      </span>
                    }
                    description={`${item.ingredient_count} 个成分`}
                  />
                </List.Item>
              )}
            />
          </Space>
        </Sider>

        <Content style={{ background: 'white', borderRadius: 8, padding: 24, minHeight: 600 }}>
          {estimationData ? (
            <Space direction="vertical" size={24} style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Title level={4} style={{ margin: 0 }}>
                    {estimationData.competitor_name} - {estimationData.product_name}
                  </Title>
                  <Text type="secondary">成分含量推算结果</Text>
                </div>
                <Button
                  type="primary"
                  icon={<BarChartOutlined />}
                  onClick={() => {
                    setGapModalVisible(true);
                    gapForm.resetFields();
                    setSelectedVersionId(null);
                  }}
                >
                  差距分析
                </Button>
              </div>

              <Card title="成分推算表">
                <Table
                  columns={estimateColumns}
                  dataSource={estimationData.ingredients}
                  rowKey="name"
                  pagination={false}
                  size="small"
                />
              </Card>

              {gapAnalysisData && (
                <Card title="差距分析结果">
                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={8}>
                      <Statistic
                        title="差距评分"
                        value={gapAnalysisData.gap_score_percentage}
                        suffix="%"
                        valueStyle={{
                          color:
                            gapAnalysisData.gap_score_percentage >= 80
                              ? '#52c41a'
                              : gapAnalysisData.gap_score_percentage >= 60
                              ? '#faad14'
                              : '#f5222d',
                        }}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title="实际得分"
                        value={gapAnalysisData.total_score}
                        suffix={` / ${gapAnalysisData.max_score}`}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title="对比版本"
                        value={`V${gapAnalysisData.our_version_number}`}
                      />
                    </Col>
                  </Row>

                  <Table
                    columns={gapColumns}
                    dataSource={gapAnalysisData.items}
                    rowKey="name"
                    pagination={false}
                    size="small"
                  />
                </Card>
              )}
            </Space>
          ) : (
            <div style={{ textAlign: 'center', color: '#999', padding: 100 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
              <div>请从左侧选择一个竞品配方查看推算结果</div>
            </div>
          )}
        </Content>
      </Layout>

      <Modal
        title="新增竞品配方"
        open={addModalVisible}
        onCancel={() => {
          setAddModalVisible(false);
          addForm.resetFields();
          setIngredientsText('');
        }}
        footer={null}
        width={600}
      >
        <Form form={addForm} layout="vertical" onFinish={handleAddCompetitor}>
          <Form.Item
            label="竞品名称"
            name="competitor_name"
            rules={[{ required: true, message: '请输入竞品名称' }]}
          >
            <Input placeholder="例如：欧莱雅、雅诗兰黛" />
          </Form.Item>
          <Form.Item
            label="产品名称"
            name="product_name"
            rules={[{ required: true, message: '请输入产品名称' }]}
          >
            <Input placeholder="例如：小黑瓶精华、小棕瓶眼霜" />
          </Form.Item>
          <Form.Item
            label="成分列表（按含量降序排列，每行一个）"
            required
          >
            <Input.TextArea
              value={ingredientsText}
              onChange={(e) => setIngredientsText(e.target.value)}
              placeholder={'水\n甘油\n烟酰胺\n透明质酸钠'}
              rows={8}
            />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button
                onClick={() => {
                  setAddModalVisible(false);
                  addForm.resetFields();
                  setIngredientsText('');
                }}
              >
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                添加
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑成分配方"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingCompetitor(null);
          setIngredientsText('');
        }}
        footer={null}
        width={600}
      >
        <Form layout="vertical" onFinish={handleSaveEdit}>
          <Form.Item label="成分列表（按含量降序排列，每行一个）">
            <Input.TextArea
              value={ingredientsText}
              onChange={(e) => setIngredientsText(e.target.value)}
              placeholder={'水\n甘油\n烟酰胺\n透明质酸钠'}
              rows={12}
            />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button
                onClick={() => {
                  setEditModalVisible(false);
                  setEditingCompetitor(null);
                  setIngredientsText('');
                }}
              >
                取消
              </Button>
              <Button type="primary" onClick={handleSaveEdit}>
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="选择我方版本进行差距分析"
        open={gapModalVisible}
        onCancel={() => {
          setGapModalVisible(false);
          gapForm.resetFields();
          setSelectedVersionId(null);
        }}
        footer={null}
        width={500}
      >
        <Form form={gapForm} layout="vertical">
          <Form.Item
            label="选择我方配方版本"
            name="version_id"
            rules={[{ required: true, message: '请选择一个版本' }]}
          >
            <Select
              showSearch
              placeholder="选择版本"
              optionFilterProp="label"
              value={selectedVersionId}
              onChange={setSelectedVersionId}
              options={versionOptions}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button
                onClick={() => {
                  setGapModalVisible(false);
                  gapForm.resetFields();
                  setSelectedVersionId(null);
                }}
              >
                取消
              </Button>
              <Button
                type="primary"
                loading={gapLoading}
                onClick={handleGapAnalysis}
                disabled={!selectedVersionId}
              >
                开始分析
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
