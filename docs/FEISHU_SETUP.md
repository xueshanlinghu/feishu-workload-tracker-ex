# 飞书应用配置指南

本文档详细说明如何在飞书开放平台创建应用，并为 `feishu-workload-tracker-ex` 配置权限。

## 1. 创建飞书应用

### 1.1 访问飞书开放平台

- 中国版：https://open.feishu.cn
- 国际版：https://open.larksuite.com

### 1.2 创建自建应用

1. 登录飞书开放平台
2. 点击"开发者后台" → "创建企业自建应用"
3. 填写应用信息：
   - 应用名称：人力占用记录系统
   - 应用描述：记录团队成员每日工作人力占用情况
   - 应用图标：上传应用图标（可选）
4. 点击"创建"

### 1.3 获取应用凭证

创建成功后，在"凭证与基础信息"页面获取：
- **App ID**: `cli_xxxxxxxxx`
- **App Secret**: `xxxxxxxxx`（点击"查看"）

⚠️ **重要**：App Secret请妥善保管，不要泄露。

## 2. 配置应用权限

### 2.1 添加权限范围

在"权限管理"页面，搜索并添加以下权限：

#### 多维表格权限
- `bitable:app` - 访问多维表格应用
  - 描述：允许应用读取和操作多维表格

#### 通讯录权限
- `contact:contact.base:readonly` - 获取通讯录基础信息
  - 描述：允许应用获取用户姓名、邮箱、头像等基础信息
- `contact:department.organize:readonly` - 获取通讯录部门组织架构信息
  - 描述：允许应用按部门拉取成员列表

#### 身份验证权限（OAuth相关）
这些权限通常会自动添加，无需手动配置。

⚠️ **重要**：
- 通讯录权限需要在 **应用身份权限 `tenant_access_token`** 页签中开通。
- 修改权限后必须重新**创建版本并发布**。
- 如果未正确开通或未发布，获取成员列表时常见报错是 `99991672 Access denied`。

### 2.2 发布权限版本

1. 添加完权限后，点击"创建版本"
2. 填写版本说明（如：初始版本）
3. 提交审核（企业自建应用通常会自动通过）
4. 等待版本审核通过后，点击"申请发布"
5. 管理员审批后即可使用

## 3. 配置OAuth回调地址

### 3.1 设置重定向URL

在"安全设置" → "重定向URL"中添加：

**开发环境：**
```
http://localhost:3001/auth/callback
```

**生产环境：**
```
https://your-domain.com/auth/callback
```

⚠️ **注意**：URL必须完全匹配，包括协议、域名、端口和路径。

## 4. 获取多维表格信息

### 4.1 打开多维表格

在飞书中打开你要使用的多维表格。

### 4.2 从URL获取app_token和table_id

浏览器地址栏URL格式示例：
```
https://xxx.feishu.cn/base/app_token_xxx?table=tbl_record_xxx&view=vew_xxx
```

提取参数：
- **app_token**: `app_token_xxx`（`base/`后面到`?`之间）
- **table_id**: `tbl_record_xxx`（`table=`后面的值）

### 4.3 表格字段说明

确保你的多维表格包含以下字段：

| 字段名称 | 字段类型 | 说明 |
|---------|---------|------|
| 记录ID | 自动编号 | 自动生成的记录序号 |
| 记录日期 | 日期 | 记录的日期 |
| 记录人员 | 人员 | 工作负载的归属人员 |
| 类型 | 单选 | 一级分类名称 |
| 内容 | 单选 | 二级分类名称 |
| 细项 | 单选 | 三级分类名称，无细项时可留空 |
| 人力占用 | 评级 | 人力占用量，配置10个选项（1,2,3...10），显示为笑脸 |
| 人力占用计算 | 公式 | 公式字段：`人力占用/10`，自动计算实际人力值（0.1-1.0） |
| 记录状态 | 单选/文本 | 记录状态（如：未发周报） |
| 创建人 | 人员 | 创建记录的人 |

⚠️ **重要**：字段名称必须完全匹配（包括中文）。

### 4.4 配置人力占用字段

**人力占用字段配置步骤：**

1. 创建"人力占用"字段，选择"评级"类型
2. 配置评级选项：
   - 添加10个评级等级（1, 2, 3, 4, 5, 6, 7, 8, 9, 10）
   - 每个等级可以设置对应的笑脸图标（可选）
   - 等级1对应0.1人天，等级10对应1.0人天
3. 创建"人力占用计算"字段（公式类型）：
   - 公式：`人力占用/10`
   - 这样可以自动将评级数字转换为实际的人力值（0.1-1.0）

### 4.5 配置三级字典表

推荐在同一个多维表格应用中维护 4 张业务表：
1. **类型字典表**：包含 `类型`、`关联内容`
2. **内容字典表**：包含 `内容`、`关联细项`
3. **细项字典表**：包含 `细项`
4. **人力记录表**：包含 `记录日期`、`记录人员`、`类型`、`内容`、`细项`、`人力占用` 等字段

其中：
- `关联内容` 应关联到内容字典表记录
- `关联细项` 应关联到细项字典表记录
- 如果某个内容没有三级菜单，可以不配置 `关联细项`

## 5. 配置环境变量

将获取到的信息填入`.env`文件：

```bash
# 复制示例文件
cp .env.example .env

# 编辑.env文件
# 填入以下信息：
FEISHU_APP_ID=cli_xxxxxxxxx
FEISHU_APP_SECRET=app_secret_xxxxxxxxx
FEISHU_APP_TOKEN=app_token_xxxxxxxxx
FEISHU_TYPE_TABLE_ID=tbl_type_xxxxxxxxx
FEISHU_CONTENT_TABLE_ID=tbl_content_xxxxxxxxx
FEISHU_DETAIL_TABLE_ID=tbl_detail_xxxxxxxxx
FEISHU_RECORD_TABLE_ID=tbl_record_xxxxxxxxx
```

## 6. 生成Session密钥

使用以下命令生成随机密钥：

### Bash (Linux/Mac):
```bash
openssl rand -base64 32
```

### Node.js（跨平台）:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

将生成的密钥填入`.env`文件的`SESSION_SECRET`变量。

## 7. 测试配置

### 7.1 启动开发服务器

```bash
npm run dev
```

### 7.2 访问应用

打开浏览器访问：http://localhost:3001

### 7.3 测试OAuth登录

1. 点击"使用飞书登录"
2. 在飞书授权页面点击"同意授权"
3. 成功后会跳转回应用

### 7.4 测试功能

1. 选择日期和人员
2. 依次选择类型、内容，以及必要时的细项
3. 提交到飞书表格
4. 在飞书表格中查看记录

## 8. 常见问题

### Q: 提示"缺少权限"？
A: 检查是否已在 **应用身份权限 `tenant_access_token`** 下开通所需权限，并确保权限版本已发布。

### Q: OAuth回调失败？
A: 检查回调URL配置是否正确，确保与`.env`中的`FEISHU_REDIRECT_URI`完全一致。

### Q: 无法获取用户列表？
A: 确保已添加并发布 `contact:contact.base:readonly` 与 `contact:department.organize:readonly`。若日志出现 `99991672 Access denied`，通常表示这两个应用身份权限还未生效。

### Q: 无法写入多维表格？
A: 确保已添加`bitable:app`权限，并且app_token和table_id正确。

### Q: 提示"未登录或会话已过期"？
A: 检查SESSION_SECRET是否已正确配置，尝试重新登录。

## 9. 生产环境部署注意事项

1. **HTTPS**：生产环境必须使用HTTPS协议
2. **域名配置**：在飞书开放平台配置生产环境的回调URL
3. **环境变量**：确保生产环境的`.env`文件正确配置
4. **权限审核**：确保应用权限已发布并通过审核
5. **安全性**：妥善保管App Secret和Session Secret

## 10. 联系支持

如遇到问题，可以：
- 查看飞书开放平台文档：https://open.feishu.cn/document/
- 查看项目README.md
- 提交GitHub Issue
