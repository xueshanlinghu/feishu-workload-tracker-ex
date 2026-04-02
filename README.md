# 人力占用记录 EX

基于 Next.js 15 + 飞书多维表格 API 的人力占用记录系统，支持 `类型 -> 内容 -> 细项` 三级联动录入，以“小时”为主单位进行提交与展示，并提供 `8 小时 = 1.0 人天` 的折算视图。

## 功能特性

- **飞书OAuth登录**：安全的企业身份验证
- **实时数据同步**：
  - 自动获取企业成员列表
  - 动态加载类型、内容、细项三级字典
  - 实时查询已有记录
  - 手动刷新已有记录
- **自定义表单组件**：
  - **日期选择器**：自定义日历界面，支持中文本地化，月份导航和快速跳转今天
  - **人员/分类选择器**：
    - 搜索过滤：快速查找选项
    - 图标装饰：用户和文件图标区分不同类型
    - 智能弹出方向：自动检测空间，向上或向下弹出，避免遮挡
  - 替代浏览器原生表单，提供统一美观的交互体验
- **记录管理**：
  - **查看**：浅色状态卡片显示已有记录，不同负载用不同颜色
  - **编辑**：点击编辑按钮修改记录，实时校验总工时不超过14小时
  - **删除**：带确认弹窗的安全删除功能
  - **环形进度可视化**：以 8 小时为 100%，超过后在同一圆环上继续累积显示
- **直观的工时输入**：
  - 彩色情绪选择器：14 个图标代表 1-14 小时
  - 下拉工时面板：默认节省行高，点开后再显示完整 14 小时选择面板
  - 悬停预览：鼠标悬停即时预览选择结果
  - 点击确认：快速选择工时
  - 不同负载显示不同彩色情绪（Smile / Meh / Frown / Angry）
- **智能验证**：
  - 前端实时验证：未明确选择人员、类型、内容、必要细项或工时时，添加/提交按钮置灰
  - 防止超出14小时限制
  - 自动计算已排工时 + 新增工时总计
  - 编辑时防止总工时超过14小时
- **友好的交互体验**：
  - Toast通知系统：右下角弹窗通知，成功消息3秒自动消失，错误消息需手动关闭
  - 加载状态显示
  - 响应式设计（支持手机/平板/桌面，并优化笔记本场景的单行录入）
  - 圆环刷新动效、弹层智能方向与平滑悬停反馈

## 技术栈

- **框架**: Next.js 15 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **UI组件**: Headless UI + 自定义组件
- **日期处理**: date-fns
- **状态管理**: React Hooks + SWR
- **认证**: iron-session
- **部署**: Docker

## UI设计风格

本项目采用现代化的**Modern Minimalism（现代简约）+ Soft UI（柔和界面）**风格，强调清晰信息层级、状态色提示和高频录入效率。

### 设计理念

- **Modern Minimalism（现代简约）**: 简洁清晰的布局，突出重点内容
- **Soft UI（柔和界面）**: 柔和阴影、浅色背景与轻量动画，舒适但不过度装饰
- **Color Coding（色彩编码）**: 用颜色直观传达信息状态和程度
- **Smart Interaction（智能交互）**: 自适应弹出方向、滚轮兼容和紧凑录入布局

### 核心设计元素

1. **浅色页面背景**: `bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100`
2. **柔和卡片**: `bg-white` + `shadow-lg` + `rounded-2xl`
3. **色彩编码系统**:
   - 舒适区（<= 8 小时）: 绿色调 `bg-green-50 text-green-700`
   - 提醒区（8-14 小时）: 橙色调 `bg-orange-50 text-orange-700`
   - 超限区（> 14 小时）: 红色调 `bg-red-50 text-red-600`
4. **状态卡片**: 已有记录使用纯色浅底，不再依赖渐变背景
5. **悬浮微动效果**:
   - 卡片抬升: `hover:-translate-y-0.5`
   - 阴影增强: `hover:shadow-xl`
   - 按钮缩放: `hover:scale-105`
6. **环形进度可视化**: SVG 单圆环 + 阈值变色 + 刷新蛇形动画
7. **柔和过渡动画**: `transition-all duration-300`
8. **智能弹出方向**: 自动检测屏幕空间，向上或向下弹出下拉框

### 可复用的AI提示词模板

如果您想在其他项目中获得类似的UI效果，可以向AI这样描述：

> "请帮我优化这个界面的UI设计，采用以下风格：
>
> **整体风格**：现代简约（Modern Minimalism）+ 柔和界面（Soft UI）
>
> **具体要求**：
>
> 1. **背景**：使用浅色渐变背景，但卡片保持克制，不要满屏花哨渐变
> 2. **卡片**：纯白色背景 + 柔和阴影 + 大圆角；状态卡片使用纯色浅底
> 3. **间距**：增加卡片间距和内边距，营造呼吸感
> 4. **色彩编码**：根据数据状态使用纯色浅底（绿色=舒适，橙色=提醒，红色=超限）
> 5. **交互动效**：
>    - 卡片悬停时轻微抬起并增强阴影
>    - 刷新时环形进度以“先快后慢”的蛇形方式绘制
>    - 所有过渡使用柔和动画（300ms 左右）
> 6. **按钮**：主按钮使用纯色高对比配色，更大的圆角
> 7. **进度展示**：使用单圆环进度图，8 小时为 100%，超出后继续在同一圆环累计
> 8. **智能交互**：下拉框自动检测屏幕空间，向上或向下弹出，并兼容页面滚轮
>
> 请保持简洁，不要过度装饰，重点是提升视觉层次和交互反馈。"

### 技术实现要点

**Tailwind CSS 关键类**：

- 纯色卡片: `bg-white`
- 页面背景渐变: `bg-gradient-to-br from-{color} via-{color} to-{color}`
- 阴影层次: `shadow-lg` → `hover:shadow-xl`
- 过渡: `transition-all duration-300`
- 变换: `hover:-translate-y-0.5` / `hover:scale-105`

**组件示例**：

```tsx
// 柔和卡片
<div className="bg-white rounded-2xl shadow-lg
                hover:shadow-xl transition-shadow duration-300
                p-8 border border-gray-100">
  {/* 内容 */}
</div>

// 环形进度图（8 小时为 100%）
<CircularProgress current={10} max={8} />

// 自定义下拉框（带智能方向）
<CustomSelect
  value={value}
  onChange={setValue}
  options={options}
  searchable={true}
/>

// 主操作按钮
<button className="bg-blue-600 text-white rounded-xl px-6 py-3
                   hover:bg-blue-700
                   hover:shadow-lg hover:scale-105
                   transition-all duration-200">
  提交
</button>
```

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
- `FEISHU_TYPE_TABLE_ID`: 类型字典表table_id
- `FEISHU_CONTENT_TABLE_ID`: 内容字典表table_id
- `FEISHU_DETAIL_TABLE_ID`: 细项字典表table_id
- `FEISHU_RECORD_TABLE_ID`: 人力记录表table_id
- `FEISHU_DEPARTMENT_ID`: 部门ID（open_department_id，如 `od-xxx`，用于获取部门成员列表）
- `NEXTAUTH_URL`: 服务访问地址（如 `http://localhost:3001`，端口修改时需同步更新）
- `FEISHU_REDIRECT_URI`: OAuth 回调地址（需与飞书开放平台配置完全一致）
- `SESSION_SECRET`: 会话密钥（随机生成）
- `FEISHU_API_BASE_URL`: 飞书API域名（中国版 `https://open.feishu.cn`，国际版 `https://open.larksuite.com`）

### 3. 运行开发服务器

```bash
npm run dev
```

打开 [http://localhost:3001](http://localhost:3001) 查看应用。

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
- `contact:contact.base:readonly` - 获取通讯录基础信息（应用身份权限）
- `contact:department.organize:readonly` - 获取通讯录部门组织架构信息（应用身份权限）
- `contact:user.basic_profile:readonly` - 批量获取用户姓名（应用身份权限）

注意：
- 以上通讯录权限需要在“应用身份权限 tenant_access_token”页签中开通并发布版本。
- 如果未开通，获取成员列表时可能出现 `99991672 Access denied`。
- 如果未开通 `contact:user.basic_profile:readonly`，人员列表可能只能拿到 ID，无法展示真实姓名。

## Docker部署

### 使用Docker Compose（推荐）

`docker compose` 会从 `.env` 读取变量，并在构建阶段作为 `build args` 传入（Next.js 构建需要这些环境变量）。

```bash
docker compose up -d --build
```

### 构建镜像（Docker）

构建镜像时需要将环境变量以 `--build-arg` 形式传入（也可直接使用上面的 Docker Compose 方式）。

```bash
docker build -t feishu-workload-tracker-ex \
  --build-arg FEISHU_APP_ID \
  --build-arg FEISHU_APP_SECRET \
  --build-arg FEISHU_APP_TOKEN \
  --build-arg FEISHU_TYPE_TABLE_ID \
  --build-arg FEISHU_CONTENT_TABLE_ID \
  --build-arg FEISHU_DETAIL_TABLE_ID \
  --build-arg FEISHU_RECORD_TABLE_ID \
  --build-arg FEISHU_DEPARTMENT_ID \
  --build-arg SESSION_SECRET \
  --build-arg NEXTAUTH_URL \
  --build-arg FEISHU_REDIRECT_URI \
  .
```

### 运行容器

```bash
docker run -p 3001:3001 --env-file .env feishu-workload-tracker-ex
```

如修改 `.env` 中的变量后需要重新构建镜像，请执行 `docker compose up -d --build`。

## 宝塔/Nginx 缓存配置（server块）

线上通过宝塔反向代理时，如果 `proxy_cache` 把 HTML 路由（如 `/workload`）长期缓存，会出现「页面引用旧的 chunk 文件，前端报 `Application error`」的问题。

建议将以下规则放在站点的**自定义配置文件 -> server块**中：仅让静态资源继续走缓存，业务页面和 API 全部绕过缓存。

> 说明：以下配置不包含域名，适用于单站点的 `server` 块；`proxy_cache_path` 仍由全局配置管理。

```nginx
# 仅跳过业务路由缓存；静态资源（如 /_next/static/*）继续可缓存
set $skip_cache 0;

# 页面路由（包含首页）
if ($request_uri ~* "^/(?:$|\\?)") { set $skip_cache 1; }
if ($request_uri ~* "^/(login|workload)(?:$|/|\\?)") { set $skip_cache 1; }

# API 与鉴权相关路由
if ($request_uri ~* "^/(api|auth)(?:/|\\?)") { set $skip_cache 1; }

# 对应反向代理缓存控制
proxy_no_cache $skip_cache;
proxy_cache_bypass $skip_cache;

# 调试响应头（可选）
add_header X-Skip-Cache $skip_cache always;
add_header X-Proxy-Cache $upstream_cache_status always;
```

保存后执行：

```bash
nginx -t && nginx -s reload
```

验证建议：

```bash
curl -I https://你的域名/workload
curl -I "https://你的域名/workload?v=check"
```

两条响应应表现一致（不再出现无参数 URL 命中旧缓存、带参数 URL 正常的分裂现象）。

## 项目结构

```
├── app/                      # Next.js App Router
│   ├── api/                  # API路由
│   │   ├── auth/             # 认证相关API
│   │   └── feishu/           # 飞书数据API
│   │       ├── records/      # 记录管理API
│   │       │   └── [id]/     # 单条记录操作（编辑/删除）
│   │       ├── categories/   # 获取三级分类选项
│   │       └── users/        # 获取用户列表
│   ├── login/                # 登录页面
│   ├── workload/             # 主记录页面
│   │   ├── page.tsx                # 主页面组件
│   │   ├── WorkloadSelector.tsx   # 笑脸选择器组件
│   │   ├── CustomSelect.tsx        # 自定义下拉框
│   │   ├── CustomDatePicker.tsx    # 自定义日期选择器
│   │   ├── CircularProgress.tsx    # 环形进度图
│   │   ├── EditRecordModal.tsx     # 编辑记录弹窗
│   │   ├── DeleteConfirmModal.tsx  # 删除确认弹窗
│   │   ├── Toast.tsx               # Toast通知组件
│   │   └── ToastProvider.tsx       # Toast上下文提供者
│   └── layout.tsx
├── lib/                      # 工具库
│   ├── feishu/               # 飞书API服务
│   │   ├── client.ts         # HTTP客户端
│   │   ├── auth.ts           # 认证管理
│   │   ├── bitable.ts        # 多维表格通用操作
│   │   ├── workload.ts       # 人力业务字典与格式化逻辑
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
   - 点击日期框打开自定义日历，支持月份导航和快速跳转今天
   - 点击人员框打开搜索下拉列表，可输入关键字快速查找
   - 下拉框会智能检测屏幕空间，自动向上或向下弹出
3. **查看已有记录**：
   - 系统自动显示所选日期和人员的已有记录
   - 记录卡片用颜色编码：绿色（低负载）、蓝色（中负载）、橙红（高负载）
   - 环形进度图直观展示当天总工时
   - 点击刷新按钮手动更新记录
4. **编辑已有记录**：
   - 点击记录卡片上的编辑按钮
   - 修改分类路径对应记录的工时
   - 系统自动校验总工时不超过14小时
5. **删除记录**：
   - 点击记录卡片上的删除按钮
   - 确认删除弹窗，防止误操作
6. **添加新记录**：
   - 点击"+ 添加记录"按钮
   - 先选择类型，再选择关联内容，必要时再选择细项
   - 下一级选项加载完成前不可操作
   - 使用彩色情绪选择器选择工时：
     - 14个图标代表1-14小时
     - 鼠标悬停预览选择结果
     - 点击确认选择
   - 可添加多条记录
7. **提交记录**：
   - 系统自动验证：
     - 所有记录必须选择类型和内容
     - 有细项的内容必须补选细项
     - 所有记录必须选择工时
     - 总工时不能超过14小时
   - 验证通过后提交按钮可点击
   - 提交成功后右下角显示Toast通知，自动刷新已有记录

### 情绪选择器说明

| 工时范围 | 折算人天 | 情绪等级 |
| -------- | -------- | -------- |
| 1-4小时  | 0.1-0.5  | Smile 轻松 |
| 5-8小时  | 0.6-1.0  | Meh 专注 |
| 9-11小时 | 1.1-1.4  | Frown 忙碌 |
| 12-14小时 | 1.5-1.8 | Angry 超载 |

### 提示信息说明

- **绿色Toast**：操作成功，3秒后自动消失，也可手动关闭
- **红色Toast**：操作失败或错误，需手动关闭查看详细信息
- **橙色提示**：表单验证未通过，提交按钮置灰并显示提示信息

## 许可证

MIT
