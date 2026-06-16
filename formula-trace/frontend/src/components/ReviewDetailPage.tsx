import { useState, useEffect, useMemo } from 'react';
import {
  Layout,
  Menu,
  Space,
  Button,
  Card,
  Tag,
  Table,
  Form,
  Select,
  InputNumber,
  Input,
  message,
  Typography,
  Row,
  Col,
  Divider,
  Progress,
  Statistic,
  Tooltip,
  Popconfirm,
  Tabs,
  Empty,
  Alert,
} from 'antd';
import {
  ArrowLeftOutlined,
  HomeOutlined,
  DatabaseOutlined,
  AuditOutlined,
  PlayCircleOutlined,
  StopOutlined,
  FileTextOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import type {
  ReviewMeeting,
  FormulaVersion,
  ReviewScore,
  ReviewDecision,
  ReviewScoreSubmit,
} from '../types';
import {
  api,
  getReviewStatusLabel,
  getReviewStatusTagColor,
  getDecisionLabel,
  getDecisionTagColor,
  getScoreColor,
  getApprovalStatusLabel,
  getApprovalStatusTagColor,
} from '../api';

const { Header, Content, Sider } = Layout;
const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

function ScoreForm({
  meeting,
  versions,
  onSubmitted,
}: {
  meeting: ReviewMeeting;
  versions: FormulaVersion[];
  onSubmitted: () => void;
}) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [selectedJudge, setSelectedJudge] = useState<string>('');
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

  const existingScores = useMemo(() => {
    const map = new Map<string, ReviewScore>();
    meeting.scores.forEach(s => {
      map.set(`${s.judge_name}-${s.version_id}`, s);
    });
    return map;
  }, [meeting.scores]);

  const availableVersions = useMemo(() => {
    if (!selectedJudge) return [];
    return versions.filter(v => !existingScores.has(`${selectedJudge}-${v.id}`));
  }, [selectedJudge, versions, existingScores]);

  useEffect(() => {
    if (selectedVersion && !availableVersions.find(v => v.id === selectedVersion)) {
      setSelectedVersion(availableVersions[0]?.id || null);
    }
  }, [selectedJudge, availableVersions]);

  const handleSubmit = async (values: any) => {
    if (!selectedJudge || !selectedVersion) {
      message.warning('请选择评委和版本');
      return;
    }
    setSubmitting(true);
    try {
      const data: ReviewScoreSubmit = {
        version_id: selectedVersion,
        judge_name: selectedJudge,
        rationality_score: values.rationality_score,
        cost_score: values.cost_score,
        feasibility_score: values.feasibility_score,
        comment: values.comment?.trim() || null,
      };
      await api.submitReviewScore(meeting.id, data);
      message.success('评分提交成功');
      form.resetFields(['rationality_score', 'cost_score', 'feasibility_score', 'comment']);
      setSelectedVersion(null);
      onSubmitted();
    } catch (e: any) {
      const errMsg = e?.response?.data?.detail || '提交失败';
      message.error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
    } finally {
      setSubmitting(false);
    }
  };

  if (meeting.status !== 'ongoing') {
    return <Empty description="会议未开始或已结束，无法提交评分" />;
  }

  return (
    <Card
      title={
        <Space>
          <StarOutlined style={{ color: '#faad14' }} />
          <span>提交评分</span>
        </Space>
      }
      size="small"
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="选择评委"
              rules={[{ required: true, message: '请选择评委' }]}
            >
              <Select
                value={selectedJudge}
                onChange={setSelectedJudge}
                placeholder="请选择评委"
              >
                {meeting.judges.map(j => (
                  <Option key={j} value={j}>{j}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="选择版本"
              rules={[{ required: true, message: '请选择版本' }]}
            >
              <Select
                value={selectedVersion}
                onChange={setSelectedVersion}
                placeholder="请选择待评审版本"
                disabled={!selectedJudge}
              >
                {availableVersions.map(v => (
                  <Option key={v.id} value={v.id}>
                    V{v.version_number} - {v.ingredients_summary}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="rationality_score"
              label="配方合理性 (1-10)"
              rules={[{ required: true, message: '请输入评分' }]}
            >
              <InputNumber
                min={1}
                max={10}
                step={0.5}
                precision={1}
                style={{ width: '100%' }}
                placeholder="1-10分"
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="cost_score"
              label="成本可控性 (1-10)"
              rules={[{ required: true, message: '请输入评分' }]}
            >
              <InputNumber
                min={1}
                max={10}
                step={0.5}
                precision={1}
                style={{ width: '100%' }}
                placeholder="1-10分"
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="feasibility_score"
              label="工艺可行性 (1-10)"
              rules={[{ required: true, message: '请输入评分' }]}
            >
              <InputNumber
                min={1}
                max={10}
                step={0.5}
                precision={1}
                style={{ width: '100%' }}
                placeholder="1-10分"
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="comment"
          label="评审意见"
        >
          <TextArea
            rows={3}
            placeholder="请输入评审意见（可选）"
            maxLength={1000}
            showCount
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
          <Button type="primary" htmlType="submit" loading={submitting}>
            提交评分
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}

function ScoreTable({ meeting, versions }: { meeting: ReviewMeeting; versions: FormulaVersion[] }) {
  const judgeScoresByVersion = useMemo(() => {
    const map = new Map<number, Map<string, ReviewScore>>();
    meeting.scores.forEach(s => {
      if (!map.has(s.version_id)) {
        map.set(s.version_id, new Map());
      }
      map.get(s.version_id)!.set(s.judge_name, s);
    });
    return map;
  }, [meeting.scores]);

  const getScoreCell = (versionId: number, judgeName: string) => {
    const judgeScores = judgeScoresByVersion.get(versionId);
    const score = judgeScores?.get(judgeName);
    if (!score) {
      return <Text type="secondary" style={{ fontSize: 12 }}>未提交</Text>;
    }
    const avg = (score.rationality_score + score.cost_score + score.feasibility_score) / 3;
    return (
      <Tooltip title={
        <Space direction="vertical" size={4} style={{ fontSize: 12 }}>
          <div>合理性: {score.rationality_score}</div>
          <div>成本: {score.cost_score}</div>
          <div>工艺: {score.feasibility_score}</div>
          {score.comment && <div>意见: {score.comment}</div>}
        </Space>
      }>
        <Space direction="vertical" size={0} align="center">
          <Text strong style={{ color: getScoreColor(avg), fontSize: 16 }}>
            {avg.toFixed(1)}
          </Text>
          <Text type="secondary" style={{ fontSize: 10 }}>
            {score.rationality_score}/{score.cost_score}/{score.feasibility_score}
          </Text>
        </Space>
      </Tooltip>
    );
  };

  const columns = [
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 180,
      fixed: 'left' as const,
      render: (v: FormulaVersion) => (
        <Space direction="vertical" size={0}>
          <Text strong>V{v.version_number}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{v.ingredients_summary}</Text>
        </Space>
      ),
    },
    ...meeting.judges.map(judge => ({
      title: (
        <Space direction="vertical" size={0} align="center">
          <Text strong>{judge}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>评委</Text>
        </Space>
      ),
      key: judge,
      width: 120,
      align: 'center' as const,
      render: (_: any, record: { version: FormulaVersion }) =>
        getScoreCell(record.version.id, judge),
    })),
    {
      title: '平均分',
      key: 'avg',
      width: 100,
      fixed: 'right' as const,
      align: 'center' as const,
      render: (_: any, record: { version: FormulaVersion }) => {
        const judgeScores = judgeScoresByVersion.get(record.version.id);
        if (!judgeScores || judgeScores.size === 0) {
          return <Text type="secondary">-</Text>;
        }
        const scores = Array.from(judgeScores.values());
        const totalAvg = scores.reduce((sum, s) => {
          const avg = (s.rationality_score + s.cost_score + s.feasibility_score) / 3;
          return sum + avg;
        }, 0) / scores.length;
        return (
          <Text strong style={{ color: getScoreColor(totalAvg), fontSize: 16 }}>
            {totalAvg.toFixed(2)}
          </Text>
        );
      },
    },
  ];

  const dataSource = versions.map(v => ({ key: v.id, version: v }));

  const submittedCount = meeting.scores.length;
  const totalCount = meeting.judges.length * versions.length;

  return (
    <Card
      title={
        <Space>
          <TeamOutlined style={{ color: '#722ed1' }} />
          <span>评委评分表</span>
          <Tag color={submittedCount === totalCount ? 'success' : 'processing'}>
            已提交 {submittedCount}/{totalCount}
          </Tag>
        </Space>
      }
      size="small"
    >
      <Table
        size="small"
        dataSource={dataSource}
        columns={columns}
        pagination={false}
        scroll={{ x: 800 }}
      />
    </Card>
  );
}

function DecisionSummary({
  decisions,
  versions,
}: {
  decisions: ReviewDecision[];
  versions: FormulaVersion[];
}) {
  const columns = [
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 160,
      render: (v: FormulaVersion) => (
        <Space direction="vertical" size={0}>
          <Text strong>V{v.version_number}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{v.ingredients_summary}</Text>
        </Space>
      ),
    },
    {
      title: '配方合理性',
      dataIndex: 'avg_rationality',
      key: 'avg_rationality',
      width: 120,
      align: 'center' as const,
      render: (v: number) => (
        <Space direction="vertical" size={0} align="center">
          <Progress
            type="dashboard"
            percent={v * 10}
            width={50}
            strokeColor={getScoreColor(v)}
            format={() => v.toFixed(1)}
          />
        </Space>
      ),
    },
    {
      title: '成本可控性',
      dataIndex: 'avg_cost',
      key: 'avg_cost',
      width: 120,
      align: 'center' as const,
      render: (v: number) => (
        <Progress
          type="dashboard"
          percent={v * 10}
          width={50}
          strokeColor={getScoreColor(v)}
          format={() => v.toFixed(1)}
        />
      ),
    },
    {
      title: '工艺可行性',
      dataIndex: 'avg_feasibility',
      key: 'avg_feasibility',
      width: 120,
      align: 'center' as const,
      render: (v: number) => (
        <Progress
          type="dashboard"
          percent={v * 10}
          width={50}
          strokeColor={getScoreColor(v)}
          format={() => v.toFixed(1)}
        />
      ),
    },
    {
      title: '综合得分',
      dataIndex: 'final_score',
      key: 'final_score',
      width: 120,
      align: 'center' as const,
      render: (v: number) => (
        <Space direction="vertical" size={0} align="center">
          <Text strong style={{ color: getScoreColor(v), fontSize: 20 }}>
            {v.toFixed(2)}
          </Text>
        </Space>
      ),
    },
    {
      title: '决策结论',
      dataIndex: 'decision',
      key: 'decision',
      width: 140,
      align: 'center' as const,
      render: (v: string, record: any) => {
        const version = record.version as FormulaVersion;
        const decision = decisions.find(d => d.version_id === version.id);
        const icon = v === 'approve' ? <CheckCircleOutlined /> :
                     v === 'conditional' ? <ExclamationCircleOutlined /> :
                     <CloseCircleOutlined />;
        return (
          <Space direction="vertical" size={4} align="center">
            <Tag
              color={getDecisionTagColor(v)}
              icon={icon}
              style={{ fontSize: 14, padding: '4px 12px' }}
            >
              {getDecisionLabel(v)}
            </Tag>
            {decision && (
              <Tag color={getApprovalStatusTagColor(version.approval_status)} style={{ fontSize: 11 }}>
                审批状态: {getApprovalStatusLabel(version.approval_status)}
              </Tag>
            )}
          </Space>
        );
      },
    },
  ];

  const dataSource = versions.map(v => {
    const decision = decisions.find(d => d.version_id === v.id);
    return {
      key: v.id,
      version: v,
      avg_rationality: decision?.avg_rationality || 0,
      avg_cost: decision?.avg_cost || 0,
      avg_feasibility: decision?.avg_feasibility || 0,
      final_score: decision?.final_score || 0,
      decision: decision?.decision || '',
    };
  });

  const approvedCount = decisions.filter(d => d.decision === 'approve').length;
  const conditionalCount = decisions.filter(d => d.decision === 'conditional').length;
  const rejectedCount = decisions.filter(d => d.decision === 'reject').length;

  return (
    <Card
      title={
        <Space>
          <AuditOutlined style={{ color: '#1890ff' }} />
          <span>决策汇总</span>
        </Space>
      }
      size="small"
    >
      <Row gutter={24} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small" style={{ textAlign: 'center', borderColor: '#52c41a' }}>
            <Statistic
              title="通过"
              value={approvedCount}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>自动提交审批</Text>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" style={{ textAlign: 'center', borderColor: '#faad14' }}>
            <Statistic
              title="有条件通过"
              value={conditionalCount}
              valueStyle={{ color: '#faad14' }}
              prefix={<ExclamationCircleOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>需完善后再提交</Text>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" style={{ textAlign: 'center', borderColor: '#f5222d' }}>
            <Statistic
              title="否决"
              value={rejectedCount}
              valueStyle={{ color: '#f5222d' }}
              prefix={<CloseCircleOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>记录否决意见</Text>
          </Card>
        </Col>
      </Row>

      <Table
        size="small"
        dataSource={dataSource}
        columns={columns}
        pagination={false}
      />

      <Alert
        type="info"
        showIcon
        message="决策说明"
        description={
          <div style={{ fontSize: 12 }}>
            <div>• <Text strong>通过</Text>：平均分 {'≥'} 8，版本自动从「草稿/已驳回」提交至「待审批」</div>
            <div>• <Text strong>有条件通过</Text>：6 {'≤'} 平均分 {'<'} 8，需研发根据评委意见完善后手动提交</div>
            <div>• <Text strong>否决</Text>：平均分 {'<'} 6，记录否决意见，不改变审批状态</div>
          </div>
        }
        style={{ marginTop: 16 }}
      />
    </Card>
  );
}

function VersionComments({ meeting, versions }: { meeting: ReviewMeeting; versions: FormulaVersion[] }) {
  const [activeTab, setActiveTab] = useState<string>(String(versions[0]?.id || ''));

  const items = versions.map(v => {
    const versionScores = meeting.scores.filter(s => s.version_id === v.id);
    return {
      key: String(v.id),
      label: `V${v.version_number} - ${v.ingredients_summary}`,
      children: (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {versionScores.length === 0 ? (
            <Empty description="暂无评审意见" />
          ) : (
            versionScores.map((score, idx) => (
              <Card key={idx} size="small">
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                      <Tag color="blue">{score.judge_name}</Tag>
                      <Space size={16}>
                        <Text type="secondary">
                          合理性: <Text strong style={{ color: getScoreColor(score.rationality_score) }}>{score.rationality_score}</Text>
                        </Text>
                        <Text type="secondary">
                          成本: <Text strong style={{ color: getScoreColor(score.cost_score) }}>{score.cost_score}</Text>
                        </Text>
                        <Text type="secondary">
                          工艺: <Text strong style={{ color: getScoreColor(score.feasibility_score) }}>{score.feasibility_score}</Text>
                        </Text>
                      </Space>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {new Date(score.created_at).toLocaleString('zh-CN')}
                    </Text>
                  </div>
                  {score.comment && (
                    <Paragraph style={{ margin: 0, padding: 8, background: '#f5f7fa', borderRadius: 4 }}>
                      {score.comment}
                    </Paragraph>
                  )}
                </Space>
              </Card>
            ))
          )}
        </Space>
      ),
    };
  });

  return (
    <Card
      title={
        <Space>
          <FileTextOutlined style={{ color: '#1890ff' }} />
          <span>评审意见</span>
        </Space>
      }
      size="small"
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={items} />
    </Card>
  );
}

export default function ReviewDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const [meeting, setMeeting] = useState<ReviewMeeting | null>(null);
  const [versions, setVersions] = useState<FormulaVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const menuItems = [
    { key: '/', icon: <HomeOutlined />, label: '配方管理' },
    { key: '/reviews', icon: <AuditOutlined />, label: '评审会议' },
    { key: '/inventory', icon: <DatabaseOutlined />, label: '库存管理' },
  ];

  useEffect(() => {
    if (id) {
      loadMeeting(parseInt(id));
    }
  }, [id]);

  const loadMeeting = async (meetingId: number) => {
    setLoading(true);
    try {
      const data = await api.getReviewMeeting(meetingId);
      setMeeting(data);
      const versionDetails = await Promise.all(
        data.version_ids.map(vid => api.getVersion(vid))
      );
      setVersions(versionDetails);
    } catch (e) {
      message.error('加载会议详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (!meeting) return;
    setActionLoading(true);
    try {
      await api.startReviewMeeting(meeting.id);
      message.success('会议已开始，评委可以开始评分');
      loadMeeting(meeting.id);
    } catch (e: any) {
      const errMsg = e?.response?.data?.detail || '操作失败';
      message.error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
    } finally {
      setActionLoading(false);
    }
  };

  const handleEnd = async () => {
    if (!meeting) return;
    setActionLoading(true);
    try {
      await api.endReviewMeeting(meeting.id);
      message.success('会议已结束，已生成决策结论');
      loadMeeting(meeting.id);
    } catch (e: any) {
      const errMsg = e?.response?.data?.detail || '操作失败';
      message.error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
    } finally {
      setActionLoading(false);
    }
  };

  if (!meeting) {
    return <div style={{ padding: 24 }}>加载中...</div>;
  }

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
            selectedKeys={[location.pathname.startsWith('/reviews') ? '/reviews' : location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key as string)}
            style={{ minWidth: 300, background: 'transparent' }}
          />
        </Space>
      </Header>

      <Layout style={{ padding: '20px' }}>
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <Card size="small">
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <Button
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate('/reviews')}
                  >
                    返回列表
                  </Button>
                  <Title level={4} style={{ margin: 0 }}>{meeting.title}</Title>
                  <Tag color={getReviewStatusTagColor(meeting.status)} style={{ fontSize: 14, padding: '4px 12px' }}>
                    {getReviewStatusLabel(meeting.status)}
                  </Tag>
                </Space>
                <Space>
                  {meeting.status === 'pending' && (
                    <Button
                      type="primary"
                      icon={<PlayCircleOutlined />}
                      onClick={handleStart}
                      loading={actionLoading}
                    >
                      开始会议
                    </Button>
                  )}
                  {meeting.status === 'ongoing' && (
                    <Popconfirm
                      title="确认结束会议？"
                      description="结束后将自动计算平均分并生成决策结论，通过的版本将自动提交审批。"
                      onConfirm={handleEnd}
                      okText="确认结束"
                      cancelText="取消"
                    >
                      <Button
                        type="primary"
                        danger
                        icon={<StopOutlined />}
                        loading={actionLoading}
                      >
                        结束会议
                      </Button>
                    </Popconfirm>
                  )}
                </Space>
              </div>

              <Row gutter={24}>
                <Col span={6}>
                  <Card size="small">
                    <Statistic
                      title="评审日期"
                      value={meeting.review_date}
                      prefix={<FileTextOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small">
                    <Statistic
                      title="待评审版本"
                      value={versions.length}
                      prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small">
                    <Statistic
                      title="评委人数"
                      value={meeting.judges.length}
                      prefix={<TeamOutlined style={{ color: '#722ed1' }} />}
                      valueStyle={{ color: '#722ed1' }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small">
                    <Statistic
                      title="已提交评分"
                      value={meeting.scores.length}
                      suffix={`/ ${meeting.judges.length * versions.length}`}
                      prefix={<StarOutlined style={{ color: '#faad14' }} />}
                      valueStyle={{ color: '#faad14' }}
                    />
                  </Card>
                </Col>
              </Row>

              <div>
                <Text strong>评委名单：</Text>
                <Space size={[8, 8]} wrap style={{ marginLeft: 8 }}>
                  {meeting.judges.map((j, idx) => (
                    <Tag key={idx} color="purple">{j}</Tag>
                  ))}
                </Space>
              </div>
            </Space>
          </Card>

          <Layout style={{ background: 'transparent', gap: 20 }}>
            <Sider
              width={320}
              style={{ background: 'white', borderRadius: 8, padding: 16 }}
              theme="light"
            >
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <div style={{ fontWeight: 600 }}>待评审版本成分摘要</div>
                {versions.map(v => (
                  <Card key={v.id} size="small">
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text strong>V{v.version_number}</Text>
                        <Tag color={getApprovalStatusTagColor(v.approval_status)}>
                          {getApprovalStatusLabel(v.approval_status)}
                        </Tag>
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {v.ingredients_summary}
                      </Text>
                      <div style={{ fontSize: 12, color: '#666' }}>
                        共 {v.ingredients.length} 种成分
                      </div>
                      <Divider style={{ margin: '8px 0' }} />
                      {v.ingredients
                        .sort((a, b) => b.percentage - a.percentage)
                        .slice(0, 5)
                        .map((ing, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <span>{ing.name}</span>
                            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                              {ing.percentage.toFixed(2)}%
                            </span>
                          </div>
                        ))}
                      {v.ingredients.length > 5 && (
                        <Text type="secondary" style={{ fontSize: 11, textAlign: 'center', display: 'block' }}>
                          ...还有 {v.ingredients.length - 5} 种成分
                        </Text>
                      )}
                    </Space>
                  </Card>
                ))}
              </Space>
            </Sider>

            <Content style={{ background: 'white', borderRadius: 8, padding: 20 }}>
              <Space direction="vertical" size={20} style={{ width: '100%' }}>
                {meeting.status === 'ongoing' && (
                  <ScoreForm
                    meeting={meeting}
                    versions={versions}
                    onSubmitted={() => id && loadMeeting(parseInt(id))}
                  />
                )}

                <ScoreTable meeting={meeting} versions={versions} />

                {meeting.status === 'ended' && (
                  <DecisionSummary decisions={meeting.decisions} versions={versions} />
                )}

                {meeting.scores.length > 0 && (
                  <VersionComments meeting={meeting} versions={versions} />
                )}
              </Space>
            </Content>
          </Layout>
        </Space>
      </Layout>
    </Layout>
  );
}
