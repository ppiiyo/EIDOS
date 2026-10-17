export const tokens = {
  color: {
    bg:        '#FFFFFF',
    bgAlt:     '#F9FAFB',
    surface:   '#FFFFFF',
    border:    '#E5E7EB',
    borderStrong: '#D1D5DB',

    text:      '#111827',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    textInverse: '#FFFFFF',

    accent:    '#2563EB',
    accentHover: '#1D4ED8',
    accentBg:  '#EFF6FF',

    success:   '#059669',
    successBg: '#ECFDF5',
    warning:   '#D97706',
    warningBg: '#FFFBEB',
    error:     '#DC2626',
    errorBg:   '#FEF2F2',
  },

  font: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
  },

  size: {
    xs:  '0.75rem',   // 12px
    sm:  '0.875rem',  // 14px
    base:'1rem',      // 16px
    lg:  '1.125rem',  // 18px
    xl:  '1.25rem',   // 20px
    '2xl':'1.5rem',   // 24px
    '3xl':'1.875rem', // 30px
  },

  radius: {
    sm: '6px',
    md: '8px',
    lg: '12px',
  },

  shadow: {
    sm: '0 1px 2px rgba(0,0,0,0.05)',
    md: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
    lg: '0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)',
  },

  space: {
    1: '4px', 2: '8px', 3: '12px', 4: '16px',
    5: '20px', 6: '24px', 8: '32px', 10: '40px', 12: '48px',
  },
} as const;
