import { createGlobalTheme, createGlobalThemeContract } from '@vanilla-extract/css'

export const foundationVars = createGlobalThemeContract(
  {
    color: {
      accent: {
        solid: null,
        hover: null,
        soft: null,
        border: null,
        tertiarySolid: null,
        tertiaryHover: null,
        tertiarySoft: null,
        tertiaryBorder: null,
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
        header: null,
        emphasized: null
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
      damage: {
        acid: null,
        acidSoft: null,
        bludgeoning: null,
        bludgeoningSoft: null,
        cold: null,
        coldSoft: null,
        fire: null,
        fireSoft: null,
        force: null,
        forceSoft: null,
        lightning: null,
        lightningSoft: null,
        necrotic: null,
        necroticSoft: null,
        piercing: null,
        piercingSoft: null,
        poison: null,
        poisonSoft: null,
        psychic: null,
        psychicSoft: null,
        radiant: null,
        radiantSoft: null,
        slashing: null,
        slashingSoft: null,
        thunder: null,
        thunderSoft: null
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
  },
  (_value, path) => `at-${path.join('-')}`
)

export const sharedFoundationTokens = {
  font: {
    sans: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', sans-serif",
    display:
      "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', sans-serif",
    mono: "'SFMono-Regular', 'SF Mono', 'JetBrains Mono', 'Fira Code', monospace"
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
    card: 'none',
    cardHover: 'none',
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
      solid: '#ec8c06',
      hover: '#f97316',
      soft: 'rgba(236, 106, 6, 0.13)',
      border: '#c95704',
      tertiarySolid: '#0891b2',
      tertiaryHover: '#0ea5c5',
      tertiarySoft: 'rgba(8, 145, 178, 0.12)',
      tertiaryBorder: '#0e7490',
      emphasisBorder: '#ec8c06',
      focus: 'rgba(8, 145, 178, 0.24)',
      contrast: '#241002'
    },
    button: {
      primary: {
        background: '#ec8c06',
        border: '#c95704',
        hover: '#f97316',
        active: '#b84a04',
        text: '#241002'
      },
      secondary: {
        background: '#ffffff',
        border: '#dfe4ea',
        hover: '#f1f5f9',
        active: '#e8edf3',
        text: '#475569'
      }
    },
    card: {
      background: {
        default: '#ffffff',
        hover: '#f8fafc',
        active: '#f1f5f9'
      },
      border: {
        default: '#dfe4ea',
        selected: '#ec8c06'
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
      dim: '#363b40',
      inverse: '#eef4f6',
      accent: '#b84a04'
    },
    surface: {
      canvas: '#f7f9fb',
      subtle: '#eef2f6',
      panel: '#ffffff',
      raised: '#fbfcfd',
      recessed: '#e5eaf0',
      sidebar: '#f1f5f9',
      header: '#ffffff',
      emphasized: '#edeff2'
    },
    border: {
      subtle: '#dfe4ea',
      strong: '#cbd5e1'
    },
    status: {
      success: '#2f9b63',
      successSoft: '#e3f6ea',
      warning: '#8a5a00',
      warningSoft: '#fff4cc',
      danger: '#c15336',
      dangerSoft: '#fee7e2'
    },
    damage: {
      acid: '#4f8f3a',
      acidSoft: '#e7f5df',
      bludgeoning: '#6b7280',
      bludgeoningSoft: '#eef0f3',
      cold: '#1d8fc2',
      coldSoft: '#e0f4fb',
      fire: '#d9340f',
      fireSoft: '#fee6d5',
      force: '#7c3aed',
      forceSoft: '#ede7ff',
      lightning: '#b7791f',
      lightningSoft: '#fff1c2',
      necrotic: '#6d28d9',
      necroticSoft: '#eee7ff',
      piercing: '#64748b',
      piercingSoft: '#edf1f5',
      poison: '#2f855a',
      poisonSoft: '#def4e8',
      psychic: '#be3f8f',
      psychicSoft: '#fae3f1',
      radiant: '#b98500',
      radiantSoft: '#fff2be',
      slashing: '#737373',
      slashingSoft: '#eeeeee',
      thunder: '#2563eb',
      thunderSoft: '#e2ecff'
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
      accent: '#ec8c06',
      muted: '#78858f',
      hover: '#0e7490',
      selected: '#ec8c06'
    },
    logo: {
      background: '#ec8c06',
      icon: '#241002'
    },
    nav: {
      pillHover: 'rgba(236, 106, 6, 0.08)',
      pillActive: 'rgba(236, 106, 6, 0.13)'
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
        border: '#ec8c06',
        background: '#ec8c06',
        text: '#b84a04'
      },
      completed: {
        border: '#0891b2',
        background: '#0891b2',
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
      solid: '#ec8c06',
      hover: '#ff7f1f',
      soft: 'rgba(236, 106, 6, 0.18)',
      border: '#c95704',
      tertiarySolid: '#6bd8cb',
      tertiaryHover: '#8ee7dc',
      tertiarySoft: 'rgba(107, 216, 203, 0.14)',
      tertiaryBorder: '#29a195',
      emphasisBorder: '#ec8c06',
      focus: 'rgba(14, 165, 197, 0.3)',
      contrast: '#241002'
    },
    button: {
      primary: {
        background: '#ec8c06',
        border: '#c95704',
        hover: '#ff7f1f',
        active: '#b84a04',
        text: '#241002'
      },
      secondary: {
        background: '#12161c',
        border: '#2a3038',
        hover: '#191e25',
        active: '#0b0f14',
        text: '#b7bdc4'
      }
    },
    card: {
      background: {
        default: '#171d1c',
        hover: '#1b2120',
        active: '#262b2a'
      },
      border: {
        default: '#2f3836',
        selected: '#ec8c06'
      }
    },
    input: {
      background: {
        default: '#0a0f0e',
        hover: '#111716',
        active: '#171d1c',
        disabled: '#101513'
      },
      border: {
        default: '#3d4947',
        focus: '#0ea5c5',
        error: '#e8795f',
        disabled: '#2f3836'
      },
      placeholder: '#7e8790',
      sideButton: '#262b2a'
    },
    text: {
      primary: '#f2f4f0',
      secondary: '#b7bdc4',
      muted: '#858d96',
      dim: '#c6ced6',
      inverse: '#071014',
      accent: '#ffb690'
    },
    surface: {
      canvas: '#0a0f0e',
      subtle: '#1b2120',
      panel: '#171d1c',
      raised: '#262b2a',
      recessed: '#050806',
      sidebar: '#0f1413',
      header: '#0f1413',
      emphasized: '#313131'
    },
    border: {
      subtle: '#2f3836',
      strong: '#3d4947'
    },
    status: {
      success: '#6fca8b',
      successSoft: '#0f2a18',
      warning: '#f5c75d',
      warningSoft: '#2f260d',
      danger: '#e8795f',
      dangerSoft: '#32130f'
    },
    damage: {
      acid: '#8bd66f',
      acidSoft: '#142915',
      bludgeoning: '#a1a1aa',
      bludgeoningSoft: '#202227',
      cold: '#73d2f2',
      coldSoft: '#0e2630',
      fire: '#ff5b1f',
      fireSoft: '#351808',
      force: '#c4a7ff',
      forceSoft: '#21153d',
      lightning: '#ffd166',
      lightningSoft: '#2e260b',
      necrotic: '#b794f6',
      necroticSoft: '#24163b',
      piercing: '#a7b0bd',
      piercingSoft: '#20242a',
      poison: '#6fca8b',
      poisonSoft: '#102a1a',
      psychic: '#f08ac2',
      psychicSoft: '#341528',
      radiant: '#ffe08a',
      radiantSoft: '#31270b',
      slashing: '#b8b8b8',
      slashingSoft: '#242424',
      thunder: '#8cb4ff',
      thunderSoft: '#14223d'
    },
    school: {
      abjuration: '#7da2f0',
      conjuration: '#d8953a',
      divination: '#d5b75c',
      enchantment: '#e187b7',
      evocation: '#e8795f',
      illusion: '#73c3e2',
      necromancy: '#a78bfa',
      transmutation: '#6fca8b'
    },
    icon: {
      default: '#d9dde0',
      accent: '#ec8c06',
      muted: '#7f8790',
      hover: '#ff7f1f',
      selected: '#ec8c06'
    },
    logo: {
      background: '#ec8c06',
      icon: '#241002'
    },
    nav: {
      pillHover: 'rgba(236, 106, 6, 0.1)',
      pillActive: 'rgba(236, 106, 6, 0.17)'
    },
    tooltip: {
      background: '#f2f4f0',
      text: '#071014'
    },
    steps: {
      default: {
        border: '#333941',
        background: '#10151b',
        text: '#858d96'
      },
      current: {
        border: '#ec8c06',
        background: '#ec8c06',
        text: '#ffb690'
      },
      completed: {
        border: '#29a195',
        background: '#29a195',
        icon: '#071014'
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
  '#fff7ed',
  '#ffedd5',
  '#fed7aa',
  '#fdba74',
  '#fb923c',
  '#f97316',
  '#ec8c06',
  '#c95704',
  '#9a3412',
  '#7c2d12'
] as const

export const media = {
  tablet: 'screen and (max-width: 992px)',
  mobile: 'screen and (max-width: 760px)'
} as const

createGlobalTheme(':root', foundationVars, {
  ...sharedFoundationTokens,
  ...lightFoundationTokens
})

createGlobalTheme('[data-mantine-color-scheme="dark"]', foundationVars, {
  ...sharedFoundationTokens,
  ...darkFoundationTokens
})
