# 飞书API开发文档参考

## 官方文档链接

### 主要文档入口

1. **飞书开放平台首页**
   https://open.feishu.cn/

2. **开发文档主页**
   https://open.feishu.cn/document/

3. **服务端API文档**
   https://open.feishu.cn/document/server-docs/

---

## 本项目使用的核心API

### 1. 身份验证（OAuth 2.0）

**文档链接：**
https://open.feishu.cn/document/server-docs/authentication-management/

#### 1.1 授权URL生成
- **端点**: `https://open.feishu.cn/open-apis/authen/v1/authorize`
- **文档**: https://open.feishu.cn/document/server-docs/authentication-management/login-state-authorization/get-authorization-code

#### 1.2 获取tenant_access_token（应用访问凭证）
- **端点**: `POST /open-apis/auth/v3/tenant_access_token/internal`
- **文档**: https://open.feishu.cn/document/server-docs/authentication-management/access-token/tenant_access_token_internal
- **用途**: 调用企业级API（通讯录、Bitable等）
- **有效期**: 2小时

#### 1.3 获取user_access_token（用户访问凭证）
- **端点**: `POST /open-apis/authen/v1/access_token`
- **文档**: https://open.feishu.cn/document/server-docs/authentication-management/access-token/create
- **用途**: 代表用户身份调用API
- **有效期**: 2小时（可使用refresh_token刷新）

#### 1.4 获取用户信息
- **端点**: `GET /open-apis/authen/v1/user_info`
- **文档**: https://open.feishu.cn/document/server-docs/authentication-management/login-state-authorization/obtain-user-information
- **需要**: user_access_token

---

### 2. 通讯录API（Contact）

**文档链接：**
https://open.feishu.cn/document/server-docs/contact-v3/

#### 2.1 获取部门用户列表
- **端点**: `GET /open-apis/contact/v3/users/find_by_department`
- **文档**: https://open.feishu.cn/document/server-docs/contact-v3/user/find_by_department
- **需要权限**:
  - `contact:contact.base:readonly`
  - `contact:department.organize:readonly`

#### 2.2 批量获取用户信息
- **端点**: `POST /open-apis/contact/v3/users/batch_get_id`
- **文档**: https://open.feishu.cn/document/server-docs/contact-v3/user/batch_get_id

---

### 3. 多维表格API（Bitable）

**文档链接：**
https://open.feishu.cn/document/server-docs/docs/bitable-v1/

#### 3.1 查询记录
- **端点**: `POST /open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records/search`
- **文档**: https://open.feishu.cn/document/server-docs/docs/bitable-v1/app-table-record/search
- **需要权限**: `bitable:app`
- **支持**: 筛选、排序、分页

#### 3.2 批量创建记录
- **端点**: `POST /open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records/batch_create`
- **文档**: https://open.feishu.cn/document/server-docs/docs/bitable-v1/app-table-record/batch_create
- **限制**: 一次最多500条

#### 3.3 获取字段配置
- **端点**: `GET /open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/fields`
- **文档**: https://open.feishu.cn/document/server-docs/docs/bitable-v1/app-table-field/list
- **用途**: 获取字段类型、选项等信息

---

## 常见错误码

### OAuth相关错误

| 错误码 | 含义 | 解决方法 |
|--------|------|----------|
| 10000 | 参数错误 | 检查请求参数是否完整 |
| 10013 | 授权码无效或已过期 | 授权码只能使用一次，重新发起授权 |
| 20014 | app_access_token无效 | 检查app_id和app_secret是否正确 |
| 99991668 | redirect_uri不匹配 | 确保redirect_uri与飞书平台配置完全一致 |
| 99991672 | Access denied | 检查通讯录应用身份权限是否已开通并发布 |

### Bitable相关错误

| 错误码 | 含义 | 解决方法 |
|--------|------|----------|
| 1254104 | 记录不存在 | 检查record_id是否正确 |
| 1254045 | 字段类型不匹配 | 检查字段值类型是否符合字段定义 |
| 403 | 权限不足 | 检查应用是否有bitable:app权限 |

---

## 权限配置

### 本项目需要的权限

在飞书开放平台"权限管理"中添加：

1. **`bitable:app`** - 访问多维表格
   文档: https://open.feishu.cn/document/server-docs/docs/bitable-v1/notification

2. **`contact:contact.base:readonly`** - 获取通讯录基础信息
   文档: https://open.feishu.cn/document/server-docs/contact-v3/user/list

3. **`contact:department.organize:readonly`** - 获取通讯录部门组织架构信息
   文档: https://open.feishu.cn/document/server-docs/contact-v3/department/parent_department

⚠️ 说明：
- 以上两个通讯录权限需要在 **应用身份权限 `tenant_access_token`** 页签下开通。
- 权限变更后必须重新创建版本并发布，否则运行时仍可能报 `99991672 Access denied`。

### 权限发布流程

1. 在"权限管理"页面添加权限
2. 点击"创建版本"
3. 填写版本说明并提交审核
4. 审核通过后点击"申请发布"
5. 管理员批准后权限生效

---

## 调试工具

### 1. API Explorer（API调试工具）
https://open.feishu.cn/api-explorer/

- 可在线测试所有飞书API
- 自动生成代码示例
- 查看请求和响应详情

### 2. 开发者后台
https://open.feishu.cn/app/

- 管理应用
- 查看API调用日志
- 配置OAuth回调URL

---

## 响应格式

飞书API统一返回格式：

```json
{
  "code": 0,           // 0表示成功，非0表示错误
  "msg": "success",    // 错误描述
  "data": {            // 业务数据（部分API无此字段）
    ...
  }
}
```

**特殊情况：**
- `tenant_access_token` API: 无 `data` 字段，直接返回 `tenant_access_token` 和 `expire`
- 部分API: `data` 可能为空或省略

---

## 最佳实践

### 1. Token管理
- ✅ 缓存tenant_access_token（有效期2小时，提前5分钟刷新）
- ✅ 存储user_access_token和refresh_token在session中
- ✅ Token过期时自动刷新

### 2. 错误处理
- ✅ 检查 `code` 字段判断请求是否成功
- ✅ 记录详细错误日志（包括请求参数）
- ✅ 给用户友好的错误提示

### 3. 安全性
- ✅ 使用HTTPS（生产环境必须）
- ✅ 妥善保管app_secret（不要提交到git）
- ✅ 验证OAuth state参数防止CSRF
- ✅ 使用httpOnly cookie存储session

---

## 常见问题排查

### 问题1: redirect_uri错误
**症状**: 授权后提示"redirect_uri错误"

**排查步骤**:
1. 检查飞书平台"安全设置 → 重定向URL"配置
2. 确保 `.env` 中的 `FEISHU_REDIRECT_URI` 与平台配置**完全一致**
3. 包括协议（http/https）、域名、端口、路径都要匹配

### 问题2: 获取不到用户列表
**症状**: 调用contact API返回空或报错

**排查步骤**:
1. 检查是否添加了 `contact:contact.base:readonly` 权限
2. 检查是否添加了 `contact:department.organize:readonly` 权限
3. 确认这两个权限是在 **应用身份权限 `tenant_access_token`** 下开通的
4. 确认权限版本已发布并生效
5. 检查tenant_access_token是否有效

### 问题3: 无法写入多维表格
**症状**: 创建记录失败

**排查步骤**:
1. 检查是否有 `bitable:app` 权限
2. 确认 `app_token` 和 `table_id` 正确
3. 检查字段值类型是否与表格定义匹配
4. 确认应用有权访问该表格（表格需要授权给应用）

---

## 更多资源

- **开发者社区**: https://open.feishu.cn/community/
- **常见问题**: https://open.feishu.cn/document/home/introduction-to-scope-and-authorization/faq
- **SDK下载**: https://open.feishu.cn/document/tools-and-resources/sdk
- **更新日志**: https://open.feishu.cn/document/changelog

---

## 本项目技术栈文档

- **Next.js**: https://nextjs.org/docs
- **React**: https://react.dev/
- **TypeScript**: https://www.typescriptlang.org/docs/
- **Tailwind CSS**: https://tailwindcss.com/docs
- **iron-session**: https://github.com/vvo/iron-session
- **Axios**: https://axios-http.com/docs/intro
