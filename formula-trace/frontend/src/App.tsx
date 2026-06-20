import { useState, useEffect, useCallback } from 'react';
import { Layout, Menu, Space, Button, Select, Modal, message, Input, Typography, Form, InputNumber, Alert, Drawer, List, Tag, Popover, Empty } from 'antd';
import { ReloadOutlined, BarChartOutlined, SearchOutlined, DatabaseOutlined, HomeOutlined, AuditOutlined, TrophyOutlined, ExperimentOutlined, SettingOutlined, WarningOutlined, DollarOutlined, CheckCircleOutlined, BellOutlined, HistoryOutlined } from '@ant-design/icons';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import type { ProductLine, VersionTreeNode, FormulaVersion, Batch, TracePathResponse, CostBudget, BudgetAlert, CostBudgetCreate, BudgetStatusItem } from './types';
import { api, collectVersionIds, getBudgetStatusColor, getBudgetStatusLabel, getAlertTypeLabel, getAlertTypeColor } from './api';
import VersionTree from './components/VersionTree';
import VersionDetail from './components/VersionDetail';
import CompareModal from './components/CompareModal';
import TraceModal from './components/TraceModal';
import InventoryPage from './components/InventoryPage';
import ReviewListPage from './components/ReviewListPage';
import ReviewDetailPage from './components/ReviewDetailPage';
import BenchmarkingPage from './components/BenchmarkingPage';
import ExperimentListPage from './components/ExperimentListPage';
import ExperimentDetailPage from './components/ExperimentDetailPage';
import BatchDetail from './components/BatchDetail';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;

function FormulaPage() {
  const navigate = useNavigate();
  const [productLines, setProductLines] = useState<ProductLine[]>([]);
  const [selectedProductLine, setSelectedProductLine] = useState<number | null>(null);
  const [versionTree, setVersionTree] = useState<VersionTreeNode[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<FormulaVersion | null>(null);
  const [allBatches, setAllBatches] = useState<Batch[]>([]);
  const [compareModalVisible, setCompareModalVisible] = useState(false);
  const [compareSelection, setCompareSelection] = useState<number[]>([]);
  const [traceModalVisible, setTraceModalVisible] = useState(false);
  const [traceBatchNumber, setTraceBatchNumber] = useState('');
  const [traceData, setTraceData] = useState<TracePathResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const location = useLocation();

  const [activeBudget, setActiveBudget] = useState<CostBudget | null>(null);
  const [pendingAlerts, setPendingAlerts] = useState<BudgetAlert[]>([]);
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [budgetForm] = Form.useForm();
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [alertDrawerVisible, setAlertDrawerVisible] = useState(false);
  const [handleAlertModalVisible, setHandleAlertModalVisible] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<BudgetAlert | null>(null);
  const [handleForm] = Form.useForm();
  const [handleLoading, setHandleLoading] = useState(false);
  const [budgetHistory, setBudgetHistory] = useState<CostBudget[]>([]);
  const [budgetHistoryVisible, setBudgetHistoryVisible] = useState(false);
  const [budgetStatusMap, setBudgetStatusMap] = useState<Record<number, BudgetStatusItem>>({});

  const menuItems = [
    { key: '/', icon: <HomeOutlined />, label: '配方管理' },
    { key: '/benchmarking', icon: <TrophyOutlined />, label: '对标分析' },
    { key: '/experiments', icon: <ExperimentOutlined />, label: '实验测试' },
    { key: '/reviews', icon: <AuditOutlined />, label: '评审会议' },
    { key: '/inventory', icon: <DatabaseOutlined />, label: '库存管理' },
  ];

  useEffect(() => {
    loadProductLines();
  }, []);

  useEffect(() => {
    if (selectedProductLine) {
      loadVersionTree(selectedProductLine);
      loadBatches(selectedProductLine);
      loadBudgetData(selectedProductLine);
    } else {
      setActiveBudget(null);
      setPendingAlerts([]);
    }
  }, [selectedProductLine]);

  const loadBudgetData = useCallback(async (productLineId: number) => {
    try {
      const [budget, alerts, monitoring] = await Promise.all([
        api.getActiveBudget(productLineId),
        api.getPendingAlerts(productLineId),
        api.getBudgetMonitoring(productLineId)
      ]);
      setActiveBudget(budget);
      setPendingAlerts(alerts);

      const statusMap: Record<number, BudgetStatusItem> = {};
      monitoring.items.forEach(item => {
        statusMap[item.version_id] = item;
      });
      setBudgetStatusMap(statusMap);
    } catch (e) {
      console.error('加载预算数据失败', e);
    }
  }, []);

  const loadProductLines = async () => {
    try {
      const data = await api.getProductLines();
      setProductLines(data);
      if (data.length > 0 && !selectedProductLine) {
        setSelectedProductLine(data[0].id);
      }
    } catch (e) {
      message.error('加载产品线失败');
    }
  };

  const loadVersionTree = async (productLineId: number) => {
    try {
      const data = await api.getVersionTree(productLineId);
      setVersionTree(data);
      setSelectedVersion(null);
      setCompareSelection([]);
    } catch (e) {
      message.error('加载版本树失败');
    }
  };

  const loadBatches = async (productLineId: number) => {
    try {
      const data = await api.getVersionBatches(productLineId);
      setAllBatches(data);
    } catch (e) {
      message.error('加载批次数据失败');
    }
  };

  const handleSelectVersion = async (versionId: number) => {
    try {
      const data = await api.getVersion(versionId);
      setSelectedVersion(data);
    } catch (e) {
      message.error('加载版本详情失败');
    }
  };

  const handleVersionUpdated = async () => {
    if (selectedProductLine) {
      try {
        const treeData = await api.getVersionTree(selectedProductLine);
        setVersionTree(treeData);
      } catch (e) {
        // ignore
      }
    }
    if (selectedVersion) {
      try {
        const data = await api.getVersion(selectedVersion.id);
        setSelectedVersion(data);
      } catch (e) {
        // ignore
      }
    }
  };

  const handleToggleCompare = (versionId: number) => {
    setCompareSelection(prev => {
      if (prev.includes(versionId)) {
        return prev.filter(id => id !== versionId);
      }
      if (prev.length >= 2) {
        return [prev[1], versionId];
      }
      return [...prev, versionId];
    });
  };

  const handleCompare = () => {
    if (compareSelection.length !== 2) {
      message.warning('请选择两个版本进行对比');
      return;
    }
    setCompareModalVisible(true);
  };

  const handleTrace = async () => {
    if (!traceBatchNumber.trim()) {
      message.warning('请输入批次号');
      return;
    }
    setLoading(true);
    try {
      const data = await api.traceBatch(traceBatchNumber.trim());
      setTraceData(data);
      setTraceModalVisible(true);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '追溯失败，请检查批次号');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBudget = useCallback(async (values: any) => {
    if (!selectedProductLine) return;
    setBudgetLoading(true);
    try {
      const budgetData: CostBudgetCreate = {
        product_line_id: selectedProductLine,
        target_cost_per_kg: values.target_cost_per_kg,
        warning_threshold: values.warning_threshold / 100,
        created_by: values.created_by,
        remark: values.remark || null
      };
      await api.createBudget(budgetData);
      message.success('预算设置成功');
      setBudgetModalVisible(false);
      budgetForm.resetFields();
      await loadBudgetData(selectedProductLine);
      loadVersionTree(selectedProductLine);
    } catch (e: any) {
      const errMsg = e?.response?.data?.detail || '设置预算失败';
      message.error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
    } finally {
      setBudgetLoading(false);
    }
  }, [selectedProductLine, budgetForm, loadBudgetData, loadVersionTree]);

  const handleShowBudgetHistory = useCallback(async () => {
    if (!selectedProductLine) return;
    try {
      const data = await api.getBudgetHistory(selectedProductLine);
      setBudgetHistory(data);
      setBudgetHistoryVisible(true);
    } catch (e) {
      message.error('加载预算历史失败');
    }
  }, [selectedProductLine]);

  const handleOpenHandleAlert = useCallback((alert: BudgetAlert) => {
    setSelectedAlert(alert);
    setHandleAlertModalVisible(true);
  }, []);

  const handleAlertSubmit = useCallback(async (values: any) => {
    if (!selectedAlert) return;
    setHandleLoading(true);
    try {
      await api.handleAlert(selectedAlert.id, {
        handled_by: values.handled_by,
        handle_remark: values.remark || null
      });
      message.success('预警已处理');
      setHandleAlertModalVisible(false);
      handleForm.resetFields();
      setSelectedAlert(null);
      if (selectedProductLine) {
        await loadBudgetData(selectedProductLine);
      }
    } catch (e: any) {
      const errMsg = e?.response?.data?.detail || '处理预警失败';
      message.error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
    } finally {
      setHandleLoading(false);
    }
  }, [selectedAlert, handleForm, loadBudgetData, selectedProductLine]);

  const currentProductLine = productLines.find(p => p.id === selectedProductLine);
  const allVersionIds = versionTree.reduce((acc, node) => collectVersionIds(node, acc), [] as number[]);

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
      <Layout style={{ padding: '20px' }}>
        <Sider
          width={320}
          style={{ background: 'white', borderRadius: 8, marginRight: 20, padding: 16 }}
          theme="light"
        >
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>产品线</div>
              <Select
                style={{ width: '100%' }}
                value={selectedProductLine}
                onChange={setSelectedProductLine}
                options={productLines.map(p => ({ label: p.name, value: p.id }))}
              />
            </div>

            {currentProductLine && (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <div style={{ padding: 12, background: '#f5f7fa', borderRadius: 6 }}>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>目标功效</div>
                  <div style={{ fontSize: 13 }}>{currentProductLine.target_effect}</div>
                </div>

                <div style={{ padding: 12, background: activeBudget ? (pendingAlerts.length > 0 ? '#fff2e8' : '#f6ffed') : '#f5f7fa', borderRadius: 6, border: activeBudget && pendingAlerts.length > 0 ? '1px solid #ffd591' : (activeBudget ? '1px solid #b7eb8f' : 'none') }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Space>
                      <DollarOutlined style={{ color: activeBudget ? '#52c41a' : '#999' }} />
                      <span style={{ fontSize: 12, color: '#666' }}>成本预算</span>
                    </Space>
                    <Space>
                      <Button
                        type="link"
                        size="small"
                        icon={<HistoryOutlined />}
                        onClick={handleShowBudgetHistory}
                        style={{ padding: 0 }}
                      >
                        历史
                      </Button>
                      <Button
                        type="link"
                        size="small"
                        icon={<SettingOutlined />}
                        onClick={() => {
                          if (activeBudget) {
                            budgetForm.setFieldsValue({
                              target_cost_per_kg: activeBudget.target_cost_per_kg,
                              warning_threshold: activeBudget.warning_threshold * 100,
                              created_by: ''
                            });
                          }
                          setBudgetModalVisible(true);
                        }}
                        style={{ padding: 0 }}
                      >
                        {activeBudget ? '修改' : '设置'}
                      </Button>
                    </Space>
                  </div>
                  {activeBudget ? (
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: '#666' }}>预算上限</span>
                        <Text strong>¥{activeBudget.target_cost_per_kg.toFixed(2)}/kg</Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: '#666' }}>预警阈值</span>
                        <Text strong style={{ color: '#faad14' }}>{(activeBudget.warning_threshold * 100).toFixed(0)}% (¥{activeBudget.warning_cost.toFixed(2)}/kg)</Text>
                      </div>
                      <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                        由 {activeBudget.created_by} 于 {new Date(activeBudget.created_at).toLocaleString('zh-CN')} 设置
                      </div>
                      {pendingAlerts.length > 0 && (
                        <Alert
                          type="warning"
                          showIcon
                          message={
                            <Space>
                              <WarningOutlined style={{ color: '#faad14' }} />
                              <span>{pendingAlerts.length} 条未处理预警</span>
                            </Space>
                          }
                          action={
                            <Button size="small" type="link" onClick={() => setAlertDrawerVisible(true)}>
                              查看
                            </Button>
                          }
                          style={{ marginTop: 8, padding: '8px 12px' }}
                        />
                      )}
                    </Space>
                  ) : (
                    <div style={{ fontSize: 12, color: '#999', textAlign: 'center', padding: '8px 0' }}>
                      暂无预算设置
                    </div>
                  )}
                </div>
              </Space>
            )}

            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="输入批次号追溯"
                value={traceBatchNumber}
                onChange={e => setTraceBatchNumber(e.target.value)}
                onPressEnter={handleTrace}
                prefix={<SearchOutlined />}
              />
              <Button type="primary" onClick={handleTrace} loading={loading}>追溯</Button>
            </Space.Compact>

            <Space style={{ width: '100%' }}>
              <Button
                type="primary"
                icon={<BarChartOutlined />}
                onClick={handleCompare}
                disabled={compareSelection.length !== 2}
                block
              >
                对比选中版本 ({compareSelection.length}/2)
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => selectedProductLine && loadVersionTree(selectedProductLine)}
              />
            </Space>

            <div style={{ borderTop: '1px solid #eee', paddingTop: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                配方版本树
                <span style={{ color: '#999', fontWeight: 400, fontSize: 12, marginLeft: 8 }}>
                  共 {allVersionIds.length} 个版本
                </span>
              </div>
              <VersionTree
                tree={versionTree}
                selectedId={selectedVersion?.id || null}
                compareSelection={compareSelection}
                onSelect={handleSelectVersion}
                onToggleCompare={handleToggleCompare}
                budgetStatusMap={budgetStatusMap}
              />
            </div>
          </Space>
        </Sider>
        <Content style={{ background: 'white', borderRadius: 8, padding: 24, minHeight: 600 }}>
          {selectedVersion ? (
            <VersionDetail
              version={selectedVersion}
              batches={allBatches.filter(b => b.version_id === selectedVersion.id)}
              allBatches={allBatches}
              versionTree={versionTree}
              onVersionUpdated={handleVersionUpdated}
            />
          ) : (
            <div style={{ textAlign: 'center', color: '#999', padding: 100 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
              <div>请从左侧选择一个配方版本查看详情</div>
            </div>
          )}
        </Content>
      </Layout>

      {pendingAlerts.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: pendingAlerts.some(a => a.alert_type === 'over_budget') ? '#fff1f0' : '#fff7e6',
            borderTop: `2px solid ${pendingAlerts.some(a => a.alert_type === 'over_budget') ? '#ffa39e' : '#ffd591'}`,
            padding: '12px 24px',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 -2px 8px rgba(0,0,0,0.1)'
          }}
        >
          <Space>
            <BellOutlined
              style={{
                color: pendingAlerts.some(a => a.alert_type === 'over_budget') ? '#f5222d' : '#faad14',
                fontSize: 20
              }}
            />
            <div>
              <Text strong style={{ fontSize: 14 }}>
                有 {pendingAlerts.length} 条未处理预算预警
              </Text>
              {pendingAlerts[0] && (
                <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                  最近：V{pendingAlerts[0].version_number} 版本
                  <Tag
                    color={pendingAlerts[0].alert_type === 'over_budget' ? 'red' : 'orange'}
                    style={{ marginLeft: 8 }}
                  >
                    {getAlertTypeLabel(pendingAlerts[0].alert_type)}
                  </Tag>
                  成本 ¥{pendingAlerts[0].actual_cost.toFixed(2)}/kg，
                  超出预算 {((pendingAlerts[0].exceed_ratio - 1) * 100).toFixed(1)}%
                </div>
              )}
            </div>
          </Space>
          <Space>
            <Button type="primary" onClick={() => setAlertDrawerVisible(true)}>
              查看全部
            </Button>
          </Space>
        </div>
      )}

      <CompareModal
        visible={compareModalVisible}
        leftId={compareSelection[0]}
        rightId={compareSelection[1]}
        onClose={() => setCompareModalVisible(false)}
      />

      <TraceModal
        visible={traceModalVisible}
        data={traceData}
        onClose={() => {
          setTraceModalVisible(false);
          setTraceData(null);
        }}
      />

      <Modal
        title="设置成本预算"
        open={budgetModalVisible}
        onCancel={() => setBudgetModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={budgetForm} layout="vertical" onFinish={handleCreateBudget}>
          <Form.Item
            label="目标成本上限（元/kg）"
            name="target_cost_per_kg"
            rules={[{ required: true, message: '请输入目标成本上限' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0.01}
              step={0.01}
              precision={2}
              placeholder="请输入目标成本上限"
            />
          </Form.Item>
          <Form.Item
            label="预警阈值（%）"
            name="warning_threshold"
            rules={[{ required: true, message: '请输入预警阈值' }]}
            initialValue={80}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              max={99}
              step={1}
              precision={0}
              placeholder="请输入预警阈值，如80表示达到预算80%时预警"
              addonAfter="%"
            />
          </Form.Item>
          <Form.Item
            label="设置人"
            name="created_by"
            rules={[{ required: true, message: '请输入设置人姓名' }]}
          >
            <Input placeholder="请输入设置人姓名" />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={3} placeholder="请输入备注（可选）" />
          </Form.Item>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => setBudgetModalVisible(false)}>取消</Button>
            <Button type="primary" htmlType="submit" loading={budgetLoading}>
              {activeBudget ? '更新预算' : '设置预算'}
            </Button>
          </Space>
        </Form>
      </Modal>

      <Drawer
        title="未处理预算预警"
        placement="right"
        width={420}
        open={alertDrawerVisible}
        onClose={() => setAlertDrawerVisible(false)}
        extra={
          <Button size="small" onClick={() => setAlertDrawerVisible(false)}>
            关闭
          </Button>
        }
      >
        {pendingAlerts.length === 0 ? (
          <Empty description="暂无未处理预警" />
        ) : (
          <List
            dataSource={pendingAlerts}
            renderItem={alert => (
              <List.Item
                key={alert.id}
                style={{
                  border: '1px solid #f0f0f0',
                  borderRadius: 8,
                  marginBottom: 12,
                  padding: 12,
                  background: alert.alert_type === 'over_budget' ? '#fff1f0' : '#fff7e6',
                  borderLeft: `4px solid ${getAlertTypeColor(alert.alert_type)}`
                }}
                actions={[
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      setAlertDrawerVisible(false);
                      handleOpenHandleAlert(alert);
                    }}
                  >
                    处理
                  </Button>
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Tag color={alert.alert_type === 'over_budget' ? 'red' : 'orange'}>
                        {getAlertTypeLabel(alert.alert_type)}
                      </Tag>
                      <Text strong>V{alert.version_number} 版本</Text>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={4} style={{ width: '100%', fontSize: 12 }}>
                      <div>
                        实际成本：
                        <Text strong style={{ color: alert.alert_type === 'over_budget' ? '#f5222d' : '#faad14' }}>
                          ¥{alert.actual_cost.toFixed(2)}/kg
                        </Text>
                      </div>
                      <div>
                        预算上限：¥{alert.budget_limit.toFixed(2)}/kg
                      </div>
                      <div>
                        超出比例：
                        <Text strong>
                          {((alert.exceed_ratio - 1) * 100).toFixed(1)}%
                        </Text>
                      </div>
                      <div style={{ color: '#999' }}>
                        预警时间：{new Date(alert.created_at).toLocaleString('zh-CN')}
                      </div>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Drawer>

      <Modal
        title="处理预警"
        open={handleAlertModalVisible}
        onCancel={() => {
          setHandleAlertModalVisible(false);
          setSelectedAlert(null);
          handleForm.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        {selectedAlert && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Alert
              type={selectedAlert.alert_type === 'over_budget' ? 'error' : 'warning'}
              showIcon
              message={
                <Space>
                  <Text strong>V{selectedAlert.version_number} 版本</Text>
                  <Tag color={selectedAlert.alert_type === 'over_budget' ? 'red' : 'orange'}>
                    {getAlertTypeLabel(selectedAlert.alert_type)}
                  </Tag>
                </Space>
              }
              description={
                <div>
                  实际成本 ¥{selectedAlert.actual_cost.toFixed(2)}/kg，
                  预算上限 ¥{selectedAlert.budget_limit.toFixed(2)}/kg，
                  超出 {((selectedAlert.exceed_ratio - 1) * 100).toFixed(1)}%
                </div>
              }
            />
            <Form form={handleForm} layout="vertical" onFinish={handleAlertSubmit}>
              <Form.Item
                label="处理人"
                name="handled_by"
                rules={[{ required: true, message: '请输入处理人姓名' }]}
              >
                <Input placeholder="请输入处理人姓名" />
              </Form.Item>
              <Form.Item label="处理备注" name="remark">
                <Input.TextArea rows={4} placeholder="请输入处理备注（可选）" />
              </Form.Item>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button
                  onClick={() => {
                    setHandleAlertModalVisible(false);
                    setSelectedAlert(null);
                    handleForm.resetFields();
                  }}
                >
                  取消
                </Button>
                <Button type="primary" htmlType="submit" loading={handleLoading}>
                  标记为已处理
                </Button>
              </Space>
            </Form>
          </Space>
        )}
      </Modal>

      <Modal
        title="预算历史记录"
        open={budgetHistoryVisible}
        onCancel={() => setBudgetHistoryVisible(false)}
        footer={null}
        width={700}
        destroyOnClose
      >
        {budgetHistory.length === 0 ? (
          <Empty description="暂无预算历史记录" />
        ) : (
          <List
            dataSource={budgetHistory}
            renderItem={budget => (
              <List.Item
                key={budget.id}
                style={{
                  border: '1px solid #f0f0f0',
                  borderRadius: 8,
                  marginBottom: 12,
                  padding: 16
                }}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      {budget.is_active ? (
                        <Tag color="green">当前生效</Tag>
                      ) : (
                        <Tag color="default">已失效</Tag>
                      )}
                      <Text strong>
                        预算上限：¥{budget.target_cost_per_kg.toFixed(2)}/kg
                      </Text>
                      <Text type="secondary">
                        预警阈值：{(budget.warning_threshold * 100).toFixed(0)}%
                      </Text>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={4} style={{ width: '100%', fontSize: 12 }}>
                      <div>
                        设置人：{budget.created_by} · 设置时间：{new Date(budget.created_at).toLocaleString('zh-CN')}
                      </div>
                      {!budget.is_active && budget.deactivated_by && (
                        <div>
                          失效人：{budget.deactivated_by} · 失效时间：{new Date(budget.deactivated_at!).toLocaleString('zh-CN')}
                        </div>
                      )}
                      {budget.remark && (
                        <div style={{ color: '#666' }}>备注：{budget.remark}</div>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Modal>
    </Layout>
  );
}

function BenchmarkingPageWithHeader() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { key: '/', icon: <HomeOutlined />, label: '配方管理' },
    { key: '/benchmarking', icon: <TrophyOutlined />, label: '对标分析' },
    { key: '/experiments', icon: <ExperimentOutlined />, label: '实验测试' },
    { key: '/reviews', icon: <AuditOutlined />, label: '评审会议' },
    { key: '/inventory', icon: <DatabaseOutlined />, label: '库存管理' },
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
      <BenchmarkingPage />
    </Layout>
  );
}

function ExperimentPageWithHeader() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { key: '/', icon: <HomeOutlined />, label: '配方管理' },
    { key: '/benchmarking', icon: <TrophyOutlined />, label: '对标分析' },
    { key: '/experiments', icon: <ExperimentOutlined />, label: '实验测试' },
    { key: '/reviews', icon: <AuditOutlined />, label: '评审会议' },
    { key: '/inventory', icon: <DatabaseOutlined />, label: '库存管理' },
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
            selectedKeys={[location.pathname.startsWith('/experiments') ? '/experiments' : location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key as string)}
            style={{ minWidth: 300, background: 'transparent' }}
          />
        </Space>
      </Header>
      <ExperimentListPage />
    </Layout>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<FormulaPage />} />
        <Route path="/batches/:id" element={<BatchDetail />} />
        <Route path="/benchmarking" element={<BenchmarkingPageWithHeader />} />
        <Route path="/experiments" element={<ExperimentPageWithHeader />} />
        <Route path="/experiments/:id" element={<ExperimentDetailPage />} />
        <Route path="/reviews" element={<ReviewListPage />} />
        <Route path="/reviews/:id" element={<ReviewDetailPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
