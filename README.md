# 飞书人力占用记录系统

基于 Next.js 15 + 飞书多维表格API 的人力工作记录系统。

## 功能特性

- 飞书OAuth登录
- 实时获取企业成员列表
- 动态加载事项选项
- 人力占用记录（0.1-1.0人天）
- 自动计算每日人力总计
- 防止超出1.0人天限制
- 响应式设计（支持手机/平板/桌面）

## 技术栈

- **框架**: Next.js 15 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **UI组件**: shadcn/ui
- **状态管理**: React Hook Form + SWR
- **认证**: iron-session
- **部署**: Docker

## 快速开始

### 1. 克隆项目并安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填入你的配置：

```bash
cp .env.example .env
```

需要配置的变量：
- `FEISHU_APP_ID`: 飞书应用ID
- `FEISHU_APP_SECRET`: 飞书应用密钥
- `FEISHU_APP_TOKEN`: 多维表格app_token（从URL获取）
- `FEISHU_TABLE_ID`: 表格table_id（从URL获取）
- `SESSION_SECRET`: 会话密钥（随机生成）

### 3. 运行开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看应用。

### 4. 构建生产版本

```bash
npm run build
npm start
```

## 飞书配置指南

详细的飞书应用配置步骤请参考 `docs/FEISHU_SETUP.md`

### 获取表格信息

1. 打开你的飞书多维表格
2. 查看浏览器地址栏URL，格式如：
   ```
   https://xxx.feishu.cn/base/bascnABC123?table=tblXYZ789
   ```
3. 提取参数：
   - `app_token`: `bascnABC123`
   - `table_id`: `tblXYZ789`

### 必要权限

在飞书开放平台需要开通以下权限：
- `bitable:app` - 访问多维表格
- `contact:user.base:readonly` - 获取通讯录用户基本信息
- `contact:user.employee_id:readonly` - 获取用户employee_id

## Docker部署

### 构建镜像

```bash
docker build -t feishu-workload-tracker .
```

### 运行容器

```bash
docker run -p 3000:3000 --env-file .env feishu-workload-tracker
```

### 使用Docker Compose

```bash
docker-compose up -d
```

## 项目结构

```
├── app/                      # Next.js App Router
│   ├── api/                  # API路由
│   ├── login/                # 登录页面
│   ├── workload/             # 主记录页面
│   └── layout.tsx
├── components/               # React组件
│   ├── ui/                   # shadcn/ui组件
│   ├── workload/             # 业务组件
│   └── layout/               # 布局组件
├── lib/                      # 工具库
│   └── feishu/               # 飞书API服务
├── hooks/                    # 自定义Hooks
└── types/                    # TypeScript类型定义
```

## 开发说明

本项目包含详细的代码注释，帮助理解Next.js概念和飞书API集成。

## 许可证

MIT
