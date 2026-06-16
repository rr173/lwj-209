import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Table, Tag, Space, Button, Modal, Form, Input, InputNumber, DatePicker, message, Progress, Row, Col, Divider, Typography, Tabs, Select, Alert, Empty, Statistic, Popconfirm, Slider, Timeline } from 'antd';
import { EyeOutlined, PlusOutlined, DeleteOutlined, MinusCircleOutlined, LineChartOutlined, ThunderboltOutlined, DollarOutlined, CalculatorOutlined, SafetyOutlined, ExperimentOutlined, CheckCircleOutlined, CloseCircleOutlined, SendOutlined, AuditOutlined, HistoryOutlined } from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import type { FormulaVersion, Batch, IngredientItem, IngredientTrendResponse, FormulaRecommendationResponse, VersionTreeNode, CostBreakdownResponse, CostSimulateResponse, CostSimulateItem, SupplierQuote, StabilityRiskResponse, AgingSimulationResponse, CompatibilityListItem, ApprovalRecord } from '../types';
import { getScoreColor, api, getApprovalStatusLabel, getApprovalStatusTagColor } from '../api';

const { Title, Text } = Typography;

interface Props {
  version: FormulaVersion;
  batches: Batch[];
  allBatches: Batch[];
  versionTree: VersionTreeNode[];
  onVersionCreated?: () => void;
  onVersionUpdated?: () => void;
}

export default function VersionDetail({ version, batches, allBatches, versionTree, onVersionCreated, onVersionUpdated }: Props) {
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
  const [allProductLineIngredients, setAllProductLineIngredients] = useState<string[]>([]);
  const [ingredientsLoading, setIngredientsLoading] = useState(false);

  const [costBreakdown, setCostBreakdown] = useState<CostBreakdownResponse | null>(null);
  const [costLoading, setCostLoading] = useState(false);
  const [simulateMode, setSimulateMode] = useState(false);
  const [simulateResult, setSimulateResult] = useState<CostSimulateResponse | null>(null);
  const [simulateIngredients, setSimulateIngredients] = useState<CostSimulateItem[]>([]);

  const [quoteModalVisible, setQuoteModalVisible] = useState(false);
  const [quoteForm] = Form.useForm();
  const [selectedIngredientForQuote, setSelectedIngredientForQuote] = useState<string>('');
  const [ingredientQuotes, setIngredientQuotes] = useState<SupplierQuote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);

  const [stabilityRisk, setStabilityRisk] = useState<StabilityRiskResponse | null>(null);
  const [stabilityLoading, setStabilityLoading] = useState(false);
  const [agingSimulation, setAgingSimulation] = useState<AgingSimulationResponse | null>(null);
  const [agingLoading, setAgingLoading] = useState(false);
  const [simulationDays, setSimulationDays] = useState<number>(30);
  const [hasRunSimulation, setHasRunSimulation] = useState(false);

  const [compatibilityData, setCompatibilityData] = useState<{
    ingredient_name: string;
    relations: CompatibilityListItem[];
  } | null>(null);
  const [compatibilityLoading, setCompatibilityLoading] = useState(false);

  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectForm] = Form.useForm();
  const [approvalHistory, setApprovalHistory] = useState<ApprovalRecord[]>([]);
  const [approvalHistoryLoading, setApprovalHistoryLoading] = useState(false);
  const [approvalActionLoading, setApprovalActionLoading] = useState(false);

  const allIngredients = [...version.ingredients].sort((a, b) => b.percentage - a.percentage);
  const batchesForVersion = allBatches.filter(b => b.version_id === version.id);
  const isPublished = version.approval_status === 'published';

  useEffect(() => {
    let cancelled = false;
    setApprovalHistoryLoading(true);
    api.getApprovalHistory(version.id)
      .then(data => {
        if (!cancelled) setApprovalHistory(data);
      })
      .catch(() => {
        if (!cancelled) setApprovalHistory([]);
      })
      .finally(() => {
        if (!cancelled) setApprovalHistoryLoading(false);
      });
    return () => { cancelled = true; };
  }, [version.id, version.approval_status]);

  const handleApprovalAction = useCallback(async (action: 'submit' | 'approve', operator: string, remark?: string) => {
    setApprovalActionLoading(true);
    try {
      if (action === 'submit') {
        await api.submitForApproval(version.id, operator, remark);
        message.success('已提交审批');
      } else {
        await api.approveVersion(version.id, operator, remark);
        message.success('审批通过，版本已发布');
      }
      if (onVersionUpdated) onVersionUpdated();
    } catch (e: any) {
      const errMsg = e?.response?.data?.detail || '操作失败';
      message.error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
    } finally {
      setApprovalActionLoading(false);
    }
  }, [version.id, onVersionUpdated]);

  const handleReject = useCallback(async (values: any) => {
    setApprovalActionLoading(true);
    try {
      await api.rejectVersion(version.id, values.operator, values.remark);
      message.success('已驳回');
      setRejectModalVisible(false);
      rejectForm.resetFields();
      if (onVersionUpdated) onVersionUpdated();
    } catch (e: any) {
      const errMsg = e?.response?.data?.detail || '驳回失败';
      message.error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
    } finally {
      setApprovalActionLoading(false);
    }
  }, [version.id, onVersionUpdated, rejectForm]);

  useEffect(() => {
    let cancelled = false;
    setIngredientsLoading(true);
    api.getProductLineIngredients(version.product_line_id)
      .then(data => {
        if (!cancelled) {
          setAllProductLineIngredients(data.ingredients);
        }
      })
      .catch(e => {
        if (!cancelled) {
          message.error('加载成分列表失败');
        }
      })
      .finally(() => {
        if (!cancelled) setIngredientsLoading(false);
      });
    return () => { cancelled = true; };
  }, [version.product_line_id]);

  const ingredientOptions = useMemo(() => {
    const names = new Set<string>();
    allProductLineIngredients.forEach(name => names.add(name));
    version.ingredients.forEach(ing => names.add(ing.name));
    return Array.from(names).sort().map(name => ({ label: name, value: name }));
  }, [allProductLineIngredients, version.ingredients]);

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

  useEffect(() => {
    if (!selectedIngredient) return;
    let cancelled = false;
    setCompatibilityLoading(true);
    api.getCompatibilityByIngredient(selectedIngredient, version.id)
      .then(data => {
        if (!cancelled) setCompatibilityData(data);
      })
      .catch(e => {
        if (!cancelled) {
          message.error('获取成分相容性数据失败');
          setCompatibilityData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setCompatibilityLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedIngredient, version.id]);

  useEffect(() => {
    let cancelled = false;
    setCostLoading(true);
    api.getCostBreakdown(version.id)
      .then(data => {
        if (!cancelled) {
          setCostBreakdown(data);
          setSimulateIngredients(data.breakdown.map(item => ({
            name: item.ingredient_name,
            percentage: item.percentage
          })));
        }
      })
      .catch(e => {
        if (!cancelled) {
          message.error('加载成本分析失败');
        }
      })
      .finally(() => {
        if (!cancelled) setCostLoading(false);
      });
    return () => { cancelled = true; };
  }, [version.id]);

  useEffect(() => {
    let cancelled = false;
    setStabilityLoading(true);
    api.getStabilityRisk(version.id)
      .then(data => {
        if (!cancelled) setStabilityRisk(data);
      })
      .catch(e => {
        if (!cancelled) {
          message.error('加载稳定性风险评估失败');
          setStabilityRisk(null);
        }
      })
      .finally(() => {
        if (!cancelled) setStabilityLoading(false);
      });
    return () => { cancelled = true; };
  }, [version.id]);

  const loadIngredientQuotes = async (ingredientName: string) => {
    setQuotesLoading(true);
    try {
      const data = await api.getQuotesByIngredient(ingredientName);
      setIngredientQuotes(data);
    } catch (e) {
      message.error('加载供应商报价失败');
    } finally {
      setQuotesLoading(false);
    }
  };

  const openQuoteModal = (ingredientName: string) => {
    setSelectedIngredientForQuote(ingredientName);
    quoteForm.resetFields();
    quoteForm.setFieldsValue({ ingredient_name: ingredientName });
    loadIngredientQuotes(ingredientName);
    setQuoteModalVisible(true);
  };

  const handleCreateQuote = async (values: any) => {
    try {
      await api.createSupplierQuote({
        ingredient_name: values.ingredient_name,
        supplier_name: values.supplier_name,
        unit_price: values.unit_price,
        min_order_quantity: values.min_order_quantity || 0,
        valid_from: values.valid_from.format('YYYY-MM-DD'),
        valid_to: values.valid_to.format('YYYY-MM-DD')
      });
      message.success('报价创建成功');
      quoteForm.resetFields(['supplier_name', 'unit_price', 'min_order_quantity', 'valid_from', 'valid_to']);
      quoteForm.setFieldsValue({ ingredient_name: selectedIngredientForQuote });
      loadIngredientQuotes(selectedIngredientForQuote);
      const data = await api.getCostBreakdown(version.id);
      setCostBreakdown(data);
      if (!simulateMode) {
        setSimulateIngredients(data.breakdown.map(item => ({
          name: item.ingredient_name,
          percentage: item.percentage
        })));
      }
    } catch (e: any) {
      let errMsg = '创建失败';
      if (e?.response?.data?.detail) {
        errMsg = e.response.data.detail;
      }
      message.error(errMsg);
    }
  };

  const handleDeleteQuote = async (quoteId: number) => {
    try {
      await api.deleteSupplierQuote(quoteId);
      message.success('删除成功');
      loadIngredientQuotes(selectedIngredientForQuote);
      const data = await api.getCostBreakdown(version.id);
      setCostBreakdown(data);
      if (!simulateMode) {
        setSimulateIngredients(data.breakdown.map(item => ({
          name: item.ingredient_name,
          percentage: item.percentage
        })));
      }
    } catch (e) {
      message.error('删除失败');
    }
  };

  const toggleSimulateMode = () => {
    if (simulateMode) {
      setSimulateMode(false);
      setSimulateResult(null);
      if (costBreakdown) {
        setSimulateIngredients(costBreakdown.breakdown.map(item => ({
          name: item.ingredient_name,
          percentage: item.percentage
        })));
      }
    } else {
      if (!costBreakdown) {
        message.warning('成本数据正在加载，请稍候再试');
        return;
      }
      const currentNames = costBreakdown.breakdown.map(i => i.ingredient_name);
      const simNames = simulateIngredients.map(i => i.name);
      const needsReset = !currentNames.every(n => simNames.includes(n)) || 
                         !simNames.every(n => currentNames.includes(n));
      if (needsReset || simulateIngredients.length === 0) {
        setSimulateIngredients(costBreakdown.breakdown.map(item => ({
          name: item.ingredient_name,
          percentage: item.percentage
        })));
      }
      setSimulateMode(true);
    }
  };

  const runSimulation = async () => {
    try {
      const data = await api.simulateCost(version.id, simulateIngredients);
      setSimulateResult(data);
    } catch (e) {
      message.error('成本模拟失败');
    }
  };

  const runAgingSimulation = async () => {
    setAgingLoading(true);
    setHasRunSimulation(true);
    try {
      const data = await api.getAgingSimulation(version.id, simulationDays);
      setAgingSimulation(data);
    } catch (e) {
      message.error('加速老化模拟失败');
      setAgingSimulation(null);
    } finally {
      setAgingLoading(false);
    }
  };

  const getRiskLevelColor = (level: string): string => {
    switch (level) {
      case '低风险': return '#52c41a';
      case '中风险': return '#faad14';
      case '高风险': return '#f5222d';
      default: return '#8c8c8c';
    }
  };

  const getCompatibilityLevelColor = (level: string): string => {
    switch (level) {
      case '相容': return '#52c41a';
      case '轻微不相容': return '#faad14';
      case '严重不相容': return '#f5222d';
      case '未配置': return '#8c8c8c';
      default: return '#8c8c8c';
    }
  };

  const getIngredientTypeColor = (type: string): string => {
    switch (type) {
      case '活性成分': return '#1890ff';
      case '防腐剂': return '#722ed1';
      case '基础原料': return '#8c8c8c';
      default: return '#8c8c8c';
    }
  };

  const handleSimulatePercentageChange = (ingredientName: string, value: number | null) => {
    if (value === null || value === undefined) return;
    const newIngredients = simulateIngredients.map(item =>
      item.name === ingredientName ? { ...item, percentage: value } : item
    );
    setSimulateIngredients(newIngredients);
  };

  useEffect(() => {
    if (simulateMode && simulateIngredients.length > 0) {
      const timer = setTimeout(() => {
        runSimulation();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [simulateIngredients, simulateMode]);

  const pieData = useMemo(() => {
    if (!costBreakdown) return [];
    return costBreakdown.breakdown
      .filter(item => item.cost !== null && item.cost > 0)
      .map(item => ({
        name: item.ingredient_name,
        value: item.cost
      }));
  }, [costBreakdown]);

  const agingChartData = useMemo(() => {
    if (!agingSimulation) return [];
    return agingSimulation.items
      .sort((a, b) => b.initial_percentage - a.initial_percentage)
      .map(item => ({
        name: item.ingredient_name,
        初始含量: Number(item.initial_percentage.toFixed(2)),
        残留含量: Number(item.residual_percentage.toFixed(2)),
        类型: item.ingredient_type
      }));
  }, [agingSimulation]);

  const COLORS = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe', '#43e97b', '#38f9d7', '#fa709a', '#fee140'];

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

      {selectedIngredient && (
        <Card
          title={
            <Space>
              <SafetyOutlined style={{ color: '#1890ff' }} />
              <span>{selectedIngredient} 与配方中其他成分的相容性</span>
            </Space>
          }
          size="small"
          loading={compatibilityLoading}
        >
          {compatibilityData && compatibilityData.relations.length > 0 ? (
            <Table
              size="small"
              dataSource={compatibilityData.relations.map((rel, idx) => ({ key: idx, ...rel }))}
              pagination={{ pageSize: 10 }}
              columns={[
                {
                  title: '其他成分',
                  dataIndex: 'other_ingredient',
                  key: 'other_ingredient',
                  width: 140,
                  render: (v: string, record: any) => (
                    <Space direction="vertical" size={0}>
                      <span style={{ fontWeight: 600 }}>{v}</span>
                      {record.percentage !== null && (
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          含量: {record.percentage.toFixed(2)}%
                        </Text>
                      )}
                    </Space>
                  )
                },
                {
                  title: '相容性等级',
                  dataIndex: 'compatibility_level',
                  key: 'compatibility_level',
                  width: 120,
                  render: (v: string) => (
                    <Tag color={getCompatibilityLevelColor(v)}>{v}</Tag>
                  )
                },
                {
                  title: '相容性分数',
                  dataIndex: 'compatibility_score',
                  key: 'compatibility_score',
                  width: 110,
                  align: 'center',
                  render: (v: number | null) => (
                    v !== null ? (
                      <span style={{
                        fontFamily: 'monospace',
                        color: getCompatibilityLevelColor(
                          v >= 80 ? '相容' : v >= 50 ? '轻微不相容' : '严重不相容'
                        ),
                        fontWeight: 600
                      }}>
                        {v.toFixed(0)}/100
                      </span>
                    ) : (
                      <Text type="secondary">-</Text>
                    )
                  )
                },
                {
                  title: '风险表现',
                  dataIndex: 'manifestation',
                  key: 'manifestation',
                  render: (v: string | null) => v || <Text type="secondary">暂无数据</Text>
                },
                {
                  title: '备注',
                  dataIndex: 'notes',
                  key: 'notes',
                  ellipsis: true,
                  render: (v: string | null) => v || <Text type="secondary">-</Text>
                }
              ]}
            />
          ) : (
            !compatibilityLoading && <Empty description="暂无相容性数据" />
          )}
        </Card>
      )}
    </Space>
  );

  const renderCostTab = () => (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Card
        size="small"
        title={
          <Space>
            <span>成本分析概览</span>
            <Button
              type={simulateMode ? 'primary' : 'default'}
              size="small"
              icon={<CalculatorOutlined />}
              onClick={toggleSimulateMode}
            >
              {simulateMode ? '退出模拟' : '成本模拟'}
            </Button>
          </Space>
        }
      >
        <Row gutter={24}>
          <Col span={10}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Text type="secondary">每公斤原料成本</Text>
              <div style={{ fontSize: 32, fontWeight: 700, color: '#1890ff', marginTop: 4 }}>
                ¥{costBreakdown ? costBreakdown.total_cost.toFixed(2) : '-'}
              </div>
              {simulateMode && simulateResult && (
                <div style={{ marginTop: 8 }}>
                  <Tag color={simulateResult.total_delta >= 0 ? 'red' : 'green'} style={{ fontSize: 14, padding: '4px 12px' }}>
                    模拟后: ¥{simulateResult.new_total_cost.toFixed(2)}
                    ({simulateResult.total_delta >= 0 ? '+' : ''}{simulateResult.total_delta.toFixed(2)},
                    {simulateResult.delta_percentage >= 0 ? '+' : ''}{simulateResult.delta_percentage.toFixed(2)}%)
                  </Tag>
                </div>
              )}
            </div>
            {pieData.length > 0 ? (
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => [`¥${Number(value).toFixed(2)}`, '成本']}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty description="暂无成本数据" style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
            )}
          </Col>
          <Col span={14}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {costBreakdown && costBreakdown.missing_quotes.length > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  message={`以下成分缺少供应商报价：${costBreakdown.missing_quotes.join('、')}`}
                />
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong>成本明细</Text>
                {simulateMode && (
                  <Text type="secondary">
                    当前合计: {simulateIngredients.reduce((s, i) => s + i.percentage, 0).toFixed(2)}%
                  </Text>
                )}
              </div>
              <Table
                size="small"
                loading={costLoading}
                dataSource={simulateMode && simulateResult ? simulateResult.items : (costBreakdown?.breakdown || [])}
                rowKey="ingredient_name"
                pagination={false}
                scroll={{ y: 280 }}
                columns={[
                  {
                    title: '成分名称',
                    dataIndex: 'ingredient_name',
                    key: 'ingredient_name',
                    width: 130,
                    render: (v: string, record: any) => (
                      <Space>
                        <span>{v}</span>
                        <Button
                          type="link"
                          size="small"
                          onClick={() => openQuoteModal(v)}
                        >
                          报价
                        </Button>
                      </Space>
                    )
                  },
                  {
                    title: '百分比',
                    dataIndex: 'percentage',
                    key: 'percentage',
                    width: 100,
                    align: 'right',
                    render: (v: number, record: any) => {
                      if (simulateMode) {
                        const simItem = simulateIngredients.find(i => i.name === record.ingredient_name);
                        const newPct = simItem?.percentage ?? v;
                        const origPct = record.original_percentage ?? v;
                        const delta = newPct - origPct;
                        return (
                          <Space direction="vertical" size={2} align="end">
                            <InputNumber
                              size="small"
                              min={0}
                              max={100}
                              step={0.01}
                              precision={2}
                              value={newPct}
                              style={{ width: 90 }}
                              onChange={(val) => handleSimulatePercentageChange(record.ingredient_name, val)}
                              suffix="%"
                            />
                            {delta !== 0 && (
                              <Text style={{ fontSize: 11, color: delta > 0 ? '#52c41a' : '#f5222d', fontWeight: 600 }}>
                                ({delta > 0 ? '+' : ''}{delta.toFixed(2)}%)
                              </Text>
                            )}
                          </Space>
                        );
                      }
                      return <span style={{ fontFamily: 'monospace' }}>{v.toFixed(2)}%</span>;
                    }
                  },
                  {
                    title: '单价(元/kg)',
                    dataIndex: 'unit_price',
                    key: 'unit_price',
                    width: 90,
                    align: 'right',
                    render: (v: number | null, record: any) => {
                      if (simulateMode && !record.has_quote && !record.unit_price) {
                        return v ? <span style={{ fontFamily: 'monospace' }}>¥{v.toFixed(2)}</span> : <Tag color="default">无报价</Tag>;
                      }
                      return v ? <span style={{ fontFamily: 'monospace' }}>¥{v.toFixed(2)}</span> : <Tag color="default">无报价</Tag>;
                    }
                  },
                  {
                    title: '供应商',
                    dataIndex: 'supplier_name',
                    key: 'supplier_name',
                    width: 100,
                    ellipsis: true,
                    render: (v: string | null) => v || '-'
                  },
                  {
                    title: '成本(元)',
                    dataIndex: 'cost',
                    key: 'cost',
                    width: 100,
                    align: 'right',
                    render: (v: number | null, record: any) => {
                      if (simulateMode && simulateResult) {
                        const newCost = record.new_cost;
                        const costDelta = record.cost_delta;
                        return (
                          <Space direction="vertical" size={2} align="end">
                            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                              {newCost !== null ? `¥${newCost.toFixed(2)}` : '-'}
                            </span>
                            {costDelta !== null && costDelta !== 0 && (
                              <Text style={{ fontSize: 11, color: costDelta > 0 ? '#f5222d' : '#52c41a' }}>
                                ({costDelta > 0 ? '+' : ''}¥{costDelta.toFixed(2)})
                              </Text>
                            )}
                          </Space>
                        );
                      }
                      return v ? <span style={{ fontFamily: 'monospace' }}>¥{v.toFixed(2)}</span> : '-';
                    }
                  }
                ]}
              />
            </Space>
          </Col>
        </Row>
      </Card>
    </Space>
  );

  const renderStabilityTab = () => (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Card
        size="small"
        title={
          <Space>
            <SafetyOutlined style={{ color: '#1890ff' }} />
            <span>稳定性风险评估</span>
          </Space>
        }
        loading={stabilityLoading}
      >
        {stabilityRisk ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Row gutter={24}>
              <Col span={8}>
                <Card size="small" style={{ textAlign: 'center' }}>
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <Progress
                      type="dashboard"
                      percent={stabilityRisk.total_score}
                      width={140}
                      strokeColor={getRiskLevelColor(stabilityRisk.risk_level)}
                      format={() => (
                        <span style={{ fontSize: 28, fontWeight: 700, color: getRiskLevelColor(stabilityRisk.risk_level) }}>
                          {stabilityRisk.total_score.toFixed(1)}
                        </span>
                      )}
                    />
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Tag
                      color={getRiskLevelColor(stabilityRisk.risk_level)}
                      style={{ fontSize: 16, padding: '4px 16px' }}
                    >
                      {stabilityRisk.risk_level}
                    </Tag>
                  </div>
                  <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                    综合稳定性风险分
                  </Text>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" style={{ textAlign: 'center', height: '100%' }}>
                  <Statistic
                    title="风险成分对"
                    value={stabilityRisk.risk_pairs.length}
                    valueStyle={{ color: stabilityRisk.risk_pairs.length > 0 ? '#f5222d' : '#52c41a', fontSize: 32 }}
                    suffix="对"
                  />
                  <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                    存在相容性风险的组合
                  </Text>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" style={{ textAlign: 'center', height: '100%' }}>
                  <Statistic
                    title="累计扣分"
                    value={stabilityRisk.total_deduction}
                    precision={2}
                    valueStyle={{ color: '#faad14', fontSize: 28 }}
                  />
                  <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                    从满分100分中扣除
                  </Text>
                </Card>
              </Col>
            </Row>

            {stabilityRisk.risk_pairs.length > 0 ? (
              <div>
                <Text strong>风险成分对详情（按扣分数降序）</Text>
                <Table
                  size="small"
                  style={{ marginTop: 12 }}
                  dataSource={stabilityRisk.risk_pairs.map((pair, idx) => ({ key: idx, ...pair }))}
                  pagination={{ pageSize: 10 }}
                  columns={[
                    {
                      title: '成分A',
                      dataIndex: 'ingredient_a',
                      key: 'ingredient_a',
                      width: 140,
                      render: (v: string, record: any) => (
                        <Space direction="vertical" size={0}>
                          <span style={{ fontWeight: 600 }}>{v}</span>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {record.percentage_a.toFixed(2)}%
                          </Text>
                        </Space>
                      )
                    },
                    {
                      title: '',
                      key: 'vs',
                      width: 40,
                      align: 'center',
                      render: () => <Text type="secondary">↔</Text>
                    },
                    {
                      title: '成分B',
                      dataIndex: 'ingredient_b',
                      key: 'ingredient_b',
                      width: 140,
                      render: (v: string, record: any) => (
                        <Space direction="vertical" size={0}>
                          <span style={{ fontWeight: 600 }}>{v}</span>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {record.percentage_b.toFixed(2)}%
                          </Text>
                        </Space>
                      )
                    },
                    {
                      title: '相容性',
                      dataIndex: 'compatibility_level',
                      key: 'compatibility_level',
                      width: 100,
                      render: (v: string) => (
                        <Tag color={getCompatibilityLevelColor(v)}>{v}</Tag>
                      )
                    },
                    {
                      title: '相容性分数',
                      dataIndex: 'compatibility_score',
                      key: 'compatibility_score',
                      width: 100,
                      align: 'center',
                      render: (v: number) => (
                        <span style={{
                          fontFamily: 'monospace',
                          color: getCompatibilityLevelColor(
                            v >= 80 ? '相容' : v >= 50 ? '轻微不相容' : '严重不相容'
                          ),
                          fontWeight: 600
                        }}>
                          {v.toFixed(0)}/100
                        </span>
                      )
                    },
                    {
                      title: '风险表现',
                      dataIndex: 'manifestation',
                      key: 'manifestation',
                      ellipsis: true
                    },
                    {
                      title: '扣分',
                      dataIndex: 'deduction',
                      key: 'deduction',
                      width: 80,
                      align: 'right',
                      render: (v: number) => (
                        <span style={{ color: '#f5222d', fontWeight: 600, fontFamily: 'monospace' }}>
                          -{v.toFixed(2)}
                        </span>
                      )
                    }
                  ]}
                />
              </div>
            ) : (
              <Alert
                type="success"
                showIcon
                message="恭喜！该配方未检测到已知的成分相容性风险"
                description="所有成分对均符合已知相容性规则，配方理论稳定性良好。"
              />
            )}
          </Space>
        ) : (
          <Empty description="暂无稳定性评估数据" />
        )}
      </Card>

      <Card
        size="small"
        title={
          <Space>
            <ExperimentOutlined style={{ color: '#722ed1' }} />
            <span>加速老化模拟</span>
          </Space>
        }
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Row gutter={24} align="middle">
            <Col span={16}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Space>
                  <Text strong>模拟天数：</Text>
                  <Tag color="blue" style={{ fontSize: 14, padding: '2px 12px' }}>
                    {simulationDays} 天
                  </Tag>
                </Space>
                <Slider
                  min={1}
                  max={180}
                  step={null}
                  marks={{
                    7: '7天',
                    14: '14天',
                    30: '30天',
                    60: '60天',
                    90: '90天',
                    180: '180天'
                  }}
                  value={simulationDays}
                  onChange={setSimulationDays}
                />
              </Space>
            </Col>
            <Col span={8}>
              <Button
                type="primary"
                size="large"
                icon={<ExperimentOutlined />}
                onClick={runAgingSimulation}
                loading={agingLoading}
                block
              >
                开始模拟
              </Button>
            </Col>
          </Row>

          {hasRunSimulation && agingSimulation ? (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Card size="small" style={{ textAlign: 'center' }}>
                    <Statistic
                      title="活性成分保留率"
                      value={agingSimulation.overall_active_retention_rate}
                      precision={1}
                      suffix="%"
                      valueStyle={{
                        color: agingSimulation.overall_active_retention_rate >= 90 ? '#52c41a' :
                               agingSimulation.overall_active_retention_rate >= 70 ? '#faad14' : '#f5222d',
                        fontSize: 24
                      }}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" style={{ textAlign: 'center' }}>
                    <Statistic
                      title="防腐剂保留率"
                      value={agingSimulation.overall_preservative_retention_rate}
                      precision={1}
                      suffix="%"
                      valueStyle={{
                        color: agingSimulation.overall_preservative_retention_rate >= 90 ? '#52c41a' :
                               agingSimulation.overall_preservative_retention_rate >= 70 ? '#faad14' : '#f5222d',
                        fontSize: 24
                      }}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" style={{ textAlign: 'center' }}>
                    <Statistic
                      title="基础原料保留率"
                      value={agingSimulation.overall_base_retention_rate}
                      precision={1}
                      suffix="%"
                      valueStyle={{ color: '#52c41a', fontSize: 24 }}
                    />
                  </Card>
                </Col>
              </Row>

              <Alert
                type="info"
                showIcon
                message="一级动力学衰减模型"
                description="残留 = 初始 × e^(-k×天数)，k值：活性成分0.005/天，防腐剂0.003/天，基础原料0.001/天"
              />

              <Card title="各成分残留百分比对比" size="small">
                <div style={{ width: '100%', height: 400 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agingChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        label={{ value: '百分比 (%)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
                        domain={[0, 'auto']}
                        tickFormatter={(v) => v.toFixed(1)}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: 8 }}
                        formatter={(value: any, name: any) => [
                          `${Number(value).toFixed(2)}%`,
                          name
                        ]}
                      />
                      <Legend />
                      <Bar dataKey="初始含量" fill="#667eea" name="初始含量 (%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="残留含量" fill="#f5576c" name="模拟后残留 (%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card title="详细降解数据" size="small">
                <Table
                  size="small"
                  dataSource={agingSimulation.items.map((item, idx) => ({ key: idx, ...item }))}
                  pagination={{ pageSize: 10 }}
                  columns={[
                    {
                      title: '成分名称',
                      dataIndex: 'ingredient_name',
                      key: 'ingredient_name',
                      width: 140
                    },
                    {
                      title: '成分类型',
                      dataIndex: 'ingredient_type',
                      key: 'ingredient_type',
                      width: 100,
                      render: (v: string) => (
                        <Tag color={getIngredientTypeColor(v)}>{v}</Tag>
                      )
                    },
                    {
                      title: '降解速率k',
                      dataIndex: 'degradation_rate',
                      key: 'degradation_rate',
                      width: 100,
                      align: 'right',
                      render: (v: number) => (
                        <span style={{ fontFamily: 'monospace' }}>{v.toFixed(3)}</span>
                      )
                    },
                    {
                      title: '初始含量',
                      dataIndex: 'initial_percentage',
                      key: 'initial_percentage',
                      width: 100,
                      align: 'right',
                      render: (v: number) => (
                        <span style={{ fontFamily: 'monospace' }}>{v.toFixed(2)}%</span>
                      )
                    },
                    {
                      title: '模拟后残留',
                      dataIndex: 'residual_percentage',
                      key: 'residual_percentage',
                      width: 110,
                      align: 'right',
                      render: (v: number, record: any) => {
                        const retention = (v / record.initial_percentage) * 100;
                        return (
                          <Space direction="vertical" size={0} align="end">
                            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v.toFixed(2)}%</span>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              保留 {retention.toFixed(1)}%
                            </Text>
                          </Space>
                        );
                      }
                    },
                    {
                      title: '降解量',
                      dataIndex: 'degradation_amount',
                      key: 'degradation_amount',
                      width: 100,
                      align: 'right',
                      render: (v: number) => (
                        <span style={{ color: '#f5222d', fontFamily: 'monospace', fontWeight: 600 }}>
                          -{v.toFixed(2)}%
                        </span>
                      )
                    }
                  ]}
                />
              </Card>
            </Space>
          ) : hasRunSimulation ? (
            <Empty description="模拟失败，请重试" />
          ) : (
            <Empty description="请选择模拟天数并点击「开始模拟」按钮" />
          )}
        </Space>
      </Card>
    </Space>
  );

  const renderApprovalTab = () => (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Card size="small" title={<Space><AuditOutlined /> 审批状态</Space>}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <Tag color={getApprovalStatusTagColor(version.approval_status)} style={{ fontSize: 16, padding: '4px 16px' }}>
            {getApprovalStatusLabel(version.approval_status)}
          </Tag>
          <Text type="secondary">
            {version.approval_status === 'draft' && '当前版本为草稿状态，提交审批后方可发布使用。'}
            {version.approval_status === 'pending' && '当前版本已提交审批，等待审批人审核。'}
            {version.approval_status === 'published' && '当前版本已发布，可创建试产批次。'}
            {version.approval_status === 'rejected' && '当前版本已被驳回，可修改后重新提交审批。'}
          </Text>
        </div>
        {!isPublished && (
          <Alert
            type="warning"
            showIcon
            message="未发布的版本不能创建试产批次"
            description="请先提交审批并通过后，才能为该版本创建试产批次。"
          />
        )}
      </Card>

      <Card size="small" title={<Space><HistoryOutlined /> 审批历史</Space>} loading={approvalHistoryLoading}>
        {approvalHistory.length > 0 ? (
          <Timeline
            items={approvalHistory.map(record => ({
              color: record.action === 'approve' ? 'green' : record.action === 'reject' ? 'red' : record.action === 'submit' ? 'blue' : 'gray',
              children: (
                <div>
                  <Space>
                    <Tag color={
                      record.action === 'submit' ? 'blue' :
                      record.action === 'approve' ? 'green' :
                      record.action === 'reject' ? 'red' : 'default'
                    }>
                      {record.action === 'submit' ? '提交审批' :
                       record.action === 'approve' ? '审批通过' :
                       record.action === 'reject' ? '驳回' : record.action}
                    </Tag>
                    <Text strong>{record.operator}</Text>
                    <Text type="secondary">{new Date(record.created_at).toLocaleString('zh-CN')}</Text>
                  </Space>
                  {record.remark && (
                    <div style={{ marginTop: 4, padding: '8px 12px', background: '#f5f5f5', borderRadius: 4 }}>
                      <Text type="secondary">备注：</Text>{record.remark}
                    </div>
                  )}
                </div>
              )
            }))}
          />
        ) : (
          <Empty description="暂无审批记录" />
        )}
      </Card>
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
            <Tag color={getApprovalStatusTagColor(version.approval_status)}>
              {getApprovalStatusLabel(version.approval_status)}
            </Tag>
            {version.parent_id && (
              <Tag color="blue">父版本: V{version.parent_id}</Tag>
            )}
          </Space>
        }
        extra={
          <Space>
            {(version.approval_status === 'draft' || version.approval_status === 'rejected') && (
              <Popconfirm
                title="提交审批"
                description={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span>确定提交此版本进行审批？</span>
                    <Input placeholder="审批人姓名" id="submit-operator-input" />
                    <Input.TextArea placeholder="备注（可选）" id="submit-remark-input" rows={2} />
                  </div>
                }
                onConfirm={() => {
                  const opEl = document.getElementById('submit-operator-input') as HTMLInputElement;
                  const rmEl = document.getElementById('submit-remark-input') as HTMLTextAreaElement;
                  const operator = opEl?.value?.trim() || '申请人';
                  const remark = rmEl?.value?.trim() || undefined;
                  handleApprovalAction('submit', operator, remark);
                }}
                okText="确定提交"
                cancelText="取消"
              >
                <Button icon={<SendOutlined />} loading={approvalActionLoading}>
                  提交审批
                </Button>
              </Popconfirm>
            )}
            {version.approval_status === 'pending' && (
              <>
                <Popconfirm
                  title="审批通过"
                  description={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <span>确定通过此版本的审批？</span>
                      <Input placeholder="审批人姓名" id="approve-operator-input" />
                      <Input.TextArea placeholder="备注（可选）" id="approve-remark-input" rows={2} />
                    </div>
                  }
                  onConfirm={() => {
                    const opEl = document.getElementById('approve-operator-input') as HTMLInputElement;
                    const rmEl = document.getElementById('approve-remark-input') as HTMLTextAreaElement;
                    const operator = opEl?.value?.trim() || '审批人';
                    const remark = rmEl?.value?.trim() || undefined;
                    handleApprovalAction('approve', operator, remark);
                  }}
                  okText="确定通过"
                  cancelText="取消"
                >
                  <Button type="primary" icon={<CheckCircleOutlined />} loading={approvalActionLoading}>
                    通过
                  </Button>
                </Popconfirm>
                <Button danger icon={<CloseCircleOutlined />} onClick={() => setRejectModalVisible(true)} loading={approvalActionLoading}>
                  驳回
                </Button>
              </>
            )}
            <Button type="dashed" onClick={openRecommend} icon={<ThunderboltOutlined />}>
              智能推荐
            </Button>
            <Button type="dashed" onClick={openCreateVersion}>
              <PlusOutlined /> 派生新版本
            </Button>
            <Button
              type="primary"
              onClick={() => setCreateBatchVisible(true)}
              disabled={!isPublished}
              title={!isPublished ? '只有已发布的版本才能创建试产批次' : undefined}
            >
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
            },
            {
              key: 'cost',
              label: <span><DollarOutlined /> 成本分析</span>,
              children: renderCostTab()
            },
            {
              key: 'stability',
              label: <span><SafetyOutlined /> 稳定性</span>,
              children: renderStabilityTab()
            },
            {
              key: 'approval',
              label: <span><AuditOutlined /> 审批</span>,
              children: renderApprovalTab()
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
        <Form form={form} layout="vertical" onFinish={handleCreateBatch}>
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
        <Form form={resultForm} layout="vertical" onFinish={handleSubmitResult}>
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
                  width: 80,
                  align: 'center',
                  render: (v: string, record: any) => {
                    const color = v === '涨' ? 'green' : (v === '降' || v === '移除') ? 'red' : 'default';
                    const delta = round2(record.recommended_percentage - record.original_percentage);
                    const sign = delta > 0 ? '+' : '';
                    return (
                      <Space direction="vertical" size={2} align="center">
                        <Tag color={color} style={{ margin: 0 }}>{v}</Tag>
                        {delta !== 0 && (
                          <Text style={{ fontSize: 11, color: delta > 0 ? '#52c41a' : '#f5222d', fontWeight: 600 }}>
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
                推荐配方合计：{recommendData.recommended_ingredients.filter(i => i.recommended_percentage > 0).reduce((s, i) => s + i.recommended_percentage, 0).toFixed(2)}% ✓
              </span>
            </div>
          </Space>
        ) : null}
      </Modal>

      <Modal
        title={
          <Space>
            <DollarOutlined style={{ color: '#1890ff' }} />
            <span>供应商报价管理 - {selectedIngredientForQuote}</span>
          </Space>
        }
        open={quoteModalVisible}
        onCancel={() => {
          setQuoteModalVisible(false);
          setIngredientQuotes([]);
        }}
        width={720}
        footer={null}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card size="small" title="添加新报价">
            <Form form={quoteForm} layout="vertical" onFinish={handleCreateQuote}>
              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item name="ingredient_name" label="成分名称" rules={[{ required: true }]}>
                    <Input readOnly style={{ background: '#f5f5f5' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="supplier_name" label="供应商名称" rules={[{ required: true }]}>
                    <Input placeholder="请输入供应商名称" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={8}>
                <Col span={8}>
                  <Form.Item name="unit_price" label="单价(元/kg)" rules={[{ required: true }]}>
                    <InputNumber min={0} step={0.01} precision={2} style={{ width: '100%' }} prefix="¥" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="min_order_quantity" label="最小起订量(kg)" initialValue={0}>
                    <InputNumber min={0} step={0.1} precision={1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="操作" style={{ marginBottom: 0 }}>
                    <Button type="primary" htmlType="submit" icon={<PlusOutlined />} style={{ marginTop: 24 }}>
                      添加报价
                    </Button>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item name="valid_from" label="有效期开始" rules={[{ required: true }]}>
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="valid_to" label="有效期截止" rules={[{ required: true }]}>
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>

          <Card size="small" title="已有报价列表" loading={quotesLoading}>
            {ingredientQuotes.length > 0 ? (
              <Table
                size="small"
                dataSource={ingredientQuotes}
                rowKey="id"
                pagination={false}
                columns={[
                  { title: '供应商', dataIndex: 'supplier_name', key: 'supplier_name' },
                  {
                    title: '单价(元/kg)',
                    dataIndex: 'unit_price',
                    key: 'unit_price',
                    width: 100,
                    align: 'right',
                    render: (v: number) => <span style={{ fontFamily: 'monospace' }}>¥{v.toFixed(2)}</span>
                  },
                  {
                    title: '最小起订量(kg)',
                    dataIndex: 'min_order_quantity',
                    key: 'min_order_quantity',
                    width: 110,
                    align: 'right',
                    render: (v: number) => v.toFixed(1)
                  },
                  { title: '有效期开始', dataIndex: 'valid_from', key: 'valid_from', width: 100 },
                  { title: '有效期截止', dataIndex: 'valid_to', key: 'valid_to', width: 100 },
                  {
                    title: '状态',
                    dataIndex: 'is_active',
                    key: 'is_active',
                    width: 80,
                    render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '有效' : '已过期'}</Tag>
                  },
                  {
                    title: '操作',
                    key: 'actions',
                    width: 60,
                    render: (_: any, record: SupplierQuote) => (
                      <Popconfirm
                        title="确定删除这个报价吗？"
                        onConfirm={() => handleDeleteQuote(record.id)}
                        okText="确定"
                        cancelText="取消"
                      >
                        <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
                      </Popconfirm>
                    )
                  }
                ]}
              />
            ) : (
              <Empty description="暂无报价" />
            )}
          </Card>
        </Space>
      </Modal>

      <Modal
        title={
          <Space>
            <CloseCircleOutlined style={{ color: '#f5222d' }} />
            <span>驳回版本 V{version.version_number}</span>
          </Space>
        }
        open={rejectModalVisible}
        onCancel={() => {
          setRejectModalVisible(false);
          rejectForm.resetFields();
        }}
        onOk={() => rejectForm.submit()}
        okText="确认驳回"
        okButtonProps={{ danger: true }}
        confirmLoading={approvalActionLoading}
      >
        <Form form={rejectForm} layout="vertical" onFinish={handleReject}>
          <Form.Item name="operator" label="审批人姓名" rules={[{ required: true, message: '请输入审批人姓名' }]}>
            <Input placeholder="请输入审批人姓名" />
          </Form.Item>
          <Form.Item name="remark" label="驳回理由" rules={[{ required: true, message: '请输入驳回理由' }]}>
            <Input.TextArea rows={4} placeholder="请详细说明驳回理由，以便修改后重新提交" maxLength={1000} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}
