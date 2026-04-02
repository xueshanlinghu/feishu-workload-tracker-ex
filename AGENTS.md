# Codex 开发规范

本文件记录了在本项目中使用Codex的开发规范和约定。
当前项目名称为 `feishu-workload-tracker-ex`。

## 命令规范

### Bash命令规范

在本项目中，所有Shell命令必须使用**Bash**语法，不使用PowerShell。

#### 正确示例 ✅
```bash
# 创建目录
mkdir -p src/components

# 列出文件
ls -la

# 查找文件
find . -name "*.ts"

# 复制文件
cp .env.example .env

# 删除文件
rm -rf node_modules

# 查看文件内容
cat package.json

# 生成随机密钥
openssl rand -base64 32
# 或使用Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### 错误示例 ❌
```powershell
# 不要使用PowerShell命令
Get-ChildItem
Remove-Item -Recurse
Copy-Item
```

### Git命令规范

```bash
# 初始化仓库
git init

# 添加文件
git add .

# 提交
git commit -m "feat: add workload tracking feature"

# 推送
git push origin main
```

### Docker命令规范

```bash
# 构建镜像
docker build -t feishu-workload-tracker-ex .

# 运行容器
docker run -p 3001:3001 --env-file .env feishu-workload-tracker-ex

# 使用Docker Compose
docker-compose up -d
docker-compose down
docker-compose logs -f
```

## 项目特定规范

### 环境变量

- 使用 `.env` 文件（不是`.env.local`）
- 不要将`.env`提交到Git
- 所有环境变量必须在`.env.example`中说明

### 代码注释

- 所有主要函数必须包含详细的中文注释
- 复杂逻辑需要解释"为什么"而不仅是"做什么"
- Next.js特定概念需要额外说明

### API路由规范

```
/api/auth/*        - 认证相关
/api/feishu/*      - 飞书API相关
```

### 文件组织

```
lib/               - 工具库和服务层
  feishu/          - 飞书API封装
  config.ts        - 配置管理
  session.ts       - Session管理
  utils.ts         - 通用工具

app/               - Next.js App Router
  api/             - API路由
  login/           - 登录页面
  workload/        - 主功能页面

components/        - React组件
  ui/              - shadcn/ui组件
  workload/        - 业务组件

types/             - TypeScript类型定义
```

### TypeScript规范

- 所有文件使用TypeScript
- 明确定义接口和类型
- 避免使用`any`类型
- 使用严格模式

### 错误处理

```typescript
// 统一错误处理格式
try {
  // 操作
} catch (error) {
  console.error('[Component] Error:', error);
  throw new Error('友好的错误提示');
}
```

## Next.js特定规范

### App Router约定

- 使用`page.tsx`定义页面
- 使用`route.ts`定义API路由
- 使用`layout.tsx`定义布局
- 客户端组件使用`'use client'`

### 数据获取

- 优先使用SWR进行客户端数据获取
- API路由中进行服务端数据获取
- 使用Next.js的缓存策略

## 提交规范

### Commit Message格式

```
<type>(<scope>): <subject>

[optional body]
```

### Commit Message额外要求

- Commit message 默认使用中文
- `subject` 要直接概括本次提交的核心目的，避免空泛表述
- `body` 需要写成多行分点说明，清楚列出本次改动项、影响范围和关键调整
- 如果一次提交同时包含前端、后端、文档或部署配置变更，`body` 中要分别列出
- 除非用户明确要求，否则不要只写单行 commit message
- 默认只允许在 `dev` 分支提交与推送
- `master` 分支只有在用户明确要求“合并”或“推送 master”时才能操作，不能自行合并或同步

类型：
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具配置

示例：
```bash
git commit -m "feat(auth): add Feishu OAuth login"
git commit -m "fix(bitable): handle empty records array"
git commit -m "docs: update FEISHU_SETUP.md"
```

推荐示例：
```bash
git commit -m "feat(workload): 升级三级分类人力占用录入流程" \
  -m "- 前端新增类型、内容、细项三级联动选择逻辑
- 后端改为按字典表校验分类链路并写入人力记录表
- 环境变量、默认端口、Docker 与文档同步更新到 v0.4.0
- 修复登录回调、会话 Cookie 与本地启动端口的兼容问题"
```

## 开发流程

1. 查看需求和计划文件
2. 使用Todo工具跟踪任务进度
3. 编写代码并添加详细注释
4. 本地测试功能
5. 提交代码（如需）
6. 更新文档

## 版本发布常见流程

当用户明确要求执行版本发布时，默认按以下顺序推进，除非用户另有说明：

1. 检查版本相关文档是否需要同步更新（如 `README.md`、`docs/`、环境变量说明、字段说明）
2. 完成代码修改后，先在 `dev` 分支提交，commit message 按中文多行说明写清改动范围
3. 本地执行必要验证（至少包含 lint / TypeScript 检查；如有额外测试也一并执行）
4. 确认工作区干净后，将 `dev` 推送到远端
5. 使用 `gh` 创建指向 `master` 的 PR，并在用户明确要求时执行 merge
6. PR 合并完成后，基于 `master` 的最终提交创建版本 tag 与 GitHub Release
7. 发布完成后，向用户反馈 commit、PR、tag、release 链接以及当前分支/工作区状态

补充约定：

- 版本号需要同步更新 `package.json` 与 `package-lock.json`
- Release 说明应概括本次核心功能、重要修复、文档更新和验证结果
- 若发布过程中发现文档、版本号、tag、release 口径不一致，应先修正再继续后续步骤

## 注意事项

- Windows环境下优先使用Git Bash或WSL
- 避免使用Windows特有的路径分隔符
- 所有脚本必须兼容Linux环境（为Docker部署准备）
