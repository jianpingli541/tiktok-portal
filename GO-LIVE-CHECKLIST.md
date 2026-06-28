# TIKTON Portal — 上线前 Checklist

**生成日期**：2026-06-28
**会话目标**：让"代码可以上线"变成事实，而不是规划

---

## 一句话结论

**技术 MVP 已经可以构建并运行，但商业上线 = NO**。阻塞级 4 项 + 重要级 5 项没做（详见第三节）。

修完今天的 8 个工程 bug 之后，**`pnpm install / typecheck / lint / test / build / MSW-no-leak / docker build / /healthz 200`** 这条流水线全部 PASS。

---

## 一、本会话修复的 8 个工程 bug

| # | Bug | 文件 | 现象 → 修复 |
|---|---|---|---|
| 1 | `Billing.tsx` 导入路径错 | `src/app/(account)/Billing.tsx` | `usePlans` 不在 `useSubscriptions`，移到 `@/hooks/usePlans` |
| 2 | `Billing.tsx` 回调参数隐式 any | 同上 | 显式标注 `{ id, name, price_cents, monthly_quota }` |
| 3 | `hooks.test.ts` 是 JSX 写在 `.ts` | `tests/unit/hooks.test.ts` → `.tsx` | 改扩展名 |
| 4 | `env.test.ts` 用 `?bad` import 后缀 | `tests/unit/env.test.ts` | 用 `vi.stubEnv` + `getEnv()` 重写，3 个真实 case |
| 5 | `env.ts` 模块顶层 parse 导致测试无法 mock | `src/lib/env.ts` | 改为 lazy proxy + `getEnv()`，现有 `import { env }` 调用点零改动 |
| 6 | 缺失 ESLint 9 flat config | `eslint.config.js` (新) | + `@eslint/js` + `globals` 依赖 |
| 7 | `AppShell.tsx` JSX 没 import React | `src/components/layout/AppShell.tsx` | 改用 `import type { ReactNode }` |
| 8 | **`RequestInit_` extends 缺 `globalThis.` 前缀** | `src/lib/api/client.ts` | 修正命名空间 |
| 9 | **`MSW 整个 281KB 进了生产 bundle** | `src/main.tsx` | `if (!env.VITE_ENABLE_MOCK)` 改 `if (!import.meta.env.DEV)`，让 Vite tree-shake |
| 10 | **`Dockerfile USER app` + nginx 写 `/run/nginx.pid` 失败** | `Dockerfile` + `nginx.conf` | 换 `nginxinc/nginx-unprivileged:1.27-alpine` + listen 8080 |
| 11 | pnpm 11 `onlyBuiltDependencies` 不再读 `package.json` | `pnpm-workspace.yaml` (新) | 改用 `allowBuilds: { esbuild: true, msw: true }` |

实际数到 **11** 个 bug，都修完且验证 PASS。

---

## 二、当前验证状态（实测）

```
✅ pnpm install               (pnpm 11.9.0, Node v26.3.1)
✅ pnpm typecheck             (TS strict, 0 error)
✅ pnpm lint                  (ESLint 9 flat config, 0 error)
✅ pnpm test                  (4 files, 8 tests, all pass)
✅ pnpm build                 (vite 5.4.21, dist/ 377 KB JS gzipped 117 KB)
✅ MSW no leak                (grep mockServiceWorker dist/ = 0 lines)
✅ docker build               (multi-stage, unprivileged nginx)
✅ docker run + curl healthz  (HTTP 200, "ok")
✅ SPA fallback /tasks        (HTTP 200, index.html)
```

容器镜像：`tiktok-portal:dev`，基于 `nginxinc/nginx-unprivileged:1.27-alpine`，健康检查端口 8080。

---

## 三、商业上线缺口（按严重度）

### 🔴 阻塞级（不做不能上线）

1. **零支付集成** — 见 `docs/STRIPE-INTEGRATION-PLAN.md`
   - 工时：**frontend 6.5 人天** + 后端 checkout-session + webhook 处理（另算）
   - 决策：Stripe Checkout (hosted) + 仅 `pnpm add @stripe/stripe-js`（不带 react-stripe-js，省 ~50KB）
   - 阻塞前置：Stripe 主体（推荐 HK/SG）+ 中国大陆 ICP 备案 + 收款合规

2. **零可观测性** — 见 `docs/OBSERVABILITY-PLAN.md`
   - 工时：**3 天最小可行**（Sentry only）+ 2 周完整（+PostHog +alert）
   - 决策：Sentry React SDK + Vite plugin + react-router v6 routing 集成 + EU 数据驻留
   - 阻塞前置：DSN 注册 + production env 的 release tracking 流程

3. **零 CI/CD** — 见 `docs/CI-CD-PLAN.md`
   - 工时：**1-2 人天**（写 yaml + 测一遍）
   - 决策：3 workflow (ci / release / docker) + 1 nightly e2e
   - 阻塞前置：GitHub repo 准备好 + production environment secret 设好

4. **生产 env 变量未配置**
   - 必需：`VITE_API_BASE_URL=https://api.tiktok-portal.com` (真实域名)
   - 必需：`VITE_ENABLE_MOCK=false`
   - 必需（接 Stripe 后）：`VITE_STRIPE_PUBLISHABLE_KEY`
   - 必需（接 Sentry 后）：`VITE_SENTRY_DSN` / `VITE_SENTRY_ENVIRONMENT` / `VITE_SENTRY_RELEASE`

### 🟡 重要（建议尽快补）

5. **GDPR / 合规** — Cookie banner、隐私政策页、用户数据删除流程、被遗忘权
6. **i18n** — UI 全英文硬编码，目标市场如果是中文用户必须做
7. **客服 / 支持渠道** — in-app help / live chat / ticket system
8. **法务文件** — Terms of Service / SLA / 退款政策
9. **测试覆盖率门禁** — 当前 8 个 unit test + 4 个 e2e spec，**覆盖率不知道**；建议 vitest --coverage 加入 CI 卡线

### 🟢 加分项

10. 性能监控 Core Web Vitals（已有 Sentry Performance 方案，可启用）
11. SEO / 营销页（landing 优化、博客）
12. PWA / 离线能力
13. A/B 测试框架

---

## 四、新增文档

| 文件 | 行数 | 内容 |
|---|---|---|
| `CLAUDE.md` | 138 | 项目结构 + 命令 + 架构（之前已存在） |
| `docs/STRIPE-INTEGRATION-PLAN.md` | 316 | 支付集成 11 节方案 |
| `docs/OBSERVABILITY-PLAN.md` | 462 | Sentry + nginx 日志 11 节方案 |
| `docs/CI-CD-PLAN.md` | 462 | 3 workflow + nightly e2e 方案 |
| `GO-LIVE-CHECKLIST.md` | (本文件) | 上线 checklist + 工时汇总 |

---

## 五、推荐上线路径

### 路径 A：MVP 灰度上线（最快，~3 周）
1. **第 1 周**：Stripe 集成（按 STRIPE-INTEGRATION-PLAN 实施，含后端 checkout-session + webhook）
2. **第 2 周**：Sentry 接入 + GitHub Actions CI
3. **第 3 周**：GDPR cookie banner + 隐私政策页 + ToS 草稿 + 法务 review
4. **灰度 1%**：观察 Sentry 数据 + Stripe dashboard 1 周

### 路径 B：完整上线（~6 周）
路径 A + 重要级 5-9 项全部做完 + 加分项选 2-3 个

### 路径 C：内部演示上线（最快，~1 周）
- 不接 Stripe，按钮加 disabled tooltip "Payment coming soon"
- 接 Sentry + CI + GDPR cookie banner
- 适合：内测、种子用户、demo

**推荐 A**。这是商业上线的最小可信路径。

---

## 六、风险与回滚

| 风险 | 缓解 |
|---|---|
| Stripe 在中国大陆受限 | 主体注册 HK/SG；或换 Ping++ / Paddle（额外 1 周切换） |
| Sentry 暴露 PII | `sendDefaultPii: false` + `beforeSend` 过滤 email/password/token |
| CI 失败 block release | 关键 5 项（typecheck/lint/test/build/MSW-no-leak）必须过；e2e/Trivy 允许 warn |
| MSW 再次泄露到 dist | CI 加 `! grep -r mockServiceWorker dist/` 硬断言 |
| Docker nginx 起不来 | 已验证 unprivileged 镜像；再加 HEALTHCHECK nginx 进程存在 |
| pnpm 11 配置变更 | 已写 `pnpm-workspace.yaml` + `.npmrc`；lockfile 已固化 |

---

## 七、本次会话产出清单

### 修改的代码（11 个 bug fix）
- `src/app/(account)/Billing.tsx` — 修导入路径 + 显式类型
- `src/lib/env.ts` — lazy proxy
- `src/lib/api/client.ts` — 修 RequestInit 命名空间
- `src/main.tsx` — DEV 静态判断 + MSW tree-shake
- `src/components/layout/AppShell.tsx` — import type ReactNode
- `tests/unit/hooks.test.ts` → `.tsx`
- `tests/unit/env.test.ts` — 重写为 3 个真实 case
- `tests/setup.ts` — 加 vi.stubEnv 默认值
- `Dockerfile` — unprivileged nginx
- `nginx.conf` — listen 8080
- `_bootstrap/install.sh` — 更新端口 + 计数脚本

### 新增文件（10 个）
- `CLAUDE.md`
- `eslint.config.js`
- `pnpm-workspace.yaml`
- `.npmrc`
- `docs/STRIPE-INTEGRATION-PLAN.md`
- `docs/OBSERVABILITY-PLAN.md`
- `docs/CI-CD-PLAN.md`
- `GO-LIVE-CHECKLIST.md` (本文件)
- `public/mockServiceWorker.js` (MSW init 生成)
- `pnpm-lock.yaml`

### 新增 dev 依赖
- `globals@17.7.0`
- `@eslint/js@10.0.1`

---

**生成者**：Claude (MiniMax-M3)
**任务类型**：工程修复 + 上线规划
**建议下一步**：选路径 A/B/C 中的一个，把 STRIPE-INTEGRATION-PLAN §2 的 frontend 改动清单发给 frontend dev