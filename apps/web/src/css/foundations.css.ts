import { createGlobalThemeContract } from '@vanilla-extract/css'

export const foundationVars = createGlobalThemeContract({
  color: {
    accent: {
      solid: null,
      hover: null,
      soft: null,
      border: null,
      focus: null,
      contrast: null
    },
    text: {
      primary: null,
      secondary: null,
      muted: null,
      inverse: null
    },
    surface: {
      canvas: null,
      subtle: null,
      panel: null,
      raised: null,
      recessed: null,
      sidebar: null,
      header: null
    },
    border: {
      subtle: null,
      strong: null
    },
    status: {
      success: null,
      successSoft: null,
      warning: null,
      warningSoft: null,
      danger: null,
      dangerSoft: null
    }
  },
  font: {
    sans: null,
    display: null,
    mono: null
  },
  size: {
    authStageMax: null,
    authPanelMax: null,
    contentMeasure: null
  },
  space: {
    2: null,
    3: null,
    4: null,
    5: null,
    6: null,
    8: null,
    10: null,
    12: null
  },
  radius: {
    sm: null,
    md: null,
    lg: null,
    xl: null,
    pill: null
  },
  shadow: {
    card: null,
    cardHover: null,
    focus: null
  },
  motion: {
    fast: null,
    base: null,
    slow: null
  }
}, (_value, path) => `at-${path.join('-')}`)

export const sharedFoundationTokens = {
  font: {
    sans:
      '-apple-system, BlinkMacSystemFont, \'SF Pro Text\', \'SF Pro Display\', \'Segoe UI\', sans-serif',
    display:
      '-apple-system, BlinkMacSystemFont, \'SF Pro Display\', \'SF Pro Text\', \'Segoe UI\', sans-serif',
    mono: '\'SFMono-Regular\', \'SF Mono\', \'JetBrains Mono\', \'Fira Code\', monospace'
  },
  size: {
    authStageMax: '1120px',
    authPanelMax: '440px',
    contentMeasure: '32rem'
  },
  space: {
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    10: '2.5rem',
    12: '3rem'
  },
  radius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    pill: '9999px'
  },
  shadow: {
    card: '0 18px 50px rgba(7, 16, 20, 0.16)',
    cardHover: '0 24px 64px rgba(7, 16, 20, 0.22)',
    focus: '0 0 0 4px rgba(123, 159, 212, 0.22)'
  },
  motion: {
    fast: '120ms',
    base: '180ms',
    slow: '320ms'
  }
} as const

export const lightFoundationTokens = {
  color: {
    accent: {
      solid: '#6082b6',
      hover: '#5071a5',
      soft: 'rgba(96, 130, 182, 0.16)',
      border: '#3f6094',
      focus: 'rgba(96, 130, 182, 0.24)',
      contrast: '#ffffff'
    },
    text: {
      primary: '#151b20',
      secondary: '#55626d',
      muted: '#8a97a1',
      inverse: '#eef4f6'
    },
    surface: {
      canvas: '#f3f4f6',
      subtle: '#ebedf2',
      panel: '#ffffff',
      raised: '#fafafc',
      recessed: '#e0e2e9',
      sidebar: '#e8e9ee',
      header: '#ebedf2'
    },
    border: {
      subtle: '#d7dbe4',
      strong: '#ced1db'
    },
    status: {
      success: '#2f9b63',
      successSoft: '#e3f6ea',
      warning: '#b7822e',
      warningSoft: '#fff2d8',
      danger: '#ea6846',
      dangerSoft: '#fee7e2'
    }
  }
} as const

export const darkFoundationTokens = {
  color: {
    accent: {
      solid: '#7b9fd4',
      hover: '#8aafde',
      soft: 'rgba(123, 159, 212, 0.2)',
      border: '#6082b6',
      focus: 'rgba(123, 159, 212, 0.32)',
      contrast: '#0f1418'
    },
    text: {
      primary: '#eef4f6',
      secondary: '#a6b3bc',
      muted: '#75828c',
      inverse: '#0f1618'
    },
    surface: {
      canvas: '#0f1618',
      subtle: '#171d22',
      panel: '#1a2127',
      raised: '#151b20',
      recessed: '#0b1014',
      sidebar: '#12181d',
      header: '#171d22'
    },
    border: {
      subtle: '#2e3942',
      strong: '#334049'
    },
    status: {
      success: '#69c488',
      successSoft: '#103019',
      warning: '#e2b663',
      warningSoft: '#3a2c10',
      danger: '#e88b6e',
      dangerSoft: '#3a1612'
    }
  }
} as const

export const brandColorScale = [
  '#eef4fb',
  '#dde7f5',
  '#cad9ef',
  '#b4c8e5',
  '#9ab3d7',
  '#7b9fd4',
  '#6082b6',
  '#5071a5',
  '#3f6094',
  '#334f80'
] as const
