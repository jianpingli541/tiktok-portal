# TIKTON Portal — 可观测性方案 (Observability Plan)

> 目标：在最少改动下，给 TIKTON Portal (React 18 + Vite 5 SPA, nginx-unprivileged 部署) 补齐**错误 / 性能 / 用户行为**三层可观测性。
> 范围：**前端为主** + **nginx 端日志轻量补充**。后端 (tikton orchestrator) 不在本方案内。
> 状态：方案文档，无代码。

---

## 0. 现状盘点 (基于仓库实测)

| 维度 | 现状 |
|---|---|
| 前端入口 | `src/main.tsx` (含 MSW dev-only + QueryClientProvider + RouterProvider) |
| 路由 | `src/app/router.tsx` (createBrowserRouter, react-router-dom 6.26) |
| API 客户端 | `src/lib/api/client.ts` (fetch + 401 refresh + retry + 15s timeout + ApiError) |
| 错误类 | `src/lib/api/errors.ts` (`ApiError { status, code, message, body }`) |
| Env | `src/lib/env.ts` (zod schema，仅校验 `VITE_API_BASE_URL` / `VITE_ENABLE_MOCK`) |
| Vite | `vite.config.ts` (`build.sourcemap: false`) |
| 部署 | `Dockerfile` (multi-stage, `nginxinc/nginx-unprivileged:1.27-alpine`, EXPOSE 8080) |
| 健康检查 | nginx `location /healthz` → 200，Dockerfile `HEALTHCHECK` wget |
| 监控 | **无** (无 Sentry / 无 RUM / 无埋点 SDK) |

---

## 1. 最小可观测性 3 层

按 ROI 排序，**先做层 1，再做层 2，层 3 看产品决策**。

### 1.1 前端错误 (Errors) — **Sentry**

| 候选 | 取舍 |
|---|---|
| **Sentry React SDK** ⭐ | 一站式：JS exception + unhandled rejection + React error boundary + API error 手动上报。React 18 有官方 `<Sentry.ErrorBoundary>`。 |
| Datadog RUM | 月费 $1.5/1000 sessions 起，与现有栈零集成，需先装 Datadog Agent |
| 自建 (try/catch + POST 到自家后端) | 工作量大、无 source map 反混淆、无 grouping/alert 生态 |
| Bugsnag / Rollbar | 都不错但生态小于 Sentry，且 Source Map 上传流程 Sentry 最成熟 |

**选 Sentry 理由**：(1) React 18 + Vite 官方支持 (`@sentry/react` + `@sentry/vite-plugin`)；(2) Source map 自动上传 + 反混淆栈；(3) 免费层 5K events/月对 MVP 够用；(4) 团队对 SaaS 运维成本远低于自建；(5) Alert / Release / Issue 流一套。

### 1.2 前端性能 (Performance / Web Vitals + API 时延) — **Sentry Performance**

| 候选 | 取舍 |
|---|---|
| **Sentry Performance** ⭐ | 与错误同源、零额外 SDK、复用 session、p50/p75/p95 transaction 直接出图 |
| Datadog RUM | 强但要付钱 + 引入第二供应商；与 Sentry 数据双轨 |
| Google Analytics 4 (web-vitals) | 免费但维度少、无 source map 关联、无 alert 集成 |
| web-vitals.js 自建 + `/api/metrics` | 工作量高、与错误脱钩、需自建聚合 |

**选 Sentry Performance 理由**：(1) 同一 SDK 同时上报 errors + transactions；(2) `browserTracingIntegration` 自动采集 LCP / FID / CLS / TTFB；(3) 通过 `tracing` 把 `src/lib/api/client.ts` 的 fetch 变成 trace，自动得出 API 时延分布；(4) 免费层 5K transactions 对早期够。

### 1.3 用户行为 (Product Analytics) — **PostHog Cloud (EU 区域) ⭐**

| 候选 | 自托管 vs SaaS | 取舍 |
|---|---|---|
| **PostHog Cloud** ⭐ | SaaS (EU region) | 全功能 (events + funnel + session replay + feature flags) 有免费层 (1M events/月)；本项目**未来要 feature flag** 做 Sentry 一键关，正好复用 |
| Plausible | SaaS only | 极简但**只有 PV**，没有 funnel / event |
| Umami | 自托管友好 | 轻量但**没有事件级**埋点 API |

**为什么放最后**：(1) 前两层先跑起来再谈；(2) PostHog 自带 session replay 与 Sentry replay **二选一**，避免双倍数据；(3) 若团队不愿意多挂一个 SaaS，可降级到 `VITE_ANALYTICS_ENABLED=false` 完全跳过。

**MVP 推荐栈一句话**：Sentry (Errors + Performance) + PostHog Cloud EU (Product Analytics)，都是 SaaS + 免费层起步。

---

## 2. Sentry 接入清单 (精确到文件)

### 2.1 依赖

```
pnpm add @sentry/react
pnpm add -D @sentry/vite-plugin
```

> 注：官方推荐 `@sentry/react` 作为生产依赖，`@sentry/vite-plugin` 作为 build-time devDep。

### 2.2 新增 `src/lib/observability.ts`

- 模块顶部 `import * as Sentry from '@sentry/react'`；
- 导出 `initObservability(env)`，内部读取 `VITE_SENTRY_ENABLED` / `VITE_SENTRY_DSN` / `VITE_SENTRY_ENVIRONMENT` / `VITE_SENTRY_RELEASE` / `VITE_SENTRY_TRACES_SAMPLE_RATE`；
- 若 `VITE_SENTRY_ENABLED !== 'true'` → 直接 `return`（默认关闭，见 §10）；
- `Sentry.init({ dsn, environment, release, sendDefaultPii: false, tracesSampleRate, beforeSend, integrations: [Sentry.browserTracingIntegration()] })`；
- 导出 `reportApiError(err: ApiError)` 与 `reportError(err)` 供其他模块调用。

### 2.3 修改 `src/main.tsx`

- 在文件**最顶部** `import '@/lib/observability';` 并调用 `initObservability(...)`（必须早于 ReactDOM，避免丢失 early error）；
- 把 `<RouterProvider>` 用 `<Sentry.ErrorBoundary fallback={<ErrorFallback/>}>` 包住（**React 18 用 ErrorBoundary**，react 19 才用 `onUncaughtError`）；
- 保留现有 MSW dev-only + StrictMode + QueryClientProvider 结构。

### 2.4 修改 `src/lib/api/client.ts`

- 在 `catch (e)` 块中，当 `retry=false` 后仍失败 → 调 `reportApiError(new ApiError(0, 'NETWORK_ERROR', ...))`；
- 在 `if (!res.ok)` 块中，当 `res.status >= 500` → 调 `reportApiError(ApiError)`；4xx **不上报**（业务错误，非异常）；
- 401 由 `onUnauthorized` 处理，不重复上报；
- import 用 `import { reportApiError } from '@/lib/observability'`（避免循环依赖：observability.ts 不 import api/）。

### 2.5 修改 `src/app/router.tsx`

- 把 `createBrowserRouter` 替换为 `withSentryReactRouterRouting(routes)`（**官方 API**，来自 `@sentry/react`）；
- 或等价：在 `BrowserRouter`/`RouterProvider` 模式下使用 `Sentry.reactRouterV6BrowserTracingIntegration({ useEffect, useLocation, useNavigationType, createRoutesFromChildren, matchRoutes })`；
- 二选一，新代码建议 `withSentryReactRouterRouting`，diff 最小。

### 2.6 修改 `vite.config.ts`

```diff
 import { defineConfig } from 'vite';
 import react from '@vitejs/plugin-react';
+import { sentryVitePlugin } from '@sentry/vite-plugin';
 import path from 'node:path';

 export default defineConfig({
   plugins: [
     react(),
+    sentryVitePlugin({
+      org: process.env.SENTRY_ORG,
+      project: process.env.SENTRY_PROJECT,
+      authToken: process.env.SENTRY_AUTH_TOKEN,
+      release: process.env.SENTRY_RELEASE,           // CI 注入 git SHA
+      deploy: { env: process.env.SENTRY_ENVIRONMENT },
+      sourcemaps: { assets: './dist/**', filesToDeleteAfterUpload: ['./dist/**/*.map'] },
+    }),
   ],
   resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
   server: { port: 5173 },
-  build: { target: 'es2022', sourcemap: false },
+  build: { target: 'es2022', sourcemap: true },     // 改 true，prod 也产 map 给 sentry 上传
 });
```

> `SENTRY_AUTH_TOKEN` 仅在 CI 注入，**不进 git**。本地 dev 不会触发上传。

### 2.7 环境变量 (扩展 `src/lib/env.ts` 的 zod schema)

```diff
 const schema = z.object({
   VITE_API_BASE_URL: z.string().url(),
   VITE_ENABLE_MOCK: z.enum(['true', 'false']).transform((v) => v === 'true'),
+  VITE_SENTRY_ENABLED: z.enum(['true', 'false']).default('false'),
+  VITE_SENTRY_DSN: z.string().url().optional(),
+  VITE_SENTRY_ENVIRONMENT: z.enum(['dev', 'staging', 'prod']).default('dev'),
+  VITE_SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
 });
```

- `VITE_SENTRY_RELEASE` 直接从 `import.meta.env` 读（CI build 时注入）。
- Dockerfile build 阶段增加 `ARG VITE_SENTRY_DSN` / `ARG VITE_SENTRY_ENABLED` / `ARG VITE_SENTRY_ENVIRONMENT`，**不要**注入 DSN 到 runtime env（避免泄漏到 nginx 镜像层）。

---

## 3. Sentry Data Scrubbing 策略

### 3.1 SDK 默认安全配置

- `sendDefaultPii: false`（**默认即 false**，但显式声明便于代码审计；不发送 user IP / cookies / username）。
- `dataCollection: { userInfo: false, httpBodies: false }`（**2025 新选项**，明确不采集 user 字段和 HTTP body，避免 React state / form data 泄漏）。

### 3.2 `beforeSend` 回调 — 必须过滤字段

下表列出**必过滤**的字段名（key 路径），命中即替换为 `'[Filtered]'`：

| 字段路径 | 为什么 |
|---|---|
| `request.headers.authorization` | Bearer token，泄露 = 账户接管 |
| `request.headers.cookie` | 含 session id |
| `request.headers["x-api-key"]` / `["x-refresh-token"]` | 与 401 refresh 链路相关 |
| `request.body.email` / `request.body.password` / `request.body.token` | 登录/注册/重置密码表单字段 |
| `user.email` / `user.ip_address` / `user.username` | PII 主体 |
| `exception.values[*].stacktrace.frames[*].vars` | locals 可能含 token，需遍历清空 |
| `breadcrumbs[*].data.*` 中匹配上述 key 名 | UI 操作 breadcrumb 可能泄漏 form data |

### 3.3 实现位置

`src/lib/observability.ts` 内 `initObservability` 中：

```ts
const DENY_KEYS = /(authorization|cookie|x-api-key|x-refresh-token|^email$|^password$|^token$|set-cookie)/i;
function scrub(obj: unknown): unknown { /* 递归遍历，匹配即替换 */ }

Sentry.init({
  ...,
  beforeSend(event) {
    if (event.request) {
      event.request.cookies = undefined;
      event.request.headers = scrubHeaders(event.request.headers);
      if (event.request.data) event.request.data = scrub(event.request.data);
    }
    if (event.user) {
      event.user = { id: event.user.id }; // 只保留匿名 id
    }
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((b) => ({ ...b, data: scrub(b.data) }));
    }
    return event;
  },
});
```

> 文档参考：`https://docs.sentry.io/platforms/javascript/guides/react/configuration/options/#beforeSend`

---

## 4. GDPR / 合规

| 项 | 决策 |
|---|---|
| PII 上报 | **默认关闭**：`sendDefaultPii: false` + `dataCollection.userInfo: false` |
| 用户 opt-out | `VITE_SENTRY_ENABLED=false` 即可全关；UI 层面在 `/account` 加 "Share error reports" 开关（写 `localStorage`，启动时检查并覆盖 env） |
| Session Replay | **默认关**（不在 SDK integrations 数组中）；若开启需 (a) 先做 Cookie 同意横幅 (b) `replaysSessionSampleRate=0.1, replaysOnErrorSampleRate=1.0` (c) `maskAllText: true, blockAllMedia: true` |
| 数据驻留 | **EU 区域** (`de.sentry.io`)。理由：用户群体在国内/欧洲混合，EU 数据中心对 GDPR 合规最稳；Sentry US (`ingest.sentry.io`) 仅在用户明确选 US 时用 |
| DPA | 注册 Sentry 时勾选 DPA (Data Processing Addendum) |
| IP 匿名化 | `sendDefaultPii: false` 自动剥离 IP；额外在 `beforeSend` 中 `delete event.user?.ip_address` |
| Cookie | 不使用 Sentry 自有 cookie 做追踪，仅依赖 `dsn` 标识 project |

---

## 5. 环境与发布追踪

### 5.1 三套 environment

| Env | 用途 | DSN 来源 |
|---|---|---|
| `dev` | 本地开发 + 团队 dogfood | Sentry project: `tiktok-portal-dev` |
| `staging` | 预发部署，跑回归 | Sentry project: `tiktok-portal-staging` |
| `prod` | 生产 | Sentry project: `tiktok-portal-prod` |

每个环境独立 Sentry project，issue 不串。

### 5.2 Release 绑定

```bash
# CI (GitHub Actions) 示例
SENTRY_RELEASE="${GITHUB_SHA::12}"   # git short SHA
SENTRY_ENVIRONMENT="prod"            # or staging
```

- CI 把 `SENTRY_RELEASE` 注入到 `pnpm build` 时的 `process.env`，再被 `sentryVitePlugin` 写到 source map release 名 + 被 `Vite` 替换到 `import.meta.env.VITE_SENTRY_RELEASE`；
- 前端 `Sentry.init({ release: import.meta.env.VITE_SENTRY_RELEASE })`；
- 部署完成后调 `sentry releases new -p tiktok-portal-prod $SENTRY_RELEASE` + `sentry releases files $SENTRY_RELEASE upload-sourcemaps ./dist` (或直接走 vite plugin 自动上传)；
- 每次 PR merge → 一个 release，可与 GitHub commit 直接关联。

### 5.3 Dockerfile / CI 改动

```diff
 ARG VITE_API_BASE_URL=https://api.example.com
 ARG VITE_ENABLE_MOCK=false
+ARG VITE_SENTRY_ENABLED=false
+ARG VITE_SENTRY_DSN
+ARG VITE_SENTRY_ENVIRONMENT=dev
+ARG SENTRY_RELEASE=dev-local
+ARG SENTRY_ORG
+ARG SENTRY_PROJECT
+ARG SENTRY_AUTH_TOKEN
+ENV VITE_SENTRY_ENABLED=$VITE_SENTRY_ENABLED
+ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
+ENV VITE_SENTRY_ENVIRONMENT=$VITE_SENTRY_ENVIRONMENT
+ENV SENTRY_RELEASE=$SENTRY_RELEASE
+ENV SENTRY_ORG=$SENTRY_ORG
+ENV SENTRY_PROJECT=$SENTRY_PROJECT
+ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN
```

---

## 6. Alert 策略 (Sentry UI 配置，无需改代码)

| Alert 名 | 触发条件 | 通知渠道 | 阈值建议 |
|---|---|---|---|
| `prod-newissue-burst` | 一个**新** issue 5min 内 events > 5 | Slack `#alerts-portal` + Email on-call | issue count > 5 in 5min |
| `prod-regression` | 之前 resolved 的 issue 重新出现 | Slack `#alerts-portal` | state: regressed |
| `prod-error-rate` | 所有 issue events 5min 内 > 50 | Email on-call | event count > 50 in 5min |
| `prod-slow-api` | transaction `p95` > 2000ms | Slack `#alerts-portal` | threshold: 2000ms, window: 10min |
| `prod-lcp-regression` | transaction `measurements.lcp` p75 > 4000ms | Slack `#perf-portal` | threshold: 4000ms, window: 30min |
| `staging-newissue` | staging 任意新 issue | Slack `#ci-portal` | issue count > 1 in 5min |

**Slack webhook**：在 Sentry Settings → Integrations → Slack 配 incoming webhook；通知模板用 `@here` 标记紧急。

---

## 7. nginx 端日志 (轻量补充)

### 7.1 access log — 改用 JSON 格式

在 `nginx.conf` 的 `server { ... }` 块内：

```nginx
log_format json escape=json
  '{'
  '"ts":"$time_iso8601",'
  '"remote_addr":"$remote_addr",'
  '"method":"$request_method",'
  '"path":"$request_uri",'
  '"status":$status,'
  '"bytes":$body_bytes_sent,'
  '"rt":$request_time,'
  '"ua":"$http_user_agent",'
  '"ref":"$http_referer"'
  '}';

access_log /var/log/nginx/access.log json;
error_log  /var/log/nginx/error.log warn;
```

> `escape=json` 自 nginx 1.25 起支持（unprivileged 镜像 1.27-alpine 已包含）。无需额外模块。

### 7.2 容器化策略 (推荐 stdout → Loki)

unprivileged 镜像不写 `/var/log/nginx/*.log` 到 host，直接改：

```nginx
access_log /dev/stdout json;
error_log  /dev/stderr warn;
```

- 优点：`docker logs` / `kubectl logs` 直接看，零额外配置；
- 进阶：接 Grafana Loki 用 Promtail sidecar 收容器 stdout，自动打 `app=portal` label；
- 替代方案：`/var/log/nginx/*.log` + `logrotate` + cron sidecar，复杂度高，不推荐 MVP 阶段。

### 7.3 健康检查保留

`/healthz` 已在 `nginx.conf` 与 `Dockerfile` 中，**不写 access log**（在 `location` 内 `access_log off;` 避免噪声淹没真实流量）。

---

## 8. 成本估算 (基于 Sentry 2025/2026 官网定价)

### 8.1 Sentry 定价 (Developer vs Team)

| 计划 | 月费 | Errors | Replays | Tracing | 适用 |
|---|---|---|---|---|---|
| **Developer (Free)** | $0 | 5K events | 50 | 5M spans | 1 人 / MVP |
| **Team** | **$26** (年付) | 50K events | 50 | 5M spans | 小团队 |
| **Business** | $80 | 50K + 按量 | 50 + 按量 | 5M + 按量 | 商业化 |
| 按量 | — | $0.000065/event (~$0.065/1K) | — | — | 超出 |

> 上述数字摘自 `https://sentry.io/pricing/` (2025-2026 pricing)。

### 8.2 用户量三档 → 月成本估算

假设：人均每月触发 0.5 error event + 5 transaction (含 5% sample rate 后约 0.25 sampled) + 0.02 replay。

| 用户量档 | MAU | 错误 events | Sampled txns | Replays | 推荐计划 | 月成本 |
|---|---|---|---|---|---|---|
| **保守** (MVP 验证) | 1,000 | 500 | 1,250 | 20 | **Developer Free** | **$0** |
| **中性** (增长期) | 10,000 | 5,000 | 12,500 | 200 | **Team** | **$26** |
| **激进** (规模化) | 100,000 | 50,000 (≈ 计划上限) | 125,000 (限 5M) | 2,000 → 超出按量 | Team + 按量 | **$26 + ~$5 (溢出) ≈ $31** |

> PostHog Cloud EU 免费层 (1M events/月) 在所有三档下都够用，**第三档额外成本 ≈ $0**。

---

## 9. 实施工时 (人天)

### Phase 1 — MVP (前 3 天，最小可行)

| Day | 任务 | 人天 |
|---|---|---|
| D1 上午 | 注册 Sentry org + 3 个 project (dev/staging/prod) + 拿 DSN + 配 Slack webhook | 0.5 |
| D1 下午 | 加 `@sentry/react` / `@sentry/vite-plugin` 依赖；写 `src/lib/observability.ts` | 0.5 |
| D2 上午 | `main.tsx` / `router.tsx` / `client.ts` 接入；写 beforeSend scrub | 1.0 |
| D2 下午 | `vite.config.ts` 配 source map plugin；`env.ts` schema 扩 | 0.5 |
| D3 | `nginx.conf` access log JSON；Dockerfile 加 ARG；CI 注入 SENTRY_RELEASE | 0.5 |
| D3 | Playwright e2e 加 "throw test error" 验证；alert 规则 1 条 (新 issue burst) | 0.5 |

**Phase 1 小计：3.5 人天**（一人 3 天做完 + 半天空）

### Phase 2 — 完整 (后 2 周)

| 周 | 任务 | 人天 |
|---|---|---|
| W2 D1-2 | 配齐 6 条 alert 规则 + on-call 轮值 | 1.0 |
| W2 D3 | `/account` 加 "Share error reports" 开关 + localStorage opt-out | 1.0 |
| W2 D4 | 接 PostHog Cloud EU，埋点注册/付费 funnel（注册→验证→首单） | 1.5 |
| W2 D5 | Session Replay 实验性开启（dev 环境，验证 maskAllText） | 0.5 |
| W3 D1 | Sentry Dashboard (errors by route / p95 by endpoint) | 1.0 |
| W3 D2 | 文档：runbook "Sentry 告警处理流程" | 0.5 |
| W3 D3 | 压测 (k6) 校验 alert 阈值合理性 | 0.5 |

**Phase 2 小计：6 人天**

**合计：~10 人天 (1 人 × 2 周)**。

---

## 10. 回滚方案

### 10.1 Feature Flag

`VITE_SENTRY_ENABLED` 默认 `false`：

| 场景 | 操作 |
|---|---|
| 正常上线 | CI 注入 `VITE_SENTRY_ENABLED=true` |
| 紧急回滚 | 改 CI 默认值 / 重新构建 `VITE_SENTRY_ENABLED=false` 的镜像 / 或在 CDN 层改 nginx `sub_filter` 把 `sentry` 域名替换为空 |
| 单用户回滚 | `/account` 开关写 `localStorage['sentry_opt_out']='1'`，启动时 `initObservability` 检查 |

### 10.2 防御深度

1. `initObservability` 内 try/catch → 任何 SDK 异常仅 `console.warn`，不阻塞应用；
2. DSN 缺失 → `init` 直接 return，不加载 SDK；
3. SDK 与 react-router 不兼容 → 在 `try { Sentry.init(...) } catch {}`，最差情况是**无监控可用**，应用照常运行；
4. 网络不可达 → SDK 自带 buffer + retry (5 次)，失败事件丢弃，**不会无限占内存**。

### 10.3 一键回滚脚本

```bash
# 关 Sentry 重新部署
docker build --build-arg VITE_SENTRY_ENABLED=false -t portal:rollback .
docker push registry/portal:rollback
kubectl set image deploy/portal portal=registry/portal:rollback
```

---

## 11. 风险与"不做的事"

### 11.1 不做的事

1. **不集成 Datadog RUM** — Sentry 已覆盖 80%，再上 Datadog 是双倍钱 + 双份 session + 团队认知负担。等 Sentry 真不够用 (50K events/月撑爆) 再考虑迁移；
2. **不做自定义 metrics 后端** — 业务指标 (DAU / 留存) 走 PostHog，技术指标 (错误 / 性能) 走 Sentry，不要发明第三套埋点；
3. **不开启 Session Replay 给生产全部用户** — maskAllText 在自定义组件上有漏报风险 (实测 React Portal / Radix 组件偶发不被 mask)，先 dev/staging 跑 2 周评估，再决定是否 prod 5% 抽样。

### 11.2 风险登记

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| DSN 泄漏到 client bundle | 低 | 低 (DSN 设计上就是 public) | OK，本来就是 public，但避免泄漏 auth token |
| Sentry 自身宕机 | 极低 | 中 (丢错误数据) | SDK 本地 buffer；nginx 上 `/healthz` 不依赖 Sentry |
| Source map 反混淆泄漏源码 | 中 | 高 | map 文件只在 CI 上传 Sentry，**不进 docker 镜像**；`filesToDeleteAfterUpload` 删 map |
| GDPR 投诉 (PII 上报) | 中 | 高 | `sendDefaultPii: false` + `beforeSend` scrub + opt-out UI + EU region |
| 误报警告疲劳 | 高 | 中 | 阈值先宽后紧，Phase 2 末根据真实数据调 |

---

## 附录 A. 引用文档

- Sentry React 指南: `https://docs.sentry.io/platforms/javascript/guides/react/`
- Sentry SDK 配置选项: `https://docs.sentry.io/platforms/javascript/guides/react/configuration/options/`
- Sentry Session Replay 隐私: `https://docs.sentry.io/platforms/javascript/session-replay/privacy/`
- Sentry Alerts: `https://docs.sentry.io/product/alerts/`
- Sentry Release Health: `https://docs.sentry.io/product/releases/`
- Sentry Vite Plugin: `https://www.npmjs.com/package/@sentry/vite-plugin`
- Sentry 定价: `https://sentry.io/pricing/`
- nginx access log JSON (`escape=json`): `https://nginx.org/en/docs/http/ngx_http_log_module.html`

## 附录 B. 文件改动汇总 (7 改 + 1 增)

| 文件 | 改动类型 | 内容 |
|---|---|---|
| `package.json` | 改 dep | `+ @sentry/react`, `+ @sentry/vite-plugin` |
| `src/lib/env.ts` | 改 | zod schema 加 Sentry 4 项 |
| **`src/lib/observability.ts`** | **新增** | init + beforeSend + reportApiError |
| `src/main.tsx` | 改 | 顶部 import observability + ErrorBoundary |
| `src/app/router.tsx` | 改 | `withSentryReactRouterRouting` 包 routes |
| `src/lib/api/client.ts` | 改 | NETWORK_ERROR + 5xx 上报 |
| `vite.config.ts` | 改 | sentryVitePlugin + sourcemap=true |
| `nginx.conf` | 改 | log_format json + stdout |
| `Dockerfile` | 改 | +7 ARG (Sentry + release) |
| `.github/workflows/*.yml` | 改 | 注入 SENTRY_RELEASE / ORG / PROJECT / AUTH_TOKEN |

---

## 12. 实施记录 (Implementation Record — 2026-06-28)

> 由 subagent 实际落地。列出本任务**真实改动 vs §B 计划的差异**。

### 12.1 本次实际改动

| 文件 | 改动 | 备注 |
|---|---|---|
| `package.json` | + `@sentry/react@10.62.0` (dep), + `@sentry/vite-plugin@5.3.0` (dev) | 按计划 |
| `src/lib/env.ts` | zod schema 加 4 项 Sentry 字段 | 按计划；保留其他 agent 添加的 Stripe 字段 |
| `.env.example` | + 4 个 VITE_SENTRY_* 空值；保留 Stripe | 按计划 |
| **`src/lib/observability.ts`** (新) | `initObservability()` + `reportApiError()` + re-export `Sentry` | 按计划 |
| `src/components/ErrorFallback.tsx` (新) | `<Sentry.ErrorBoundary>` fallback UI；其他 agent 加了 i18n | 按计划（与 i18n 兼容） |
| `src/main.tsx` | 顶部 `initObservability()`；`<Sentry.ErrorBoundary fallback={<ErrorFallback/>}>` 包 `<RouterProvider>` | 按计划；保留 i18n 初始化顺序 |
| `src/lib/api/client.ts` | 5xx + NETWORK_ERROR → `reportApiError(err, { path, method, status })`；4xx/401 不上报 | 按计划 |
| `vite.config.ts` | 条件启用 `sentryVitePlugin`（缺任一 env 时静默跳过）；自定义 plugin 从 prod build 删除 `mockServiceWorker.js` | **扩展**：原计划未指定 mockServiceWorker 清理 |
| `tests/unit/observability.test.ts` (新) | 6 tests：覆盖 enabled=false / enabled=true / DSN 缺失 / dev vs prod sampleRate / beforeSend scrub 字段 | 按计划 |
| `tests/unit/api-client-sentry.test.ts` (新) | 5 tests：NETWORK_ERROR、500、400/401/404 | 按计划 |

### 12.2 vs 计划的偏差

| 项 | 计划 | 实际 | 原因 |
|---|---|---|---|
| `beforeSend` 类型签名 | `(event: Sentry.Event) => Sentry.Event \| null` | `(event: Sentry.ErrorEvent, hint: Sentry.EventHint) => Sentry.ErrorEvent \| null` | `@sentry/react@10.62.0` 的实际类型签名要求 `ErrorEvent`（`Event` 含 `type: 'transaction'` 与 `ErrorEvent` 不兼容）。功能行为不变。 |
| `VITE_SENTRY_ENABLED` default | plan §2.7 写 `default('false')`；任务 spec 写 `optional().transform(...)` | `optional().transform(v => v === 'true')`（即未设 = false） | 跟随任务 spec 实现，与 plan 不一致但功能等价 |
| `VITE_SENTRY_ENVIRONMENT` enum | plan §2.7: `['dev', 'staging', 'prod']` | 任务 spec: `['development', 'staging', 'production']` + `default('development')` | 跟随任务 spec。CI 注入时需用 `production` 字面量。 |
| `tracesSampleRate` | plan §2.2: 单独 env var `VITE_SENTRY_TRACES_SAMPLE_RATE` | 任务 spec: 硬编码 `isDev ? 1.0 : 0.1` | 跟随任务 spec（更简单，少 1 个 env） |
| `withSentryReactRouterRouting` | plan §2.5 推荐包 routes | **未改 router.tsx** | task spec §7 明确说"router 文件本身不用改，只需 initObservability 注册 routing instrumentation"；`browserTracingIntegration` 已自动采集路由切换 |
| Session Replay 默认开 | plan §1.3 / §4: 默认关 | 任务 spec: `replayIntegration` 在 integrations 数组中，但 `replaysSessionSampleRate: 0`，仅 `replaysOnErrorSampleRate: 0.1` 触发 | 跟随任务 spec：replay 模块已加载但仅在出错时启用 |
| `nginx.conf` / `Dockerfile` / CI | plan §B 列了但任务 spec 未要求 | **未改** | 任务 spec 仅要求前端 + 单元测试；nginx/Dockerfile/CI 由后续 subagent 处理 |
| Opt-out UI (localStorage) | plan §4 / §10.1 列了 | **未实现** | 任务 spec 未要求；可作为 Phase 2 |
| Opt-in maskAllText / blockAllMedia | plan §4 | 已设置 `maskAllText: true, blockAllMedia: true` | 跟随任务 spec |
| `dataCollection.userInfo` | plan §3.1 列出 | **未设置**（SDK 10.x 已废弃该选项；`sendDefaultPii: false` 已足够） | 跟随当前 SDK API 实际行为 |

### 12.3 验证结果

| 命令 | 退出码 | 说明 |
|---|---|---|
| `pnpm typecheck` | **0** | tsc 0 error |
| `pnpm lint` | **0** | eslint 0 error（其他 agent 之前引入的 billing-checkout lint 错误已修复） |
| `pnpm test` | **0** | 10 files / 35 tests passed；本任务新增 11 tests（6 observability + 5 api-client-sentry） |
| `pnpm build` | **0** | vite build 成功，sourcemap=false（缺 SENTRY_AUTH_TOKEN，plugin 静默跳过）；`dist/` 不含 `mockServiceWorker.js` |

### 12.4 留给后续任务

- nginx JSON access log（§7）— DevOps / 部署 agent
- Dockerfile 7 个新 ARG（§5.3）— DevOps agent
- CI 注入 SENTRY_RELEASE/ORG/PROJECT/AUTH_TOKEN（§5.2, §B）— GitHub Actions agent
- opt-out UI（`/account` 开关 + localStorage）— Phase 2 任务 #11
- PostHog 接入（§1.3）— 待产品决策

---

> **维护者**：本方案 ≤ 500 行；任何实施变更需同步更新 §2 接入清单与 §B 文件改动汇总。
