import { createGlobalThemeContract } from '@vanilla-extract/css'

export const foundationVars = createGlobalThemeContract(
  {
    color: {
      accent: {
        solid: null,
        hover: null,
        soft: null,
        border: null,
        focus: null,
        contrast: null,
      },
      text: {
        primary: null,
        secondary: null,
        muted: null,
        inverse: null,
      },
      surface: {
        canvas: null,
        subtle: null,
        panel: null,
        raised: null,
      },
      border: {
        subtle: null,
        strong: null,
      },
      status: {
        success: null,
        successSoft: null,
        danger: null,
        dangerSoft: null,
      },
      decorative: {
        heroStart: null,
        heroEnd: null,
        glow: null,
      },
    },
    font: {
      sans: null,
      display: null,
      mono: null,
    },
    size: {
      authStageMax: null,
      authPanelMax: null,
      contentMeasure: null,
    },
    space: {
      2: null,
      3: null,
      4: null,
      5: null,
      6: null,
      8: null,
      10: null,
      12: null,
    },
    radius: {
      sm: null,
      md: null,
      lg: null,
      xl: null,
      pill: null,
    },
    shadow: {
      card: null,
      cardHover: null,
      focus: null,
    },
    motion: {
      fast: null,
      base: null,
      slow: null,
    },
  },
  (_value, path) => `at-${path.join('-')}`,
)

export const sharedFoundationTokens = {
  font: {
    sans:
      "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', sans-serif",
    display:
      "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', sans-serif",
    mono: "'SFMono-Regular', 'SF Mono', 'JetBrains Mono', 'Fira Code', monospace",
  },
  size: {
    authStageMax: '1120px',
    authPanelMax: '440px',
    contentMeasure: '32rem',
  },
  space: {
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    10: '2.5rem',
    12: '3rem',
  },
  radius: {
    sm: '12px',
    md: '18px',
    lg: '24px',
    xl: '32px',
    pill: '999px',
  },
  shadow: {
    card: '0 18px 50px rgba(7, 16, 20, 0.16)',
    cardHover: '0 24px 64px rgba(7, 16, 20, 0.22)',
    focus: '0 0 0 4px rgba(81, 153, 145, 0.18)',
  },
  motion: {
    fast: '120ms',
    base: '180ms',
    slow: '320ms',
  },
} as const

export const lightFoundationTokens = {
  color: {
    accent: {
      solid: '#3f8c84',
      hover: '#33766f',
      soft: 'rgba(63, 140, 132, 0.12)',
      border: 'rgba(63, 140, 132, 0.28)',
      focus: 'rgba(63, 140, 132, 0.2)',
      contrast: '#f6fbfa',
    },
    text: {
      primary: '#172024',
      secondary: '#4d5d63',
      muted: '#738189',
      inverse: '#f5fbfa',
    },
    surface: {
      canvas: '#f3f6f5',
      subtle: '#ebf0ef',
      panel: '#ffffff',
      raised: '#f8fbfb',
    },
    border: {
      subtle: 'rgba(23, 32, 36, 0.08)',
      strong: 'rgba(23, 32, 36, 0.14)',
    },
    status: {
      success: '#2f7d69',
      successSoft: 'rgba(47, 125, 105, 0.1)',
      danger: '#b45357',
      dangerSoft: 'rgba(180, 83, 87, 0.1)',
    },
    decorative: {
      heroStart: 'rgba(63, 140, 132, 0.14)',
      heroEnd: 'rgba(18, 58, 70, 0.02)',
      glow: 'rgba(63, 140, 132, 0.08)',
    },
  },
} as const

export const darkFoundationTokens = {
  color: {
    accent: {
      solid: '#78b3ac',
      hover: '#90c4be',
      soft: 'rgba(120, 179, 172, 0.14)',
      border: 'rgba(120, 179, 172, 0.3)',
      focus: 'rgba(120, 179, 172, 0.24)',
      contrast: '#0f1618',
    },
    text: {
      primary: '#edf4f2',
      secondary: '#bcc9c6',
      muted: '#879592',
      inverse: '#0f1618',
    },
    surface: {
      canvas: '#0f1618',
      subtle: '#121b1e',
      panel: '#182227',
      raised: '#1e2b31',
    },
    border: {
      subtle: 'rgba(237, 244, 242, 0.08)',
      strong: 'rgba(237, 244, 242, 0.14)',
    },
    status: {
      success: '#78b69d',
      successSoft: 'rgba(120, 182, 157, 0.12)',
      danger: '#df8a86',
      dangerSoft: 'rgba(223, 138, 134, 0.14)',
    },
    decorative: {
      heroStart: 'rgba(120, 179, 172, 0.16)',
      heroEnd: 'rgba(10, 18, 22, 0.02)',
      glow: 'rgba(120, 179, 172, 0.08)',
    },
  },
} as const

export const brandColorScale = [
  '#edf8f7',
  '#d7eeeb',
  '#c0e3de',
  '#a7d6cf',
  '#8dc8c0',
  '#78b3ac',
  '#5f9b95',
  '#4a817b',
  '#386763',
  '#274e4b',
] as const
