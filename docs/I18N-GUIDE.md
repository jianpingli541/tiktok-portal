# Internationalization (i18n) Guide

TIKTON Portal ships with i18next + react-i18next. The UI is translated into
English (default) and Simplified Chinese (zh-CN). The infrastructure is designed
to make adding additional languages a low-friction process.

## File Layout

```
src/lib/i18n/
├── index.ts                # i18next init (detector + fallback + react plugin)
└── locales/
    ├── en.json             # English (default / fallback)
    └── zh-CN.json          # Simplified Chinese
```

`src/lib/i18n/index.ts` is imported as a side-effect at the very top of
`src/main.tsx`, so `useTranslation()` works on the first render of every
component.

## Key Naming Conventions

Use **nested, dot-separated** keys grouped by domain. Keep keys stable —
they are part of the public translation surface and renaming them is a
breaking change for translators.

| Prefix       | Purpose                                                 |
|--------------|---------------------------------------------------------|
| `common.*`   | Buttons, generic actions (cancel, save, back, retry)    |
| `errors.*`   | Error messages (network, unauthorized, validation)      |
| `languages.*`| Display names of supported languages                   |
| `subtitleStyles.*` | The three subtitle style options                  |
| `nav.*`      | Sidebar / nav labels                                    |
| `landing.*`  | Marketing landing page                                  |
| `pricing.*`  | Plans / pricing page (incl. interpolation tokens)       |
| `auth.*`     | Login, register, verify-email, forgot-password         |
| `submit.*`   | Submit-a-video form                                     |
| `tasks.*`    | Task list + detail                                      |
| `account.*`  | Account/profile page                                    |
| `billing.*`  | Billing/subscription page                               |
| `errorBoundary.*` | Top-level error fallback UI                        |

### Interpolation

Use double-curly placeholders, never concatenate at call site:

```ts
t('pricing.videosPerMonth', { count: 50 })     // "50 videos / month"
t('auth.verifyEmail.body', { email: 'a@b.c' }) // "We sent a verification link to a@b.c."
```

Pluralization is **not** enabled yet (would require `i18next-icu`); if you
need it, add the package and switch `fallbackLng` strategy accordingly.

## Adding a New Language

1. **Copy the English source** as the new file:
   ```bash
   cp src/lib/i18n/locales/en.json src/lib/i18n/locales/<locale>.json
   ```
   Use the BCP-47 tag (e.g. `es-ES`, `ja-JP`). The dash-case key is required
   for i18next's `supportedLngs` whitelist.

2. **Translate every value**. Do **not** rename keys; do **not** leave values
   in English. The CI check below will fail if you do.

3. **Register the locale** in two places:

   - `src/lib/i18n/index.ts` — add to `SUPPORTED_LANGUAGES` and to the
     `resources` block:
     ```ts
     export const SUPPORTED_LANGUAGES = ['en', 'zh-CN', 'ja-JP'] as const;
     // ...
     resources: {
       en:      { translation: en },
       'zh-CN': { translation: zhCN },
       'ja-JP': { translation: jaJP },
     },
     ```

   - `src/components/layout/Topbar.tsx` — add to the `LANGUAGES` array so the
     language switcher exposes the new option.

4. **Run the verification suite**:
   ```bash
   pnpm typecheck && pnpm lint && pnpm test && pnpm build
   ```

5. **Manual smoke test**:
   - Open the app, switch to the new language via the Topbar globe menu.
   - Walk through: landing → pricing → register → submit → tasks → billing.
   - Reload — the selection should persist via `localStorage.i18nextLng`.

## Detecting Untranslated Keys (CI)

i18next ships a sister tool called **i18next-parser** that statically scans
source code for `t('...')` / `t(\"...\")` calls and diffs them against the
JSON catalogs, emitting any missing keys.

Recommended (not installed by default to keep the runtime dependency
footprint small):

```bash
pnpm add -D i18next-parser
```

Then add `i18n:extract` to `package.json`:

```json
"scripts": {
  "i18n:extract": "i18next-parser --config i18next-parser.config.cjs"
}
```

And the config:

```js
// i18next-parser.config.cjs
module.exports = {
  locales: ['en', 'zh-CN'],
  defaultNamespace: 'translation',
  input: ['src/**/*.{ts,tsx}'],
  output: 'src/lib/i18n/locales/$LOCALE.json',
  sort: true,
  createOldCatalogs: false,
};
```

Wire `pnpm i18n:extract` into CI (e.g. `.github/workflows/ci.yml`) and fail
the build if any locale is missing a key — i18next-parser exits non-zero
when it discovers gaps.

## Persistence & Default Order

The detector cascade (see `src/lib/i18n/index.ts`) is:

1. `localStorage.i18nextLng` (explicit user pick — survives reloads)
2. `navigator.language` (first browser preference)
3. `'en'` (fallback, hard-coded)

`fallbackLng: 'en'` ensures an unknown locale silently degrades to English
rather than rendering raw keys.

## When to Translate, When Not To

- **Translate**: anything user-visible in JSX — headings, buttons, labels,
  error toasts, placeholders, table headers, empty states.
- **Do NOT translate**: console messages, log strings, comments,
  `localStorage` keys, `data-*` attribute values, CSS class names,
  brand names (TIKTON).
- **Avoid translating inside API calls or form validation schemas**
  — keep validation messages flowing through `t()` at the component layer
  (see `src/app/(auth)/Login.tsx` for the pattern).

## Testing

Two unit tests guard the wiring:

- `tests/unit/i18n.test.ts` — verifies default language, fallback on
  unsupported locale, `changeLanguage` + localStorage write, and
  interpolation.
- `tests/unit/LanguageSwitcher.test.tsx` — verifies the Topbar dropdown
  lists the supported languages and `changeLanguage` fires on click.

When you add a new language, extend these tests with at least one assertion
that the new locale renders a translated string end-to-end.
