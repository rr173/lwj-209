import { useState, useEffect } from 'react';
import { Layout, Space, Button, Select, Modal, message, Input } from 'antd';
import { ReloadOutlined, BarChartOutlined, SearchOutlined } from '@ant-design/icons';
import type { ProductLine, VersionTreeNode, FormulaVersion, Batch, TracePathResponse } from './types';
import { api, collectVersionIds } from './api';
import VersionTree from './components/VersionTree';
import VersionDetail from './components/VersionDetail';
import CompareModal from './components/CompareModal';
import TraceModal from './components/TraceModal';

const { Header, Content, Sider } = Layout;

function App() {
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

  useEffect(() => {
    loadProductLines();
  }, []);

  useEffect(() => {
    if (selectedProductLine) {
      loadVersionTree(selectedProductLine);
      loadBatches(selectedProductLine);
    }
  }, [selectedProductLine]);

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

  const currentProductLine = productLines.find(p => p.id === selectedProductLine);
  const allVersionIds = versionTree.reduce((acc, node) => collectVersionIds(node, acc), [] as number[]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header className="app-header">
        <Space direction="vertical" size={0}>
          <h1>化妆品配方版本管理与批次追溯系统</h1>
          <div className="subtitle">Formula Version Management & Batch Traceability System</div>
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
              <div style={{ padding: 12, background: '#f5f7fa', borderRadius: 6 }}>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>目标功效</div>
                <div style={{ fontSize: 13 }}>{currentProductLine.target_effect}</div>
              </div>
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
    </Layout>
  );
}

export default App;
