# Stripe 集成方案 — TIKTON Portal

> 状态：方案稿 v1 (2026-06-28)
> 范围：portal 端（前端）+ 与后端 orchestrator 的契约扩展
> 关联：`docs/API-CONTRACT.md` v1、`src/app/(account)/Billing.tsx`、`src/hooks/useSubscriptions.ts`

---

## 1. 推荐方案：Stripe Checkout (hosted, redirect)

**3 行理由**：
1. **PCI 合规负担最低** — 卡号不过我方域名，SAQ A 级别，CNY 定价 + 跨境支付合规成本可控。
2. **SPA 集成最简** — 后端创建 `Checkout Session` 返回 `session.url`，前端 `window.location.href = url` 一行搞定，**不需要 `@stripe/react-stripe-js` 也不需要 Elements 嵌入**；Alipay/微信等本地支付方式 Stripe 已原生集成，无需额外客户端代码。
3. **支持未来扩展** — 同一 `Checkout Session` 接口下可加 trial、coupon、tax，渐进式升级到 Embedded Checkout 不需要重写前端调用。

### 备选方案对比

| 维度 | **Checkout (hosted)** ✅ | Elements (embedded) | Payment Links |
|---|---|---|---|
| 集成成本 | 低（后端 1 endpoint + 前端 1 redirect） | 中（前端要 Stripe.js Provider + 双向 confirm 状态机） | 极低（无代码） |
| UI 自定义 | 主题色/logo 限制 | 完全自定义 | 仅 Stripe Dashboard 字段 |
| 订阅管理 | Stripe Customer Portal 跳回 | 自己写 cancel/update UI | 无 |
| 中国市场 (CNY) | ✅ Alipay 插件，CNY 原生 | ✅ 同 | ✅ 但无订阅 |
| PCI 范围 | SAQ A | SAQ A | SAQ A |
| 与现 SPA 契合 | 高（纯重定向） | 中（要管 SDK 生命周期） | 低（无 SPA 状态联动） |

**结论**：选 Checkout hosted。前端最小改动就是从「点按钮→调 `/upgrade`」改成「点按钮→调 `/checkout-session`→302 到 Stripe→回 `/billing/return`」。

---

## 2. Portal 端改动清单

### 2.1 新增 `src/lib/api/stripe.ts`

> 文件作用：把"调后端拿 session 然后重定向"封装成一个原子操作，方便 Billing 组件复用。

```ts
// 函数签名（不在本文档写实现）
export interface CheckoutSessionResponse { url: string; session_id: string }
export async function createCheckoutSession(planId: string): Promise<CheckoutSessionResponse>
export function redirectToCheckout(url: string): void  // window.location.href = url
```

内部走 `apiClient.post('/v1/billing/checkout-session', { plan_id })`，复用现有 `src/lib/api/client.ts` 错误处理与 401 回调。

### 2.2 修改 `src/hooks/useSubscriptions.ts`

**现状**（`useUpgradeSubscription`）：直接 POST `/v1/subscriptions/upgrade`，后端 mock 一键完成。
**改为并存**（不删旧的，留给 feature flag 关闭时的 dev/mock 路径）：

| 旧 | 新 |
|---|---|
| `useUpgradeSubscription(planId)` | `useCreateCheckoutSession()` 返回 `useMutation<CheckoutSessionResponse, ApiError, string>` |

`useCreateCheckoutSession` 不在 `onSuccess` 里改 query cache——因为真正的订阅状态变更在 Stripe webhook 落地之后、由 `useCurrentSubscription` 轮询或 invalidate 触发。这样不会让用户在付完款之前看到虚假成功。

### 2.3 修改 `src/app/(account)/Billing.tsx`

改动点（精确到行级别）：
- L9 `const upgrade = useUpgradeSubscription()` → `const checkout = useCreateCheckoutSession()` + `const [errorMsg, setErrorMsg] = useState<string | null>(null)`
- L40 `disabled={... || upgrade.isPending}` → `disabled={... || checkout.isPending}`
- L41 `onClick={() => upgrade.mutate(p.id)}` →
  ```ts
  onClick={async () => {
    try {
      const { url } = await checkout.mutateAsync(p.id);
      redirectToCheckout(url);  // 浏览器离开当前页
    } catch (e) {
      setErrorMsg(e instanceof ApiError ? e.message : 'Unable to start checkout');
    }
  }}
  ```
- 错误条：在 `<Card>` 之间插一个 `<Alert variant="destructive">` 仅当 `errorMsg` 非空时渲染。
- 按钮文案：`upgrade.isPending ? 'Upgrading…'` → `checkout.isPending ? 'Opening checkout…'`

### 2.4 新增 `src/app/(account)/BillingReturn.tsx`

路由：`/billing/return?session_id=...`（在 `src/app/router.tsx` 注册 `path="billing/return"`）。

行为：
1. 读 `URLSearchParams` 拿 `session_id`
2. 调 `GET /v1/billing/return?session_id=...`（带 auth header）
3. 三态：
   - `payment_status === 'paid'` → `<Navigate to="/billing" replace />`，让 Billing 重新拉 `useCurrentSubscription` 显示新 plan
   - `payment_status === 'unpaid'` / `requires_payment_method` → 显示友好提示 + 「重试」按钮跳回 `/billing`
   - 后端返回 404 / 过期 → 「支付会话已过期，请重新选择套餐」+ 跳回 `/billing`

> 这页是 **portal 自己的成功页**，**真正的支付完成依赖后端 webhook** 写入订阅。门户只做"显示状态"，不依赖 webhook 时序。

### 2.5 路由注册

`src/app/router.tsx`：
```tsx
{ path: 'billing/return', element: <BillingReturn /> }
```

---

## 3. API 契约扩展

> 以下追加到 `docs/API-CONTRACT.md` 末尾（不破坏 v1，向后兼容旧的 `/v1/subscriptions/upgrade`）。

### `POST /v1/billing/checkout-session`

请求：
```json
{ "plan_id": "pro_monthly" }
```
响应 `200`：
```json
{ "url": "https://checkout.stripe.com/c/pay/cs_test_...", "session_id": "cs_test_..." }
```
错误：
- `401` UNAUTHENTICATED
- `402` QUOTA_EXCEEDED（已订阅更高级别）
- `409` PLAN_NOT_FOUND
- `429` RATE_LIMITED

后端行为：服务端用 `STRIPE_SECRET_KEY` 调 `stripe.checkout.sessions.create({ mode: 'subscription', line_items: [{ price: <mapped price_id>, quantity: 1 }], success_url, cancel_url, client_reference_id: <user_id> })`，把 `session.url` 回传前端。

### `GET /v1/billing/return?session_id=xxx`

用途：门户 `/billing/return` 页面拉取一次支付结果用于显示。**不是 webhook**，**不是 source of truth**——真正的状态变更由 Stripe → orchestrator webhook 完成。

响应 `200`：
```json
{
  "payment_status": "paid" | "unpaid" | "no_payment_required",
  "subscription": { "plan_id": "pro_monthly", "status": "active", "current_period_end": "2026-07-28T..." }
}
```
错误：
- `404` SESSION_NOT_FOUND（session 过期或伪造）
- `402` PAYMENT_FAILED
- `401` UNAUTHENTICATED

---

## 4. 环境变量变化

### 4.1 Portal `.env.example`（追加）

```env
# Stripe (public-safe, prefix pk_)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_replace_me

# Feature flag: false = 走旧的 useUpgradeSubscription (mock/dev), true = 走 checkout
VITE_STRIPE_ENABLED=false
```

`VITE_STRIPE_PUBLISHABLE_KEY` 是 **公开 key**（`pk_test_...` / `pk_live_...`），设计上允许暴露在前端 bundle 中——仅用于初始化 Stripe.js（如果未来加 Embedded Checkout 才需要），hosted Checkout redirect 模式甚至**不需要**这个 key，但保留以便渐进升级。

### 4.2 后端 orchestrator `.env`（追加，不在 portal 仓库）

```env
STRIPE_SECRET_KEY=sk_test_replace_me        # 仅后端，永不进 frontend bundle
STRIPE_WEBHOOK_SECRET=whsec_replace_me       # webhook 签名校验
STRIPE_PRICE_MAP_JSON={"basic":"price_xxx","pro":"price_yyy","enterprise":"price_zzz"}
```

---

## 5. 测试要点

### 5.1 单元（vitest + testing-library）

| 用例 | 文件 | 断言 |
|---|---|---|
| 点 Choose 触发 createCheckoutSession mutation | `src/app/(account)/Billing.test.tsx` (新增) | mock fetch 返回 `{url:'https://stripe.test/cs_x'}`，断言 `window.location.href` 被赋值 |
| mutation 失败显示错误条 | 同上 | mock 返回 500，断言 Alert 出现且文案是后端 message |
| 按钮在 pending 时禁用 | 同上 | `getByRole('button', {name:/opening/i})` 存在且 `disabled` |
| BillingReturn 解析 session_id 调 return API | `src/app/(account)/BillingReturn.test.tsx` (新增) | mock URLSearchParams + fetch，断言调用了正确的 URL |
| 三态：paid → 重定向；unpaid → 提示；404 → 提示 | 同上 | 三组独立用例 |
| feature flag 关闭时仍走 useUpgradeSubscription | `src/hooks/useSubscriptions.test.ts` (新增) | env mock `VITE_STRIPE_ENABLED=false` |

### 5.2 E2E（Playwright）

`tests/e2e/billing-checkout.spec.ts`：
1. 登录 → 进入 `/billing` → 断言 3 张 plan card 渲染
2. mock `/v1/billing/checkout-session` 返回 `https://stripe.test/cs_test_x` → 点 Choose → 断言浏览器导航离开 portal（监听 `framenavigated`）
3. **不在 e2e 测真 Stripe 跳转**——Stripe 域名是第三方，CI 网络与凭据成本高。用 MSW 在 `tests/setup.ts` 拦截 `checkout.stripe.com` 即可。

---

## 6. 风险与约束

### 6.1 公开 key 暴露是否安全 ✅

**安全**。Stripe 官方文档明确：`pk_*` 仅能调用 Stripe 提供的 UI（Checkout / Elements）做卡号 tokenization，**无法**发起扣款、退款、查订阅、查 customer。详见 [Stripe API keys 文档](https://docs.stripe.com/keys)。

**限制**：
- 必须域名白名单（Dashboard 配置 publishable key 的 allowed domains）
- 启用 Restricted API Keys (`rk_*`) 替代 `sk_*` 暴露面更小
- 启用 webhook 签名校验（`stripe.webhooks.constructEvent`）

### 6.2 中国市场约束 ⚠️ 重点

| 维度 | 现状 (2026-06) |
|---|---|
| Stripe 收款主体 | **中国大陆主体不可直接开 Stripe 账户**——通常用香港/新加坡公司主体 |
| Alipay 支持 | ✅ 原生集成，CNY 默认货币，无需额外代码 |
| WeChat Pay | ✅ Checkout 支持（Pay 模式），订阅模式需 invite |
| ICP 备案 | **必须**——portal 域名 + 后端 API 域名都要备案，否则国内用户访问会被阻断 |
| 跨境收款 | 走 Stripe 默认汇率 + 1.5% + 0.3 USD/笔；CNY 入账需香港账户 |
| 税务 | Stripe 自动开票（仅部分地区）；中国大陆增值税需自己处理 |

**替代方案对比**（若决定不用 Stripe）：

| 方案 | 优势 | 劣势 |
|---|---|---|
| **Ping++** | 国内合规、本地支付方式齐全、人民币结算 | 海外卡费率较高、需 ICP + 增值电信业务许可 |
| **Paddle (MoR)** | Merchant of Record 自动处理税务 | 抽佣高（5%+0.5 USD）、对中国本地支付方式支持弱 |
| **Airwallex** | 适合跨境、多币种 | 集成成本介于 Stripe 与 Ping++ 之间 |
| **Lemon Squeezy (MoR)** | 极简订阅 | 同 Paddle，海外为主 |

**建议**：MVP 阶段维持 Stripe + 香港主体 + ICP 备案；若 CN 流量 > 30%，Q3-Q4 评估 Ping++ 兜底国内用户。

### 6.3 退款 / 争议 / 税务

| 项 | 处理位置 |
|---|---|
| 用户主动退款 | **仅后端**——Stripe Dashboard 或后端 admin API（`stripe.refunds.create`），前端无入口 |
| 争议 (chargeback) | Stripe Dashboard 邮件 → 后端 webhook `/v1/webhooks/stripe` 监听 `charge.dispute.created`，自动暂停订阅 |
| 税务计算 | Stripe Tax 启用，CNY 价格含税；invoice URL 通过 Customer Portal 让用户下载 |
| 汇率 | Stripe 自动按 `fx_rate` 处理，前端只展示基础币种价 |

---

## 7. 工时估算

> 单位：人天（8h）。Senior frontend (React + TS strict) 基准。

| 项 | 工时 | 估算依据 |
|---|---|---|
| `src/lib/api/stripe.ts` + 类型 | 0.5 | 1 文件，~30 行 |
| `useCreateCheckoutSession` hook | 0.5 | 与现有 `useUpgradeSubscription` 90% 同构，主要改 mutationFn 与 onSuccess 语义 |
| `Billing.tsx` 按钮行为改造 + 错误条 | 1.0 | 现有 ~50 行，改 ~20 行 + 错误状态机 |
| `BillingReturn.tsx` 新页 + 三态 | 1.0 | ~80 行新代码 |
| 路由注册 + 导航 guard | 0.5 | 5 行改动 |
| 单元测试 6 用例 | 1.5 | 平均 0.25 天/用例，含 mock fetch |
| E2E 1 spec（MSW mock） | 1.0 | 含 MSW handler |
| `.env.example` + 文档 | 0.5 |  |
| **Frontend 小计** | **6.5 人天** | |

**分档定位**：落在 **5-8 人天档**（一个 sprint 内可完成）。

### 后端配合项（不在本工时表，但 portal 上线阻塞）

| 项 | 估时 | 备注 |
|---|---|---|
| `POST /v1/billing/checkout-session` endpoint | 1.5 | 调 Stripe SDK + 价格映射 |
| `GET /v1/billing/return` endpoint | 0.5 | 简单 lookup |
| `/v1/webhooks/stripe` 监听 + 签名校验 + 写库 | 2.0 | `checkout.session.completed` → 改订阅 |
| Stripe Dashboard 配置（webhook URL + 价格 ID） | 0.5 | 一次性 |
| 香港主体开户 / ICP 备案 | 不在工时 | 业务/法务线，2-6 周 |

---

## 8. 依赖新增

```bash
pnpm add @stripe/stripe-js
```

**只加一个包**——`@stripe/stripe-js` 用于 hosted Checkout 模式下（可选）`loadStripe()` + `redirectToCheckout()` 的客户端 helper。**不加** `@stripe/react-stripe-js`，原因：
- 我们用 hosted redirect 模式，不需要 StripeProvider / Elements 组件
- 若选纯 `window.location.href = session.url` 方案，**连 `@stripe/stripe-js` 都可以不加**——但加上更稳，未来切 Embedded Checkout 时不用重装依赖

**最终推荐**：加 `@stripe/stripe-js`（~13 KB gzip），不加 `@stripe/react-stripe-js`（~50 KB+）。

---

## 9. 回滚策略

### 9.1 Feature flag

`VITE_STRIPE_ENABLED=false`（默认）→ 走旧路径 `useUpgradeSubscription`（mock 一键升级）
`VITE_STRIPE_ENABLED=true` → 走新路径 `useCreateCheckoutSession` → Stripe 重定向

在 `src/lib/env.ts` 加：
```ts
VITE_STRIPE_ENABLED: z.enum(['true','false']).default('false').transform(v => v === 'true')
```

### 9.2 代码层

- `useUpgradeSubscription` **保留不删**——旧的 Billing 按钮 `onClick` 行为作为 fallback
- `Billing.tsx` 用 `if (env.VITE_STRIPE_ENABLED) <NewButton> else <OldButton>` 双按钮分支，灰度切换
- `BillingReturn.tsx` 是纯新增，删掉路由即可回滚，不影响其他代码
- `src/lib/api/stripe.ts` 是纯新增，回滚即删文件

### 9.3 回滚触发条件

| 信号 | 动作 |
|---|---|
| Stripe webhook 5xx > 5% | flag → false，回 mock 路径 |
| 用户投诉「付了款但没生效」> 3 单/日 | flag → false + 后端查 Stripe Dashboard |
| Alipay 通道挂掉（Stripe status page 告警） | flag → false + 公告 |

---

## 10. 关键引用

- [Stripe Checkout 文档 (subscriptions)](https://docs.stripe.com/payments/checkout/subscriptions)
- [Stripe API keys (publishable vs secret)](https://docs.stripe.com/keys)
- [Stripe Alipay 集成](https://docs.stripe.com/payments/alipay)
- [Stripe webhook 签名校验](https://docs.stripe.com/webhooks/signatures)
- [Stripe Customer Portal（订阅管理回跳）](https://docs.stripe.com/billing/subscriptions/integrating-customer-portal)
- [@stripe/stripe-js npm](https://www.npmjs.com/package/@stripe/stripe-js)
- [Stripe 支持国家 / Business locations](https://docs.stripe.com/payments/alipay) — 验证 AT/AU/BE/.../SG/US 等可收款主体

---

## 11. 决策一句话总结

**Stripe Checkout (hosted redirect) + 后端 checkout-session endpoint + 门户 BillingReturn 三态页，feature flag `VITE_STRIPE_ENABLED` 控制灰度，frontend 总工时 6.5 人天（落在 5-8 天档）。**
