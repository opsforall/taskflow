import { describe, it, expect, vi, afterEach } from 'vitest';
import { THEMES, DEFAULT_THEME, resolveTheme, getAppColor, applyTheme } from './theme';

afterEach(() => vi.unstubAllGlobals());

describe('resolveTheme', () => {
  it('accepte une couleur connue', () => {
    expect(resolveTheme('red')).toBe('red');
    expect(resolveTheme('purple')).toBe('purple');
  });

  it('normalise la casse et les espaces', () => {
    expect(resolveTheme(' RED ')).toBe('red');
    expect(resolveTheme('Blue')).toBe('blue');
  });

  it('retombe sur le thème par défaut pour une couleur inconnue', () => {
    expect(resolveTheme('magenta')).toBe(DEFAULT_THEME);
    expect(resolveTheme('constructor')).toBe(DEFAULT_THEME);
  });

  it('retombe sur le thème par défaut pour une valeur vide ou absente', () => {
    expect(resolveTheme('')).toBe(DEFAULT_THEME);
    expect(resolveTheme(undefined)).toBe(DEFAULT_THEME);
    expect(resolveTheme(null)).toBe(DEFAULT_THEME);
  });
});

describe('THEMES', () => {
  it('chaque thème définit toutes les propriétés nécessaires', () => {
    for (const [name, theme] of Object.entries(THEMES)) {
      expect(theme.primary, `${name}.primary`).toMatch(/^#[0-9a-f]{6}$/);
      expect(theme.primaryDark, `${name}.primaryDark`).toMatch(/^#[0-9a-f]{6}$/);
      expect(theme.primarySoft, `${name}.primarySoft`).toMatch(/^#[0-9a-f]{6}$/);
      expect(theme.ring, `${name}.ring`).toContain('rgba');
    }
  });

  it('le thème par défaut existe', () => {
    expect(THEMES[DEFAULT_THEME]).toBeDefined();
  });
});

describe('getAppColor', () => {
  it('lit la couleur injectée au runtime via window.__ENV__', () => {
    vi.stubGlobal('window', { __ENV__: { APP_COLOR: 'red' } });
    expect(getAppColor()).toBe('red');
  });

  it('retombe sur le thème par défaut sans couleur fournie', () => {
    vi.stubGlobal('window', { __ENV__: { APP_COLOR: '' } });
    expect(getAppColor()).toBe(DEFAULT_THEME);
  });
});

describe('applyTheme', () => {
  it('pose les variables CSS et data-theme sur la racine', () => {
    const setProperty = vi.fn();
    const setAttribute = vi.fn();
    vi.stubGlobal('document', {
      documentElement: { style: { setProperty }, setAttribute }
    });

    const applied = applyTheme('purple');

    expect(applied).toBe('purple');
    expect(setProperty).toHaveBeenCalledWith('--primary', THEMES.purple.primary);
    expect(setAttribute).toHaveBeenCalledWith('data-theme', 'purple');
  });

  it('normalise une couleur inconnue vers le défaut', () => {
    const setProperty = vi.fn();
    const setAttribute = vi.fn();
    vi.stubGlobal('document', {
      documentElement: { style: { setProperty }, setAttribute }
    });
    expect(applyTheme('inconnue')).toBe(DEFAULT_THEME);
  });
});
