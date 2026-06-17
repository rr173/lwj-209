import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Slider,
  message,
  Typography,
  DatePicker,
  InputNumber,
} from 'antd';
import {
  PlusOutlined,
  ExperimentOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ExperimentListItem, ProductLine, VersionTreeNode, FormulaVersion } from '../types';
import { api, getExperimentStatusLabel, getExperimentStatusTagColor, collectVersionIds } from '../api';

const { Title } = Typography;
const { TextArea } = Input;

function CreateExperimentModal({
  visible,
  onClose,
  onCreated,
  productLines,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  productLines: ProductLine[];
}) {
  const [form] = Form.useForm();
  const [selectedProductLine, setSelectedProductLine] = useState<number | null>(null);
  const [versionTree, setVersionTree] = useState<VersionTreeNode[]>([]);
  const [allVersions, setAllVersions] = useState<FormulaVersion[]>([]);
  const [publishedVersions, setPublishedVersions] = useState<FormulaVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const skinFeelWeight = Form.useWatch('skin_feel_weight', form) ?? 0.4;
  const stabilityWeight = Form.useWatch('stability_weight', form) ?? 0.4;
  const costWeight = Form.useWatch('cost_weight', form) ?? 0.2;
  const totalWeight = skinFeelWeight + stabilityWeight + costWeight;

  useEffect(() => {
    if (selectedProductLine) {
      setLoadingVersions(true);
      Promise.all([
        api.getVersionTree(selectedProductLine),
      ]).then(async ([tree]) => {
        setVersionTree(tree);
        const ids: number[] = [];
        for (const node of tree) {
          collectVersionIds(node, ids);
        }
        const versions: FormulaVersion[] = [];
        for (const id of ids) {
          try {
            const v = await api.getVersion(id);
            versions.push(v);
          } catch {}
        }
        setAllVersions(versions);
        setPublishedVersions(versions.filter(v => v.approval_status === 'published'));
      }).finally(() => setLoadingVersions(false));
    } else {
      setVersionTree([]);
      setAllVersions([]);
      setPublishedVersions([]);
    }
  }, [selectedProductLine]);

  useEffect(() => {
    if (visible) {
      form.resetFields();
      setSelectedProductLine(null);
      form.setFieldsValue({
        skin_feel_weight: 0.4,
        stability_weight: 0.4,
        cost_weight: 0.2,
      });
    }
  }, [visible, form]);

  const handleProductLineChange = (productLineId: number) => {
    setSelectedProductLine(productLineId);
    form.setFieldValue('version_ids', []);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (Math.abs(totalWeight - 1.0) > 0.0001) {
        message.error(`三个权重之和必须等于1.0，当前为${totalWeight.toFixed(4)}`);
        return;
      }
      if (!values.version_ids || values.version_ids.length < 2) {
        message.error('至少需要选择2个配方版本');
        return;
      }
      await api.createExperiment({
        name: values.name,
        purpose: values.purpose,
        version_ids: values.version_ids,
        skin_feel_weight: values.skin_feel_weight,
        stability_weight: values.stability_weight,
        cost_weight: values.cost_weight,
      });
      message.success('实验计划创建成功');
      onCreated();
      onClose();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '创建失败');
    }
  };

  return (
    <Modal
      title={<Space><ExperimentOutlined />新建实验计划</Space>}
      open={visible}
      onCancel={onClose}
      width={720}
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleSubmit}>创建</Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="实验名称"
          name="name"
          rules={[
            { required: true, message: '请输入实验名称' },
            { min: 1, max: 200, message: '名称长度1-200字符' },
          ]}
        >
          <Input placeholder="例如：夏季清爽乳液A/B测试" />
        </Form.Item>

        <Form.Item
          label="实验目的描述"
          name="purpose"
          rules={[
            { required: true, message: '请输入实验目的' },
            { min: 1, max: 1000, message: '描述长度1-1000字符' },
          ]}
        >
          <TextArea rows={3} placeholder="描述本次对照实验的目标和预期" />
        </Form.Item>

        <Form.Item
          label="产品线"
          name="product_line"
          rules={[{ required: true, message: '请选择产品线' }]}
        >
          <Select
            placeholder="选择产品线，自动筛选该产品线已发布的版本"
            onChange={handleProductLineChange}
            options={productLines.map(p => ({ label: p.name, value: p.id }))}
          />
        </Form.Item>

        <Form.Item
          label={`纳入的配方版本 (2-6个，当前已选 ${form.getFieldValue('version_ids')?.length || 0}个)`}
          name="version_ids"
          rules={[{ required: true, message: '请选择至少2个配方版本' }]}
        >
          <Select
            mode="multiple"
            placeholder={selectedProductLine ? '选择2-6个已发布版本' : '请先选择产品线'}
            disabled={!selectedProductLine || loadingVersions}
            loading={loadingVersions}
            options={publishedVersions.map(v => ({
              label: `V${v.version_number} - ${v.ingredients_summary}`,
              value: v.id,
            }))}
            maxTagCount={6}
          />
        </Form.Item>

        <Title level={5} style={{ marginTop: 8, marginBottom: 16 }}>
          评估指标权重配置
          <Tag
            color={Math.abs(totalWeight - 1.0) < 0.0001 ? 'green' : 'red'}
            style={{ marginLeft: 12 }}
          >
            合计: {(totalWeight * 100).toFixed(1)}%
            {Math.abs(totalWeight - 1.0) > 0.0001 && ' (需为100%)'}
          </Tag>
        </Title>

        <Form.Item label="肤感权重" required style={{ marginBottom: 8 }}>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="skin_feel_weight" noStyle>
              <Slider
                min={0}
                max={1}
                step={0.05}
                style={{ flex: 1, margin: '0 12px' }}
              />
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
              <Slider
                min={0}
                max={1}
                step={0.05}
                style={{ flex: 1, margin: '0 12px' }}
              />
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
              <Slider
                min={0}
                max={1}
                step={0.05}
                style={{ flex: 1, margin: '0 12px' }}
              />
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
      </Form>
    </Modal>
  );
}

export default function ExperimentListPage() {
  const navigate = useNavigate();
  const [experiments, setExperiments] = useState<ExperimentListItem[]>([]);
  const [productLines, setProductLines] = useState<ProductLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [exps, pls] = await Promise.all([
        api.listExperiments(),
        api.getProductLines(),
      ]);
      setExperiments(exps);
      setProductLines(pls);
    } catch {
      message.error('加载实验列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const columns = [
    {
      title: '实验名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: ExperimentListItem) => (
        <Space>
          <ExperimentOutlined />
          <a onClick={() => navigate(`/experiments/${record.id}`)}>{text}</a>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={getExperimentStatusTagColor(status)}>
          {getExperimentStatusLabel(status)}
        </Tag>
      ),
    },
    {
      title: '产品线',
      dataIndex: 'product_line_name',
      key: 'product_line_name',
      width: 180,
    },
    {
      title: '版本数',
      dataIndex: 'version_count',
      key: 'version_count',
      width: 100,
      render: (v: number) => <Tag color="blue">{v} 个</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 200,
      render: (t: string) => new Date(t).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: ExperimentListItem) => (
        <Button
          type="primary"
          size="small"
          icon={<ArrowRightOutlined />}
          onClick={() => navigate(`/experiments/${record.id}`)}
        >
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: 'white', borderRadius: 8, margin: 20 }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}>
          <ExperimentOutlined /> 配方实验与A/B测试
        </Title>
        <Space>
          <Button onClick={loadData}>刷新</Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            新建实验计划
          </Button>
        </Space>
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={experiments}
        loading={loading}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: '暂无实验计划，点击右上角"新建实验计划"开始' }}
      />

      <CreateExperimentModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onCreated={loadData}
        productLines={productLines}
      />
    </div>
  );
}
