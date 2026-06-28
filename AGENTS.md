# Agent Operating Rules — tiktok-portal

- Follow `docs/superpowers/plans/2026-06-27-tiktok-portal-mvp.md` task-by-task when implementing.
- All API calls MUST go through `src/lib/api/client.ts`; never call `fetch()` directly elsewhere.
- Mock is enabled only in dev/e2e (`VITE_ENABLE_MOCK=true`); production build must NOT include MSW.
- Tailwind classes only; do not introduce CSS-in-JS or styled-components.
- TypeScript strict; no `any` without justification in a comment.
- Commit messages: `feat:` `fix:` `chore:` `docs:` `refactor:` `test:` (Conventional Commits).