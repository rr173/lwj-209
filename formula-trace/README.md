# 化妆品配方版本管理与批次追溯系统

## 功能特性

- **配方版本管理**：支持配方多版本迭代，版本间形成树状结构
- **互斥成分校验**：预先配置互斥成分组，创建版本时自动校验
- **百分比校验**：成分百分比之和必须等于100%，精确到小数点后两位
- **批次管理**：关联试产批次，记录检测结果（肤感、稳定性、成本）
- **版本树可视化**：树状图展示版本演变，节点颜色按评分渐变
- **版本对比**：任意两个版本并排对比，高亮显示差异
- **批次追溯**：从任意批次反向追溯完整配方演变路径
- **综合评分**：肤感×0.4 + 稳定性×0.4 - 成本归一化×0.2

## 快速启动

```bash
docker-compose up
```

启动后访问：http://localhost:3000

系统会自动预置"美白精华"产品线，包含：
- 5个配方版本（根版本→两个分支各2个迭代）
- 3个批次带检测结果
- 1组互斥成分配置（水杨酸 ↔ 烟酰胺）

## API接口

### 产品线管理
- `POST /api/product-lines` - 创建产品线
- `GET /api/product-lines` - 获取产品线列表
- `GET /api/product-lines/{id}` - 获取产品线详情

### 互斥成分管理
- `POST /api/exclusion-groups?product_line_id={id}` - 创建互斥组
- `GET /api/exclusion-groups?product_line_id={id}` - 获取互斥组列表

### 配方版本管理
- `POST /api/versions` - 创建配方版本
- `GET /api/versions/{id}` - 获取版本详情
- `GET /api/versions/product-line/{id}/tree` - 获取版本树
- `GET /api/versions/compare?left_id={id}&right_id={id}` - 对比版本

### 批次管理
- `POST /api/batches` - 创建批次
- `POST /api/batches/{id}/test-result` - 提交检测结果
- `GET /api/batches/product-line/{id}` - 获取产品线批次列表（按综合评分排序）
- `GET /api/batches/trace/{batch_number}` - 追溯批次演变路径

## 项目结构

```
formula-trace/
├── backend/
│   ├── main.py              # FastAPI入口
│   ├── models.py            # 数据库模型
│   ├── schemas.py           # Pydantic模式
│   ├── database.py          # 数据库连接
│   ├── seed.py              # 预置数据
│   ├── routers/
│   │   ├── product_lines.py
│   │   ├── versions.py
│   │   ├── batches.py
│   │   └── exclusion_groups.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── VersionTree.tsx
│   │   │   ├── VersionDetail.tsx
│   │   │   ├── CompareModal.tsx
│   │   │   └── TraceModal.tsx
│   │   ├── App.tsx
│   │   ├── api.ts
│   │   └── types.ts
│   └── package.json
└── docker-compose.yml
```
