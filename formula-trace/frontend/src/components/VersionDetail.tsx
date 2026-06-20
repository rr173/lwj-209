import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Table, Tag, Space, Button, Modal, Form, Input, InputNumber, DatePicker, message, Progress, Row, Col, Divider, Typography, Tabs, Select, Alert, Empty, Statistic, Popconfirm, Slider, Timeline, Checkbox, Collapse } from 'antd';
import { EyeOutlined, PlusOutlined, DeleteOutlined, MinusCircleOutlined, LineChartOutlined, ThunderboltOutlined, DollarOutlined, CalculatorOutlined, SafetyOutlined, ExperimentOutlined, CheckCircleOutlined, CloseCircleOutlined, SendOutlined, AuditOutlined, HistoryOutlined, ExclamationCircleOutlined, FilePdfOutlined, GlobalOutlined, CaretDownOutlined, RiseOutlined, FallOutlined, StarFilled, ClockCircleOutlined, ScheduleOutlined, FlagOutlined, SwapOutlined, EnvironmentOutlined, WarningOutlined, ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import type { FormulaVersion, Batch, IngredientItem, IngredientTrendResponse, FormulaRecommendationResponse, VersionTreeNode, CostBreakdownResponse, CostSimulateResponse, CostSimulateItem, SupplierQuote, StabilityRiskResponse, AgingSimulationResponse, CompatibilityListItem, ApprovalRecord, VersionReviewRecord, ComplianceReportResponse, MultiMarketCompareResponse, ImpactAnalysisResponse, LifecycleTimelineResponse, LifecycleEvent, Milestone, ProductLineLifecycleStats, MilestoneCreate, SubstitutionPlanListResponse, SubstitutionPlan, SubstitutionPlanIngredient, SustainabilityScoreResponse, SustainabilityCompareResponse } from '../types';
import { getScoreColor, api, getApprovalStatusLabel, getApprovalStatusTagColor, getReviewStatusLabel, getReviewStatusTagColor, getDecisionLabel, getDecisionTagColor, getSustainabilityColor, getSustainabilityLabel, getSourceCategoryColor, getSourceCategoryLabel, collectVersionIds } from '../api';
import ProcessExecutionPanel from './ProcessExecutionPanel';

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
  const [reviewRecords, setReviewRecords] = useState<VersionReviewRecord[]>([]);
  const [reviewRecordsLoading, setReviewRecordsLoading] = useState(false);

  const [availableMarkets, setAvailableMarkets] = useState<string[]>([]);
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>(['中国']);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('面部');
  const [complianceReport, setComplianceReport] = useState<ComplianceReportResponse | null>(null);
  const [compareReport, setCompareReport] = useState<MultiMarketCompareResponse | null>(null);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [hasRunComplianceCheck, setHasRunComplianceCheck] = useState(false);

  const [impactAnalysisData, setImpactAnalysisData] = useState<ImpactAnalysisResponse | null>(null);
  const [impactAnalysisLoading, setImpactAnalysisLoading] = useState(false);
  const [showImpactPreview, setShowImpactPreview] = useState(false);

  const [timelineData, setTimelineData] = useState<LifecycleTimelineResponse | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineExpanded, setTimelineExpanded] = useState(false);

  const [versionMilestones, setVersionMilestones] = useState<Milestone[]>([]);
  const [milestoneLoading, setMilestoneLoading] = useState(false);
  const [createMilestoneVisible, setCreateMilestoneVisible] = useState(false);
  const [milestoneForm] = Form.useForm();

  const [lifecycleStats, setLifecycleStats] = useState<ProductLineLifecycleStats | null>(null);
  const [lifecycleStatsLoading, setLifecycleStatsLoading] = useState(false);

  const [substitutionModalVisible, setSubstitutionModalVisible] = useState(false);
  const [substitutionIngredient, setSubstitutionIngredient] = useState<string>('');
  const [substitutionPlansData, setSubstitutionPlansData] = useState<SubstitutionPlanListResponse | null>(null);
  const [substitutionPlansLoading, setSubstitutionPlansLoading] = useState(false);
  const [selectedPlanPreview, setSelectedPlanPreview] = useState<SubstitutionPlan | null>(null);

  const [sustainabilityScore, setSustainabilityScore] = useState<SustainabilityScoreResponse | null>(null);
  const [sustainabilityLoading, setSustainabilityLoading] = useState(false);
  const [compareVersionId, setCompareVersionId] = useState<number | null>(null);
  const [sustainabilityCompare, setSustainabilityCompare] = useState<SustainabilityCompareResponse | null>(null);
  const [sustainabilityCompareLoading, setSustainabilityCompareLoading] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    setReviewRecordsLoading(true);
    api.getVersionReviews(version.id)
      .then(data => {
        if (!cancelled) setReviewRecords(data);
      })
      .catch(() => {
        if (!cancelled) setReviewRecords([]);
      })
      .finally(() => {
        if (!cancelled) setReviewRecordsLoading(false);
      });
    return () => { cancelled = true; };
  }, [version.id]);

  useEffect(() => {
    let cancelled = false;
    api.getAvailableMarkets()
      .then(data => {
        if (!cancelled) setAvailableMarkets(data);
      })
      .catch(() => {
        if (!cancelled) setAvailableMarkets([]);
      });
    api.getAvailableCategories()
      .then(data => {
        if (!cancelled) setAvailableCategories(data);
      })
      .catch(() => {
        if (!cancelled) setAvailableCategories([]);
      });
    return () => { cancelled = true; };
  }, []);

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

  useEffect(() => {
    let cancelled = false;
    setTimelineLoading(true);
    api.getVersionTimeline(version.id)
      .then(data => {
        if (!cancelled) setTimelineData(data);
      })
      .catch(e => {
        if (!cancelled) {
          message.error('加载时间线数据失败');
        }
      })
      .finally(() => {
        if (!cancelled) setTimelineLoading(false);
      });
    return () => { cancelled = true; };
  }, [version.id]);

  useEffect(() => {
    let cancelled = false;
    setSustainabilityLoading(true);
    api.getSustainabilityScore(version.id)
      .then(data => {
        if (!cancelled) setSustainabilityScore(data);
      })
      .catch(e => {
        if (!cancelled) {
          message.error('加载可持续性评分失败');
        }
      })
      .finally(() => {
        if (!cancelled) setSustainabilityLoading(false);
      });
    return () => { cancelled = true; };
  }, [version.id]);

  useEffect(() => {
    let cancelled = false;
    if (compareVersionId !== null) {
      setSustainabilityCompareLoading(true);
      api.compareSustainability(version.id, compareVersionId)
        .then(data => {
          if (!cancelled) setSustainabilityCompare(data);
        })
        .catch(e => {
          if (!cancelled) {
            message.error('加载可持续性对比数据失败');
          }
        })
        .finally(() => {
          if (!cancelled) setSustainabilityCompareLoading(false);
        });
    } else {
      setSustainabilityCompare(null);
    }
    return () => { cancelled = true; };
  }, [version.id, compareVersionId]);

  useEffect(() => {
    let cancelled = false;
    setMilestoneLoading(true);
    api.getVersionMilestones(version.id)
      .then(data => {
        if (!cancelled) setVersionMilestones(data);
      })
      .catch(e => {
        if (!cancelled) {
          message.error('加载里程碑数据失败');
        }
      })
      .finally(() => {
        if (!cancelled) setMilestoneLoading(false);
      });
    return () => { cancelled = true; };
  }, [version.id]);

  useEffect(() => {
    let cancelled = false;
    setLifecycleStatsLoading(true);
    api.getProductLineLifecycleStats(version.product_line_id)
      .then(data => {
        if (!cancelled) setLifecycleStats(data);
      })
      .catch(e => {
        if (!cancelled) {
          message.error('加载生命周期统计失败');
        }
      })
      .finally(() => {
        if (!cancelled) setLifecycleStatsLoading(false);
      });
    return () => { cancelled = true; };
  }, [version.product_line_id]);

  const refreshMilestones = useCallback(async () => {
    try {
      const data = await api.getVersionMilestones(version.id);
      setVersionMilestones(data);
    } catch (e) {
      message.error('刷新里程碑失败');
    }
  }, [version.id]);

  const handleCreateMilestone = useCallback(async (values: any) => {
    try {
      await api.createMilestone({
        version_id: version.id,
        name: values.name,
        target_date: values.target_date.format('YYYY-MM-DD'),
      });
      message.success('里程碑创建成功');
      setCreateMilestoneVisible(false);
      milestoneForm.resetFields();
      await refreshMilestones();
      const timeline = await api.getVersionTimeline(version.id);
      setTimelineData(timeline);
      const stats = await api.getProductLineLifecycleStats(version.product_line_id);
      setLifecycleStats(stats);
    } catch (e: any) {
      const errMsg = e?.response?.data?.detail || '创建里程碑失败';
      message.error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
    }
  }, [version.id, version.product_line_id, milestoneForm, refreshMilestones]);

  const handleCompleteMilestone = useCallback(async (milestoneId: number) => {
    try {
      await api.completeMilestone(milestoneId);
      message.success('里程碑已标记完成');
      await refreshMilestones();
      const timeline = await api.getVersionTimeline(version.id);
      setTimelineData(timeline);
      const stats = await api.getProductLineLifecycleStats(version.product_line_id);
      setLifecycleStats(stats);
    } catch (e: any) {
      const errMsg = e?.response?.data?.detail || '操作失败';
      message.error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
    }
  }, [version.id, version.product_line_id, refreshMilestones]);

  const handleDeleteMilestone = useCallback(async (milestoneId: number) => {
    try {
      await api.deleteMilestone(milestoneId);
      message.success('里程碑已删除');
      await refreshMilestones();
      const timeline = await api.getVersionTimeline(version.id);
      setTimelineData(timeline);
      const stats = await api.getProductLineLifecycleStats(version.product_line_id);
      setLifecycleStats(stats);
    } catch (e: any) {
      const errMsg = e?.response?.data?.detail || '删除失败';
      message.error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
    }
  }, [version.id, version.product_line_id, refreshMilestones]);

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
    setImpactAnalysisData(null);
    setShowImpactPreview(false);
    setCreateVersionVisible(true);
  };

  const handleImpactPreview = async () => {
    try {
      const values = await versionForm.validateFields();
      const ingredients = values.ingredients
        .filter((item: any) => item.name && item.percentage !== undefined && item.percentage !== null)
        .map((item: any) => ({
          name: item.name.trim(),
          percentage: Number(Number(item.percentage).toFixed(2))
        }));

      const originalMap = new Map(version.ingredients.map(ing => [ing.name, ing.percentage]));
      const adjustments: IngredientItem[] = ingredients.filter((ing: IngredientItem) => {
        const original = originalMap.get(ing.name);
        return original !== undefined && Math.abs(original - ing.percentage) > 0.001;
      });

      if (adjustments.length === 0) {
        message.info('没有检测到成分变化，请先调整成分比例');
        return;
      }

      setImpactAnalysisLoading(true);
      setShowImpactPreview(true);
      try {
        const data = await api.analyzeImpact(version.id, adjustments, selectedCategory);
        setImpactAnalysisData(data);
      } catch (e: any) {
        let errMsg = '影响分析失败';
        if (e?.response?.data?.detail) {
          errMsg = typeof e.response.data.detail === 'string'
            ? e.response.data.detail
            : JSON.stringify(e.response.data.detail);
        }
        message.error(errMsg);
        setShowImpactPreview(false);
      } finally {
        setImpactAnalysisLoading(false);
      }
    } catch {
      message.warning('请先完善成分信息并确保百分比之和为100%');
    }
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

  const handleOpenSubstitution = async (ingredientName: string) => {
    setSubstitutionIngredient(ingredientName);
    setSubstitutionModalVisible(true);
    setSubstitutionPlansLoading(true);
    setSelectedPlanPreview(null);
    setSubstitutionPlansData(null);
    try {
      const data = await api.generateSubstitutionPlans(version.id, ingredientName);
      setSubstitutionPlansData(data);
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '加载替代方案失败');
    } finally {
      setSubstitutionPlansLoading(false);
    }
  };

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
                render: (_: any, record: IngredientItem) => (
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
              },
              {
                title: '',
                key: 'action',
                width: 80,
                render: (_: any, record: IngredientItem) => (
                  <Button
                    type="link"
                    size="small"
                    icon={<SwapOutlined />}
                    onClick={() => handleOpenSubstitution(record.name)}
                  >
                    找替代
                  </Button>
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

  const getComplianceStatusColor = (status: string): string => {
    switch (status) {
      case '合规': return '#52c41a';
      case '超限': return '#f5222d';
      case '禁用': return '#a8071a';
      case '未收录': return '#faad14';
      default: return '#8c8c8c';
    }
  };

  const getComplianceStatusTagColor = (status: string): string => {
    switch (status) {
      case '合规': return 'success';
      case '超限': return 'error';
      case '禁用': return 'error';
      case '未收录': return 'warning';
      default: return 'default';
    }
  };

  const getOverallConclusionColor = (conclusion: string): string => {
    switch (conclusion) {
      case '全部合规': return '#52c41a';
      case '存在超限': return '#f5222d';
      case '存在禁用成分': return '#a8071a';
      default: return '#8c8c8c';
    }
  };

  const handleComplianceCheck = useCallback(async () => {
    if (selectedMarkets.length === 0) {
      message.warning('请至少选择一个目标市场');
      return;
    }

    setComplianceLoading(true);
    setHasRunComplianceCheck(true);
    setComplianceReport(null);
    setCompareReport(null);

    try {
      if (selectedMarkets.length === 1) {
        const data = await api.checkCompliance(version.id, selectedMarkets[0], selectedCategory);
        setComplianceReport(data);
      } else {
        const data = await api.multiMarketCompare(version.id, selectedMarkets, selectedCategory);
        setCompareReport(data);
        const primaryData = await api.checkCompliance(version.id, selectedMarkets[0], selectedCategory);
        setComplianceReport(primaryData);
      }
      message.success('合规检测完成');
    } catch (e: any) {
      const errMsg = e?.response?.data?.detail || '合规检测失败';
      message.error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
    } finally {
      setComplianceLoading(false);
    }
  }, [version.id, selectedMarkets, selectedCategory]);

  const handleExportPdf = useCallback(async () => {
    if (selectedMarkets.length === 0) {
      message.warning('请先选择市场并进行检测');
      return;
    }
    if (!hasRunComplianceCheck) {
      message.warning('请先进行合规检测');
      return;
    }

    try {
      const blob = await api.exportCompliancePdf(version.id, selectedMarkets, selectedCategory);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      link.download = `合规报告_V${version.version_number}_${timestamp}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('PDF导出成功');
    } catch (e: any) {
      message.error('PDF导出失败');
    }
  }, [version.id, version.version_number, selectedMarkets, selectedCategory, hasRunComplianceCheck]);

  const renderComplianceTab = () => (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Card
        size="small"
        title={
          <Space>
            <GlobalOutlined style={{ color: '#722ed1' }} />
            <span>法规合规检测</span>
          </Space>
        }
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <Text strong style={{ marginBottom: 8, display: 'block' }}>选择目标市场：</Text>
              <Checkbox.Group
                value={selectedMarkets}
                onChange={(values) => setSelectedMarkets(values as string[])}
                style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}
              >
                {availableMarkets.map(market => (
                  <Checkbox key={market} value={market} style={{ marginRight: 0 }}>
                    {market}
                  </Checkbox>
                ))}
              </Checkbox.Group>
            </div>
            <div>
              <Text strong style={{ marginBottom: 8, display: 'block' }}>产品品类：</Text>
              <Select
                value={selectedCategory}
                onChange={setSelectedCategory}
                style={{ minWidth: 160 }}
                options={availableCategories.map(c => ({ label: c, value: c }))}
              />
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>检测时优先匹配该品类法规，无匹配则回退到"全身"</Text>
              </div>
            </div>
          </div>

          <Space>
            <Button
              type="primary"
              icon={<SafetyOutlined />}
              onClick={handleComplianceCheck}
              loading={complianceLoading}
              disabled={selectedMarkets.length === 0}
            >
              开始检测
            </Button>
            {hasRunComplianceCheck && (
              <Button
                icon={<FilePdfOutlined />}
                onClick={handleExportPdf}
                disabled={complianceLoading}
              >
                导出报告(PDF)
              </Button>
            )}
            <Text type="secondary" style={{ marginLeft: 16 }}>
              选择2-5个市场可进行多市场对比
            </Text>
          </Space>
        </Space>
      </Card>

      {complianceReport && selectedMarkets.length === 1 && (
        <Card
          size="small"
          title={
            <Space>
              <SafetyOutlined style={{ color: getOverallConclusionColor(complianceReport.overall_conclusion) }} />
              <span>合规检测报告 - {complianceReport.target_market}</span>
            </Space>
          }
          loading={complianceLoading}
        >
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Row gutter={24}>
              <Col span={8}>
                <Card size="small" style={{ textAlign: 'center', background: '#f9f0ff' }}>
                  <div style={{ fontSize: 48, fontWeight: 700, color: getOverallConclusionColor(complianceReport.overall_conclusion) }}>
                    {complianceReport.compliance_rate}%
                  </div>
                  <div style={{ color: '#666', fontSize: 14, marginTop: 8 }}>合规率</div>
                </Card>
              </Col>
              <Col span={16}>
                <Card size="small">
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <Text strong style={{ fontSize: 16 }}>整体结论：</Text>
                      <Tag
                        color={complianceReport.overall_conclusion === '全部合规' ? 'success' : 'error'}
                        style={{ fontSize: 16, padding: '4px 16px' }}
                      >
                        {complianceReport.overall_conclusion}
                      </Tag>
                    </div>
                    <Row gutter={16}>
                      <Col span={6}>
                        <Statistic title="总成分数" value={complianceReport.total_ingredients} />
                      </Col>
                      <Col span={6}>
                        <Statistic title="合规成分" value={complianceReport.compliant_count} valueStyle={{ color: '#52c41a' }} />
                      </Col>
                      <Col span={6}>
                        <Statistic title="超限成分" value={complianceReport.over_limit_count} valueStyle={{ color: '#f5222d' }} />
                      </Col>
                      <Col span={6}>
                        <Statistic title="未收录成分" value={complianceReport.unlisted_count} valueStyle={{ color: '#faad14' }} />
                      </Col>
                    </Row>
                    {complianceReport.banned_count > 0 && (
                      <Alert
                        type="error"
                        showIcon
                        message={`检测到 ${complianceReport.banned_count} 个禁用成分，请立即移除！`}
                      />
                    )}
                  </Space>
                </Card>
              </Col>
            </Row>

            <div>
              <Text strong style={{ marginBottom: 12, display: 'block' }}>成分检测详情：</Text>
              <Table
                size="small"
                dataSource={complianceReport.items.map((item, idx) => ({ key: idx, ...item }))}
                pagination={{ pageSize: 10 }}
                columns={[
                  {
                    title: '成分名称',
                    dataIndex: 'ingredient_name',
                    key: 'ingredient_name',
                    width: 160,
                    render: (v: string, record: any) => (
                      <Space direction="vertical" size={0}>
                        <span style={{ fontWeight: 600 }}>{v}</span>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          含量: {record.percentage.toFixed(2)}%
                        </Text>
                      </Space>
                    )
                  },
                  {
                    title: '实际含量',
                    dataIndex: 'percentage',
                    key: 'percentage',
                    width: 100,
                    align: 'right',
                    render: (v: number) => (
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v.toFixed(2)}%</span>
                    )
                  },
                  {
                    title: '限用上限',
                    dataIndex: 'max_percentage',
                    key: 'max_percentage',
                    width: 100,
                    align: 'right',
                    render: (v: number | null) => v !== null ? (
                      <span style={{ fontFamily: 'monospace' }}>{v.toFixed(2)}%</span>
                    ) : <Text type="secondary">-</Text>
                  },
                  {
                    title: '适用品类',
                    dataIndex: 'product_category',
                    key: 'product_category',
                    width: 90,
                    render: (v: string | null) => v || <Text type="secondary">-</Text>
                  },
                  {
                    title: '匹配品类',
                    dataIndex: 'matched_regulation_category',
                    key: 'matched_regulation_category',
                    width: 90,
                    render: (v: string | null) => v ? (
                      <Tag color={v === selectedCategory ? 'blue' : 'default'}>{v}</Tag>
                    ) : <Text type="secondary">-</Text>
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    key: 'status',
                    width: 100,
                    render: (v: string) => (
                      <Tag color={getComplianceStatusTagColor(v)} style={{ fontSize: 13, padding: '2px 10px' }}>
                        {v}
                      </Tag>
                    )
                  },
                  {
                    title: '备注',
                    dataIndex: 'notes',
                    key: 'notes',
                    render: (v: string | null, record: any) => {
                      if (record.status === '超限' && record.max_percentage !== null) {
                        return (
                          <Text type="danger" strong>
                            实际值 {record.percentage.toFixed(2)}% vs 限值 {record.max_percentage.toFixed(2)}%
                          </Text>
                        );
                      }
                      if (record.status === '禁用') {
                        return <Text type="danger" strong>该成分在目标市场完全禁用</Text>;
                      }
                      if (record.status === '未收录') {
                        return <Text type="warning">法规库未收录，需人工确认</Text>;
                      }
                      return v || <Text type="secondary">-</Text>;
                    }
                  }
                ]}
                rowClassName={(record) => {
                  if (record.status === '超限' || record.status === '禁用') {
                    return 'compliance-row-danger';
                  }
                  if (record.status === '未收录') {
                    return 'compliance-row-warning';
                  }
                  return '';
                }}
              />
            </div>
          </Space>
        </Card>
      )}

      {compareReport && selectedMarkets.length >= 2 && (
        <Card
          size="small"
          title={
            <Space>
              <GlobalOutlined style={{ color: '#722ed1' }} />
              <span>多市场对比矩阵</span>
              {compareReport.inconsistent_ingredients.length > 0 && (
                <Tag color="warning" style={{ marginLeft: 8 }}>
                  发现 {compareReport.inconsistent_ingredients.length} 个不一致成分
                </Tag>
              )}
            </Space>
          }
          loading={complianceLoading}
        >
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {compareReport.inconsistent_ingredients.length > 0 && (
              <Alert
                type="warning"
                showIcon
                message={
                  <span>
                    以下成分在不同市场法规要求不一致，请特别关注：
                    <Text strong style={{ marginLeft: 8, color: '#d48806' }}>
                      {compareReport.inconsistent_ingredients.join('、')}
                    </Text>
                  </span>
                }
              />
            )}

            <Table
              size="small"
              dataSource={compareReport.items.map((item, idx) => ({ key: idx, ...item }))}
              pagination={{ pageSize: 20 }}
              columns={[
                {
                  title: '成分名称',
                  dataIndex: 'ingredient_name',
                  key: 'ingredient_name',
                  width: 160,
                  fixed: 'left',
                  render: (v: string, record: any) => (
                    <Space direction="vertical" size={0}>
                      <span style={{ fontWeight: 600 }}>{v}</span>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        含量: {record.percentage.toFixed(2)}%
                      </Text>
                    </Space>
                  )
                },
                {
                  title: '实际含量',
                  dataIndex: 'percentage',
                  key: 'percentage',
                  width: 100,
                  fixed: 'left',
                  align: 'right',
                  render: (v: number) => (
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v.toFixed(2)}%</span>
                  )
                },
                ...selectedMarkets.map(market => ({
                  title: market,
                  dataIndex: ['market_statuses', market] as const,
                  key: market,
                  width: 100,
                  align: 'center' as const,
                  render: (v: string) => (
                    <Tag
                      color={getComplianceStatusTagColor(v)}
                      style={{ fontSize: 12, padding: '2px 8px' }}
                    >
                      {v}
                    </Tag>
                  )
                }))
              ]}
              scroll={{ x: 700 }}
              rowClassName={(record) => {
                if (record.has_inconsistency) {
                  return 'compliance-row-inconsistent';
                }
                return '';
              }}
            />
          </Space>
        </Card>
      )}

      {hasRunComplianceCheck && !complianceReport && !compareReport && (
        <Card size="small" loading={complianceLoading}>
          <Empty description="暂无检测结果" />
        </Card>
      )}

      {!hasRunComplianceCheck && (
        <Card size="small">
          <Empty
            description={
              <Space direction="vertical" size={8} style={{ width: '100%', textAlign: 'center' }}>
                <SafetyOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                <Text type="secondary">请选择目标市场并点击"开始检测"按钮</Text>
              </Space>
            }
          />
        </Card>
      )}
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
            items={approvalHistory.map(record => {
              const actionMap: Record<string, { label: string; color: string; timelineColor: string }> = {
                submit: { label: '提交审批', color: 'blue', timelineColor: 'blue' },
                approve: { label: '审批通过', color: 'green', timelineColor: 'green' },
                reject: { label: '驳回', color: 'red', timelineColor: 'red' },
                review_approve: { label: '评审通过', color: 'green', timelineColor: 'green' },
                review_conditional: { label: '评审有条件通过', color: 'orange', timelineColor: 'orange' },
                review_reject: { label: '评审否决', color: 'red', timelineColor: 'red' },
              };
              const actionInfo = actionMap[record.action] || { label: record.action, color: 'default', timelineColor: 'gray' };
              return {
                color: actionInfo.timelineColor,
                children: (
                  <div>
                    <Space>
                      <Tag color={actionInfo.color}>
                        {actionInfo.label}
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
              };
            })}
          />
        ) : (
          <Empty description="暂无审批记录" />
        )}
      </Card>

      <Card
        size="small"
        title={<Space><AuditOutlined /> 评审记录</Space>}
        loading={reviewRecordsLoading}
        extra={
          reviewRecords.length > 0 && (
            <Tag color="blue">共 {reviewRecords.length} 次评审</Tag>
          )
        }
      >
        {reviewRecords.length > 0 ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {reviewRecords.map((record, idx) => (
              <Card key={idx} size="small" style={{ borderLeft: '4px solid #1890ff' }}>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                      <Text strong style={{ fontSize: 15 }}>{record.meeting_title}</Text>
                      <Tag color={getReviewStatusTagColor(record.meeting_status)}>
                        {getReviewStatusLabel(record.meeting_status)}
                      </Tag>
                      {record.decision && (
                        <Tag
                          color={getDecisionTagColor(record.decision)}
                          icon={
                            record.decision === 'approve' ? <CheckCircleOutlined /> :
                            record.decision === 'conditional' ? <ExclamationCircleOutlined /> :
                            <CloseCircleOutlined />
                          }
                        >
                          {getDecisionLabel(record.decision)}
                        </Tag>
                      )}
                    </Space>
                    <Text type="secondary">{record.meeting_date}</Text>
                  </div>

                  {record.final_score !== null && (
                    <Row gutter={16}>
                      <Col span={6}>
                        <Card size="small" style={{ textAlign: 'center' }}>
                          <Statistic
                            title="综合得分"
                            value={record.final_score}
                            precision={2}
                            valueStyle={{ color: getScoreColor(record.final_score), fontSize: 20 }}
                          />
                        </Card>
                      </Col>
                      <Col span={6}>
                        <Card size="small" style={{ textAlign: 'center' }}>
                          <Statistic
                            title="合理性"
                            value={record.avg_rationality ?? 0}
                            precision={2}
                            valueStyle={{ color: getScoreColor(record.avg_rationality!) }}
                          />
                        </Card>
                      </Col>
                      <Col span={6}>
                        <Card size="small" style={{ textAlign: 'center' }}>
                          <Statistic
                            title="成本"
                            value={record.avg_cost ?? 0}
                            precision={2}
                            valueStyle={{ color: getScoreColor(record.avg_cost!) }}
                          />
                        </Card>
                      </Col>
                      <Col span={6}>
                        <Card size="small" style={{ textAlign: 'center' }}>
                          <Statistic
                            title="工艺"
                            value={record.avg_feasibility ?? 0}
                            precision={2}
                            valueStyle={{ color: getScoreColor(record.avg_feasibility!) }}
                          />
                        </Card>
                      </Col>
                    </Row>
                  )}

                  {record.judge_scores.length > 0 && (
                    <Table
                      size="small"
                      dataSource={record.judge_scores.map((s, i) => ({ key: i, ...s }))}
                      pagination={false}
                      columns={[
                        {
                          title: '评委',
                          dataIndex: 'judge_name',
                          key: 'judge_name',
                          width: 120,
                          render: (v: string) => <Tag color="purple">{v}</Tag>,
                        },
                        {
                          title: '合理性',
                          dataIndex: 'rationality_score',
                          key: 'rationality_score',
                          width: 100,
                          align: 'center',
                          render: (v: number) => (
                            <Text strong style={{ color: getScoreColor(v) }}>{v}</Text>
                          ),
                        },
                        {
                          title: '成本',
                          dataIndex: 'cost_score',
                          key: 'cost_score',
                          width: 100,
                          align: 'center',
                          render: (v: number) => (
                            <Text strong style={{ color: getScoreColor(v) }}>{v}</Text>
                          ),
                        },
                        {
                          title: '工艺',
                          dataIndex: 'feasibility_score',
                          key: 'feasibility_score',
                          width: 100,
                          align: 'center',
                          render: (v: number) => (
                            <Text strong style={{ color: getScoreColor(v) }}>{v}</Text>
                          ),
                        },
                        {
                          title: '平均分',
                          key: 'avg',
                          width: 100,
                          align: 'center',
                          render: (_: any, record: any) => {
                            const avg = (record.rationality_score + record.cost_score + record.feasibility_score) / 3;
                            return (
                              <Text strong style={{ color: getScoreColor(avg), fontSize: 16 }}>
                                {avg.toFixed(2)}
                              </Text>
                            );
                          },
                        },
                        {
                          title: '评审意见',
                          dataIndex: 'comment',
                          key: 'comment',
                          ellipsis: true,
                          render: (v: string | null) => v || <Text type="secondary">-</Text>,
                        },
                      ]}
                    />
                  )}
                </Space>
              </Card>
            ))}
          </Space>
        ) : (
          <Empty description="暂无评审记录" />
        )}
      </Card>
    </Space>
  );

  const getTimelineItemProps = (event: LifecycleEvent) => {
    const isMilestone = event.event_type.startsWith('milestone_');
    if (isMilestone) {
      const status = event.event_type.replace('milestone_', '');
      if (status === 'overdue') {
        return {
          color: 'red',
          dot: <StarFilled style={{ fontSize: 16 }} />,
        };
      } else if (status === 'completed') {
        return {
          color: 'green',
          dot: <StarFilled style={{ fontSize: 16 }} />,
        };
      } else {
        return {
          color: 'gold',
          dot: <StarFilled style={{ fontSize: 16 }} />,
        };
      }
    }
    return {
      color: 'blue',
    };
  };

  const formatEventTime = (timeStr: string) => {
    try {
      const date = new Date(timeStr);
      if (isNaN(date.getTime())) return timeStr;
      if (date.getFullYear() === 1) return timeStr;
      return date.toLocaleString('zh-CN');
    } catch {
      return timeStr;
    }
  };

  const renderTimelineTab = () => {
    const displayEvents = timelineExpanded
      ? (timelineData?.events || [])
      : (timelineData?.events || []).slice(-10);
    const totalCount = timelineData?.events?.length || 0;

    return (
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <Card
          size="small"
          title={<Space><ClockCircleOutlined /> 生命周期概览</Space>}
          extra={
            <Space>
              {timelineData?.derived_from && (
                <Tag color="cyan" icon={<RiseOutlined />}>
                  派生自 V{timelineData.derived_from.parent_version_number}
                </Tag>
              )}
              <Tag color="blue">共 {totalCount} 个事件</Tag>
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => setCreateMilestoneVisible(true)}
              >
                添加里程碑
              </Button>
            </Space>
          }
        >
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="版本修改轮次"
                value={timelineData?.events?.filter(e => e.event_type.startsWith('approval_')).length || 0}
                prefix={<HistoryOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="试产批次"
                value={timelineData?.events?.filter(e => e.event_type === 'first_batch_created' || e.event_type === 'batch_test_result').length || 0}
                prefix={<ExperimentOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="评审引用次数"
                value={timelineData?.events?.filter(e => e.event_type === 'review_referenced').length || 0}
                prefix={<AuditOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="里程碑"
                value={versionMilestones.length}
                prefix={<StarFilled style={{ color: '#faad14' }} />}
                valueStyle={{
                  color: versionMilestones.some(m => m.status === 'overdue') ? '#f5222d' : undefined
                }}
              />
            </Col>
          </Row>
        </Card>

        {versionMilestones.length > 0 && (
          <Card
            size="small"
            title={<Space><FlagOutlined /> 里程碑列表</Space>}
            loading={milestoneLoading}
          >
            <Table
              size="small"
              dataSource={versionMilestones.map(m => ({ key: m.id, ...m }))}
              pagination={false}
              columns={[
                {
                  title: '里程碑名称',
                  dataIndex: 'name',
                  key: 'name',
                  render: (v: string, record: any) => (
                    <Space>
                      <StarFilled style={{
                        color: record.status === 'overdue' ? '#f5222d' :
                               record.status === 'completed' ? '#52c41a' : '#faad14'
                      }} />
                      <Text strong>{v}</Text>
                      {record.status === 'overdue' && <Tag color="red">已逾期</Tag>}
                      {record.status === 'completed' && <Tag color="green">已完成</Tag>}
                      {record.status === 'pending' && <Tag color="gold">待完成</Tag>}
                    </Space>
                  )
                },
                { title: '目标日期', dataIndex: 'target_date', key: 'target_date', width: 140 },
                {
                  title: '实际完成',
                  dataIndex: 'actual_completion_date',
                  key: 'actual_completion_date',
                  width: 140,
                  render: (v: string | null) => v || <Text type="secondary">-</Text>
                },
                {
                  title: '操作',
                  key: 'actions',
                  width: 180,
                  render: (_: any, record: any) => (
                    <Space size="small">
                      {record.status !== 'completed' && (
                        <Button
                          type="link"
                          size="small"
                          icon={<CheckCircleOutlined />}
                          onClick={() => handleCompleteMilestone(record.id)}
                        >
                          标记完成
                        </Button>
                      )}
                      <Popconfirm
                        title="确定删除该里程碑？"
                        onConfirm={() => handleDeleteMilestone(record.id)}
                        okText="删除"
                        cancelText="取消"
                      >
                        <Button
                          type="link"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                        >
                          删除
                        </Button>
                      </Popconfirm>
                    </Space>
                  )
                }
              ]}
            />
          </Card>
        )}

        <Card
          size="small"
          title={<Space><ScheduleOutlined /> 完整时间线</Space>}
          loading={timelineLoading}
          extra={
            totalCount > 10 && (
              <Button
                type="link"
                onClick={() => setTimelineExpanded(!timelineExpanded)}
              >
                {timelineExpanded ? '收起（仅显示最近10条）' : `展开全部（${totalCount}条）`}
              </Button>
            )
          }
        >
          {timelineData && timelineData.events && timelineData.events.length > 0 ? (
            <Timeline
              style={{ padding: '16px 8px' }}
              items={displayEvents.map((event, idx) => {
                const props = getTimelineItemProps(event);
                return {
                  ...props,
                  children: (
                    <div style={{ marginBottom: idx === displayEvents.length - 1 ? 0 : 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                        <div style={{ flex: 1 }}>
                          <Space wrap size={[8, 4]}>
                            <Text strong>{event.description}</Text>
                            {event.operator && (
                              <Tag color="blue">{event.operator}</Tag>
                            )}
                          </Space>
                        </div>
                        <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                          {formatEventTime(event.event_time)}
                        </Text>
                      </div>
                    </div>
                  ),
                };
              })}
            />
          ) : (
            <Empty description="暂无时间线数据" />
          )}
        </Card>
      </Space>
    );
  };

  const renderSustainabilityTab = () => {
    const allVersions = useMemo(() => {
      const ids: number[] = [];
      versionTree.forEach(root => collectVersionIds(root, ids));
      return ids.map(id => {
        const findNode = (nodes: VersionTreeNode[]): VersionTreeNode | null => {
          for (const node of nodes) {
            if (node.id === id) return node;
            const found = findNode(node.children);
            if (found) return found;
          }
          return null;
        };
        return findNode(versionTree);
      }).filter((v): v is VersionTreeNode => v !== null && v.id !== version.id);
    }, [versionTree, version.id]);

    const renderGauge = (score: number, size: number = 200) => {
      const angle = (score / 100) * 180 - 90;
      const color = getSustainabilityColor(score);
      const label = getSustainabilityLabel(score);

      const segments = [
        { start: -90, end: -18, color: '#f5222d', label: '0-40' },
        { start: -18, end: 36, color: '#faad14', label: '40-70' },
        { start: 36, end: 90, color: '#52c41a', label: '70-100' },
      ];

      const createArcPath = (startAngle: number, endAngle: number, innerR: number, outerR: number) => {
        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;
        const x1 = size / 2 + innerR * Math.cos(startRad);
        const y1 = size / 2 + innerR * Math.sin(startRad);
        const x2 = size / 2 + outerR * Math.cos(startRad);
        const y2 = size / 2 + outerR * Math.sin(startRad);
        const x3 = size / 2 + outerR * Math.cos(endRad);
        const y3 = size / 2 + outerR * Math.sin(endRad);
        const x4 = size / 2 + innerR * Math.cos(endRad);
        const y4 = size / 2 + innerR * Math.sin(endRad);
        const largeArc = endAngle - startAngle > 180 ? 1 : 0;

        return `M ${x1} ${y1} L ${x2} ${y2} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x3} ${y3} L ${x4} ${y4} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x1} ${y1} Z`;
      };

      const pointerRad = (angle * Math.PI) / 180;
      const pointerLength = size * 0.35;
      const pointerX = size / 2 + pointerLength * Math.cos(pointerRad);
      const pointerY = size / 2 + pointerLength * Math.sin(pointerRad);

      return (
        <div style={{ position: 'relative', width: size, height: size / 2 + 30 }}>
          <svg width={size} height={size / 2 + 30} viewBox={`0 0 ${size} ${size / 2 + 30}`}>
            {segments.map((seg, idx) => (
              <path
                key={idx}
                d={createArcPath(seg.start, seg.end, size * 0.35, size * 0.45)}
                fill={seg.color}
                opacity={0.3}
              />
            ))}
            <line
              x1={size / 2}
              y1={size / 2}
              x2={pointerX}
              y2={pointerY}
              stroke={color}
              strokeWidth={3}
              strokeLinecap="round"
            />
            <circle cx={size / 2} cy={size / 2} r={8} fill={color} />
            <text x={size / 2} y={size / 2 + 50} textAnchor="middle" fontSize={28} fontWeight="bold" fill={color}>
              {score.toFixed(1)}
            </text>
            <text x={size / 2} y={size / 2 + 70} textAnchor="middle" fontSize={14} fill="#666">
              {label}
            </text>
          </svg>
        </div>
      );
    };

    const renderRingChart = (score: number, title: string, size: number = 120) => {
      const color = getSustainabilityColor(score);
      const radius = size / 2 - 10;
      const circumference = 2 * Math.PI * radius;
      const offset = circumference - (score / 100) * circumference;

      return (
        <div style={{ textAlign: 'center' }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#f0f0f0"
              strokeWidth={12}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={12}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
            <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fontSize={18} fontWeight="bold" fill={color}>
              {score.toFixed(0)}
            </text>
          </svg>
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{title}</div>
        </div>
      );
    };

    const getRadarData = () => {
      if (!sustainabilityScore) return [];
      const data = [
        {
          dimension: '生物降解性',
          current: sustainabilityScore.biodegradability_score,
          ...(sustainabilityCompare ? { compare: sustainabilityCompare.biodegradability_score.right_value } : {}),
          fullMark: 100,
        },
        {
          dimension: '碳足迹评分',
          current: sustainabilityScore.carbon_footprint_score,
          ...(sustainabilityCompare ? { compare: sustainabilityCompare.carbon_footprint_score.right_value } : {}),
          fullMark: 100,
        },
        {
          dimension: '来源评分',
          current: sustainabilityScore.source_score,
          ...(sustainabilityCompare ? { compare: sustainabilityCompare.source_score.right_value } : {}),
          fullMark: 100,
        },
        {
          dimension: '综合评分',
          current: sustainabilityScore.total_score,
          ...(sustainabilityCompare ? { compare: sustainabilityCompare.total_score.right_value } : {}),
          fullMark: 100,
        },
      ];
      return data;
    };

    const contributionColumns = [
      {
        title: '成分名称',
        dataIndex: 'ingredient_name',
        key: 'ingredient_name',
        render: (v: string, record: any) => (
          <Space>
            <Text strong>{v}</Text>
            {!record.has_data && <Tag color="default">数据缺失</Tag>}
          </Space>
        ),
      },
      {
        title: '占比',
        dataIndex: 'percentage',
        key: 'percentage',
        width: 80,
        render: (v: number) => `${v.toFixed(2)}%`,
      },
      {
        title: '来源分类',
        dataIndex: 'source_category',
        key: 'source_category',
        width: 100,
        render: (v: string | null | undefined) => v ? (
          <Tag color={getSourceCategoryColor(v)}>{getSourceCategoryLabel(v)}</Tag>
        ) : <Text type="secondary">-</Text>,
      },
      {
        title: '生物降解性',
        dataIndex: 'biodegradability_score',
        key: 'biodegradability_score',
        width: 100,
        render: (v: number | null | undefined, record: any) => v !== null && v !== undefined ? (
          <Space>
            <Progress
              percent={v}
              size="small"
              showInfo={false}
              strokeColor={getSustainabilityColor(v)}
              style={{ width: 60 }}
            />
            <span>{v.toFixed(0)}</span>
          </Space>
        ) : record.has_data ? '0' : <Text type="secondary">-</Text>,
      },
      {
        title: '碳足迹 (kg CO₂/kg)',
        dataIndex: 'carbon_footprint',
        key: 'carbon_footprint',
        width: 130,
        render: (v: number | null | undefined, record: any) => v !== null && v !== undefined ? (
          <span style={{ color: v > 5 ? '#f5222d' : v > 2 ? '#faad14' : '#52c41a' }}>
            {v.toFixed(2)}
          </span>
        ) : record.has_data ? '0' : <Text type="secondary">-</Text>,
      },
      {
        title: '微塑料风险',
        dataIndex: 'has_microplastic_risk',
        key: 'has_microplastic_risk',
        width: 100,
        render: (v: boolean | null | undefined) => v === true ? (
          <Tag color="red" icon={<WarningOutlined />}>有风险</Tag>
        ) : v === false ? (
          <Tag color="green" icon={<CheckCircleOutlined />}>无风险</Tag>
        ) : <Text type="secondary">-</Text>,
      },
    ];

    const compareColumns = [
      {
        title: '成分名称',
        dataIndex: 'ingredient_name',
        key: 'ingredient_name',
        render: (v: string, record: any) => (
          <Space>
            <Text strong>{v}</Text>
            {record.change_type === 'added' && <Tag color="green">新增</Tag>}
            {record.change_type === 'removed' && <Tag color="red">移除</Tag>}
          </Space>
        ),
      },
      {
        title: `${sustainabilityCompare ? `V${sustainabilityCompare.left_version_number}` : '当前'}占比`,
        dataIndex: 'left_percentage',
        key: 'left_percentage',
        width: 100,
        render: (v: number | null | undefined) => v !== null && v !== undefined ? `${v.toFixed(2)}%` : '-',
      },
      {
        title: `${sustainabilityCompare ? `V${sustainabilityCompare.right_version_number}` : '对比'}占比`,
        dataIndex: 'right_percentage',
        key: 'right_percentage',
        width: 100,
        render: (v: number | null | undefined) => v !== null && v !== undefined ? `${v.toFixed(2)}%` : '-',
      },
      {
        title: '环境影响变化',
        dataIndex: 'impact_label',
        key: 'impact_label',
        render: (v: string, record: any) => {
          const isPositive = v.includes('正面') || v.includes('新增环保') || v.includes('移除环境负担');
          const isNegative = v.includes('负面') || v.includes('新增环境负担') || v.includes('移除环保');
          const icon = isPositive ? <ArrowUpOutlined style={{ color: '#52c41a' }} /> :
                       isNegative ? <ArrowDownOutlined style={{ color: '#f5222d' }} /> :
                       <MinusOutlined style={{ color: '#999' }} />;
          const color = isPositive ? '#52c41a' : isNegative ? '#f5222d' : '#999';
          return (
            <Space>
              {icon}
              <span style={{ color }}>{v}</span>
              {record.environmental_impact_delta !== null && record.environmental_impact_delta !== undefined && (
                <Tag color={record.environmental_impact_delta > 0 ? 'green' : 'red'}>
                  {record.environmental_impact_delta > 0 ? '+' : ''}{record.environmental_impact_delta.toFixed(2)}
                </Tag>
              )}
            </Space>
          );
        },
      },
    ];

    return (
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <Card
          size="small"
          title={<Space><EnvironmentOutlined /> 可持续性评分</Space>}
          loading={sustainabilityLoading}
          extra={
            sustainabilityScore && !sustainabilityScore.is_reliable && (
              <Tag color="orange" icon={<ExclamationCircleOutlined />}>
                数据不可靠（缺失 {sustainabilityScore.missing_percentage.toFixed(0)}%）
              </Tag>
            )
          }
        >
          {sustainabilityScore ? (
            <Space direction="vertical" size={24} style={{ width: '100%' }}>
              <Row gutter={24} align="middle">
                <Col span={8} style={{ display: 'flex', justifyContent: 'center' }}>
                  {renderGauge(sustainabilityScore.total_score)}
                </Col>
                <Col span={16}>
                  <Row gutter={16}>
                    <Col span={8} style={{ display: 'flex', justifyContent: 'center' }}>
                      {renderRingChart(sustainabilityScore.biodegradability_score, '生物降解性')}
                    </Col>
                    <Col span={8} style={{ display: 'flex', justifyContent: 'center' }}>
                      {renderRingChart(sustainabilityScore.carbon_footprint_score, '碳足迹评分')}
                    </Col>
                    <Col span={8} style={{ display: 'flex', justifyContent: 'center' }}>
                      {renderRingChart(sustainabilityScore.source_score, '来源评分')}
                    </Col>
                  </Row>
                  <Row gutter={16} style={{ marginTop: 16 }}>
                    <Col span={12}>
                      <Statistic
                        title="微塑料惩罚"
                        value={sustainabilityScore.microplastic_penalty}
                        suffix="分"
                        valueStyle={{ color: sustainabilityScore.microplastic_penalty > 0 ? '#f5222d' : '#52c41a' }}
                        prefix={sustainabilityScore.has_microplastic_ingredient ? <WarningOutlined /> : <CheckCircleOutlined />}
                      />
                    </Col>
                    <Col span={12}>
                      <Statistic
                        title="数据缺失"
                        value={sustainabilityScore.missing_ingredients.length}
                        suffix={`个成分 (${sustainabilityScore.missing_percentage.toFixed(1)}%)`}
                        valueStyle={{ color: sustainabilityScore.missing_ingredients.length > 0 ? '#faad14' : '#52c41a' }}
                      />
                    </Col>
                  </Row>
                  {sustainabilityScore.missing_ingredients.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <Text type="secondary">缺失环境数据的成分：</Text>
                      <Space wrap size={[4, 4]} style={{ marginLeft: 8 }}>
                        {sustainabilityScore.missing_ingredients.map(name => (
                          <Tag key={name} color="default">{name}</Tag>
                        ))}
                      </Space>
                    </div>
                  )}
                </Col>
              </Row>
            </Space>
          ) : (
            <Empty description="暂无可持续性评分数据" />
          )}
        </Card>

        <Card
          size="small"
          title={<Space><EnvironmentOutlined /> 成分环境贡献明细</Space>}
          loading={sustainabilityLoading}
        >
          {sustainabilityScore ? (
            <Table
              size="small"
              dataSource={sustainabilityScore.contributions.map((c, idx) => ({ key: idx, ...c }))}
              pagination={false}
              columns={contributionColumns}
            />
          ) : (
            <Empty description="暂无成分数据" />
          )}
        </Card>

        <Card
          size="small"
          title={<Space><SwapOutlined /> 版本对比</Space>}
          extra={
            <Space>
              <span style={{ color: '#999', fontSize: 12 }}>对比版本：</span>
              <Select
                style={{ width: 200 }}
                placeholder="选择要对比的版本"
                value={compareVersionId}
                allowClear
                onChange={(value) => setCompareVersionId(value)}
                options={allVersions.map(v => ({
                  label: `V${v.version_number} - ${v.ingredients_summary}`,
                  value: v.id,
                }))}
              />
            </Space>
          }
        >
          {compareVersionId === null ? (
            <Empty description="请选择一个版本进行对比" />
          ) : sustainabilityCompareLoading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>加载对比数据中...</div>
          ) : sustainabilityCompare ? (
            <Space direction="vertical" size={24} style={{ width: '100%' }}>
              <Row gutter={24}>
                <Col span={12}>
                  <Card size="small" title="各维度评分对比">
                    <Row gutter={16}>
                      <Col span={12}>
                        <Statistic
                          title={`V${sustainabilityCompare.left_version_number} 总分`}
                          value={sustainabilityCompare.total_score.left_value}
                          valueStyle={{ color: getSustainabilityColor(sustainabilityCompare.total_score.left_value) }}
                        />
                      </Col>
                      <Col span={12}>
                        <Statistic
                          title={`V${sustainabilityCompare.right_version_number} 总分`}
                          value={sustainabilityCompare.total_score.right_value}
                          valueStyle={{ color: getSustainabilityColor(sustainabilityCompare.total_score.right_value) }}
                          prefix={
                            sustainabilityCompare.total_score.delta > 0 ?
                              <ArrowUpOutlined style={{ color: '#52c41a' }} /> :
                              sustainabilityCompare.total_score.delta < 0 ?
                                <ArrowDownOutlined style={{ color: '#f5222d' }} /> :
                                <MinusOutlined style={{ color: '#999' }} />
                          }
                        />
                      </Col>
                    </Row>
                    <Row gutter={16} style={{ marginTop: 16 }}>
                      <Col span={8}>
                        <Statistic
                          title="生物降解性"
                          value={sustainabilityCompare.biodegradability_score.delta}
                          prefix={sustainabilityCompare.biodegradability_score.delta > 0 ? '+' : ''}
                          valueStyle={{ color: sustainabilityCompare.biodegradability_score.delta >= 0 ? '#52c41a' : '#f5222d' }}
                          suffix="分"
                        />
                      </Col>
                      <Col span={8}>
                        <Statistic
                          title="碳足迹"
                          value={sustainabilityCompare.carbon_footprint_score.delta}
                          prefix={sustainabilityCompare.carbon_footprint_score.delta > 0 ? '+' : ''}
                          valueStyle={{ color: sustainabilityCompare.carbon_footprint_score.delta >= 0 ? '#52c41a' : '#f5222d' }}
                          suffix="分"
                        />
                      </Col>
                      <Col span={8}>
                        <Statistic
                          title="来源评分"
                          value={sustainabilityCompare.source_score.delta}
                          prefix={sustainabilityCompare.source_score.delta > 0 ? '+' : ''}
                          valueStyle={{ color: sustainabilityCompare.source_score.delta >= 0 ? '#52c41a' : '#f5222d' }}
                          suffix="分"
                        />
                      </Col>
                    </Row>
                    {sustainabilityCompare.positive_impact_ingredients.length > 0 && (
                      <Alert
                        style={{ marginTop: 16 }}
                        type="success"
                        showIcon
                        message="正面环境影响"
                        description={
                          <Space wrap>
                            {sustainabilityCompare.positive_impact_ingredients.map(name => (
                              <Tag key={name} color="green">{name}</Tag>
                            ))}
                          </Space>
                        }
                      />
                    )}
                    {sustainabilityCompare.negative_impact_ingredients.length > 0 && (
                      <Alert
                        style={{ marginTop: 16 }}
                        type="error"
                        showIcon
                        message="负面环境影响"
                        description={
                          <Space wrap>
                            {sustainabilityCompare.negative_impact_ingredients.map(name => (
                              <Tag key={name} color="red">{name}</Tag>
                            ))}
                          </Space>
                        }
                      />
                    )}
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title="雷达图对比">
                    <div style={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={getRadarData()}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="dimension" />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} />
                          <Radar
                            name={`V${sustainabilityCompare.left_version_number}（当前）`}
                            dataKey="current"
                            stroke="#1890ff"
                            fill="#1890ff"
                            fillOpacity={0.3}
                          />
                          {sustainabilityCompare && (
                            <Radar
                              name={`V${sustainabilityCompare.right_version_number}`}
                              dataKey="compare"
                              stroke="#faad14"
                              fill="#faad14"
                              fillOpacity={0.3}
                            />
                          )}
                          <Legend />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </Col>
              </Row>

              <Card size="small" title="逐成分环境贡献对比">
                <Table
                  size="small"
                  dataSource={sustainabilityCompare.ingredient_comparisons.map((c, idx) => ({ key: idx, ...c }))}
                  pagination={false}
                  columns={compareColumns}
                />
              </Card>
            </Space>
          ) : (
            <Empty description="对比数据加载失败" />
          )}
        </Card>
      </Space>
    );
  };

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Card
        size="small"
        loading={lifecycleStatsLoading}
        style={{
          background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%)',
          borderLeft: '4px solid #1890ff',
        }}
      >
        <Row gutter={[24, 12]} align="middle">
          <Col flex="auto">
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Space align="center">
                <ScheduleOutlined style={{ fontSize: 20, color: '#1890ff' }} />
                <Text strong style={{ fontSize: 16 }}>产品线生命周期统计</Text>
              </Space>
            </Space>
          </Col>
          <Col>
            <Statistic
              title={
                <Space size={4}>
                  <ClockCircleOutlined style={{ color: '#52c41a' }} />
                  <span>平均试产周期</span>
                </Space>
              }
              value={lifecycleStats?.avg_days_to_first_batch ?? '-'}
              suffix={lifecycleStats?.avg_days_to_first_batch !== null && lifecycleStats?.avg_days_to_first_batch !== undefined ? '天' : ''}
              valueStyle={{ fontSize: 20, fontWeight: 700, color: '#52c41a' }}
            />
          </Col>
          <Col>
            <Statistic
              title={
                <Space size={4}>
                  <AuditOutlined style={{ color: '#1890ff' }} />
                  <span>平均审批周期</span>
                </Space>
              }
              value={lifecycleStats?.avg_days_from_batch_to_approval ?? '-'}
              suffix={lifecycleStats?.avg_days_from_batch_to_approval !== null && lifecycleStats?.avg_days_from_batch_to_approval !== undefined ? '天' : ''}
              valueStyle={{ fontSize: 20, fontWeight: 700, color: '#1890ff' }}
            />
          </Col>
          <Col>
            <Statistic
              title={
                <Space size={4}>
                  <RiseOutlined style={{ color: '#722ed1' }} />
                  <span>版本平均存活轮次</span>
                </Space>
              }
              value={lifecycleStats?.avg_version_survival_rounds ?? '-'}
              valueStyle={{ fontSize: 20, fontWeight: 700, color: '#722ed1' }}
            />
          </Col>
          <Col>
            <Statistic
              title={
                <Space size={4}>
                  <StarFilled style={{
                    color: (lifecycleStats?.overdue_milestone_count ?? 0) > 0 ? '#f5222d' : '#faad14'
                  }} />
                  <span>逾期里程碑</span>
                </Space>
              }
              value={lifecycleStats?.overdue_milestone_count ?? 0}
              valueStyle={{
                fontSize: 20,
                fontWeight: 700,
                color: (lifecycleStats?.overdue_milestone_count ?? 0) > 0 ? '#f5222d' : '#52c41a'
              }}
            />
          </Col>
        </Row>
      </Card>

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
            },
            {
              key: 'compliance',
              label: <span><GlobalOutlined /> 法规合规</span>,
              children: renderComplianceTab()
            },
            {
              key: 'timeline',
              label: <span><ScheduleOutlined /> 时间线</span>,
              children: renderTimelineTab()
            },
            {
              key: 'sustainability',
              label: <span><EnvironmentOutlined /> 可持续性</span>,
              children: renderSustainabilityTab()
            },
            {
              key: 'process-execution',
              label: <span><ThunderboltOutlined /> 工艺执行</span>,
              children: (
                <ProcessExecutionPanel
                  version={version}
                  batches={batches}
                  allBatches={allBatches}
                />
              )
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
        width={880}
        okText="创建新版本"
      >
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          系统已预填父版本的成分，请直接修改。百分比之和必须精确等于 100.00%。
        </Typography.Paragraph>
        <Row gutter={16}>
          <Col span={12}>
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
                    <div style={{ maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
                      {fields.map(({ key, name, ...restField }) => (
                        <Row key={key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                          <Col flex="auto">
                            <Form.Item
                              {...restField}
                              name={[name, 'name']}
                              rules={[{ required: true, message: '必填' }]}
                              style={{ marginBottom: 0 }}
                            >
                              <Input placeholder="成分名称" size="small" />
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
                                size="small"
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
                    </div>
                    <Form.Item style={{ marginTop: 8, marginBottom: 0 }}>
                      <Button
                        type="dashed"
                        onClick={() => add({ name: '', percentage: 0 })}
                        block
                        icon={<PlusOutlined />}
                        size="small"
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
                      padding: 10,
                      background: ok ? '#f6ffed' : '#fff1f0',
                      borderRadius: 6,
                      border: `1px solid ${ok ? '#b7eb8f' : '#ffa39e'}`,
                      textAlign: 'center',
                      fontWeight: 600,
                      marginTop: 12
                    }}>
                      <span style={{ color: ok ? '#52c41a' : '#f5222d' }}>
                        当前合计：{total.toFixed(2)}%
                        {ok ? ' ✓ 符合要求' : ' ✗ 需调整至100.00%'}
                      </span>
                    </div>
                  );
                }}
              </Form.Item>

              <Button
                type="primary"
                icon={<EyeOutlined />}
                onClick={handleImpactPreview}
                loading={impactAnalysisLoading}
                block
                style={{ marginTop: 12 }}
              >
                影响预览
              </Button>
            </Form>
          </Col>
          <Col span={12}>
            <div style={{
              border: '1px solid #f0f0f0',
              borderRadius: 6,
              padding: 12,
              height: '100%',
              minHeight: 420,
              maxHeight: 500,
              overflowY: 'auto'
            }}>
              {!showImpactPreview ? (
                <div style={{
                  textAlign: 'center',
                  color: '#999',
                  paddingTop: 100
                }}>
                  <CalculatorOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 12 }} />
                  <div>调整成分后点击"影响预览"</div>
                  <div style={{ fontSize: 12 }}>查看成本、合规、稳定性综合影响</div>
                </div>
              ) : impactAnalysisLoading ? (
                <div style={{ textAlign: 'center', paddingTop: 100, color: '#999' }}>
                  正在分析影响...
                </div>
              ) : impactAnalysisData ? (
                <>
                  {impactAnalysisData.exclusion_conflicts.length > 0 && (
                    <Alert
                      message="存在互斥成分冲突"
                      description={impactAnalysisData.exclusion_conflicts.map((c, i) => (
                        <div key={i}>
                          <b>{c.group_name}</b>: {c.conflicting_ingredients.join(', ')}
                        </div>
                      ))}
                      type="warning"
                      showIcon
                      style={{ marginBottom: 12 }}
                    />
                  )}
                  <Collapse
                    defaultActiveKey={['cost', 'compliance', 'stability']}
                    size="small"
                    items={[
                      {
                        key: 'cost',
                        label: (
                          <Space>
                            <DollarOutlined style={{ color: '#1890ff' }} />
                            <span>成本变化</span>
                            <Tag color={impactAnalysisData.cost_impact.total_delta > 0 ? 'red' : impactAnalysisData.cost_impact.total_delta < 0 ? 'green' : 'default'}>
                              {impactAnalysisData.cost_impact.total_delta > 0 ? '+' : ''}{impactAnalysisData.cost_impact.total_delta.toFixed(4)} 元
                            </Tag>
                          </Space>
                        ),
                        children: (
                          <div>
                            <Row gutter={8} style={{ marginBottom: 12 }}>
                              <Col span={12}>
                                <Statistic
                                  title="调整前"
                                  value={impactAnalysisData.cost_impact.original_total_cost}
                                  precision={4}
                                  prefix="¥"
                                />
                              </Col>
                              <Col span={12}>
                                <Statistic
                                  title="调整后"
                                  value={impactAnalysisData.cost_impact.new_total_cost}
                                  precision={4}
                                  prefix="¥"
                                  valueStyle={{ color: impactAnalysisData.cost_impact.total_delta > 0 ? '#f5222d' : impactAnalysisData.cost_impact.total_delta < 0 ? '#52c41a' : 'inherit' }}
                                />
                              </Col>
                            </Row>
                            <div style={{
                              fontSize: 12,
                              fontWeight: 600,
                              marginBottom: 6,
                              color: '#666'
                            }}>
                              成本变化明细
                            </div>
                            <Table
                              size="small"
                              dataSource={impactAnalysisData.cost_impact.details.filter(d => d.cost_delta !== null && Math.abs(d.cost_delta) > 0.0001)}
                              rowKey="ingredient_name"
                              pagination={false}
                              columns={[
                                {
                                  title: '成分',
                                  dataIndex: 'ingredient_name',
                                  key: 'ingredient_name',
                                  width: '30%',
                                  render: (text) => <span style={{ fontSize: 12 }}>{text}</span>
                                },
                                {
                                  title: '比例变化',
                                  key: 'pct',
                                  width: '25%',
                                  render: (_, record) => (
                                    <span style={{ fontSize: 12 }}>
                                      {record.original_percentage.toFixed(2)}% → {record.new_percentage.toFixed(2)}%
                                    </span>
                                  )
                                },
                                {
                                  title: '成本变化',
                                  key: 'cost',
                                  width: '25%',
                                  render: (_, record) => {
                                    const delta = record.cost_delta;
                                    if (delta === null) return <span style={{ color: '#999', fontSize: 12 }}>-</span>;
                                    return (
                                      <span style={{
                                        color: delta > 0 ? '#f5222d' : delta < 0 ? '#52c41a' : '#999',
                                        fontSize: 12
                                      }}>
                                        {delta > 0 ? '+' : ''}{delta.toFixed(4)}
                                      </span>
                                    );
                                  }
                                }
                              ]}
                            />
                            {impactAnalysisData.cost_impact.missing_quotes.length > 0 && (
                              <div style={{
                                fontSize: 12,
                                color: '#faad14',
                                marginTop: 8
                              }}>
                                缺少报价的成分: {impactAnalysisData.cost_impact.missing_quotes.join(', ')}
                              </div>
                            )}
                          </div>
                        )
                      },
                      {
                        key: 'compliance',
                        label: (
                          <Space>
                            <GlobalOutlined style={{ color: '#722ed1' }} />
                            <span>合规风险</span>
                            {impactAnalysisData.compliance_risk.new_risks.length > 0 && (
                              <Tag color="red">
                                {impactAnalysisData.compliance_risk.new_risks.length} 项新增风险
                              </Tag>
                            )}
                          </Space>
                        ),
                        children: (
                          <div>
                            {impactAnalysisData.compliance_risk.new_risks.length === 0 ? (
                              <div style={{
                                padding: 20,
                                textAlign: 'center',
                                color: '#52c41a'
                              }}>
                                <CheckCircleOutlined style={{ fontSize: 32, marginBottom: 8 }} />
                                <div>未发现新增合规风险</div>
                                <div style={{ fontSize: 12, color: '#999' }}>
                                  检测市场: {impactAnalysisData.compliance_risk.markets.join(', ')}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div style={{
                                  fontSize: 12,
                                  color: '#666',
                                  marginBottom: 8
                                }}>
                                  调整后新增的合规问题：
                                </div>
                                {impactAnalysisData.compliance_risk.new_risks.map((risk, index) => (
                                  <Alert
                                    key={index}
                                    message={
                                      <Space size="small">
                                        <Tag color="red">{risk.target_market}</Tag>
                                        <Tag color={risk.risk_type === '禁用' ? '#a8071a' : 'orange'}>
                                          {risk.risk_type}
                                        </Tag>
                                        <span style={{ fontWeight: 600 }}>{risk.ingredient_name}</span>
                                        <span style={{ fontSize: 12, color: '#666' }}>
                                          {risk.percentage.toFixed(2)}%
                                          {risk.max_percentage !== null && ` / 限用${risk.max_percentage}%`}
                                        </span>
                                      </Space>
                                    }
                                    description={risk.notes || risk.regulation_reference || ''}
                                    type="error"
                                    showIcon
                                    style={{ marginBottom: 8 }}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      },
                      {
                        key: 'stability',
                        label: (
                          <Space>
                            <SafetyOutlined style={{ color: '#13c2c2' }} />
                            <span>稳定性影响</span>
                            <Tag color={impactAnalysisData.stability_impact.score_delta < 0 ? 'red' : impactAnalysisData.stability_impact.score_delta > 0 ? 'green' : 'default'}>
                              {impactAnalysisData.stability_impact.score_delta > 0 ? '+' : ''}{impactAnalysisData.stability_impact.score_delta.toFixed(2)} 分
                            </Tag>
                          </Space>
                        ),
                        children: (
                          <div>
                            <Row gutter={8} style={{ marginBottom: 12 }}>
                              <Col span={12}>
                                <Statistic
                                  title="调整前"
                                  value={impactAnalysisData.stability_impact.original_total_score}
                                  suffix="分"
                                />
                                <Tag color={getScoreColor(impactAnalysisData.stability_impact.original_total_score / 10)}>
                                  {impactAnalysisData.stability_impact.original_risk_level}
                                </Tag>
                              </Col>
                              <Col span={12}>
                                <Statistic
                                  title="调整后"
                                  value={impactAnalysisData.stability_impact.new_total_score}
                                  suffix="分"
                                  valueStyle={{ color: impactAnalysisData.stability_impact.score_delta < 0 ? '#f5222d' : '#52c41a' }}
                                />
                                <Tag color={getScoreColor(impactAnalysisData.stability_impact.new_total_score / 10)}>
                                  {impactAnalysisData.stability_impact.new_risk_level}
                                </Tag>
                              </Col>
                            </Row>
                            <Progress
                              percent={impactAnalysisData.stability_impact.new_total_score}
                              showInfo={false}
                              strokeColor={getScoreColor(impactAnalysisData.stability_impact.new_total_score / 10)}
                              strokeWidth={8}
                              style={{ marginBottom: 12 }}
                            />
                            {impactAnalysisData.stability_impact.significant_changes.length > 0 && (
                              <>
                                <div style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: '#f5222d',
                                  marginBottom: 6
                                }}>
                                  ⚠️ 显著变化的成分对（变化＞5分）
                                </div>
                                {impactAnalysisData.stability_impact.significant_changes.map((pair, index) => (
                                  <div
                                    key={index}
                                    style={{
                                      padding: 8,
                                      background: pair.deduction_delta > 0 ? '#fff1f0' : '#f6ffed',
                                      borderRadius: 4,
                                      marginBottom: 6,
                                      fontSize: 12
                                    }}
                                  >
                                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                      {pair.ingredient_a} + {pair.ingredient_b}
                                      <Tag
                                        color={pair.deduction_delta > 0 ? 'red' : 'green'}
                                        style={{ marginLeft: 8 }}
                                      >
                                        {pair.deduction_delta > 0 ? '风险增加' : '风险降低'} {Math.abs(pair.deduction_delta).toFixed(2)}分
                                      </Tag>
                                    </div>
                                    <div style={{ color: '#666' }}>
                                      {pair.manifestation}（{pair.compatibility_level}）
                                    </div>
                                    <div style={{ color: '#999', fontSize: 11 }}>
                                      扣分项: {pair.original_deduction.toFixed(2)} → {pair.new_deduction.toFixed(2)}
                                    </div>
                                  </div>
                                ))}
                              </>
                            )}
                            {impactAnalysisData.stability_impact.significant_changes.length === 0 && (
                              <div style={{
                                padding: 12,
                                textAlign: 'center',
                                color: '#52c41a',
                                fontSize: 12
                              }}>
                                无显著变化的成分对（变化≤5分）
                              </div>
                            )}
                          </div>
                        )
                      }
                    ]}
                  />
                </>
              ) : null}
            </div>
          </Col>
        </Row>
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

      <Modal
        title={
          <Space>
            <FlagOutlined style={{ color: '#faad14' }} />
            <span>添加里程碑 - V{version.version_number}</span>
          </Space>
        }
        open={createMilestoneVisible}
        onCancel={() => {
          setCreateMilestoneVisible(false);
          milestoneForm.resetFields();
        }}
        onOk={() => milestoneForm.submit()}
        okText="创建里程碑"
      >
        <Form form={milestoneForm} layout="vertical" onFinish={handleCreateMilestone}>
          <Form.Item
            name="name"
            label="里程碑名称"
            rules={[
              { required: true, message: '请输入里程碑名称' },
              { max: 200, message: '名称不能超过200个字符' }
            ]}
          >
            <Input
              placeholder="例如：首次稳定性测试、客户样品确认等"
              maxLength={200}
              showCount
            />
          </Form.Item>
          <Form.Item
            name="target_date"
            label="目标日期"
            rules={[{ required: true, message: '请选择目标日期' }]}
          >
            <DatePicker style={{ width: '100%' }} placeholder="选择目标完成日期" />
          </Form.Item>
          <Alert
            type="info"
            showIcon
            message="里程碑提示"
            description="里程碑到达目标日期但未标记完成时，系统会自动标记为已逾期。同一版本下不允许创建同名里程碑。"
          />
        </Form>
      </Modal>

      <Modal
        title={
          <Space>
            <SwapOutlined />
            <span>替代方案推荐 — {substitutionIngredient}</span>
          </Space>
        }
        open={substitutionModalVisible}
        onCancel={() => {
          setSubstitutionModalVisible(false);
          setSelectedPlanPreview(null);
          setSubstitutionPlansData(null);
        }}
        footer={null}
        width={960}
        destroyOnClose
      >
        {substitutionPlansLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Text type="secondary">正在生成替代方案...</Text>
          </div>
        ) : substitutionPlansData && substitutionPlansData.plans.length === 0 ? (
          <Empty description={`暂无「${substitutionIngredient}」的替代品配置，请先在替代关系管理中添加`} />
        ) : substitutionPlansData ? (
          <div>
            <Alert
              style={{ marginBottom: 16 }}
              type="info"
              showIcon
              message={`原成分「${substitutionIngredient}」占比 ${substitutionPlansData.original_percentage.toFixed(2)}%，以下为按综合推荐度排序的替代方案`}
            />
            <Row gutter={[16, 16]}>
              {substitutionPlansData.plans.map((plan, idx) => (
                <Col span={selectedPlanPreview ? 12 : 8} key={plan.substitute_ingredient}>
                  <Card
                    size="small"
                    hoverable
                    style={{
                      borderColor: selectedPlanPreview?.substitute_ingredient === plan.substitute_ingredient ? '#1890ff' : undefined,
                      borderWidth: selectedPlanPreview?.substitute_ingredient === plan.substitute_ingredient ? 2 : 1,
                    }}
                    onClick={() => setSelectedPlanPreview(
                      selectedPlanPreview?.substitute_ingredient === plan.substitute_ingredient ? null : plan
                    )}
                  >
                    <div style={{ marginBottom: 8 }}>
                      <Space>
                        <Text strong style={{ fontSize: 15 }}>{plan.substitute_ingredient}</Text>
                        <Tag color={plan.fitness_score >= 80 ? 'green' : plan.fitness_score >= 60 ? 'orange' : 'red'}>
                          适配度 {plan.fitness_score}
                        </Tag>
                      </Space>
                    </div>
                    <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
                      建议用量: ×{plan.suggested_ratio} → 新增 {plan.new_percentage.toFixed(2)}%, 最终占比: <Text strong>{plan.final_percentage.toFixed(2)}%</Text>
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <Space size={4} wrap>
                        {plan.has_conflict && (
                          <Tag color="error" icon={<ExclamationCircleOutlined />}>有冲突</Tag>
                        )}
                        {plan.has_compliance_risk && (
                          <Tag color="warning" icon={<ExclamationCircleOutlined />}>合规风险</Tag>
                        )}
                        {plan.sensory_impact === '感官可能有变化' && (
                          <Tag color="orange">感官可能变化</Tag>
                        )}
                      </Space>
                    </div>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                      成本变化: {plan.cost_change_rate !== null ? (
                        <span style={{ color: plan.cost_change_rate > 0 ? '#f5222d' : plan.cost_change_rate < 0 ? '#52c41a' : '#666' }}>
                          {plan.cost_change_rate > 0 ? '+' : ''}{plan.cost_change_rate.toFixed(2)}%
                        </span>
                      ) : '无报价数据'}
                    </div>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                      稳定性变化: {plan.stability_risk_change !== null ? (
                        <span style={{ color: plan.stability_risk_change < 0 ? '#f5222d' : plan.stability_risk_change > 0 ? '#52c41a' : '#666' }}>
                          {plan.stability_risk_change > 0 ? '+' : ''}{plan.stability_risk_change.toFixed(2)}分
                        </span>
                      ) : '-'}
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <Text style={{ fontSize: 12, color: '#666' }}>综合推荐度</Text>
                      <Progress
                        percent={plan.overall_recommendation}
                        size="small"
                        strokeColor={plan.overall_recommendation >= 70 ? '#52c41a' : plan.overall_recommendation >= 50 ? '#faad14' : '#f5222d'}
                        format={(p) => `${p?.toFixed(1)}`}
                      />
                    </div>
                    {(plan.has_conflict || plan.has_compliance_risk) && (
                      <div style={{ fontSize: 11, color: '#999' }}>
                        {plan.conflict_details.map((d, i) => <div key={`c${i}`}>⚠️ {d}</div>)}
                        {plan.compliance_risk_details.map((d, i) => <div key={`r${i}`}>⚠️ {d}</div>)}
                      </div>
                    )}
                  </Card>
                </Col>
              ))}
            </Row>
            {selectedPlanPreview && (
              <div style={{ marginTop: 16 }}>
                <Divider orientation="left" style={{ fontSize: 13 }}>
                  替换预览：{substitutionIngredient} → {selectedPlanPreview.substitute_ingredient}
                </Divider>
                <Table
                  size="small"
                  pagination={false}
                  dataSource={selectedPlanPreview.full_ingredients.map(ing => ({
                    ...ing,
                    key: ing.name,
                  }))}
                  columns={[
                    {
                      title: '成分名称',
                      dataIndex: 'name',
                      key: 'name',
                      render: (name: string, record: SubstitutionPlanIngredient) => (
                        <Space>
                          {name}
                          {record.is_new && <Tag color="blue">替代品</Tag>}
                          {name === substitutionIngredient && <Tag color="default">原成分→移除</Tag>}
                        </Space>
                      )
                    },
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
                      title: '变化',
                      key: 'change',
                      width: 100,
                      render: (_: any, record: SubstitutionPlanIngredient) => {
                        const orig = allIngredients.find(i => i.name === record.name);
                        if (!orig) return <Tag color="blue">新增</Tag>;
                        const diff = record.percentage - orig.percentage;
                        if (Math.abs(diff) < 0.005) return <Text type="secondary">-</Text>;
                        return (
                          <Text style={{ color: diff > 0 ? '#52c41a' : '#f5222d', fontFamily: 'monospace' }}>
                            {diff > 0 ? '+' : ''}{diff.toFixed(2)}%
                          </Text>
                        );
                      }
                    }
                  ]}
                />
                <div style={{ marginTop: 8, textAlign: 'right' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    合计: {selectedPlanPreview.full_ingredients.reduce((s, i) => s + i.percentage, 0).toFixed(2)}%
                  </Text>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </Space>
  );
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}
