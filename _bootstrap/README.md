# tiktok-portal MVP — 交付包

## 现状

- 87 个源文件已由 AI 写完
- 2 个阻塞错误已修复:
  1. `router.tsx` 现在导出真实的注册/定价/任务详情组件
  2. `package.json` 已补齐 6 个 Radix 依赖 (`@radix-ui/react-label / dialog / dropdown-menu / select / slot` + `class-variance-authority`)
- 本会话的 Bash 工具不可用,**以下命令需要你本地跑**

---

## 一键安装 (推荐)

```bash
cd /root/projects/tiktok-portal
bash _bootstrap/install.sh
```

脚本会:
1. git init + 初始 commit
2. pnpm install
3. MSW worker 生成
4. 单元测试 / typecheck / lint / build
5. 验证 `dist/` 不含 `mockServiceWorker` (关键!)
6. (可选) Docker build + curl `/healthz`
7. (可选) Playwright e2e

任何 step 失败时**继续执行**,最后输出 PASS/FAIL 总结,不会中途静默中断。

---

## 手动步骤 (如果脚本失败)

### 1. git init

```bash
cd /root/projects/tiktok-portal
git init -b main
git add .
git commit -m "feat(scaffold): tiktok-portal MVP 创作者门户"
```

### 2. 安装依赖

```bash
corepack enable
corepack prepare pnpm@latest --activate
pnpm install
```

### 3. 生成 MSW worker

```bash
npx msw init public/ --save
```

### 4. 验证

```bash
pnpm test --run         # 单元测试
pnpm typecheck          # TS 严格模式
pnpm lint               # ESLint
pnpm build              # 生产构建

# 关键检查: prod build 不能含 mock
if grep -r "mockServiceWorker" dist/; then
  echo "❌ MSW 泄露到生产"
  exit 1
fi
```

### 5. (可选) Docker

```bash
docker build -t tiktok-portal:dev .
docker run --rm -d --name tiktok-portal-test -p 18080:80 tiktok-portal:dev
sleep 3
curl -sS -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:18080/healthz
docker stop tiktok-portal-test
```

### 6. (可选) e2e

```bash
pnpm exec playwright install --with-deps chromium
VITE_ENABLE_MOCK=false pnpm test:e2e
```

---

## 关键决策 (已写进代码)

| 项 | 选择 | 理由 |
|---|---|---|
| 框架 | React 18 + TS strict | 用户指定 |
| 构建 | Vite 5 | 用户指定 |
| 路由 | React Router v6 data router | plan 选型 |
| 状态 | TanStack Query v5 + Zustand | plan 选型 |
| 表单 | react-hook-form + zod | plan 选型 |
| UI | shadcn/ui + Tailwind v3 | 用户指定 |
| Mock | MSW v2 (dev only) | 用户指定 |
| 测试 | Vitest + Testing Library + Playwright | plan 选型 |
| 部署 | 多阶段 Docker (node:20 → nginx:1.27) | plan 选型 |
| 代码风格 | Prettier + ESLint (strict) | plan 选型 |

---

## 完成标志

- [ ] pnpm install 0 error
- [ ] pnpm test 全部通过
- [ ] pnpm typecheck 0 error
- [ ] pnpm lint 0 error
- [ ] pnpm build 成功
- [ ] `dist/` 不含 `mockServiceWorker`
- [ ] docker build 成功
- [ ] curl `/healthz` 返回 200
- [ ] 浏览器打开 dev server, 能走完 register → pricing → submit → task detail
- [ ] git tag v0.1.0-mvp

---

## 关键约定 (开发时必读)

1. **MSW 不能进生产**: `import './mocks'` 仅在 `import.meta.env.DEV` 时执行。`build` 后 `dist/` 必须不含 `mockServiceWorker.js`。
2. **TanStack Query 集中在 `src/lib/query/`**: 不要散落在各页面。
3. **错误边界**: `src/components/ErrorBoundary.tsx` 包裹路由树。
4. **表单 schema 复用**: zod schema 定义在 `src/lib/schemas/`,前后端共享。
5. **环境变量**: 以 `VITE_` 开头才能在浏览器访问。`VITE_ENABLE_MOCK` 控制 MSW 开关。
6. **可访问性**: shadcn/ui 默认使用 Radix,已包含键盘导航和 ARIA。

---

## 目录速查

```
tiktok-portal/
├── src/
│   ├── main.tsx              # 入口,挂载 Router + MSW
│   ├── router.tsx            # 路由配置 (数据路由)
│   ├── routes/               # 页面组件
│   │   ├── RegisterPage.tsx
│   │   ├── PricingPage.tsx
│   │   ├── SubmitPage.tsx
│   │   └── TaskDetailPage.tsx
│   ├── components/
│   │   ├── ui/               # shadcn stub (button/input/label/...)
│   │   ├── ErrorBoundary.tsx
│   │   └── ...
│   ├── lib/
│   │   ├── api.ts            # fetch 封装
│   │   ├── query/            # TanStack Query hooks
│   │   └── schemas/          # zod
│   └── mocks/                # MSW handlers (dev only)
├── public/
│   └── mockServiceWorker.js  # MSW 生成
├── tests/
│   ├── unit/                 # Vitest
│   └── e2e/                  # Playwright
├── Dockerfile                # node:20 build → nginx:1.27 runtime
├── nginx.conf                # SPA 路由 + /healthz
└── _bootstrap/               # ← 你在这里
    ├── install.sh
    └── README.md
```

---

## 相关文档

- **Spec**: `/root/docs/superpowers/specs/2026-06-27-tiktok-portal-mvp-design.md`
- **Plan**: `/root/docs/superpowers/plans/2026-06-27-tiktok-portal-mvp.md`
- **USER-GUIDE**: `docs/USER-GUIDE.md` (端到端使用)
- **API-CONTRACT**: `docs/API-CONTRACT.md` (mock 接口契约)
- **DESIGN**: `docs/DESIGN.md` (视觉设计规范)

---

## 出问题?

| 症状 | 排查 |
|---|---|
| `pnpm install` 报 peer dep 错误 | 删除 `node_modules` + `pnpm-lock.yaml`,重跑 |
| `mockServiceWorker` 泄露到 dist | 检查 `src/main.tsx` 中 MSW 导入是否被 `import.meta.env.DEV` 包裹 |
| Playwright 报 `browser not installed` | 跑 `pnpm exec playwright install chromium` |
| Docker build 在国内慢 | Dockerfile 已用 `registry.npmmirror.com` 镜像源 |
| `/healthz` 返回 404 | 检查 `nginx.conf` 中 `location = /healthz { ... }` 块 |

---

**任务标签**: final-delivery
**交付日期**: 2026-06-27
**状态**: 待用户本地验证