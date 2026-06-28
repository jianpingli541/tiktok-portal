import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('LanguageSwitcher (Topbar)', () => {
  let i18n: typeof import('@/lib/i18n').default;

  beforeAll(async () => {
    const mod = await import('@/lib/i18n');
    i18n = mod.default;
    await new Promise((r) => setTimeout(r, 10));
  });

  beforeEach(async () => {
    window.localStorage.clear();
    await i18n.changeLanguage('en');
  });

  it('switches language from zh-CN to English when English is clicked', async () => {
    // Seed zh-CN as the starting language.
    await i18n.changeLanguage('zh-CN');
    window.localStorage.setItem('i18nextLng', 'zh-CN');

    const { default: Topbar } = await import('@/components/layout/Topbar');
    render(<Topbar />);

    const trigger = screen.getByRole('button', { name: /语言|language/i });
    await userEvent.click(trigger);

    const englishOption = await screen.findByRole('menuitem', { name: /english/i });
    await userEvent.click(englishOption);

    expect(i18n.resolvedLanguage ?? i18n.language).toBe('en');
    expect(window.localStorage.getItem('i18nextLng')).toBe('en');
  });

  it('lists both supported languages in the menu', async () => {
    const { default: Topbar } = await import('@/components/layout/Topbar');

    render(<Topbar />);

    const trigger = screen.getByRole('button', { name: /language/i });
    await userEvent.click(trigger);

    // Both English and 中文 (zh-CN) should be reachable.
    expect(await screen.findByRole('menuitem', { name: /english/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /中文/i })).toBeInTheDocument();
  });

  it('switches from English to Chinese when 中文 is clicked', async () => {
    const { default: Topbar } = await import('@/components/layout/Topbar');
    render(<Topbar />);

    const trigger = screen.getByRole('button', { name: /language/i });
    await userEvent.click(trigger);

    const chineseOption = await screen.findByRole('menuitem', { name: /中文/i });
    await userEvent.click(chineseOption);

    expect(i18n.resolvedLanguage ?? i18n.language).toBe('zh-CN');
    expect(window.localStorage.getItem('i18nextLng')).toBe('zh-CN');
  });
});

void vi;
