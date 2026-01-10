# 飞书人力占用记录系统

基于 Next.js 15 + 飞书多维表格API 的人力工作记录系统。

## 功能特性

- **飞书OAuth登录**：安全的企业身份验证
- **实时数据同步**：
  - 自动获取企业成员列表
  - 动态加载事项选项（从多维表格字段配置）
  - 实时查询已有记录
  - 手动刷新已有记录
- **直观的人力输入**：
  - 笑脸选择器：10个笑脸代表0.1-1.0人天
  - 悬停预览：鼠标悬停即时预览选择结果
  - 点击确认：快速选择人力占用
  - 不同等级显示不同表情（🙂😊😄🤩）
- **智能验证**：
  - 前端实时验证：事项为空或人力未选时提交按钮置灰
  - 防止超出1.0人天限制
  - 自动计算已占用+新增总计
- **友好的交互体验**：
  - 消息通知自动消失（3秒）或手动关闭
  - 加载状态显示
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
- `FEISHU_DEPARTMENT_ID`: 部门ID（open_department_id，如 `od-xxx`，用于获取部门成员列表）
- `NEXTAUTH_URL`: 服务访问地址（如 `http://localhost:3000`，端口修改时需同步更新）
- `FEISHU_REDIRECT_URI`: OAuth 回调地址（需与飞书开放平台配置完全一致）
- `SESSION_SECRET`: 会话密钥（随机生成）
- `FEISHU_API_BASE_URL`: 飞书API域名（中国版 `https://open.feishu.cn`，国际版 `https://open.larksuite.com`）

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

### 使用Docker Compose（推荐）

`docker compose` 会从 `.env` 读取变量，并在构建阶段作为 `build args` 传入（Next.js 构建需要这些环境变量）。

```bash
docker compose up -d --build
```

### 构建镜像（Docker）

构建镜像时需要将环境变量以 `--build-arg` 形式传入（也可直接使用上面的 Docker Compose 方式）。

```bash
docker build -t feishu-workload-tracker \
  --build-arg FEISHU_APP_ID \
  --build-arg FEISHU_APP_SECRET \
  --build-arg FEISHU_APP_TOKEN \
  --build-arg FEISHU_TABLE_ID \
  --build-arg FEISHU_DEPARTMENT_ID \
  --build-arg SESSION_SECRET \
  --build-arg NEXTAUTH_URL \
  --build-arg FEISHU_REDIRECT_URI \
  .
```

### 运行容器

```bash
docker run -p 3000:3000 --env-file .env feishu-workload-tracker
```

如修改 `.env` 中的变量后需要重新构建镜像，请执行 `docker compose up -d --build`。

## 项目结构

```
├── app/                      # Next.js App Router
│   ├── api/                  # API路由
│   │   ├── auth/             # 认证相关API
│   │   └── feishu/           # 飞书数据API
│   ├── login/                # 登录页面
│   ├── workload/             # 主记录页面
│   │   ├── page.tsx          # 主页面组件
│   │   └── WorkloadSelector.tsx  # 笑脸选择器组件
│   └── layout.tsx
├── components/               # React组件
│   ├── ui/                   # shadcn/ui组件
│   ├── workload/             # 业务组件
│   └── layout/               # 布局组件
├── lib/                      # 工具库
│   ├── feishu/               # 飞书API服务
│   │   ├── client.ts         # HTTP客户端
│   │   ├── auth.ts           # 认证管理
│   │   ├── bitable.ts        # 多维表格操作
│   │   └── users.ts          # 用户API
│   └── session.ts            # Session管理
├── types/                    # TypeScript类型定义
├── docs/                     # 文档
│   └── FEISHU_SETUP.md       # 飞书配置指南
├── Dockerfile                # Docker构建文件
├── docker-compose.yml        # Docker编排文件
└── .env.example              # 环境变量示例
```

## 开发说明

本项目包含详细的代码注释，帮助理解Next.js概念和飞书API集成。

## 使用指南

### 基本流程

1. **登录系统**：使用飞书账号登录
2. **选择日期和人员**：
   - 默认选中今天和当前登录用户
   - 可切换日期查看其他日期的记录
   - 可切换人员为他人记录工作量
3. **查看已有记录**：
   - 系统自动显示所选日期和人员的已有记录
   - 点击刷新按钮手动更新记录
4. **添加新记录**：
   - 点击"+ 添加记录"按钮
   - 从下拉列表选择工作事项
   - 使用笑脸选择器选择人力占用：
     - 10个笑脸代表0.1-1.0人天
     - 鼠标悬停预览选择结果
     - 点击确认选择
   - 可添加多条记录
5. **提交记录**：
   - 系统自动验证：
     - 所有记录必须选择事项
     - 所有记录必须选择人力占用
     - 总人力不能超过1.0人天
   - 验证通过后提交按钮可点击
   - 提交成功后自动刷新已有记录

### 笑脸选择器说明

| 笑脸数量 | 人力占用 | 表情等级 |
|---------|---------|---------|
| 1-3个 | 0.1-0.3 | 🙂 轻松 |
| 4-6个 | 0.4-0.6 | 😊 适中 |
| 7-8个 | 0.7-0.8 | 😄 忙碌 |
| 9-10个 | 0.9-1.0 | 🤩 满负荷 |

### 提示信息说明

- **绿色提示**：操作成功，3秒后自动消失或手动关闭
- **红色提示**：操作失败，需查看错误信息并手动关闭
- **橙色提示**：表单验证未通过，提交按钮置灰

## 许可证

MIT
