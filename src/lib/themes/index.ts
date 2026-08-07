export interface ThemeColors {
  name: string;
  label: string;
  emoji: string;
  isDark: boolean;
  bg: string;
  bgCard: string;
  bgElevated: string;
  bgInput: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentHover: string;
  accentGlow: string;
  gradientBrand: string;
  gradientBrandHorizontal: string;
  border: string;
  borderStrong: string;
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;
  success: string;
  danger: string;
  warning: string;
}

export type ThemeId =
  | 'dark'
  | 'light'
  | 'oled'
  | 'neon'
  | 'forest'
  | 'sunset'
  | 'ocean'
  | 'lavender';

export const themes: Record<ThemeId, ThemeColors> = {
  dark: {
    name: 'dark', label: 'Midnight', emoji: '🌙', isDark: true,
    bg: '#0d0d15', bgCard: '#18181f', bgElevated: '#22222d', bgInput: '#1a1a25',
    textPrimary: '#f1f1f7', textSecondary: '#9898ab', textTertiary: '#66667a',
    accent: '#7c5cfc', accentHover: '#9178ff', accentGlow: 'rgba(124, 92, 252, 0.25)',
    gradientBrand: 'linear-gradient(135deg, #7c5cfc, #c94b8c)',
    gradientBrandHorizontal: 'linear-gradient(90deg, #7c5cfc, #c94b8c)',
    border: 'rgba(255, 255, 255, 0.06)', borderStrong: 'rgba(255, 255, 255, 0.12)',
    shadowSm: '0 2px 8px rgba(0, 0, 0, 0.3)', shadowMd: '0 4px 16px rgba(0, 0, 0, 0.4)', shadowLg: '0 8px 32px rgba(0, 0, 0, 0.5)',
    success: '#34d399', danger: '#f87171', warning: '#fbbf24',
  },
  light: {
    name: 'light', label: 'Daylight', emoji: '☀️', isDark: false,
    bg: '#f8f8fc', bgCard: '#ffffff', bgElevated: '#ffffff', bgInput: '#f0f0f5',
    textPrimary: '#1a1a2e', textSecondary: '#5a5a72', textTertiary: '#8e8ea2',
    accent: '#6c4ce0', accentHover: '#7d5ff0', accentGlow: 'rgba(108, 76, 224, 0.15)',
    gradientBrand: 'linear-gradient(135deg, #6c4ce0, #e0448c)',
    gradientBrandHorizontal: 'linear-gradient(90deg, #6c4ce0, #e0448c)',
    border: 'rgba(0, 0, 0, 0.08)', borderStrong: 'rgba(0, 0, 0, 0.14)',
    shadowSm: '0 2px 8px rgba(0, 0, 0, 0.06)', shadowMd: '0 4px 16px rgba(0, 0, 0, 0.08)', shadowLg: '0 8px 32px rgba(0, 0, 0, 0.1)',
    success: '#10b981', danger: '#ef4444', warning: '#f59e0b',
  },
  oled: {
    name: 'oled', label: 'OLED', emoji: '🖤', isDark: true,
    bg: '#000000', bgCard: '#0a0a0a', bgElevated: '#111111', bgInput: '#0d0d0d',
    textPrimary: '#ffffff', textSecondary: '#999999', textTertiary: '#555555',
    accent: '#7c5cfc', accentHover: '#9178ff', accentGlow: 'rgba(124, 92, 252, 0.2)',
    gradientBrand: 'linear-gradient(135deg, #7c5cfc, #c94b8c)',
    gradientBrandHorizontal: 'linear-gradient(90deg, #7c5cfc, #c94b8c)',
    border: 'rgba(255, 255, 255, 0.04)', borderStrong: 'rgba(255, 255, 255, 0.08)',
    shadowSm: '0 2px 8px rgba(0, 0, 0, 0.5)', shadowMd: '0 4px 16px rgba(0, 0, 0, 0.6)', shadowLg: '0 8px 32px rgba(0, 0, 0, 0.7)',
    success: '#34d399', danger: '#f87171', warning: '#fbbf24',
  },
  neon: {
    name: 'neon', label: 'Neon', emoji: '💜', isDark: true,
    bg: '#0a0a12', bgCard: '#12121e', bgElevated: '#1a1a2e', bgInput: '#141428',
    textPrimary: '#e8e8ff', textSecondary: '#a0a0cc', textTertiary: '#6a6a99',
    accent: '#00ffc8', accentHover: '#33ffd6', accentGlow: 'rgba(0, 255, 200, 0.3)',
    gradientBrand: 'linear-gradient(135deg, #00ffc8, #b44dff)',
    gradientBrandHorizontal: 'linear-gradient(90deg, #00ffc8, #b44dff)',
    border: 'rgba(180, 77, 255, 0.1)', borderStrong: 'rgba(180, 77, 255, 0.2)',
    shadowSm: '0 2px 8px rgba(0, 0, 0, 0.4)', shadowMd: '0 4px 16px rgba(180, 77, 255, 0.1)', shadowLg: '0 8px 32px rgba(0, 255, 200, 0.05)',
    success: '#00ffc8', danger: '#ff4477', warning: '#ffbb33',
  },
  forest: {
    name: 'forest', label: 'Forest', emoji: '🌲', isDark: true,
    bg: '#0f1a10', bgCard: '#162218', bgElevated: '#1d2c20', bgInput: '#142016',
    textPrimary: '#e0ece0', textSecondary: '#90a890', textTertiary: '#5c7a5c',
    accent: '#4ade80', accentHover: '#6aee9a', accentGlow: 'rgba(74, 222, 128, 0.25)',
    gradientBrand: 'linear-gradient(135deg, #4ade80, #22d3a0)',
    gradientBrandHorizontal: 'linear-gradient(90deg, #4ade80, #22d3a0)',
    border: 'rgba(74, 222, 128, 0.08)', borderStrong: 'rgba(74, 222, 128, 0.16)',
    shadowSm: '0 2px 8px rgba(0, 0, 0, 0.35)', shadowMd: '0 4px 16px rgba(0, 0, 0, 0.45)', shadowLg: '0 8px 32px rgba(0, 0, 0, 0.5)',
    success: '#4ade80', danger: '#f87171', warning: '#fbbf24',
  },
  sunset: {
    name: 'sunset', label: 'Sunset', emoji: '🌅', isDark: true,
    bg: '#1a1210', bgCard: '#241a16', bgElevated: '#2e221c', bgInput: '#1e1612',
    textPrimary: '#f5e8e0', textSecondary: '#c4a898', textTertiary: '#8a7060',
    accent: '#f59e0b', accentHover: '#f7b733', accentGlow: 'rgba(245, 158, 11, 0.3)',
    gradientBrand: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    gradientBrandHorizontal: 'linear-gradient(90deg, #f59e0b, #ef4444)',
    border: 'rgba(245, 158, 11, 0.08)', borderStrong: 'rgba(245, 158, 11, 0.16)',
    shadowSm: '0 2px 8px rgba(0, 0, 0, 0.35)', shadowMd: '0 4px 16px rgba(245, 158, 11, 0.08)', shadowLg: '0 8px 32px rgba(0, 0, 0, 0.5)',
    success: '#4ade80', danger: '#f87171', warning: '#f59e0b',
  },
  ocean: {
    name: 'ocean', label: 'Ocean', emoji: '🌊', isDark: true,
    bg: '#0a1424', bgCard: '#111c30', bgElevated: '#192840', bgInput: '#0e1a2c',
    textPrimary: '#e0eaf5', textSecondary: '#90b0d0', textTertiary: '#5a80a8',
    accent: '#38bdf8', accentHover: '#5ccafc', accentGlow: 'rgba(56, 189, 248, 0.25)',
    gradientBrand: 'linear-gradient(135deg, #38bdf8, #818cf8)',
    gradientBrandHorizontal: 'linear-gradient(90deg, #38bdf8, #818cf8)',
    border: 'rgba(56, 189, 248, 0.08)', borderStrong: 'rgba(56, 189, 248, 0.16)',
    shadowSm: '0 2px 8px rgba(0, 0, 0, 0.35)', shadowMd: '0 4px 16px rgba(56, 189, 248, 0.08)', shadowLg: '0 8px 32px rgba(0, 0, 0, 0.5)',
    success: '#4ade80', danger: '#f87171', warning: '#fbbf24',
  },
  lavender: {
    name: 'lavender', label: 'Lavender', emoji: '🌸', isDark: true,
    bg: '#16101e', bgCard: '#1e1828', bgElevated: '#282034', bgInput: '#1a1424',
    textPrimary: '#ede4f5', textSecondary: '#b8a4cc', textTertiary: '#7a6899',
    accent: '#c084fc', accentHover: '#d4a4ff', accentGlow: 'rgba(192, 132, 252, 0.25)',
    gradientBrand: 'linear-gradient(135deg, #c084fc, #f472b6)',
    gradientBrandHorizontal: 'linear-gradient(90deg, #c084fc, #f472b6)',
    border: 'rgba(192, 132, 252, 0.08)', borderStrong: 'rgba(192, 132, 252, 0.16)',
    shadowSm: '0 2px 8px rgba(0, 0, 0, 0.35)', shadowMd: '0 4px 16px rgba(192, 132, 252, 0.08)', shadowLg: '0 8px 32px rgba(0, 0, 0, 0.5)',
    success: '#4ade80', danger: '#f87171', warning: '#fbbf24',
  },
};

export const DEFAULT_THEME: ThemeId = 'dark';

const WHITE = '#ffffff';
const INK = '#0c0d14';

function luminance(hex: string): number {
  const v = parseInt(hex.replace('#', ''), 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin((v >> 16) & 255) + 0.7152 * lin((v >> 8) & 255) + 0.0722 * lin(v & 255);
}

const ratio = (l1: number, l2: number) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

function darken(hex: string, factor: number): string {
  const v = parseInt(hex.replace('#', ''), 16);
  const c = (x: number) => Math.round(Math.min(255, x * factor)).toString(16).padStart(2, '0');
  return `#${c((v >> 16) & 255)}${c((v >> 8) & 255)}${c(v & 255)}`;
}

// Rendered button text is near-white (~0.90 luminance), not pure white — require
// 5.0:1 vs white so the real pair clears 4.5:1 AA.
const AA_WHITE = 5.0;

function primaryPair(accent: string): { primary: string; foreground: string } {
  const l = luminance(accent);
  if (ratio(l, luminance(WHITE)) >= AA_WHITE) return { primary: accent, foreground: WHITE };
  if (ratio(l, luminance(INK)) >= 4.5) return { primary: accent, foreground: INK };
  for (let factor = 0.92; factor > 0.3; factor -= 0.04) {
    const primary = darken(accent, factor);
    if (ratio(luminance(primary), luminance(WHITE)) >= AA_WHITE) return { primary, foreground: WHITE };
  }
  return { primary: darken(accent, 0.3), foreground: WHITE };
}

export function applyTheme(theme: ThemeColors): void {
  const root = document.documentElement;
  root.style.setProperty('--bg-root', theme.bg);
  root.style.setProperty('--bg-surface', theme.bgCard);
  root.style.setProperty('--bg', theme.bg);
  root.style.setProperty('--bg-card', theme.bgCard);
  root.style.setProperty('--bg-elevated', theme.bgElevated);
  root.style.setProperty('--bg-input', theme.bgInput);
  root.style.setProperty('--text-primary', theme.textPrimary);
  root.style.setProperty('--text-secondary', theme.textSecondary);
  root.style.setProperty('--text-tertiary', theme.textTertiary);
  root.style.setProperty('--accent-stream', theme.accent);
  root.style.setProperty('--accent-hover', theme.accentHover);
  root.style.setProperty('--accent-glow', theme.accentGlow);
  root.style.setProperty('--gradient-brand', theme.gradientBrand);
  root.style.setProperty('--gradient-brand-horizontal', theme.gradientBrandHorizontal);
  root.style.setProperty('--border-stream', theme.border);
  root.style.setProperty('--border-strong', theme.borderStrong);
  root.style.setProperty('--shadow-sm', theme.shadowSm);
  root.style.setProperty('--shadow-md', theme.shadowMd);
  root.style.setProperty('--shadow-lg', theme.shadowLg);
  root.style.setProperty('--success', theme.success);
  root.style.setProperty('--danger', theme.danger);
  root.style.setProperty('--warning', theme.warning);
  const pair = primaryPair(theme.accent);
  root.style.setProperty('--primary', pair.primary);
  root.style.setProperty('--primary-foreground', pair.foreground);
  root.setAttribute('data-theme', theme.name);
}
