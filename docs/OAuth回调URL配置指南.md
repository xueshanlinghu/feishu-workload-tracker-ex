# 飞书OAuth回调URL配置详细指南

## 问题1：找不到配置回调URL的地方？

### 详细步骤（带截图说明）

#### 1. 登录飞书开放平台
- 访问：https://open.feishu.cn（中国版）
- 点击右上角"开发者后台"

#### 2. 进入你的应用
- 在"我的应用"列表中找到你的应用
- 点击应用卡片进入应用详情

#### 3. 找到"重定向URL"配置（关键！）

**方法一：通过"安全设置"**
```
左侧导航栏：
├── 应用信息
├── 凭证与基础信息
├── 权限管理
├── 安全设置 ⭐ ← 点击这里
│   ├── 重定向URL ⭐ ← 在这里配置
│   └── IP白名单
```

**方法二：如果找不到"安全设置"**
有些界面版本可能在：
- "应用功能" → "网页" → "重定向URL"
- 或 "开发配置" → "安全设置"

#### 4. 添加重定向URL
1. 点击"添加重定向URL"或"新增"按钮
2. 输入完整的回调地址：
   ```
   http://localhost:3001/auth/callback
   ```
3. 点击"确定"或"保存"

**⚠️ 注意事项：**
- URL必须以 `http://` 或 `https://` 开头
- 不能有空格或特殊字符
- 路径部分要完全匹配（`/auth/callback`）
- 端口号必须包含（`:3001`）

---

## 问题2：localhost 地址飞书能找到吗？

### 答案：可以！这是标准的OAuth流程

### 工作原理详解

#### OAuth 2.0 授权码流程

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  你的浏览器  │         │  飞书服务器  │         │ 本地应用    │
│             │         │             │         │ localhost   │
└─────────────┘         └─────────────┘         └─────────────┘
      │                       │                       │
      │ 1. 访问登录页          │                       │
      │─────────────────────────────────────────────>│
      │                       │                       │
      │ 2. 重定向到飞书授权页   │                       │
      │<─────────────────────────────────────────────│
      │                       │                       │
      │ 3. 跳转到飞书授权页     │                       │
      │──────────────────────>│                       │
      │                       │                       │
      │ 4. 显示授权页面         │                       │
      │<──────────────────────│                       │
      │                       │                       │
      │ 5. 用户点击"同意授权"   │                       │
      │──────────────────────>│                       │
      │                       │                       │
      │ 6. 302重定向指令        │                       │
      │    (跳转到 localhost)  │                       │
      │<──────────────────────│                       │
      │                       │                       │
      │ 7. 浏览器执行跳转       │                       │
      │    (访问 localhost)    │                       │
      │─────────────────────────────────────────────>│
      │                       │                       │
      │                       │ 8. 后端用code换token   │
      │                       │<──────────────────────│
      │                       │                       │
      │                       │ 9. 返回access_token   │
      │                       │──────────────────────>│
```

### 关键点理解

**1. 飞书服务器不会访问你的 localhost**
- 飞书只是发送一个 HTTP 302 重定向响应
- 响应头包含：`Location: http://localhost:3001/auth/callback?code=xxx`
- 你的浏览器收到这个响应后，自动跳转

**2. 浏览器在本地执行跳转**
- 浏览器看到 localhost，知道是本机
- 浏览器访问本机的3001端口
- 这就是为什么 localhost 可以工作

**3. 这是 OAuth 2.0 的标准流程**
- 所有 OAuth 应用的开发都是这样测试的
- Google、GitHub、微信等 OAuth 都支持 localhost
- 这是业界标准做法

### 类比理解

**场景：你去银行办理业务**

1. **传统理解（错误）**：
   ```
   你以为：银行把钱送到你家（localhost）
   担心：银行找不到你家地址
   ```

2. **实际流程（正确）**：
   ```
   实际：银行给你一张取款单（302重定向）
   取款单上写着："去XX地址取钱"（http://localhost:3001/auth/callback）
   你自己拿着取款单去取钱（浏览器访问localhost）
   ```

### 生产环境 vs 开发环境

| 环境 | 回调URL | 说明 |
|------|---------|------|
| **开发环境** | `http://localhost:3001/auth/callback` | ✅ 本地测试用，完全可行 |
| **生产环境** | `https://your-domain.com/auth/callback` | ✅ 部署后用，外网可访问 |

**开发环境配置示例：**
```env
# .env（开发环境）
NEXTAUTH_URL=http://localhost:3001
FEISHU_REDIRECT_URI=http://localhost:3001/auth/callback
```

**生产环境配置示例：**
```env
# .env（生产环境）
NEXTAUTH_URL=https://workload.yourcompany.com
FEISHU_REDIRECT_URI=https://workload.yourcompany.com/auth/callback
```

---

## 完整配置检查清单

### ✅ 飞书开放平台配置

- [ ] 创建了企业自建应用
- [ ] 获取了 `app_id` (在"凭证与基础信息")
- [ ] 获取了 `app_secret` (在"凭证与基础信息")
- [ ] 添加了权限：
  - [ ] `bitable:app` (多维表格)
  - [ ] `contact:user.base:readonly` (通讯录用户)
  - [ ] `contact:user.employee_id:readonly` (用户工号)
- [ ] 发布了权限版本
- [ ] 配置了重定向URL：`http://localhost:3001/auth/callback`

### ✅ 多维表格配置

- [ ] 从表格URL获取了 `app_token`
- [ ] 从表格URL获取了 `table_id`
- [ ] 确认表格包含必需字段：
  - [ ] 记录日期（日期类型）
  - [ ] 记录人员（人员类型）
  - [ ] 事项（文本类型）
  - [ ] 人力占用（数字类型）

### ✅ 本地项目配置

- [ ] 创建了 `.env` 文件
- [ ] 填入了 `FEISHU_APP_ID`
- [ ] 填入了 `FEISHU_APP_SECRET`
- [ ] 填入了 `FEISHU_APP_TOKEN`
- [ ] 填入了 `FEISHU_TABLE_ID`
- [ ] 填入了 `SESSION_SECRET`
- [ ] 更新了 `NEXTAUTH_URL=http://localhost:3001`
- [ ] 更新了 `FEISHU_REDIRECT_URI=http://localhost:3001/auth/callback`

### ✅ 测试步骤

1. [ ] 启动开发服务器：`npm run dev`
2. [ ] 访问：http://localhost:3001
3. [ ] 点击"使用飞书登录"
4. [ ] 在飞书授权页面点击"同意授权"
5. [ ] 成功跳转回应用并登录

---

## 常见问题

### Q1: 点击登录后跳转到飞书，但提示"redirect_uri错误"？
**A:** 检查以下几点：
- 飞书平台配置的URL和 `.env` 中的 `FEISHU_REDIRECT_URI` 是否完全一致
- URL包含端口号（`:3001`）
- URL以 `http://` 开头（开发环境）
- 路径是 `/auth/callback`

### Q2: 授权后跳转回来，但提示"登录失败"？
**A:** 可能的原因：
- `app_id` 或 `app_secret` 配置错误
- 权限未发布或未通过审核
- Session密钥未配置

### Q3: 飞书界面改版，找不到"安全设置"菜单？
**A:** 尝试以下位置：
- "应用配置" → "安全设置"
- "开发配置" → "重定向URL"
- "应用功能" → "网页" → "重定向URL"
- 或直接在搜索框搜索"重定向URL"

### Q4: 可以配置多个回调URL吗？
**A:** 可以！建议配置：
- `http://localhost:3000/auth/callback`（备用端口）
- `http://localhost:3001/auth/callback`（当前使用）
- `https://your-domain.com/auth/callback`（生产环境）

### Q5: 生产环境部署后需要修改什么？
**A:** 需要：
1. 在飞书平台添加生产环境的回调URL（https域名）
2. 更新 `.env` 中的 `NEXTAUTH_URL` 和 `FEISHU_REDIRECT_URI`
3. 重新构建和部署应用

---

## 技术原理补充

### HTTP 302 重定向示例

**飞书服务器的响应：**
```http
HTTP/1.1 302 Found
Location: http://localhost:3001/auth/callback?code=abc123&state=xyz789
```

**浏览器行为：**
```javascript
// 浏览器自动执行：
window.location.href = "http://localhost:3001/auth/callback?code=abc123&state=xyz789";
```

这就是为什么 localhost 可以工作的原因！

---

## 总结

1. ✅ **localhost 回调URL完全可行**，这是OAuth标准流程
2. ✅ **飞书不会访问你的localhost**，是浏览器在本地跳转
3. ✅ **开发和生产环境分别配置**不同的回调URL
4. ✅ **确保飞书平台和代码中的URL完全一致**

准备好配置信息后，我可以帮你继续调试！
