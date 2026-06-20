import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Card, Row, Col, Progress, Statistic, Tag, Timeline, Button, Space, Select,
  Modal, Form, Input, InputNumber, message, Alert, Tooltip, Table, Typography,
  Divider, Empty, Tabs, Badge, Descriptions, Popconfirm, Collapse, Radio
} from 'antd';
import {
  PlayCircleOutlined, CheckCircleOutlined, PauseCircleOutlined, ThunderboltOutlined,
  WarningOutlined, SyncOutlined, FileDoneOutlined, CameraOutlined, SwapOutlined,
  ClockCircleOutlined, EnvironmentOutlined, DashboardOutlined, DiffOutlined,
  ReloadOutlined, RightCircleOutlined
} from '@ant-design/icons';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  Legend, ResponsiveContainer, BarChart, Bar, Cell, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import type {
  Batch, FormulaVersion, BatchProcessExecution, StepExecution,
  ExecutionTimelineResponse, ProcessCompareResponse, StepExecutionStatus
} from '../types';
import { api } from '../api';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

interface Props {
  version: FormulaVersion;
  batches: Batch[];
  allBatches: Batch[];
  preselectedBatchId?: number | null;
  hideBatchSelector?: boolean;
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}分${s}秒` : `${s}秒`;
}

function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return '-';
  try {
    const d = new Date(timeStr);
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return timeStr; }
}

function getStatusColor(status: StepExecutionStatus | string): string {
  switch (status) {
    case 'completed': return '#52c41a';
    case 'in_progress': return '#1890ff';
    case 'interrupted': return '#fa8c16';
    case 'pending': return '#bfbfbf';
    default: return '#bfbfbf';
  }
}

function getStatusLabel(status: StepExecutionStatus | string): string {
  switch (status) {
    case 'completed': return '已完成';
    case 'in_progress': return '进行中';
    case 'interrupted': return '已中断';
    case 'pending': return '待开始';
    default: return status;
  }
}

function getConsistencyColor(score: number | null): string {
  if (score === null) return '#bfbfbf';
  if (score >= 90) return '#52c41a';
  if (score >= 75) return '#faad14';
  return '#f5222d';
}

function getParameterLabel(p: string): string {
  switch (p) {
    case 'temperature': return '温度(℃)';
    case 'duration': return '时长(秒)';
    case 'speed': return '转速(rpm)';
    default: return p;
  }
}

export default function ProcessExecutionPanel({
  version, batches, allBatches, preselectedBatchId = null, hideBatchSelector = false
}: Props) {
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(preselectedBatchId);
  const [compareBatchId, setCompareBatchId] = useState<number | null>(null);
  const [execution, setExecution] = useState<BatchProcessExecution | null>(null);
  const [timeline, setTimeline] = useState<ExecutionTimelineResponse | null>(null);
  const [compareData, setCompareData] = useState<ProcessCompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [execLoading, setExecLoading] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);

  const [completeModal, setCompleteModal] = useState(false);
  const [currentStep, setCurrentStep] = useState<StepExecution | null>(null);
  const [completeForm] = Form.useForm();

  const [interruptModal, setInterruptModal] = useState(false);
  const [interruptForm] = Form.useForm();

  const [stepDetailModal, setStepDetailModal] = useState(false);
  const [detailStep, setDetailStep] = useState<StepExecution | null>(null);

  const versionBatches = useMemo(
    () => allBatches.filter(b => b.version_id === version.id),
    [allBatches, version.id]
  );

  const executableBatches = useMemo(
    () => allBatches.filter(b =>
      b.version_id === version.id ||
      versionBatches.some(vb => vb.id === b.id)
    ),
    [allBatches, version.id, versionBatches]
  );

  const loadExecution = useCallback(async (batchId: number) => {
    setExecLoading(true);
    try {
      const data = await api.getBatchProcessExecution(batchId);
      setExecution(data);
    } catch (e: any) {
      setExecution(null);
    } finally {
      setExecLoading(false);
    }
  }, []);

  const loadTimeline = useCallback(async (batchId: number) => {
    setTimelineLoading(true);
    try {
      const data = await api.getExecutionTimeline(batchId);
      setTimeline(data);
    } catch (e: any) {
      setTimeline(null);
    } finally {
      setTimelineLoading(false);
    }
  }, []);

  const loadCompare = useCallback(async (leftId: number, rightId: number) => {
    setCompareLoading(true);
    try {
      const data = await api.compareBatchProcesses(leftId, rightId);
      setCompareData(data);
    } catch (e: any) {
      setCompareData(null);
    } finally {
      setCompareLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedBatchId !== null) {
      loadExecution(selectedBatchId);
      loadTimeline(selectedBatchId);
    } else {
      setExecution(null);
      setTimeline(null);
    }
    setCompareData(null);
    setCompareBatchId(null);
  }, [selectedBatchId, loadExecution, loadTimeline]);

  useEffect(() => {
    if (selectedBatchId !== null && compareBatchId !== null && selectedBatchId !== compareBatchId) {
      loadCompare(selectedBatchId, compareBatchId);
    } else {
      setCompareData(null);
    }
  }, [selectedBatchId, compareBatchId, loadCompare]);

  useEffect(() => {
    if (versionBatches.length === 0) return;
    const hasPre = preselectedBatchId && versionBatches.some(b => b.id === preselectedBatchId);
    if (hasPre) {
      setSelectedBatchId(preselectedBatchId);
    } else if (!selectedBatchId) {
      setSelectedBatchId(versionBatches[0].id);
    } else if (preselectedBatchId === null || preselectedBatchId === undefined) {
      if (!versionBatches.some(b => b.id === selectedBatchId)) {
        setSelectedBatchId(versionBatches[0].id);
      }
    }
  }, [versionBatches, preselectedBatchId]);

  const progressInfo = useMemo(() => {
    if (!execution) return { percent: 0, completed: 0, total: 0 };
    const total = execution.step_executions.length;
    const completed = execution.step_executions.filter(s => s.status === 'completed').length;
    return { percent: total > 0 ? Math.round(completed / total * 100) : 0, completed, total };
  }, [execution]);

  const handleStartStep = async (step: StepExecution) => {
    if (!execution) return;
    setLoading(true);
    try {
      await api.startStep(execution.id, step.id, '当前操作员');
      message.success(`开始工序：${step.name}`);
      loadExecution(selectedBatchId!);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const openCompleteModal = (step: StepExecution) => {
    setCurrentStep(step);
    completeForm.setFieldsValue({
      actual_temperature: step.target_temperature,
      actual_duration: step.target_duration,
      actual_stirring_speed: step.stirring_speed,
      photo_url: '',
      remark: '',
    });
    setCompleteModal(true);
  };

  const handleCompleteStep = async (values: any) => {
    if (!execution || !currentStep) return;
    setLoading(true);
    try {
      await api.completeStep(execution.id, currentStep.id, {
        operator: '当前操作员',
        ...values
      });
      message.success(`完成工序：${currentStep.name}`);
      setCompleteModal(false);
      completeForm.resetFields();
      loadExecution(selectedBatchId!);
      loadTimeline(selectedBatchId!);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleInterrupt = async (values: any) => {
    if (!execution) return;
    setLoading(true);
    try {
      await api.interruptExecution(execution.id, '当前操作员', values.reason);
      message.success('已中断当前执行');
      setInterruptModal(false);
      interruptForm.resetFields();
      loadExecution(selectedBatchId!);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async () => {
    if (!execution) return;
    setLoading(true);
    try {
      await api.resumeExecution(execution.id, '当前操作员');
      message.success('已恢复执行');
      loadExecution(selectedBatchId!);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const deviationSteps = useMemo(() => {
    if (!execution) return [];
    return execution.step_executions.filter(s => s.has_deviation);
  }, [execution]);

  const radarData = useMemo(() => {
    if (!execution) return [];
    const total = execution.step_executions.length || 1;
    const completed = execution.step_executions.filter(s => s.status === 'completed').length;
    const tempDev = deviationSteps.filter(s =>
      s.deviation_details?.some(d => d.parameter === 'temperature')
    ).length;
    const durDev = deviationSteps.filter(s =>
      s.deviation_details?.some(d => d.parameter === 'duration')
    ).length;
    const speedDev = deviationSteps.filter(s =>
      s.deviation_details?.some(d => d.parameter === 'speed')
    ).length;
    return [
      { subject: '工序完成度', A: Math.round(completed / total * 100) },
      { subject: '温度合规', A: Math.max(0, 100 - tempDev * 25) },
      { subject: '时长合规', A: Math.max(0, 100 - durDev * 25) },
      { subject: '转速合规', A: Math.max(0, 100 - speedDev * 25) },
      { subject: '无中断率', A: execution.was_interrupted ? 50 : 100 },
    ];
  }, [execution, deviationSteps]);

  const paramChartData = useMemo(() => {
    if (!timeline) return [];
    return timeline.step_executions
      .filter(s => s.status === 'completed')
      .map(s => ({
        name: `步骤${s.step_order}`,
        step: s.step_order,
        目标温度: s.target_temperature,
        实际温度: s.actual_temperature,
        目标时长: s.target_duration ? s.target_duration / 60 : null,
        实际时长: s.actual_duration ? s.actual_duration / 60 : null,
      }));
  }, [timeline]);

  const compareChartData = useMemo(() => {
    if (!compareData) return [];
    const stepMap = new Map<number, any>();
    for (const d of compareData.step_diffs) {
      if (!stepMap.has(d.step_order)) {
        stepMap.set(d.step_order, {
          step: `步骤${d.step_order}`,
          step_order: d.step_order,
          name: d.step_name,
          温度差: 0,
          时长差: 0,
          转速差: 0,
        });
      }
      const obj = stepMap.get(d.step_order)!;
      if (d.parameter === 'temperature') obj.温度差 = d.difference || 0;
      if (d.parameter === 'duration') obj.时长差 = Math.round((d.difference || 0) / 60);
      if (d.parameter === 'speed') obj.转速差 = d.difference || 0;
    }
    return Array.from(stepMap.values());
  }, [compareData]);

  const renderStepTimelineItem = (step: StepExecution) => {
    const dotColor = step.has_deviation ? '#f5222d' : getStatusColor(step.status);
    const actions: React.ReactNode[] = [];

    const canStart = step.status === 'pending' && (
      step.step_order === 1 ||
      execution?.step_executions.find(s => s.step_order === step.step_order - 1)?.status === 'completed'
    );

    if (step.status === 'pending' && canStart) {
      actions.push(
        <Button
          key="start"
          type="primary"
          size="small"
          icon={<PlayCircleOutlined />}
          onClick={() => handleStartStep(step)}
          loading={loading}
        >开始</Button>
      );
    }
    if (step.status === 'in_progress') {
      actions.push(
        <Button
          key="complete"
          type="primary"
          size="small"
          icon={<CheckCircleOutlined />}
          onClick={() => openCompleteModal(step)}
          loading={loading}
        >完成</Button>
      );
    }
    if (step.status === 'interrupted') {
      actions.push(
        <Tag color="orange" key="interrupted">已中断</Tag>
      );
    }

    return (
      <Timeline.Item
        key={step.id}
        dot={step.has_deviation ? <WarningOutlined /> : undefined}
        color={dotColor}
      >
        <Card
          size="small"
          style={{
            marginBottom: 8,
            borderColor: step.has_deviation ? '#ffa39e' : undefined,
            backgroundColor: step.has_deviation ? '#fff2f0' : undefined
          }}
          title={
            <Space>
              <Text strong>{`步骤${step.step_order}：${step.name || '工序'}`}</Text>
              <Tag color={getStatusColor(step.status)} style={{ borderWidth: 0 }}>
                {getStatusLabel(step.status)}
              </Tag>
              {step.requires_photo && <Tag icon={<CameraOutlined />}>需拍照</Tag>}
              {step.has_deviation && <Tag color="red" icon={<WarningOutlined />}>工艺偏差</Tag>}
              {step.interrupted_at && <Tag color="orange" icon={<PauseCircleOutlined />}>中断恢复</Tag>}
            </Space>
          }
          extra={
            <Button
              type="link"
              size="small"
              icon={<RightCircleOutlined />}
              onClick={() => { setDetailStep(step); setStepDetailModal(true); }}
            >详情</Button>
          }
        >
          <Row gutter={[12, 8]}>
            {step.target_temperature !== null && (
              <Col xs={12} md={8}>
                <Space direction="vertical" size={0}>
                  <Text type="secondary" style={{ fontSize: 12 }}>目标温度</Text>
                  <Space>
                    <Text strong>{step.target_temperature}℃</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>±{step.temperature_tolerance}℃</Text>
                    {step.actual_temperature !== null && (
                      <Text
                        type={Math.abs(step.actual_temperature - step.target_temperature) > (step.temperature_tolerance || 0) ? 'danger' : undefined}
                        style={{ fontWeight: 600 }}
                      >→ {step.actual_temperature}℃</Text>
                    )}
                  </Space>
                </Space>
              </Col>
            )}
            {step.target_duration !== null && (
              <Col xs={12} md={8}>
                <Space direction="vertical" size={0}>
                  <Text type="secondary" style={{ fontSize: 12 }}>目标时长</Text>
                  <Space>
                    <Text strong>{formatDuration(step.target_duration)}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>±{formatDuration(step.duration_tolerance)}</Text>
                    {step.actual_duration !== null && (
                      <Text
                        type={Math.abs(step.actual_duration - step.target_duration) > (step.duration_tolerance || 0) ? 'danger' : undefined}
                        style={{ fontWeight: 600 }}
                      >→ {formatDuration(step.actual_duration)}</Text>
                    )}
                  </Space>
                </Space>
              </Col>
            )}
            {step.stirring_speed !== null && (
              <Col xs={12} md={8}>
                <Space direction="vertical" size={0}>
                  <Text type="secondary" style={{ fontSize: 12 }}>搅拌转速</Text>
                  <Space>
                    <Text strong>{step.stirring_speed}rpm</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>±{step.speed_tolerance}rpm</Text>
                    {step.actual_stirring_speed !== null && (
                      <Text
                        type={Math.abs(step.actual_stirring_speed - step.stirring_speed) > (step.speed_tolerance || 0) ? 'danger' : undefined}
                        style={{ fontWeight: 600 }}
                      >→ {step.actual_stirring_speed}rpm</Text>
                    )}
                  </Space>
                </Space>
              </Col>
            )}
            {(step.start_time || step.end_time) && (
              <Col span={24}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <ClockCircleOutlined /> {formatTime(step.start_time)} ~ {formatTime(step.end_time)}
                </Text>
              </Col>
            )}
            {step.remark && (
              <Col span={24}>
                <Alert type="info" showIcon message={step.remark} style={{ fontSize: 12 }} />
              </Col>
            )}
            {step.has_deviation && step.deviation_details && (
              <Col span={24}>
                <Alert
                  type="error"
                  showIcon
                  message={
                    <Space wrap>
                      {step.deviation_details.map((d, i) => (
                        <Tag key={i} color="red">
                          {getParameterLabel(d.parameter)}: 偏差{d.deviation} ({d.deviation_percentage}%)
                        </Tag>
                      ))}
                      <Text type="danger">扣分: -{step.deviation_deduction}</Text>
                    </Space>
                  }
                />
              </Col>
            )}
            {actions.length > 0 && (
              <Col span={24}>
                <Space>{actions}</Space>
              </Col>
            )}
          </Row>
        </Card>
      </Timeline.Item>
    );
  };

  const compareTableCols = [
    { title: '步骤', dataIndex: 'step_order', key: 'step_order', width: 80, fixed: 'left' as const },
    { title: '工序', dataIndex: 'step_name', key: 'step_name', width: 140, fixed: 'left' as const },
    { title: '参数', dataIndex: 'parameter', key: 'parameter', width: 100, render: (p: string) => getParameterLabel(p) },
    {
      title: `${compareData?.left_batch_number || '批次A'}`,
      dataIndex: 'left_value', key: 'left_value', width: 120,
      render: (v: any, r: any) => (
        <Text type={r.has_diff ? 'warning' : undefined}>{v ?? '-'}</Text>
      )
    },
    {
      title: `${compareData?.right_batch_number || '批次B'}`,
      dataIndex: 'right_value', key: 'right_value', width: 120,
      render: (v: any, r: any) => (
        <Text type={r.has_diff ? 'warning' : undefined}>{v ?? '-'}</Text>
      )
    },
    { title: '目标值', dataIndex: 'target_value', key: 'target_value', width: 100, render: (v: any) => v ?? '-' },
    {
      title: '差异',
      dataIndex: 'difference', key: 'difference', width: 100,
      render: (v: any, r: any) => (
        <Tag color={r.diff_level === 'significant' ? 'red' : r.diff_level === 'minor' ? 'orange' : 'default'}>
          {v ?? '-'}
        </Tag>
      )
    },
  ];

  return (
    <div>
      <Row gutter={[16, 16]}>
        {!hideBatchSelector && (
          <Col xs={24} lg={8}>
            <Card size="small" title={<Space><FileDoneOutlined />批次选择</Space>}>
              <Form.Item label="选择批次" style={{ marginBottom: 12 }}>
                <Select
                  style={{ width: '100%' }}
                  placeholder="请选择要查看的批次"
                  value={selectedBatchId}
                  onChange={setSelectedBatchId}
                  optionFilterProp="label"
                >
                  {versionBatches.length === 0 ? (
                    <Select.Option value={null} disabled>该版本暂无批次</Select.Option>
                  ) : versionBatches.map(b => (
                    <Select.Option key={b.id} value={b.id} label={b.batch_number}>
                      <Space>
                        <Text>{b.batch_number}</Text>
                        <Tag color="blue">{b.production_date.toString()}</Tag>
                        {b.overall_score && <Tag color="green">综合{b.overall_score.toFixed(1)}</Tag>}
                      </Space>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              {execution && (
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Descriptions size="small" column={1} bordered>
                    <Descriptions.Item label="工艺卡">
                      <Space>
                        <Text strong>{execution.process_card_name}</Text>
                        <Tag color="blue">{execution.process_card_style}</Tag>
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="操作员">{execution.operator}</Descriptions.Item>
                  <Descriptions.Item label="状态">
                    <Tag color={getStatusColor(execution.status)}>{getStatusLabel(execution.status)}</Tag>
                    {execution.was_interrupted && <Tag color="orange" icon={<PauseCircleOutlined />}>有中断记录</Tag>}
                  </Descriptions.Item>
                </Descriptions>

                {execution.status === 'in_progress' && (
                  <Popconfirm
                    title="确定要中断当前执行？"
                    onConfirm={() => setInterruptModal(true)}
                    okText="确认中断"
                    cancelText="取消"
                  >
                    <Button danger block icon={<PauseCircleOutlined />}>中断执行</Button>
                  </Popconfirm>
                )}
                {execution.status === 'interrupted' && (
                  <Button
                    type="primary"
                    block
                    icon={<SyncOutlined />}
                    onClick={handleResume}
                    loading={loading}
                  >恢复执行</Button>
                )}
              </Space>
            )}
          </Card>
        </Col>
        )}

        <Col xs={24} lg={hideBatchSelector ? 24 : 16}>
          <Card
            size="small"
            style={{ marginBottom: 16 }}
            title={
              <Space wrap>
                <SwapOutlined />
                <Text strong>选择对比批次</Text>
              </Space>
            }
          >
            <Row gutter={[16, 8]}>
              <Col xs={24} md={12}>
                <Space size={8} style={{ width: '100%' }}>
                  <Text type="secondary" style={{ minWidth: 80 }}>当前批次:</Text>
                  <Tag color="geekblue" style={{ fontSize: 13 }}>
                    {execution?.batch_number || selectedBatchId || '-'}
                  </Tag>
                </Space>
              </Col>
              <Col xs={24} md={12}>
                <Space size={8} style={{ width: '100%' }}>
                  <Text type="secondary" style={{ minWidth: 80 }}>对比批次:</Text>
                  <Select
                    style={{ flex: 1, minWidth: 200 }}
                    placeholder="选择对比批次（可选）"
                    value={compareBatchId}
                    onChange={setCompareBatchId}
                    allowClear
                    optionFilterProp="label"
                  >
                    {allBatches
                      .filter(b => b.id !== selectedBatchId)
                      .map(b => (
                        <Select.Option key={b.id} value={b.id} label={b.batch_number}>
                          <Space>
                            <Text>{b.batch_number}</Text>
                            <Tag color="blue">{b.production_date.toString()}</Tag>
                          </Space>
                        </Select.Option>
                      ))}
                  </Select>
                </Space>
              </Col>
            </Row>
          </Card>

          <Card
            size="small"
            title={
              <Space wrap>
                <DashboardOutlined />
                <Text strong>工艺执行概览</Text>
                {execution && <Tag color="geekblue">{execution.batch_number}</Tag>}
                <Button
                  type="text"
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => selectedBatchId && loadExecution(selectedBatchId)}
                >刷新</Button>
              </Space>
            }
            loading={execLoading}
          >
            {!execution ? (
              <Empty
                description={
                  <Space direction="vertical">
                    <Text>该批次暂无工艺执行记录</Text>
                    <Text type="secondary">可通过创建工艺卡并生成执行任务来开始</Text>
                  </Space>
                }
              />
            ) : (
              <>
                <Row gutter={[16, 12]}>
                  <Col xs={24} sm={8}>
                    <Card size="small" style={{ height: '100%' }}>
                      <Progress
                        type="circle"
                        percent={progressInfo.percent}
                        format={() => (
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 20, fontWeight: 700 }}>{progressInfo.completed}/{progressInfo.total}</div>
                            <div style={{ fontSize: 11, color: '#8c8c8c' }}>工序完成</div>
                          </div>
                        )}
                        width={120}
                        strokeColor={progressInfo.percent === 100 ? '#52c41a' : '#1890ff'}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card size="small" style={{ height: '100%' }}>
                      <Progress
                        type="circle"
                        percent={execution.consistency_score ?? 0}
                        format={(p) => (
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 20, fontWeight: 700, color: getConsistencyColor(execution.consistency_score) }}>
                              {execution.consistency_score ?? '-'}
                            </div>
                            <div style={{ fontSize: 11, color: '#8c8c8c' }}>一致性评分</div>
                          </div>
                        )}
                        width={120}
                        strokeColor={getConsistencyColor(execution.consistency_score)}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card size="small" style={{ height: '100%' }}>
                      <Row gutter={[8, 8]}>
                        <Col span={24}>
                          <Statistic
                            title="工艺偏差数"
                            value={execution.total_deviation_count}
                            valueStyle={{ color: execution.total_deviation_count > 0 ? '#f5222d' : '#52c41a', fontSize: 24 }}
                            prefix={execution.total_deviation_count > 0 ? <WarningOutlined /> : <CheckCircleOutlined />}
                          />
                        </Col>
                        <Col span={24}>
                          <Divider style={{ margin: '4px 0' }} />
                          <Space direction="vertical" size={2} style={{ width: '100%' }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>开始时间</Text>
                            <Text strong style={{ fontSize: 13 }}>{formatTime(execution.started_at)}</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>结束时间</Text>
                            <Text strong style={{ fontSize: 13 }}>{formatTime(execution.completed_at)}</Text>
                          </Space>
                        </Col>
                      </Row>
                    </Card>
                  </Col>
                </Row>

                <Divider />

                <Row gutter={[16, 12]}>
                  <Col xs={24} md={14}>
                    <Title level={5} style={{ marginTop: 0 }}>
                      <Space><DiffOutlined />参数达标雷达</Space>
                    </Title>
                    <ResponsiveContainer width="100%" height={220}>
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <Radar
                          name="本批次"
                          dataKey="A"
                          stroke={getConsistencyColor(execution.consistency_score)}
                          fill={getConsistencyColor(execution.consistency_score)}
                          fillOpacity={0.5}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </Col>
                  <Col xs={24} md={10}>
                    <Title level={5} style={{ marginTop: 0 }}>
                      <Space><ThunderboltOutlined />偏差统计</Space>
                    </Title>
                    {timeline ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={paramChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <ReTooltip />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="目标温度" fill="#1890ff" />
                          <Bar dataKey="实际温度" fill="#52c41a" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
                  </Col>
                </Row>
              </>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={compareData ? 14 : 24}>
          <Card
            size="small"
            title={
              <Space wrap>
                <ClockCircleOutlined />
                <Text strong>工序执行时间线</Text>
                {execution && execution.interruption_reason && (
                  <Tag color="orange">中断原因: {execution.interruption_reason}</Tag>
                )}
              </Space>
            }
            loading={timelineLoading}
          >
            {!execution || execution.step_executions.length === 0 ? (
              <Empty description="暂无工序数据" />
            ) : (
              <Timeline mode="left" style={{ padding: 8 }}>
                {execution.step_executions.map(renderStepTimelineItem)}
              </Timeline>
            )}
          </Card>
        </Col>

        {compareData && (
          <Col xs={24} lg={10}>
            <Card
              size="small"
              title={
                <Space wrap>
                  <SwapOutlined />
                  <Text strong>工艺轨迹对比</Text>
                </Space>
              }
              loading={compareLoading}
              extra={
                <Space>
                  <Badge status="processing" text={`差异率: ${compareData.summary.difference_rate_percentage}%`} />
                </Space>
              }
            >
              <Descriptions size="small" column={2} bordered style={{ marginBottom: 12 }}>
                <Descriptions.Item label={`${compareData.left_batch_number}评分`}>
                  <Text strong style={{ color: getConsistencyColor(compareData.left_consistency_score) }}>
                    {compareData.left_consistency_score ?? '-'}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label={`${compareData.right_batch_number}评分`}>
                  <Text strong style={{ color: getConsistencyColor(compareData.right_consistency_score) }}>
                    {compareData.right_consistency_score ?? '-'}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="差异参数">
                  <Tag color="blue">温度{compareData.summary.temperature_differences}处</Tag>
                  <Tag color="cyan">时长{compareData.summary.duration_differences}处</Tag>
                  <Tag color="purple">转速{compareData.summary.speed_differences}处</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="重大差异步骤">
                  {compareData.significant_diff_steps.length > 0 ? (
                    compareData.significant_diff_steps.map(s => <Tag color="red" key={s}>步骤{s}</Tag>)
                  ) : <Text type="secondary">无</Text>}
                </Descriptions.Item>
              </Descriptions>

              <Title level={5} style={{ marginTop: 0 }}>参数差异柱状图</Title>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={compareChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="step" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <ReTooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="温度差" name="温度差(℃)" fill="#f5222d" />
                  <Bar dataKey="时长差" name="时长差(分)" fill="#fa8c16" />
                  <Bar dataKey="转速差" name="转速差(rpm)" fill="#722ed1" />
                </BarChart>
              </ResponsiveContainer>

              <Divider style={{ margin: '12px 0' }} />

              <Title level={5}>差异明细</Title>
              <Table
                size="small"
                columns={compareTableCols}
                dataSource={compareData.step_diffs.filter(r => r.has_diff)}
                pagination={{ pageSize: 5, size: 'small' }}
                rowKey={(r: any) => `${r.step_order}-${r.parameter}`}
                scroll={{ x: 700 }}
                locale={{ emptyText: '未检测到显著差异' }}
              />
            </Card>
          </Col>
        )}
      </Row>

      {timeline && timeline.timeline_events.length > 0 && (
        <Card
          size="small"
          title={
            <Space>
              <EnvironmentOutlined />
              <Text strong>完整事件时间轴（工艺回放）</Text>
            </Space>
          }
          style={{ marginTop: 16 }}
        >
          <Collapse defaultActiveKey={['timeline']} ghost>
            <Panel
              header={`${timeline.timeline_events.length} 个事件 · 点击展开`}
              key="timeline"
            >
              <Timeline>
                {timeline.timeline_events.map((evt, idx) => {
                  let color = 'blue';
                  let icon: React.ReactNode = null;
                  if (evt.event_type.includes('complete')) { color = 'green'; icon = <CheckCircleOutlined />; }
                  else if (evt.event_type.includes('start')) { color = 'blue'; icon = <PlayCircleOutlined />; }
                  else if (evt.event_type.includes('interrupt')) { color = 'orange'; icon = <PauseCircleOutlined />; }
                  else if (evt.event_type.includes('resume')) { color = 'cyan'; icon = <SyncOutlined />; }
                  return (
                    <Timeline.Item key={idx} color={color} dot={icon}>
                      <Space direction="vertical" size={0}>
                        <Text strong>{formatTime(evt.timestamp)}</Text>
                        <Text>{evt.description}</Text>
                        {evt.extra?.deviations && (
                          <Space wrap>
                            {evt.extra.deviations.map((d: any, i: number) => (
                              <Tag key={i} color="red">
                                {getParameterLabel(d.parameter)}偏差{d.deviation}({d.deviation_percentage}%)
                              </Tag>
                            ))}
                          </Space>
                        )}
                      </Space>
                    </Timeline.Item>
                  );
                })}
              </Timeline>
            </Panel>
          </Collapse>
        </Card>
      )}

      <Modal
        title={`完成工序：${currentStep?.name}`}
        open={completeModal}
        onCancel={() => { setCompleteModal(false); completeForm.resetFields(); }}
        footer={null}
        width={560}
      >
        <Form
          form={completeForm}
          layout="vertical"
          onFinish={handleCompleteStep}
        >
          <Row gutter={12}>
            {currentStep?.target_temperature !== null && currentStep?.target_temperature !== undefined && (
              <Col span={12}>
                <Form.Item
                  label={`实际温度（目标 ${currentStep.target_temperature}±${currentStep.temperature_tolerance}℃）`}
                  name="actual_temperature"
                  rules={[{ required: true, message: '请输入实际温度' }]}
                >
                  <InputNumber min={0} max={200} step={0.5} style={{ width: '100%' }} addonAfter="℃" />
                </Form.Item>
              </Col>
            )}
            <Col span={12}>
              <Form.Item
                label={`实际时长（目标 ${formatDuration(currentStep?.target_duration)}±${formatDuration(currentStep?.duration_tolerance)}）`}
                name="actual_duration"
                rules={[{ required: true, message: '请输入实际时长' }]}
              >
                <InputNumber min={1} step={10} style={{ width: '100%' }} addonAfter="秒" />
              </Form.Item>
            </Col>
            {currentStep?.stirring_speed !== null && currentStep?.stirring_speed !== undefined && (
              <Col span={12}>
                <Form.Item
                  label={`实际转速（目标 ${currentStep.stirring_speed}±${currentStep.speed_tolerance}rpm）`}
                  name="actual_stirring_speed"
                  rules={[{ required: true, message: '请输入实际转速' }]}
                >
                  <InputNumber min={0} max={10000} step={10} style={{ width: '100%' }} addonAfter="rpm" />
                </Form.Item>
              </Col>
            )}
            {currentStep?.requires_photo && (
              <Col span={12}>
                <Form.Item
                  label="照片URL"
                  name="photo_url"
                  rules={[{ required: true, message: '该步骤要求拍照确认' }]}
                >
                  <Input placeholder="请上传照片或输入照片链接" prefix={<CameraOutlined />} />
                </Form.Item>
              </Col>
            )}
            <Col span={24}>
              <Form.Item label="备注" name="remark">
                <Input.TextArea rows={2} placeholder="记录工序中的特殊情况" />
              </Form.Item>
            </Col>
          </Row>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => { setCompleteModal(false); completeForm.resetFields(); }}>取消</Button>
            <Button type="primary" htmlType="submit" icon={<CheckCircleOutlined />} loading={loading}>
              确认完成
            </Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        title="中断当前工艺执行"
        open={interruptModal}
        onCancel={() => { setInterruptModal(false); interruptForm.resetFields(); }}
        footer={null}
        width={480}
      >
        <Form
          form={interruptForm}
          layout="vertical"
          onFinish={handleInterrupt}
        >
          <Alert
            type="warning"
            showIcon
            message="中断后可以恢复继续执行"
            description="中断期间系统会记录中断时间点，恢复后会从当前工序继续"
            style={{ marginBottom: 16 }}
          />
          <Form.Item
            label="中断原因"
            name="reason"
            rules={[{ required: true, message: '请填写中断原因' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="例如：临时停电/设备故障/换班交接..."
            />
          </Form.Item>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => { setInterruptModal(false); interruptForm.resetFields(); }}>取消</Button>
            <Button danger htmlType="submit" icon={<PauseCircleOutlined />} loading={loading}>
              确认中断
            </Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        title={`工序详情：步骤${detailStep?.step_order} ${detailStep?.name}`}
        open={stepDetailModal}
        onCancel={() => { setStepDetailModal(false); setDetailStep(null); }}
        footer={[
          <Button key="close" onClick={() => { setStepDetailModal(false); setDetailStep(null); }}>
            关闭
          </Button>
        ]}
        width={640}
      >
        {detailStep && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Row gutter={12}>
              <Col span={12}>
                <Statistic
                  title="工序状态"
                  value={getStatusLabel(detailStep.status)}
                  valueStyle={{ color: getStatusColor(detailStep.status), fontSize: 18 }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="工艺偏差"
                  value={detailStep.has_deviation ? '存在' : '无'}
                  valueStyle={{ color: detailStep.has_deviation ? '#f5222d' : '#52c41a', fontSize: 18 }}
                  prefix={detailStep.has_deviation ? <WarningOutlined /> : <CheckCircleOutlined />}
                />
              </Col>
            </Row>

            <Descriptions size="small" bordered column={2} title="工艺参数对比">
              <Descriptions.Item label="温度">
                <Space>
                  <Text>目标: {detailStep.target_temperature ?? '-'}℃</Text>
                  <Text type="secondary">±{detailStep.temperature_tolerance}℃</Text>
                </Space>
                <br />
                <Text strong={detailStep.has_deviation} type={detailStep.has_deviation && detailStep.deviation_details?.some(d => d.parameter === 'temperature') ? 'danger' : undefined}>
                  实际: {detailStep.actual_temperature ?? '-'}℃
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="时长">
                <Space>
                  <Text>目标: {formatDuration(detailStep.target_duration)}</Text>
                  <Text type="secondary">±{formatDuration(detailStep.duration_tolerance)}</Text>
                </Space>
                <br />
                <Text strong type={detailStep.has_deviation && detailStep.deviation_details?.some(d => d.parameter === 'duration') ? 'danger' : undefined}>
                  实际: {formatDuration(detailStep.actual_duration)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="转速">
                <Space>
                  <Text>目标: {detailStep.stirring_speed ?? '-'}rpm</Text>
                  <Text type="secondary">±{detailStep.speed_tolerance}rpm</Text>
                </Space>
                <br />
                <Text strong type={detailStep.has_deviation && detailStep.deviation_details?.some(d => d.parameter === 'speed') ? 'danger' : undefined}>
                  实际: {detailStep.actual_stirring_speed ?? '-'}rpm
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="执行时间">
                <Text>{formatTime(detailStep.start_time)} ~ {formatTime(detailStep.end_time)}</Text>
              </Descriptions.Item>
            </Descriptions>

            {detailStep.notes && (
              <Alert
                type="info"
                showIcon
                message="工艺卡操作说明"
                description={detailStep.notes}
              />
            )}
            {detailStep.remark && (
              <Alert
                type="info"
                showIcon
                message="执行备注"
                description={detailStep.remark}
              />
            )}
            {detailStep.has_deviation && detailStep.deviation_details && (
              <Alert
                type="error"
                showIcon
                message={
                  <Space>
                    <Text strong>工艺偏差详情</Text>
                    <Text type="danger">共扣 {detailStep.deviation_deduction} 分</Text>
                  </Space>
                }
                description={
                  <Space wrap direction="vertical" style={{ width: '100%' }}>
                    {detailStep.deviation_details.map((d, i) => (
                      <Tag color="red" key={i} style={{ margin: 0 }}>
                        {getParameterLabel(d.parameter)} 偏差 {d.deviation}（超出{d.deviation_percentage}%）
                      </Tag>
                    ))}
                  </Space>
                }
              />
            )}
            {detailStep.interrupted_at && (
              <Alert
                type="warning"
                showIcon
                message="中断恢复记录"
                description={
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text>中断于: {formatTime(detailStep.interrupted_at)}</Text>
                    <Text>恢复于: {formatTime(detailStep.resumed_at)}</Text>
                  </Space>
                }
              />
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
}
