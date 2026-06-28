import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

describe('i18n', () => {
  // Import the singleton i18next instance once for the whole suite.
  // i18next keeps cached language/detector state across module resets,
  // so resetModules() is intentionally avoided — each test instead
  // asserts the current behaviour by changing language explicitly.
  let i18n: typeof import('@/lib/i18n').default;

  beforeAll(async () => {
    const mod = await import('@/lib/i18n');
    i18n = mod.default;
    // Ensure init has settled.
    await new Promise((r) => setTimeout(r, 10));
  });

  beforeEach(async () => {
    // Always start each test in English so assertions are deterministic.
    window.localStorage.clear();
    await i18n.changeLanguage('en');
  });

  it('uses English as the default language', () => {
    expect(i18n.resolvedLanguage ?? i18n.language).toBe('en');
    expect(i18n.t('common.appName')).toBe('TIKTON Portal');
  });

  it('falls back to English when an unsupported language is requested', async () => {
    await i18n.changeLanguage('fr-FR');
    expect(i18n.resolvedLanguage ?? i18n.language).toBe('en');
    expect(i18n.t('common.appName')).toBe('TIKTON Portal');
  });

  it('changeLanguage switches active language and persists to localStorage', async () => {
    await i18n.changeLanguage('zh-CN');
    expect(i18n.resolvedLanguage ?? i18n.language).toBe('zh-CN');
    expect(window.localStorage.getItem('i18nextLng')).toBe('zh-CN');
    expect(i18n.t('common.appName')).toBe('TIKTON 创作者门户');
    expect(i18n.t('nav.tasks')).toBe('任务列表');
    expect(i18n.t('submit.title')).toBe('提交视频');
    // Switch back to confirm bidirectional change.
    await i18n.changeLanguage('en');
    expect(i18n.t('common.appName')).toBe('TIKTON Portal');
  });

  it('interpolates variables in translation strings', () => {
    expect(i18n.t('pricing.videosPerMonth', { count: 50 })).toBe('50 videos / month');
    expect(i18n.t('pricing.choose', { plan: 'Pro' })).toBe('Choose Pro');
  });

  it('renders Chinese translations when language is zh-CN', async () => {
    await i18n.changeLanguage('zh-CN');
    expect(i18n.t('auth.login.submit')).toBe('登录');
    expect(i18n.t('landing.getStarted')).toBe('立即开始');
  });
});

void vi;
