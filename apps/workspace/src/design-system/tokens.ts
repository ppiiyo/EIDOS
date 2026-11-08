export const tokens = {
  color: {
    bg: '#F8FAFC',
    bgAlt: '#F1F5F9',
    surface: '#FFFFFF',
    border: '#E2E8F0',
    borderStrong: '#CBD5E1',

    text: '#0F172A',
    textSecondary: '#475569', // >= 4.5:1 contrast against #FFFFFF and #F8FAFC (WCAG AA)
    textMuted: '#64748B',
    textInverse: '#FFFFFF',

    accent: '#0F172A',
    accentHover: '#1E293B',
    accentBrand: '#2563EB',
    accentBg: '#EFF6FF',

    success: '#059669',
    successBg: '#ECFDF5',
    successBorder: '#A7F3D0',

    warning: '#D97706',
    warningBg: '#FFFBEB',
    warningBorder: '#FDE68A',

    danger: '#DC2626',
    dangerBg: '#FEF2F2',
    dangerBorder: '#FECACA',
    error: '#DC2626',
    errorBg: '#FEF2F2',
  },

  font: {
    sans: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'IBM Plex Mono', 'SF Mono', monospace",
  },

  size: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem',// 30px
  },

  layout: {
    gridBase: '8px',
    storefrontMaxWidth: '1160px',
    adminSidebarWidth: '240px',
  },

  radius: {
    sm: '6px',   // inputs
    md: '8px',   // buttons & compact cards
    lg: '12px',  // elevated cards
  },

  shadow: {
    none: 'none',
    sm: '0 1px 2px rgba(15, 23, 42, 0.04)',
    md: '0 1px 3px rgba(15, 23, 42, 0.06)',
    lg: '0 4px 6px rgba(15, 23, 42, 0.06)',
  },

  space: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
  },
} as const;
