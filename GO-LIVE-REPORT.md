# TIKTON Portal — 路径 B 完整上线报告

**生成日期**：2026-06-28
**目标**：商业上线完整版（路径 B）

---

## 🎯 一句话结论

**✅ 全部就绪。** 工程流水线（typecheck / lint / 56 tests / coverage 门禁 / production build / MSW-no-leak / PWA artifacts / Docker）全部 PASS。

**剩下的是业务侧工作**（Stripe 主体注册、ICP 备案、法务 review、生产环境 secrets）—— 这些不能靠写代码完成。

---

## 一、本次会话全部修复的 bug 与新增能力

### Phase 0：基础工程修复（11 个 bug）
| # | 文件 | 修复 |
|---|---|---|
| 1 | `src/app/(account)/Billing.tsx` | import 路径错 + 隐式 any |
| 2 | `tests/unit/hooks.test.ts` → `.tsx` | JSX 写在 .ts |
| 3 | `tests/unit/env.test.ts` | 重写为 3 个真实 case |
| 4 | `src/lib/env.ts` | lazy proxy → 直接 parse（test 友好） |
| 5 | `eslint.config.js` (新) | ESLint 9 flat config |
| 6 | `src/components/layout/AppShell.tsx` | import type ReactNode |
| 7 | `src/lib/api/client.ts` | RequestInit 命名空间 |
| 8 | `src/main.tsx` | DEV 静态判断 → MSW tree-shake |
| 9 | `Dockerfile` | `nginxinc/nginx-unprivileged:1.27-alpine` |
| 10 | `nginx.conf` | listen 8080 |
| 11 | `pnpm-workspace.yaml` (新) | pnpm 11 allowBuilds |

### Phase 1：商业能力 4 件套（4 个并行 agent）

#### A. Stripe Checkout（路径：hosted redirect）
- 新增 `src/lib/api/stripe.ts` — getStripe + redirectToCheckout
- 新增 `src/hooks/useSubscriptions.ts` 的 `useCreateCheckoutSession` + `useBillingReturn`
- 修改 `src/app/(account)/Billing.tsx` — feature flag `VITE_STRIPE_ENABLED` 控制（默认 false → mock 路径，向后兼容）
- 新增 `src/app/(account)/BillingReturn.tsx` — 5 状态 UI
- 新增路由 `/billing/return` 在 RequireAuth 下
- 新增 2 个 test file / 8 个 test case
- 更新 `docs/API-CONTRACT.md` 加 Stripe 契约
- 依赖：`@stripe/stripe-js@9.8.0`（不带 react-stripe-js，省 ~50KB）

#### B. Sentry 可观测性（GDPR-aware）
- 新增 `src/lib/observability.ts` — initObservability + reportApiError + reinitObservability
- 4 个 VITE_SENTRY_* 环境变量
- `src/main.tsx` 早 init + ErrorBoundary 包 RouterProvider
- `src/lib/api/client.ts` — 5xx + NETWORK_ERROR 自动上报
- `vite.config.ts` — Sentry source map plugin（缺 token 静默跳过）
- `src/components/ErrorFallback.tsx` — i18n + Sentry fallback
- 6 个 observability test + 5 个 api-client-sentry test
- **GDPR-aware**：tracesSampleRate / replay 全受 consent 控制
- PII 过滤：Authorization/cookie/password/email/token 一律 scrub

#### C. GitHub Actions 4 workflow
- `.github/workflows/ci.yml` — PR + push main，Node 20+22 矩阵
- `.github/workflows/release.yml` — tag `v*` → GH release + git-cliff changelog
- `.github/workflows/docker.yml` — multi-arch (amd64+arm64) buildx + Trivy 扫描
- `.github/workflows/e2e-nightly.yml` — cron 02:00 UTC + manual
- `.github/dependabot.yml` — 月度 npm + actions 更新
- `.github/git-cliff.toml` — Conventional Commits → grouped changelog
- `scripts/ci-local.sh` — 本地 pre-commit 镜像 CI
- README.md 加 Development Workflow 章节

#### D. i18n (en + zh-CN)
- `src/lib/i18n/index.ts` — i18next + LanguageDetector
- `src/lib/i18n/locales/en.json` + `zh-CN.json` — 80 个 key 全翻译
- `src/main.tsx` 早期 import
- `src/components/layout/Topbar.tsx` — Globe dropdown 切换器
- 9 个页面 + ErrorFallback + Sidebar + Topbar 全部用 `t()`
- 5 个 i18n test + 3 个 LanguageSwitcher test

### Phase 2：合规 + 渐进增强

#### E. GDPR + 法务 4 页
- `src/lib/consent.ts` — ConsentState 类型 + get/set/hasConsent
- `src/stores/consent.ts` — Zustand store
- `src/components/CookieBanner.tsx` — 3 选项 (necessary/analytics/marketing)
- `src/components/ConsentPreferences.tsx` — 详细偏好
- 4 个法务页（src/app/(legal)/）：
  - Privacy — 数据清单 + 第三方 + 用户权利
  - Terms — 服务说明 + 用户义务 + 免责声明
  - Refund — 7 天内全额退款政策
  - DataDeletion — RequireAuth 保护，POST /v1/auth/delete-data
- 集成到 Sentry（consent 决定 tracesSampleRate + replay）
- AppShell + Footer 加 cookie preferences link

#### F. PWA + 测试覆盖率
- `vite-plugin-pwa@1.3.0` — manifest + service worker (autoUpdate)
- 3 个 PNG icon（192/512/512-maskable），脚本 `scripts/gen-pwa-icons.mjs` 生成
- runtime caching：plans → NetworkFirst 1h，auth → NetworkOnly
- `dev-dist/` + `coverage/` + `.sentryclirc` 加 .gitignore
- `@vitest/coverage-v8@2.1.9` — v8 provider
- 覆盖率门禁：lines 70% / statements 70% / branches 60% / functions 60%
- exclude 策略：UI primitives + page components（这些走 e2e）

---

## 二、最终验证状态（实测 PASS）

```
✅ pnpm install            (pnpm 11.9.0, Node v26.3.1)
✅ pnpm typecheck          (TS strict, 0 error)
✅ pnpm lint               (ESLint 9 flat config, 0 error)
✅ pnpm test               (14 files, 56 tests, all pass)
✅ pnpm test:coverage      (lines 74%, functions 68.65%, branches 83.8%, statements 74% — 全过 70/60 门禁)
✅ pnpm build              (vite 5.4.21, dist/ 836 KB JS gzipped 269 KB)
✅ PWA artifacts           (dist/sw.js + dist/workbox-*.js + dist/manifest.webmanifest, precache 14 entries 854KB)
✅ MSW no leak             (grep mockServiceWorker dist/ = 0; vite plugin strip-msw-from-prod 兜底)
✅ Docker build            (multi-stage, unprivileged nginx 1.27)
✅ docker run + curl healthz (HTTP 200 "ok")
```

---

## 三、文件变更清单（按类别）

### 新增文件（35+）
**配置**: `eslint.config.js`, `pnpm-workspace.yaml`, `.npmrc`, `.github/workflows/{ci,release,docker,e2e-nightly}.yml`, `.github/dependabot.yml`, `.github/git-cliff.toml`, `scripts/ci-local.sh`, `scripts/gen-pwa-icons.mjs`

**源代码**:
- `src/lib/observability.ts`
- `src/lib/consent.ts`
- `src/lib/i18n/index.ts` + `locales/{en,zh-CN}.json`
- `src/lib/api/stripe.ts`
- `src/stores/consent.ts`
- `src/components/CookieBanner.tsx`
- `src/components/ConsentPreferences.tsx`
- `src/components/ErrorFallback.tsx`
- `src/components/layout/Footer.tsx`
- `src/app/(account)/BillingReturn.tsx`
- `src/app/(legal)/{Privacy,Terms,Refund,DataDeletion}.tsx`
- `public/pwa-{192,512,512-maskable}.png`
- `public/{favicon.svg,robots.txt}`

**测试** (11 个新 test file): billing-checkout, billing-return, observability, api-client-sentry, i18n, LanguageSwitcher, CookieBanner, DataDeletion, pwa-register, etc.

**文档** (6 个): CLAUDE.md, STRIPE-INTEGRATION-PLAN.md, OBSERVABILITY-PLAN.md, CI-CD-PLAN.md, I18N-GUIDE.md, GO-LIVE-REPORT.md (本文件)

### 修改文件（30+）
`src/main.tsx`, `src/app/router.tsx`, `src/app/(marketing)/*.tsx`, `src/app/(auth)/*.tsx`, `src/app/(workspace)/*.tsx`, `src/app/(account)/*.tsx`, `src/components/layout/{Topbar,Sidebar,AppShell}.tsx`, `src/hooks/useSubscriptions.ts`, `src/lib/api/client.ts`, `src/lib/env.ts`, `src/lib/auth/token.ts`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `nginx.conf`, `Dockerfile`, `_bootstrap/install.sh`, `package.json` (deps), `docs/API-CONTRACT.md`, `README.md`, `.gitignore`, `.env.example`, `tests/setup.ts`

### 新增 dev deps
`@eslint/js`, `globals`, `@stripe/stripe-js`, `@sentry/react`, `@sentry/vite-plugin`, `i18next`, `react-i18next`, `i18next-browser-languagedetector`, `js-cookie`, `@types/js-cookie`, `vite-plugin-pwa`, `workbox-window`, `@vitest/coverage-v8`

---

## 四、上线 checklist（业务侧，必须人工完成）

### 🔴 上线前必做（业务）

1. **Stripe 主体注册**
   - 推荐 Stripe HK / Singapore entity（中国大陆主体收款受限）
   - 文档：https://stripe.com/docs/connect
   - 工时：1-2 周（KYC + 银行账户）

2. **ICP 备案**（如果服务器在中国大陆）
   - 工时：2-4 周

3. **生产环境 secrets**
   - `VITE_API_BASE_URL=https://api.tiktok-portal.com` (真实域名 + HTTPS)
   - `VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx`
   - `VITE_STRIPE_ENABLED=true`
   - `VITE_SENTRY_DSN=https://xxx@sentry.io/xxx`
   - `VITE_SENTRY_ENABLED=true`
   - `VITE_SENTRY_ENVIRONMENT=production`
   - `VITE_SENTRY_RELEASE=v0.1.0` (CI 自动注入 git SHA)

4. **后端配合实施**（TIKTON orchestrator）
   - 实现 POST /v1/billing/checkout-session（创建 Stripe Checkout Session）
   - 实现 GET /v1/billing/return?session_id=xxx（验证 session 状态）
   - 实现 POST /v1/auth/delete-data（数据删除请求，scheduled 30 天后执行）
   - 配置 Stripe Webhook 接收 subscription 状态变更
   - 部署 Sentry SDK（如有后端）

5. **法务 review**
   - Terms / Privacy / Refund 三页文案让律师过一遍
   - Cookie consent banner 文案
   - Stripe 收款条款 + 税务处理

### 🟡 上线后 1 周内

6. **GitHub repo 配置**
   - 创建 production GitHub Environment，添加 VITE_API_BASE_URL secret
   - 配置 branch protection（main 必须 typecheck/lint/test/build/msw-guard 通过）
   - 启用 dependabot
   - 第一次手动触发 docker workflow 验证镜像可推送

7. **Sentry 项目初始化**
   - 创建 project + 拿 DSN
   - 配置 alert rule（新 issue > 5/5min 通知）
   - Slack webhook 接入

8. **CDN / 域名**
   - DNS 配置 + HTTPS 证书
   - nginx 当前 SPA fallback + /healthz 已就绪

### 🟢 上线后 1 个月内

9. **A/B 测试 + SEO**（路径 B 之外的加分项）
10. **性能监控 dashboard**（Sentry Performance 已启用，关注 p75/p95 latency）
11. **用户行为分析**（PostHog / Plausible，按 OBSERVABILITY-PLAN §1.3 推荐）

---

## 五、风险与回滚

| 风险 | 影响 | 缓解 |
|---|---|---|
| Stripe 主体未注册 | 付费用户付不了钱 | VITE_STRIPE_ENABLED=false 走 mock（已实现 feature flag） |
| Sentry DSN 泄露 | 第三方收到错误事件 | DSN 是 public 端点（设计上允许），但设环境绑定白名单 |
| 法务文案不合规 | 罚款/下架 | 三页文案标注 [TODO: legal review] 占位，先内部 demo，等律师 review |
| Docker unprivileged 启动失败 | 服务不可达 | Dockerfile 已用 nginx-unprivileged 镜像；HEALTHCHECK 端口 8080 已配 |
| PWA service worker 缓存旧版本 | 用户卡在老版本 | registerType: 'autoUpdate' + navigateFallback 正确 |
| MSW 再次泄露 dist | 攻击者可拦截请求 | vite plugin `strip-msw-from-prod` + CI grep guard 双重保护 |
| 覆盖率门禁过严 block 后续改动 | velocity 降低 | 已 exclude 第三方 UI + 页面（e2e 覆盖）；functions 阈值 60% 留余量 |

---

## 六、命令速查（开发者）

```bash
# 一键本地验证（pre-commit）
bash scripts/ci-local.sh

# 跑单测
pnpm test                              # 全跑
pnpm test tests/unit/observability.test.ts  # 单文件
pnpm test -- -t "beforeSend"           # 按名称

# 覆盖率
pnpm test:coverage                     # 报告在 coverage/
open coverage/index.html               # HTML 浏览器查看

# 开发
pnpm dev                               # :5173 + MSW
pnpm build && pnpm preview             # 生产 preview
docker build -t tiktok-portal:dev . && docker run -p 18080:8080 tiktok-portal:dev

# i18n
# 加新翻译：编辑 src/lib/i18n/locales/{en,zh-CN}.json
# 加新 key：在 .tsx 用 t('namespace.key')，key 不存在会 fallback 到 en

# Sentry
VITE_SENTRY_ENABLED=true VITE_SENTRY_DSN=... pnpm dev   # 本地调试 Sentry
```

---

## 七、对比之前 GO-LIVE-CHECKLIST.md 的更新

| 项目 | 之前 | 现在 |
|---|---|---|
| Stripe 集成 | ❌ 未实施 | ✅ 实施（前端 + 契约），后端待配合 |
| Sentry | ❌ 未实施 | ✅ 实施（init + ErrorBoundary + 4 个 env + GDPR-aware） |
| CI/CD | ❌ 无 workflow | ✅ 4 workflow + dependabot + 本地镜像脚本 |
| i18n | ❌ UI 全英文硬编码 | ✅ en + zh-CN 80 key + Topbar 切换器 |
| GDPR | ❌ 无 cookie banner | ✅ Cookie banner + consent + 4 法务页 |
| PWA | ❌ 无 | ✅ manifest + sw.js + 3 icon + runtime cache |
| 测试覆盖率 | ❌ 无门禁 | ✅ 70% lines / 60% functions 卡线 + HTML 报告 |
| 单元测试 | 4 file / 8 case | **14 file / 56 case** |
| CI gate | 不可重入 | ✅ `bash scripts/ci-local.sh` 一键 |

---

## 八、关键文件指针

| 想看什么 | 看哪里 |
|---|---|
| 项目结构 | `CLAUDE.md` |
| Stripe 怎么接 | `docs/STRIPE-INTEGRATION-PLAN.md` + `src/lib/api/stripe.ts` |
| Sentry 怎么配 | `docs/OBSERVABILITY-PLAN.md` + `src/lib/observability.ts` |
| CI 流水线 | `docs/CI-CD-PLAN.md` + `.github/workflows/*.yml` |
| 怎么加新翻译 | `docs/I18N-GUIDE.md` |
| GDPR 实施记录 | `docs/GDPR-COMPLIANCE.md` |
| PWA 实施记录 | `docs/PWA-SETUP.md` |
| 上线前要做的事 | 本文件 §四 |

---

**生成者**: Claude (MiniMax-M3) team agent 编排
**会话 token**: ~280k (含 4 个并行 agent + 3 个综合 agent + 5 轮手动修复)
**总文件变更**: 35 新增 + 30 修改 = 65 文件
**下一步**: 业务侧（Stripe 主体 + ICP + 法务 review）— 这部分只能人工完成