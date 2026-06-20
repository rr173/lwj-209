import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Card, Row, Col, Tabs, Button, Space, Tag, Descriptions, Divider, Typography,
  Table, Image, Empty, message, Spin, Breadcrumb, Tooltip, Progress, Statistic
} from 'antd';
import {
  ArrowLeftOutlined, ReloadOutlined, SafetyOutlined,
  ExperimentOutlined, FileSearchOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import type { Batch, FormulaVersion, IngredientItem } from '../types';
import { api, getScoreColor } from '../api';
import ProcessExecutionPanel from './ProcessExecutionPanel';

const { Title, Text, Paragraph } = Typography;

export default function BatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const batchId = useMemo(() => Number(id), [id]);

  const [batch, setBatch] = useState<Batch | null>(null);
  const [version, setVersion] = useState<FormulaVersion | null>(null);
  const [allBatches, setAllBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);

  const loadBatch = useCallback(async () => {
    if (!batchId) return;
    setLoading(true);
    try {
      const [b, ab] = await Promise.all([
        api.getBatch(batchId),
        (async () => {
          try {
            const pls = await api.getProductLines();
            if (pls.length === 0) return [];
            const batches: Batch[] = [];
            const results = await Promise.all(pls.map(async pl => {
              try { return await api.getVersionBatches(pl.id); }
              catch { return []; }
            }));
            return results.flat();
          } catch { return []; }
        })()
      ]);
      setBatch(b);
      setAllBatches(ab);
      if (b) {
        try {
          const v = await api.getVersion(b.version_id);
          setVersion(v);
        } catch { setVersion(null); }
      }
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '加载批次详情失败');
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    loadBatch();
  }, [loadBatch]);

  const sortedIngredients: IngredientItem[] = useMemo(() => {
    if (!version) return [];
    return [...version.ingredients].sort((a, b) => b.percentage - a.percentage);
  }, [version]);

  const ingCols = [
    {
      title: '排序', dataIndex: 'idx', key: 'idx', width: 70,
      render: (_: any, __: any, idx: number) => <Text type="secondary">#{idx + 1}</Text>
    },
    { title: '成分名称', dataIndex: 'name', key: 'name', width: 180 },
    {
      title: '百分比', dataIndex: 'percentage', key: 'percentage', width: 160,
      render: (p: number) => (
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          <Progress percent={p} showInfo steps={100} size="small" strokeColor={p >= 10 ? '#1890ff' : p >= 1 ? '#52c41a' : '#faad14'} />
          <Text strong>{p.toFixed(2)}%</Text>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1600, margin: '0 auto' }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Space style={{ justifyContent: 'space-between', width: '100%' }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>
            <Breadcrumb
              items={[
                { title: <a onClick={() => navigate('/')}>配方管理</a> },
                { title: version ? `V${version.version_number} 版本` : '批次详情' },
                { title: <Text strong>{batch?.batch_number || `批次 #${batchId}`}</Text> },
              ]}
            />
          </Space>
          <Button icon={<ReloadOutlined />} onClick={loadBatch}>刷新</Button>
        </Space>

        <Spin spinning={loading}>
          {batch ? (
            <>
              <Card
                title={
                  <Space>
                    <Title level={4} style={{ margin: 0 }}>
                      批次详情
                    </Title>
                    <Tag color="geekblue" style={{ fontSize: 14, padding: '2px 10px' }}>
                      {batch.batch_number}
                    </Tag>
                    {version && (
                      <Tag color="blue" style={{ fontSize: 13 }}>
                        基于版本 V{version.version_number}
                      </Tag>
                    )}
                  </Space>
                }
                size="small"
                extra={
                  <Space>
                    <Tag icon={<ExperimentOutlined />} color="purple">
                      生产日期: {batch.production_date.toString()}
                    </Tag>
                    <Tag color="cyan">
                      生产量: {batch.production_amount} kg
                    </Tag>
                  </Space>
                }
              >
                <Row gutter={[16, 12]}>
                  <Col xs={24} md={14}>
                    <Descriptions size="small" bordered column={2}>
                      <Descriptions.Item label="版本号">
                        {version ? (
                          <Space>
                            <Text strong>V{version.version_number}</Text>
                            <Text type="secondary">{version.approval_status}</Text>
                          </Space>
                        ) : <Text type="secondary">-</Text>}
                      </Descriptions.Item>
                      <Descriptions.Item label="产品线">
                        {version ? (
                          <Text strong>美白精华</Text>
                        ) : <Text type="secondary">-</Text>}
                      </Descriptions.Item>
                      <Descriptions.Item label="肤感评分">
                        {batch.skin_feel_score !== null && batch.skin_feel_score !== undefined ? (
                          <Text strong style={{ color: getScoreColor(batch.skin_feel_score) }}>
                            {batch.skin_feel_score.toFixed(1)}
                          </Text>
                        ) : <Tag>待检测</Tag>}
                      </Descriptions.Item>
                      <Descriptions.Item label="稳定性评分">
                        {batch.stability_score !== null && batch.stability_score !== undefined ? (
                          <Text strong style={{ color: getScoreColor(batch.stability_score) }}>
                            {batch.stability_score.toFixed(1)}
                          </Text>
                        ) : <Tag>待检测</Tag>}
                      </Descriptions.Item>
                      <Descriptions.Item label="原料成本">
                        {batch.cost_per_kg !== null && batch.cost_per_kg !== undefined ? (
                          <Text strong>¥{batch.cost_per_kg.toFixed(2)}/kg</Text>
                        ) : <Tag>待核算</Tag>}
                      </Descriptions.Item>
                      <Descriptions.Item label="综合评分">
                        {batch.overall_score !== null && batch.overall_score !== undefined ? (
                          <Space>
                            <Progress
                              type="circle"
                              percent={Math.round(batch.overall_score * 10)}
                              format={() => (
                                <Text strong style={{
                                  color: getScoreColor(batch.overall_score!),
                                  fontSize: 20
                                }}>
                                  {(batch.overall_score!).toFixed(1)}
                                </Text>
                              )}
                              width={52}
                            />
                          </Space>
                        ) : <Tag>待完成</Tag>}
                      </Descriptions.Item>
                    </Descriptions>
                  </Col>

                  <Col xs={24} md={10}>
                    <div style={{
                      padding: 16,
                      background: 'linear-gradient(135deg, #e6f7ff 0%, #f0f5ff 100%)',
                      borderRadius: 8,
                      height: '100%'
                    }}>
                      <Row gutter={[8, 8]}>
                        <Col xs={8}>
                          <Statistic
                            title="成分数"
                            value={sortedIngredients.length}
                            valueStyle={{ fontSize: 22 }}
                            prefix={<FileSearchOutlined style={{ color: '#1890ff' }} />}
                          />
                        </Col>
                        <Col xs={8}>
                          <Statistic
                            title="版本状态"
                            value={version?.approval_status || '-'}
                            valueStyle={{ fontSize: 18 }}
                            prefix={<SafetyOutlined style={{ color: '#52c41a' }} />}
                          />
                        </Col>
                        <Col xs={8}>
                          <Statistic
                            title="批次序号"
                            value={`#${batchId}`}
                            valueStyle={{ fontSize: 22 }}
                            prefix={<ExperimentOutlined style={{ color: '#722ed1' }} />}
                          />
                        </Col>
                      </Row>
                      {version?.ingredients_summary && (
                        <>
                          <Divider style={{ margin: '12px 0' }} />
                          <Text type="secondary" style={{ fontSize: 12 }}>配方摘要:</Text>
                          <Paragraph
                            type="secondary"
                            style={{ fontSize: 12, margin: '4px 0 0 0' }}
                            ellipsis={{ rows: 2 }}
                          >
                            {version.ingredients_summary}
                          </Paragraph>
                        </>
                      )}
                    </div>
                  </Col>
                </Row>
              </Card>

              <Tabs
                defaultActiveKey="process"
                size="large"
                items={[
                  {
                    key: 'process',
                    label: (
                      <span>
                        <SafetyOutlined /> 工艺执行
                      </span>
                    ),
                    children: (
                      version ? (
                        <ProcessExecutionPanel
                          version={version}
                          batches={allBatches.filter(b => b.version_id === version.id)}
                          allBatches={allBatches}
                          preselectedBatchId={batchId}
                        />
                      ) : (
                        <Empty description="版本数据加载失败" />
                      )
                    )
                  },
                  {
                    key: 'formula',
                    label: (
                      <span>
                        <FileSearchOutlined /> 配方成分
                      </span>
                    ),
                    children: (
                      version ? (
                        <Card size="small" title={`V${version.version_number} 配方成分清单（按含量排序）`}>
                          <Table
                            size="small"
                            rowKey="name"
                            columns={ingCols}
                            dataSource={sortedIngredients.map((ing, idx) => ({ ...ing, idx: idx + 1 }))}
                            pagination={false}
                            summary={() => (
                              <Table.Summary fixed>
                                <Table.Summary.Row>
                                  <Table.Summary.Cell index={0} colSpan={2}><Text strong>合计</Text></Table.Summary.Cell>
                                  <Table.Summary.Cell index={1}>
                                    <Text strong style={{ color: '#1890ff' }}>
                                      {sortedIngredients.reduce((acc, i) => acc + i.percentage, 0).toFixed(2)}%
                                    </Text>
                                  </Table.Summary.Cell>
                                </Table.Summary.Row>
                              </Table.Summary>
                            )}
                          />
                        </Card>
                      ) : <Empty description="版本数据未加载" />
                    )
                  },
                  {
                    key: 'info',
                    label: (
                      <span>
                        <ExperimentOutlined /> 检测结果
                      </span>
                    ),
                    children: (
                      <Card size="small">
                        <Row gutter={[16, 16]}>
                          <Col xs={24} md={8}>
                            <Card
                              size="small"
                              style={{
                                height: '100%',
                                border: '2px solid #f0f0f0',
                                borderRadius: 8
                              }}
                              title={<Space><SafetyOutlined style={{ color: '#1890ff' }} />肤感</Space>}
                            >
                              <Progress
                                type="circle"
                                percent={batch.skin_feel_score !== null && batch.skin_feel_score !== undefined
                                  ? Math.round(batch.skin_feel_score * 10)
                                  : 0}
                                format={() => (
                                  <div style={{ textAlign: 'center' }}>
                                    <div style={{
                                      fontSize: 28,
                                      fontWeight: 700,
                                      color: batch.skin_feel_score !== null ? getScoreColor(batch.skin_feel_score) : '#bfbfbf'
                                    }}>
                                      {batch.skin_feel_score !== null
                                        ? batch.skin_feel_score.toFixed(1)
                                        : '-'}
                                    </div>
                                  </div>
                                )}
                                width={120}
                                strokeColor={batch.skin_feel_score !== null
                                  ? getScoreColor(batch.skin_feel_score)
                                  : '#bfbfbf'}
                              />
                            </Card>
                          </Col>
                          <Col xs={24} md={8}>
                            <Card
                              size="small"
                              style={{
                                height: '100%',
                                border: '2px solid #f0f0f0',
                                borderRadius: 8
                              }}
                              title={<Space><SafetyOutlined style={{ color: '#52c41a' }} />稳定性</Space>}
                            >
                              <Progress
                                type="circle"
                                percent={batch.stability_score !== null && batch.stability_score !== undefined
                                  ? Math.round(batch.stability_score * 10)
                                  : 0}
                                format={() => (
                                  <div style={{ textAlign: 'center' }}>
                                    <div style={{
                                      fontSize: 28,
                                      fontWeight: 700,
                                      color: batch.stability_score !== null ? getScoreColor(batch.stability_score) : '#bfbfbf'
                                    }}>
                                      {batch.stability_score !== null
                                        ? batch.stability_score.toFixed(1)
                                        : '-'}
                                    </div>
                                  </div>
                                )}
                                width={120}
                                strokeColor={batch.stability_score !== null
                                  ? getScoreColor(batch.stability_score)
                                  : '#bfbfbf'}
                              />
                            </Card>
                          </Col>
                          <Col xs={24} md={8}>
                            <Card
                              size="small"
                              style={{
                                height: '100%',
                                border: '2px solid #f0f0f0',
                                borderRadius: 8
                              }}
                              title={<Space><SafetyOutlined style={{ color: '#722ed1' }} />综合</Space>}
                            >
                              <Progress
                                type="circle"
                                percent={batch.overall_score !== null && batch.overall_score !== undefined
                                  ? Math.round(batch.overall_score * 10)
                                  : 0}
                                format={() => (
                                  <div style={{ textAlign: 'center' }}>
                                    <div style={{
                                      fontSize: 28,
                                      fontWeight: 700,
                                      color: batch.overall_score !== null ? getScoreColor(batch.overall_score) : '#bfbfbf'
                                    }}>
                                      {batch.overall_score !== null
                                        ? batch.overall_score.toFixed(1)
                                        : '-'}
                                    </div>
                                  </div>
                                )}
                                width={120}
                                strokeColor={batch.overall_score !== null
                                  ? getScoreColor(batch.overall_score)
                                  : '#bfbfbf'}
                              />
                            </Card>
                          </Col>
                          <Col span={24}>
                            <Card size="small" title="成本信息">
                              <Descriptions size="small" column={2} bordered>
                                <Descriptions.Item label="原料成本">
                                  {batch.cost_per_kg !== null && batch.cost_per_kg !== undefined ? (
                                    <Text strong style={{ fontSize: 16 }}>
                                      ¥{batch.cost_per_kg.toFixed(2)} / kg
                                    </Text>
                                  ) : <Tag color="default">待核算</Tag>}
                                </Descriptions.Item>
                                <Descriptions.Item label="生产规模">
                                  <Text strong>{batch.production_amount} kg</Text>
                                </Descriptions.Item>
                                <Descriptions.Item label="批次创建时间" span={2}>
                                  {new Date(batch.production_date.toString() + 'T00:00:00').toLocaleString('zh-CN')}
                                </Descriptions.Item>
                              </Descriptions>
                            </Card>
                          </Col>
                        </Row>
                      </Card>
                    )
                  }
                ]}
              />
            </>
          ) : (
            <Empty
              description={loading ? '加载中...' : '批次不存在'}
              style={{ padding: 100 }}
            />
          )}
        </Spin>
      </Space>
    </div>
  );
}
