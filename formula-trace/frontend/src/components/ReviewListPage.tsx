import { useState, useEffect } from 'react';
import {
  Layout,
  Menu,
  Space,
  Button,
  Table,
  Tag,
  Modal,
  Form,
  Input,
  DatePicker,
  Select,
  message,
  Typography,
  Card,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  TeamOutlined,
  FileTextOutlined,
  HomeOutlined,
  DatabaseOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import type {
  ReviewMeetingListItem,
  ReviewMeetingCreate,
  FormulaVersion,
  ProductLine,
} from '../types';
import { api, getReviewStatusLabel, getReviewStatusTagColor } from '../api';

const { Header, Content } = Layout;
const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

export default function ReviewListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [meetings, setMeetings] = useState<ReviewMeetingListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [productLines, setProductLines] = useState<ProductLine[]>([]);
  const [selectedProductLine, setSelectedProductLine] = useState<number | null>(null);
  const [availableVersions, setAvailableVersions] = useState<FormulaVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  const menuItems = [
    { key: '/', icon: <HomeOutlined />, label: '配方管理' },
    { key: '/reviews', icon: <AuditOutlined />, label: '评审会议' },
    { key: '/inventory', icon: <DatabaseOutlined />, label: '库存管理' },
  ];

  useEffect(() => {
    loadMeetings();
    loadProductLines();
  }, []);

  useEffect(() => {
    if (selectedProductLine) {
      loadVersions(selectedProductLine);
    } else {
      setAvailableVersions([]);
    }
  }, [selectedProductLine]);

  const loadMeetings = async () => {
    setLoading(true);
    try {
      const data = await api.getReviewMeetings();
      setMeetings(data);
    } catch (e) {
      message.error('加载评审会议列表失败');
    } finally {
      setLoading(false);
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

  const loadVersions = async (productLineId: number) => {
    setVersionsLoading(true);
    try {
      const treeData = await api.getVersionTree(productLineId);
      const versions = flattenVersions(treeData);
      setAvailableVersions(versions);
    } catch (e) {
      message.error('加载版本列表失败');
    } finally {
      setVersionsLoading(false);
    }
  };

  const flattenVersions = (tree: any[]): FormulaVersion[] => {
    const result: FormulaVersion[] = [];
    const traverse = (nodes: any[]) => {
      nodes.forEach(node => {
        result.push(node);
        if (node.children && node.children.length > 0) {
          traverse(node.children);
        }
      });
    };
    traverse(tree);
    return result;
  };

  const handleCreate = async (values: any) => {
    try {
      const data: ReviewMeetingCreate = {
        title: values.title,
        review_date: values.review_date.format('YYYY-MM-DD'),
        version_ids: values.version_ids,
        judges: values.judges.split(',').map((j: string) => j.trim()).filter(Boolean),
      };
      await api.createReviewMeeting(data);
      message.success('评审会议创建成功');
      setCreateModalVisible(false);
      form.resetFields();
      setSelectedProductLine(null);
      loadMeetings();
    } catch (e: any) {
      const errMsg = e?.response?.data?.detail || '创建失败';
      message.error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
    }
  };

  const columns = [
    {
      title: '会议标题',
      dataIndex: 'title',
      key: 'title',
      render: (v: string, record: ReviewMeetingListItem) => (
        <a onClick={() => navigate(`/reviews/${record.id}`)} style={{ fontWeight: 500 }}>
          {v}
        </a>
      ),
    },
    {
      title: '评审日期',
      dataIndex: 'review_date',
      key: 'review_date',
      width: 140,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => (
        <Tag color={getReviewStatusTagColor(v)} style={{ fontSize: 13, padding: '2px 10px' }}>
          {getReviewStatusLabel(v)}
        </Tag>
      ),
    },
    {
      title: '版本数',
      dataIndex: 'version_count',
      key: 'version_count',
      width: 80,
      align: 'center' as const,
      render: (v: number) => (
        <Space>
          <FileTextOutlined style={{ color: '#1890ff' }} />
          <span>{v}</span>
        </Space>
      ),
    },
    {
      title: '评委数',
      dataIndex: 'judge_count',
      key: 'judge_count',
      width: 80,
      align: 'center' as const,
      render: (v: number) => (
        <Space>
          <TeamOutlined style={{ color: '#722ed1' }} />
          <span>{v}</span>
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: any, record: ReviewMeetingListItem) => (
        <Button type="link" onClick={() => navigate(`/reviews/${record.id}`)}>
          查看详情
        </Button>
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
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key as string)}
            style={{ minWidth: 300, background: 'transparent' }}
          />
        </Space>
      </Header>

      <Content style={{ padding: '24px', minHeight: 'calc(100vh - 64px)' }}>
        <Card>
          <Space direction="vertical" size={24} style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Title level={3} style={{ margin: 0 }}>
                <AuditOutlined style={{ marginRight: 8 }} />
                配方评审会议管理
              </Title>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                创建评审会议
              </Button>
            </div>

            <Table
              rowKey="id"
              loading={loading}
              dataSource={meetings}
              columns={columns}
              pagination={{ pageSize: 10 }}
              locale={{ emptyText: <Empty description="暂无评审会议" /> }}
            />
          </Space>
        </Card>
      </Content>

      <Modal
        title="创建评审会议"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
          setSelectedProductLine(null);
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
        >
          <Form.Item
            name="title"
            label="会议标题"
            rules={[{ required: true, message: '请输入会议标题' }]}
          >
            <Input placeholder="请输入会议标题，如：2024年Q3保湿霜配方评审" maxLength={200} />
          </Form.Item>

          <Form.Item
            name="review_date"
            label="评审日期"
            rules={[{ required: true, message: '请选择评审日期' }]}
          >
            <DatePicker style={{ width: '100%' }} placeholder="选择评审日期" />
          </Form.Item>

          <Form.Item
            label="选择产品线（筛选配方版本）"
            rules={[{ required: true, message: '请选择产品线' }]}
          >
            <Select
              placeholder="选择产品线"
              value={selectedProductLine}
              onChange={setSelectedProductLine}
              options={productLines.map(p => ({ label: p.name, value: p.id }))}
            />
          </Form.Item>

          <Form.Item
            name="version_ids"
            label="选择待评审的配方版本（1-5个）"
            rules={[
              { required: true, message: '请选择待评审的配方版本' },
              { type: 'array', min: 1, max: 5, message: '请选择1-5个版本' },
            ]}
          >
            <Select
              mode="multiple"
              placeholder="请选择待评审的配方版本"
              loading={versionsLoading}
              disabled={!selectedProductLine}
              optionFilterProp="label"
              options={availableVersions.map(v => ({
                label: `V${v.version_number} - ${v.ingredients_summary}`,
                value: v.id,
              }))}
              maxTagCount={5}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="judges"
            label="评委名单（用逗号分隔）"
            rules={[{ required: true, message: '请输入评委名单' }]}
            help="至少1位评委，例如：张三,李四,王五"
          >
            <TextArea
              rows={3}
              placeholder="请输入评委姓名，用英文逗号分隔"
              maxLength={1000}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setCreateModalVisible(false);
                form.resetFields();
                setSelectedProductLine(null);
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                创建会议
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
