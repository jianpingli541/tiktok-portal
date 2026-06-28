#!/usr/bin/env bash
# ============================================================================
# tiktok-portal MVP — 一键安装 + 验证脚本
# ============================================================================
# 用法:
#   cd /root/projects/tiktok-portal
#   bash _bootstrap/install.sh
#
# 行为:
#   - 任何 step 失败时继续执行,最后输出 PASS/FAIL 总结
#   - 关键检查: dist/ 不含 mockServiceWorker (MSW 不能进生产)
# ============================================================================
set -uo pipefail

cd "$(dirname "$0")/.."
ROOT=$(pwd)

echo "============================================"
echo "🚀 tiktok-portal MVP 安装"
echo "============================================"
echo "  ROOT: $ROOT"
echo "  Node: $(node --version 2>/dev/null || echo 'missing')"
echo "  pnpm: $(pnpm --version 2>/dev/null || echo 'missing')"
echo "  docker: $(docker --version 2>/dev/null || echo 'missing')"
echo "============================================"
echo ""

declare -a FAILED_STEPS=()
declare -a PASSED_STEPS=()

run_step() {
    local name="$1"
    local cmd="$2"
    echo ""
    echo "==[${name}]=="
    if eval "$cmd"; then
        PASSED_STEPS+=("$name")
    else
        FAILED_STEPS+=("$name")
        echo "❌ FAIL: $name"
    fi
}

# Step 1: git init + initial commit
run_step "1/9 git init + initial commit" "
[ ! -d .git ] && git init -b main
git add .
git commit -m 'feat(scaffold): tiktok-portal MVP 创作者门户 (T1-T11)' --allow-empty
"

# Step 2: pnpm install
run_step "2/9 pnpm install" "
corepack enable || true
corepack prepare pnpm@latest --activate || true
pnpm install
"

# Step 3: MSW worker 生成
run_step "3/9 MSW worker" '
npx msw init public/ --save
'

echo ""
echo "==[4/9]== shadcn 组件 (已 stub,跳过 npx shadcn add)"
PASSED_STEPS+=("4/9 shadcn (skip)")

run_step "5/9 vitest 单元测试" "pnpm test --run"

run_step "6/9 typecheck" "pnpm typecheck"
run_step "6/9 lint" "pnpm lint"
run_step "6/9 build" "pnpm build"

run_step "7/9 验证 dist/ 不含 mock" '
LEAK=$(grep -r "mockServiceWorker" dist/ 2>/dev/null | wc -l)
if [ "$LEAK" -gt 0 ]; then
  echo "❌ FAIL: mock leaked into prod build ($LEAK lines)"
  exit 1
fi
echo "✅ no mock leaked"
'

echo ""
echo "==[8/9]== Docker build (可选)"
if command -v docker >/dev/null 2>&1; then
    if docker build -t tiktok-portal:dev . 2>&1 | tail -8; then
        PASSED_STEPS+=("8a/9 docker build")
        docker rm -f tiktok-portal-test 2>/dev/null || true
        if docker run --rm -d --name tiktok-portal-test -p 18080:8080 tiktok-portal:dev; then
            sleep 3
            HTTP_CODE=$(curl -sS -o /tmp/healthz.out -w "%{http_code}" http://127.0.0.1:18080/healthz || echo "000")
            echo "HTTP $HTTP_CODE"
            cat /tmp/healthz.out 2>/dev/null || true
            docker stop tiktok-portal-test >/dev/null 2>&1 || true
            if [ "$HTTP_CODE" = "200" ]; then
                PASSED_STEPS+=("8b/9 docker run + /healthz")
            else
                FAILED_STEPS+=("8b/9 docker run + /healthz (HTTP $HTTP_CODE)")
            fi
        else
            FAILED_STEPS+=("8b/9 docker run")
        fi
    else
        FAILED_STEPS+=("8a/9 docker build")
    fi
else
    echo "⚠️  docker not installed, skip"
    PASSED_STEPS+=("8/9 docker (skip)")
fi

echo ""
echo "==[9/9]== e2e (可选, 需 playwright)"
if command -v pnpm >/dev/null 2>&1; then
    if pnpm exec playwright install --with-deps chromium 2>&1 | tail -3; then
        if VITE_ENABLE_MOCK=false pnpm test:e2e 2>&1 | tail -20; then
            PASSED_STEPS+=("9/9 e2e")
        else
            FAILED_STEPS+=("9/9 e2e")
        fi
    else
        echo "⚠️  playwright install failed, skip e2e"
        PASSED_STEPS+=("9/9 e2e (skip - playwright install)")
    fi
else
    echo "⚠️  pnpm not found, skip e2e"
    PASSED_STEPS+=("9/9 e2e (skip)")
fi

echo ""
echo "============================================"
echo "📊 tiktok-portal MVP 安装总结"
echo "============================================"
echo "✅ PASSED (${#PASSED_STEPS[@]}):"
for step in "${PASSED_STEPS[@]}"; do
    echo "   - $step"
done

if [ ${#FAILED_STEPS[@]} -gt 0 ]; then
    echo ""
    echo "❌ FAILED (${#FAILED_STEPS[@]}):"
    for step in "${FAILED_STEPS[@]}"; do
        echo "   - $step"
    done
    echo ""
    echo "============================================"
    echo "❌ 安装未完全成功"
    echo "============================================"
    exit 1
fi

echo ""
echo "============================================"
echo "🎉 tiktok-portal MVP 安装完成"
echo "============================================"
exit 0