import { useState, useEffect, useMemo } from 'react';
import {
  Layout,
  Table,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Space,
  Alert,
  Timeline,
  Card,
  Row,
  Col,
  Statistic,
  message,
  Popconfirm,
  Typography,
} from 'antd';
import {
  PlusOutlined,
  ImportOutlined,
  ExportOutlined,
  EditOutlined,
  DeleteOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import type { ColumnsType, ExpandableConfig } from 'antd/es/table/interface';
import { api } from '../api';
import type {
  IngredientInventory,
  PurchaseWarningItem,
  InventoryTransaction,
  IngredientInventoryCreate,
  StockInRequest,
  StockOutRequest,
} from '../types';
import { useNavigate } from 'react-router-dom';

const { Header, Content } = Layout;
const { Title } = Typography;

type WarningLevel = 'urgent' | 'warning' | 'normal';

const getWarningLevelColor = (level: WarningLevel): string => {
  switch (level) {
    case 'urgent':
      return 'red';
    case 'warning':
      return 'gold';
    case 'normal':
      return 'green';
    default:
      return 'default';
  }
};

const getWarningLevelText = (level: WarningLevel): string => {
  switch (level) {
    case 'urgent':
      return '紧急';
    case 'warning':
      return '警告';
    case 'normal':
      return '正常';
    default:
      return level;
  }
};

const getWarningLevelTag = (level: WarningLevel) => {
  const color = getWarningLevelColor(level);
  const text = getWarningLevelText(level);
  const icon =
    level === 'urgent' ? (
      <WarningOutlined />
    ) : level === 'warning' ? (
      <ClockCircleOutlined />
    ) : (
      <CheckCircleOutlined />
    );
  return (
    <Tag color={color} icon={icon}>
      {text}
    </Tag>
  );
};

const formatDateTime = (dateStr: string): string => {
  return new Date(dateStr).toLocaleString('zh-CN');
};

export default function InventoryPage() {
  const navigate = useNavigate();
  const [inventories, setInventories] = useState<IngredientInventory[]>([]);
  const [warnings, setWarnings] = useState<PurchaseWarningItem[]>([]);
  const [warningCounts, setWarningCounts] = useState({ urgent: 0, warning: 0, normal: 0 });
  const [loading, setLoading] = useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
  const [transactionMap, setTransactionMap] = useState<Record<number, InventoryTransaction[]>>({});

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [stockInModalVisible, setStockInModalVisible] = useState(false);
  const [stockOutModalVisible, setStockOutModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState<IngredientInventory | null>(null);

  const [createForm] = Form.useForm<IngredientInventoryCreate>();
  const [stockInForm] = Form.useForm<StockInRequest>();
  const [stockOutForm] = Form.useForm<StockOutRequest>();
  const [editForm] = Form.useForm<{
    current_quantity?: number;
    safety_stock?: number;
    storage_location?: string;
  }>();

  const warningMap = useMemo(() => {
    const map: Record<number, PurchaseWarningItem> = {};
    warnings.forEach(w => {
      map[w.id] = w;
    });
    return map;
  }, [warnings]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invData, warnData] = await Promise.all([
        api.getInventories(),
        api.getPurchaseWarnings(),
      ]);
      setInventories(invData);
      setWarnings(warnData.items);
      setWarningCounts({
        urgent: warnData.urgent_count,
        warning: warnData.warning_count,
        normal: warnData.normal_count,
      });
    } catch (e) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async (inventoryId: number) => {
    if (transactionMap[inventoryId]) return;
    try {
      const data = await api.getInventoryTransactions(inventoryId, 30);
      setTransactionMap(prev => ({ ...prev, [inventoryId]: data }));
    } catch (e) {
      message.error('加载流水记录失败');
    }
  };

  const handleExpand = async (expanded: boolean, record: IngredientInventory) => {
    if (expanded) {
      setExpandedRowKeys([record.id]);
      await loadTransactions(record.id);
    } else {
      setExpandedRowKeys([]);
    }
  };

  const handleCreate = async (values: IngredientInventoryCreate) => {
    try {
      await api.createInventory(values);
      message.success('创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '创建失败');
    }
  };

  const handleStockIn = async (values: StockInRequest) => {
    if (!selectedInventory) return;
    try {
      await api.stockIn(selectedInventory.id, values);
      message.success('入库成功');
      setStockInModalVisible(false);
      stockInForm.resetFields();
      setSelectedInventory(null);
      loadData();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '入库失败');
    }
  };

  const handleStockOut = async (values: StockOutRequest) => {
    if (!selectedInventory) return;
    try {
      await api.stockOut(selectedInventory.id, values);
      message.success('出库成功');
      setStockOutModalVisible(false);
      stockOutForm.resetFields();
      setSelectedInventory(null);
      loadData();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '出库失败');
    }
  };

  const handleEdit = async (values: {
    current_quantity?: number;
    safety_stock?: number;
    storage_location?: string;
  }) => {
    if (!selectedInventory) return;
    try {
      await api.updateInventory(selectedInventory.id, values);
      message.success('更新成功');
      setEditModalVisible(false);
      editForm.resetFields();
      setSelectedInventory(null);
      loadData();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '更新失败');
    }
  };

  const handleDelete = async (inventoryId: number) => {
    try {
      await api.deleteInventory(inventoryId);
      message.success('删除成功');
      loadData();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '删除失败');
    }
  };

  const openStockInModal = (record: IngredientInventory) => {
    setSelectedInventory(record);
    setStockInModalVisible(true);
  };

  const openStockOutModal = (record: IngredientInventory) => {
    setSelectedInventory(record);
    setStockOutModalVisible(true);
  };

  const openEditModal = (record: IngredientInventory) => {
    setSelectedInventory(record);
    editForm.setFieldsValue({
      current_quantity: record.current_quantity,
      safety_stock: record.safety_stock,
      storage_location: record.storage_location || '',
    });
    setEditModalVisible(true);
  };

  const expandedRowRender = (record: IngredientInventory) => {
    const transactions = transactionMap[record.id] || [];
    const warning = warningMap[record.id];

    return (
      <div style={{ padding: '0 24px' }}>
        <Row gutter={16}>
          <Col span={8}>
            <Card title="库存预警详情" size="small">
              {warning ? (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <span style={{ color: '#888' }}>日均消耗：</span>
                    <span>{warning.average_daily_consumption !== null ? `${warning.average_daily_consumption} kg/天` : '暂无数据'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#888' }}>预计可用：</span>
                    <span>
                      {warning.estimated_days_left !== null
                        ? `${warning.estimated_days_left} 天`
                        : '暂无数据'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#888' }}>缺货量：</span>
                    <span style={{ color: warning.shortage_amount > 0 ? '#f5222d' : '#52c41a' }}>
                      {warning.shortage_amount > 0 ? `缺 ${warning.shortage_amount} kg` : '充足'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#888' }}>存放位置：</span>
                    <span>{record.storage_location || '未设置'}</span>
                  </div>
                </Space>
              ) : (
                <div style={{ color: '#888' }}>加载中...</div>
              )}
            </Card>
          </Col>
          <Col span={16}>
            <Card title="近30天库存流水" size="small">
              {transactions.length > 0 ? (
                <Timeline
                  style={{ maxHeight: 300, overflow: 'auto' }}
                  items={transactions.map(tx => ({
                    color: tx.transaction_type === 'stock_in' ? 'green' : 'red',
                    dot: tx.transaction_type === 'stock_in' ? <ArrowUpOutlined /> : <ArrowDownOutlined />,
                    children: (
                      <div>
                        <div>
                          <Tag color={tx.transaction_type === 'stock_in' ? 'green' : 'red'}>
                            {tx.transaction_type === 'stock_in' ? '入库' : '出库'}
                          </Tag>
                          <span style={{ fontWeight: 600 }}>
                            {tx.transaction_type === 'stock_in' ? '+' : '-'}{tx.quantity} kg
                          </span>
                          {tx.batch_number && (
                            <Tag style={{ marginLeft: 8 }}>批次：{tx.batch_number}</Tag>
                          )}
                        </div>
                        {tx.remark && <div style={{ color: '#666', fontSize: 12 }}>{tx.remark}</div>}
                        <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                          {formatDateTime(tx.created_at)}
                        </div>
                      </div>
                    ),
                  }))}
                />
              ) : (
                <div style={{ color: '#888', textAlign: 'center', padding: 20 }}>
                  暂无流水记录
                </div>
              )}
            </Card>
          </Col>
        </Row>
      </div>
    );
  };

  const columns: ColumnsType<IngredientInventory> = [
    {
      title: '原料名称',
      dataIndex: 'ingredient_name',
      key: 'ingredient_name',
      width: 160,
      render: (text: string) => <span style={{ fontWeight: 500 }}>{text}</span>,
    },
    {
      title: '当前库存 (kg)',
      dataIndex: 'current_quantity',
      key: 'current_quantity',
      width: 140,
      render: (val: number, record) => {
        const warning = warningMap[record.id];
        const isLow = warning && warning.warning_level !== 'normal';
        return (
          <span style={{ color: isLow ? '#f5222d' : '#000', fontWeight: isLow ? 600 : 400 }}>
            {val.toFixed(4)}
          </span>
        );
      },
    },
    {
      title: '安全库存 (kg)',
      dataIndex: 'safety_stock',
      key: 'safety_stock',
      width: 140,
      render: (val: number) => val.toFixed(4),
    },
    {
      title: '状态',
      key: 'status',
      width: 120,
      render: (_, record) => {
        const warning = warningMap[record.id];
        return warning ? getWarningLevelTag(warning.warning_level) : null;
      },
    },
    {
      title: '预计可用天数',
      key: 'estimated_days',
      width: 140,
      render: (_, record) => {
        const warning = warningMap[record.id];
        if (!warning || warning.estimated_days_left === null) {
          return <span style={{ color: '#888' }}>暂无数据</span>;
        }
        const days = warning.estimated_days_left;
        let color = '#52c41a';
        if (days < 7) color = '#f5222d';
        else if (days < 14) color = '#faad14';
        return <span style={{ color, fontWeight: 500 }}>{days} 天</span>;
      },
    },
    {
      title: '存放位置',
      dataIndex: 'storage_location',
      key: 'storage_location',
      width: 160,
      render: (val: string | null) => val || <span style={{ color: '#888' }}>未设置</span>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<ImportOutlined />}
            onClick={() => openStockInModal(record)}
          >
            入库
          </Button>
          <Button
            type="text"
            size="small"
            icon={<ExportOutlined />}
            onClick={() => openStockOutModal(record)}
          >
            出库
          </Button>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除该原料库存记录？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const expandableConfig: ExpandableConfig<IngredientInventory> = {
    expandedRowRender,
    expandedRowKeys,
    onExpand: handleExpand,
    expandIcon: ({ expanded, onExpand, record }) => (
      <Button type="link" onClick={e => onExpand(record, e)}>
        {expanded ? '收起详情' : '查看详情'}
      </Button>
    ),
  };

  const showWarningBanner = warningCounts.urgent > 0 || warningCounts.warning > 0;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header className="app-header">
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Title level={3} style={{ color: 'white', margin: 0 }}>
              原料库存管理
            </Title>
          </Space>
          <Button icon={<HomeOutlined />} onClick={() => navigate('/')}>
            返回配方管理
          </Button>
        </Space>
      </Header>

      <Content style={{ padding: '24px' }}>
        {showWarningBanner && (
          <Alert
            message={
              <Space>
                <WarningOutlined style={{ color: '#faad14', fontSize: 20 }} />
                <span style={{ fontWeight: 600 }}>采购预警：</span>
                {warningCounts.urgent > 0 && (
                  <Tag color="red" style={{ margin: 0 }}>
                    {warningCounts.urgent} 个原料紧急
                  </Tag>
                )}
                {warningCounts.warning > 0 && (
                  <Tag color="gold" style={{ margin: 0 }}>
                    {warningCounts.warning} 个原料警告
                  </Tag>
                )}
                <span style={{ marginLeft: 8, color: '#888' }}>
                  {warningCounts.normal} 个原料正常
                </span>
              </Space>
            }
            type={warningCounts.urgent > 0 ? 'error' : 'warning'}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="紧急缺货"
                value={warningCounts.urgent}
                valueStyle={{ color: '#f5222d' }}
                prefix={<WarningOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="即将缺货"
                value={warningCounts.warning}
                valueStyle={{ color: '#faad14' }}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="库存正常"
                value={warningCounts.normal}
                valueStyle={{ color: '#52c41a' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="原料总数" value={inventories.length} />
            </Card>
          </Col>
        </Row>

        <Card>
          <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
            <Title level={4} style={{ margin: 0 }}>
              原料库存列表
            </Title>
            <Space>
              <Button onClick={loadData}>刷新</Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                新增原料
              </Button>
            </Space>
          </Space>

          <Table
            columns={columns}
            dataSource={inventories}
            rowKey="id"
            loading={loading}
            expandable={expandableConfig}
            scroll={{ x: 1100 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: total => `共 ${total} 条记录`,
            }}
          />
        </Card>
      </Content>

      <Modal
        title="新增原料库存"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreate}
          initialValues={{ current_quantity: 0, safety_stock: 0 }}
        >
          <Form.Item
            name="ingredient_name"
            label="原料名称"
            rules={[{ required: true, message: '请输入原料名称' }]}
          >
            <Input placeholder="请输入原料名称" maxLength={200} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="current_quantity"
                label="当前库存 (kg)"
                rules={[{ required: true, message: '请输入当前库存' }]}
              >
                <InputNumber style={{ width: '100%' }} min={0} step={0.0001} precision={4} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="safety_stock"
                label="安全库存 (kg)"
                rules={[{ required: true, message: '请输入安全库存' }]}
              >
                <InputNumber style={{ width: '100%' }} min={0} step={0.0001} precision={4} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="storage_location" label="存放位置">
            <Input placeholder="请输入存放位置，如：A区-原料架1" maxLength={200} />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button
                onClick={() => {
                  setCreateModalVisible(false);
                  createForm.resetFields();
                }}
              >
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                确定
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`原料入库 - ${selectedInventory?.ingredient_name || ''}`}
        open={stockInModalVisible}
        onCancel={() => {
          setStockInModalVisible(false);
          stockInForm.resetFields();
          setSelectedInventory(null);
        }}
        footer={null}
        width={500}
      >
        <Form form={stockInForm} layout="vertical" onFinish={handleStockIn}>
          <Form.Item
            name="quantity"
            label="入库数量 (kg)"
            rules={[{ required: true, message: '请输入入库数量' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0.0001} step={0.0001} precision={4} />
          </Form.Item>
          <Form.Item name="batch_number" label="入库批次号">
            <Input placeholder="可选，用于追溯" maxLength={50} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea placeholder="可选" rows={3} maxLength={500} />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button
                onClick={() => {
                  setStockInModalVisible(false);
                  stockInForm.resetFields();
                  setSelectedInventory(null);
                }}
              >
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                确定入库
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`原料出库 - ${selectedInventory?.ingredient_name || ''}`}
        open={stockOutModalVisible}
        onCancel={() => {
          setStockOutModalVisible(false);
          stockOutForm.resetFields();
          setSelectedInventory(null);
        }}
        footer={null}
        width={500}
      >
        <Form form={stockOutForm} layout="vertical" onFinish={handleStockOut}>
          <div style={{ marginBottom: 16, padding: 12, background: '#f5f7fa', borderRadius: 6 }}>
            <span style={{ color: '#888' }}>当前库存：</span>
            <span style={{ fontWeight: 600 }}>{selectedInventory?.current_quantity || 0} kg</span>
          </div>
          <Form.Item
            name="quantity"
            label="出库数量 (kg)"
            rules={[{ required: true, message: '请输入出库数量' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0.0001}
              max={selectedInventory?.current_quantity}
              step={0.0001}
              precision={4}
            />
          </Form.Item>
          <Form.Item name="batch_number" label="关联批次号">
            <Input placeholder="可选，关联试产批次" maxLength={50} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea placeholder="可选" rows={3} maxLength={500} />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button
                onClick={() => {
                  setStockOutModalVisible(false);
                  stockOutForm.resetFields();
                  setSelectedInventory(null);
                }}
              >
                取消
              </Button>
              <Button type="primary" htmlType="submit" danger>
                确定出库
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`编辑原料 - ${selectedInventory?.ingredient_name || ''}`}
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          editForm.resetFields();
          setSelectedInventory(null);
        }}
        footer={null}
        width={500}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="current_quantity"
                label="当前库存 (kg)"
                rules={[{ required: true, message: '请输入当前库存' }]}
              >
                <InputNumber style={{ width: '100%' }} min={0} step={0.0001} precision={4} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="safety_stock"
                label="安全库存 (kg)"
                rules={[{ required: true, message: '请输入安全库存' }]}
              >
                <InputNumber style={{ width: '100%' }} min={0} step={0.0001} precision={4} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="storage_location" label="存放位置">
            <Input placeholder="请输入存放位置" maxLength={200} />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button
                onClick={() => {
                  setEditModalVisible(false);
                  editForm.resetFields();
                  setSelectedInventory(null);
                }}
              >
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
