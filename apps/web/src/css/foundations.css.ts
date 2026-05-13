import { createGlobalTheme, createGlobalThemeContract } from '@vanilla-extract/css'

export const foundationVars = createGlobalThemeContract({
  color: {
    accent: {
      solid: null,
      hover: null,
      soft: null,
      border: null,
      emphasisBorder: null,
      focus: null,
      contrast: null
    },
    button: {
      primary: {
        background: null,
        border: null,
        hover: null,
        active: null,
        text: null
      },
      secondary: {
        background: null,
        border: null,
        hover: null,
        active: null,
        text: null
      }
    },
    card: {
      background: {
        default: null,
        hover: null,
        active: null
      },
      border: {
        default: null,
        selected: null
      }
    },
    input: {
      background: {
        default: null,
        hover: null,
        active: null,
        disabled: null
      },
      border: {
        default: null,
        focus: null,
        error: null,
        disabled: null
      },
      placeholder: null,
      sideButton: null
    },
    text: {
      primary: null,
      secondary: null,
      muted: null,
      dim: null,
      inverse: null,
      accent: null
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
    },
    school: {
      abjuration: null,
      conjuration: null,
      divination: null,
      enchantment: null,
      evocation: null,
      illusion: null,
      necromancy: null,
      transmutation: null
    },
    icon: {
      default: null,
      accent: null,
      muted: null,
      hover: null,
      selected: null
    },
    logo: {
      background: null,
      icon: null
    },
    nav: {
      pillHover: null,
      pillActive: null
    },
    tooltip: {
      background: null,
      text: null
    },
    steps: {
      default: {
        border: null,
        background: null,
        text: null
      },
      current: {
        border: null,
        background: null,
        text: null
      },
      completed: {
        border: null,
        background: null,
        icon: null
      },
      error: {
        border: null,
        background: null,
        text: null,
        icon: null
      }
    }
  },
  font: {
    sans: null,
    display: null,
    mono: null
  },
  fontWeight: {
    regular: null,
    medium: null,
    semibold: null,
    bold: null,
    heavy: null
  },
  size: {
    authStageMax: null,
    authPanelMax: null,
    contentMeasure: null
  },
  space: {
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
    6: null,
    7: null,
    8: null,
    9: null,
    10: null,
    12: null,
    13: null,
    14: null
  },
  radius: {
    sm: null,
    md: null,
    lg: null,
    xl: null,
    xxl: null,
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
  },
  typography: {
    display: {
      fontSize: null,
      lineHeight: null,
      fontWeight: null,
      letterSpacing: null
    },
    title: {
      fontSize: null,
      lineHeight: null,
      fontWeight: null,
      letterSpacing: null
    },
    heading: {
      fontSize: null,
      lineHeight: null,
      fontWeight: null,
      letterSpacing: null
    },
    body: {
      fontSize: null,
      lineHeight: null,
      fontWeight: null,
      letterSpacing: null
    },
    bodySm: {
      fontSize: null,
      lineHeight: null,
      fontWeight: null,
      letterSpacing: null
    },
    label: {
      fontSize: null,
      lineHeight: null,
      fontWeight: null,
      letterSpacing: null
    },
    caption: {
      fontSize: null,
      lineHeight: null,
      fontWeight: null,
      letterSpacing: null
    }
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
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    heavy: '800'
  },
  size: {
    authStageMax: '1120px',
    authPanelMax: '440px',
    contentMeasure: '32rem'
  },
  space: {
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    7: '1.75rem',
    8: '2rem',
    9: '2.25rem',
    10: '2.5rem',
    12: '3rem',
    13: '4rem',
    14: '6rem'
  },
  radius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    xxl: '24px',
    pill: '9999px'
  },
  shadow: {
    card: '0 18px 50px rgba(7, 16, 20, 0.16)',
    cardHover: '0 24px 64px rgba(7, 16, 20, 0.22)',
    focus: '0 0 0 4px rgba(14, 165, 197, 0.24)'
  },
  motion: {
    fast: '120ms',
    base: '180ms',
    slow: '320ms'
  },
  typography: {
    display: {
      fontSize: '4rem',
      lineHeight: '1.12',
      fontWeight: '800',
      letterSpacing: '0'
    },
    title: {
      fontSize: '2rem',
      lineHeight: '1.2',
      fontWeight: '750',
      letterSpacing: '0'
    },
    heading: {
      fontSize: '1.5rem',
      lineHeight: '1.2',
      fontWeight: '750',
      letterSpacing: '0'
    },
    body: {
      fontSize: '1rem',
      lineHeight: '1.5',
      fontWeight: '400',
      letterSpacing: '0'
    },
    bodySm: {
      fontSize: '0.875rem',
      lineHeight: '1.45',
      fontWeight: '400',
      letterSpacing: '0'
    },
    label: {
      fontSize: '0.75rem',
      lineHeight: '1.45',
      fontWeight: '700',
      letterSpacing: '0'
    },
    caption: {
      fontSize: '13px',
      lineHeight: '1.4',
      fontWeight: '400',
      letterSpacing: '0'
    }
  }
} as const

export const lightFoundationTokens = {
  color: {
    accent: {
      solid: '#0891b2',
      hover: '#0ea5c5',
      soft: 'rgba(8, 145, 178, 0.16)',
      border: '#0891b2',
      emphasisBorder: '#0e7490',
      focus: 'rgba(8, 145, 178, 0.24)',
      contrast: '#ffffff'
    },
    button: {
      primary: {
        background: '#0891b2',
        border: '#0e7490',
        hover: '#0ea5c5',
        active: '#0e7490',
        text: '#ffffff'
      },
      secondary: {
        background: '#f0f1f4',
        border: '#d7dbe4',
        hover: '#e9ebf0',
        active: '#dee1e8',
        text: '#55626d'
      }
    },
    card: {
      background: {
        default: '#ffffff',
        hover: '#f3f4f7',
        active: '#edeff4'
      },
      border: {
        default: '#d7dbe4',
        selected: '#4f46e5'
      }
    },
    input: {
      background: {
        default: '#f8f9fb',
        hover: '#f2f4f8',
        active: '#edf0f5',
        disabled: '#edeff3'
      },
      border: {
        default: '#ced2de',
        focus: '#0891b2',
        error: '#c15336',
        disabled: '#dde1e9'
      },
      placeholder: '#8b97a1',
      sideButton: '#e8e9ee'
    },
    text: {
      primary: '#151b20',
      secondary: '#55626d',
      muted: '#8a97a1',
      dim: '#8a97a1',
      inverse: '#eef4f6',
      accent: '#0891b2'
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
    },
    school: {
      abjuration: '#3f6fda',
      conjuration: '#b7822e',
      divination: '#b59a2e',
      enchantment: '#bf4f8d',
      evocation: '#c15336',
      illusion: '#2d8fba',
      necromancy: '#7856bf',
      transmutation: '#2f9b63'
    },
    icon: {
      default: '#20262d',
      accent: '#4f46e5',
      muted: '#78858f',
      hover: '#0e7490',
      selected: '#0891b2'
    },
    logo: {
      background: '#0891b2',
      icon: '#ffffff'
    },
    nav: {
      pillHover: 'rgba(8, 145, 178, 0.1)',
      pillActive: 'rgba(8, 145, 178, 0.16)'
    },
    tooltip: {
      background: '#1a2127',
      text: '#eef4f6'
    },
    steps: {
      default: {
        border: '#b5b9c6',
        background: '#ffffff',
        text: '#999ead'
      },
      current: {
        border: '#0891b2',
        background: '#0891b2',
        text: '#0891b2'
      },
      completed: {
        border: '#4f46e5',
        background: '#4f46e5',
        icon: '#ffffff'
      },
      error: {
        border: '#dc3545',
        background: '#dc3545',
        text: '#dc3545',
        icon: '#ffffff'
      }
    }
  }
} as const

export const darkFoundationTokens = {
  color: {
    accent: {
      solid: '#0ea5c5',
      hover: '#38bdd6',
      soft: 'rgba(14, 165, 197, 0.2)',
      border: '#0b8aaa',
      emphasisBorder: '#0b8aaa',
      focus: 'rgba(14, 165, 197, 0.32)',
      contrast: '#0f1418'
    },
    button: {
      primary: {
        background: '#0ea5c5',
        border: '#0b8aaa',
        hover: '#38bdd6',
        active: '#0b8aaa',
        text: '#0f1418'
      },
      secondary: {
        background: '#1c242b',
        border: '#2e3942',
        hover: '#232d35',
        active: '#141a20',
        text: '#a6b3bc'
      }
    },
    card: {
      background: {
        default: '#17202a',
        hover: '#202830',
        active: '#263039'
      },
      border: {
        default: '#2e3942',
        selected: '#6366f1'
      }
    },
    input: {
      background: {
        default: '#13191e',
        hover: '#182027',
        active: '#1c252c',
        disabled: '#161c21'
      },
      border: {
        default: '#334049',
        focus: '#0ea5c5',
        error: '#ec8768',
        disabled: '#283038'
      },
      placeholder: '#73818c',
      sideButton: '#253038'
    },
    text: {
      primary: '#eef4f6',
      secondary: '#a6b3bc',
      muted: '#75828c',
      dim: '#75828c',
      inverse: '#0f1418',
      accent: '#0ea5c5'
    },
    surface: {
      canvas: '#0d1117',
      subtle: '#171d22',
      panel: '#17202a',
      raised: '#131920',
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
    },
    school: {
      abjuration: '#7da2f0',
      conjuration: '#e2b663',
      divination: '#ddc66e',
      enchantment: '#e187b7',
      evocation: '#ec8768',
      illusion: '#73c3e2',
      necromancy: '#a68ae0',
      transmutation: '#69c488'
    },
    icon: {
      default: '#d7e0e4',
      accent: '#6366f1',
      muted: '#7f8c96',
      hover: '#38bdd6',
      selected: '#0ea5c5'
    },
    logo: {
      background: '#0ea5c5',
      icon: '#0f1418'
    },
    nav: {
      pillHover: 'rgba(14, 165, 197, 0.13)',
      pillActive: 'rgba(14, 165, 197, 0.2)'
    },
    tooltip: {
      background: '#eef4f6',
      text: '#0f1418'
    },
    steps: {
      default: {
        border: '#4a5168',
        background: '#1e2530',
        text: '#666f84'
      },
      current: {
        border: '#0ea5c5',
        background: '#0ea5c5',
        text: '#9be8f5'
      },
      completed: {
        border: '#6366f1',
        background: '#6366f1',
        icon: '#ffffff'
      },
      error: {
        border: '#dc3545',
        background: '#dc3545',
        text: '#dc3545',
        icon: '#ffffff'
      }
    }
  }
} as const

export const brandColorScale = [
  '#eefbfd',
  '#d8f6fb',
  '#b7edf5',
  '#84ddec',
  '#38bdd6',
  '#0ea5c5',
  '#0891b2',
  '#0e7490',
  '#155e75',
  '#164e63'
] as const

createGlobalTheme(':root', foundationVars, {
  ...sharedFoundationTokens,
  ...lightFoundationTokens
})

createGlobalTheme('[data-mantine-color-scheme="dark"]', foundationVars, {
  ...sharedFoundationTokens,
  ...darkFoundationTokens
})
