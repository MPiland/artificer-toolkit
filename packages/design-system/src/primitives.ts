/**
 * Unit-agnostic spacing scale in rem units.
 */
export const spacingScale = {
  1: 0.25,
  2: 0.5,
  3: 0.75,
  4: 1,
  5: 1.25,
  6: 1.5,
  7: 1.75,
  8: 2,
  9: 2.25,
  10: 2.5,
  12: 3,
  13: 4,
  14: 6
} as const

/**
 * Unit-agnostic radii scale in px-equivalent numeric values.
 */
export const radiusScale = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  pill: 9999
} as const

/**
 * Unit-agnostic typography scale.
 * Font sizes are represented as rem units and line heights are unitless.
 */
export const typographyScale = {
  display: {
    fontSize: 4,
    lineHeight: 1.12,
    fontWeight: 800,
    letterSpacing: 0
  },
  title: {
    fontSize: 2,
    lineHeight: 1.2,
    fontWeight: 750,
    letterSpacing: 0
  },
  heading: {
    fontSize: 1.5,
    lineHeight: 1.2,
    fontWeight: 750,
    letterSpacing: 0
  },
  body: {
    fontSize: 1,
    lineHeight: 1.5,
    fontWeight: 400,
    letterSpacing: 0
  },
  bodySm: {
    fontSize: 0.875,
    lineHeight: 1.45,
    fontWeight: 400,
    letterSpacing: 0
  },
  label: {
    fontSize: 0.75,
    lineHeight: 1.45,
    fontWeight: 700,
    letterSpacing: 0
  },
  caption: {
    fontSize: 0.8125,
    lineHeight: 1.4,
    fontWeight: 400,
    letterSpacing: 0
  }
} as const

/**
 * Unit-agnostic font-weight scale.
 */
export const fontWeightScale = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  heavy: 800
} as const

/**
 * Breakpoints as unitless pixel widths.
 */
export const breakpoints = {
  tablet: 992,
  tabletPortrait: 900,
  mobile: 760
} as const

/**
 * Unit-agnostic duration scale in milliseconds.
 */
export const motionScale = {
  fast: 120,
  base: 180,
  slow: 320
} as const

/**
 * Canonical non-theme primitive colors.
 */
export const colorScale = {
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
} as const

export const lightColorTokens = {
  color: {
    ...colorScale,
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
    }
  }
} as const

export const darkColorTokens = {
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

/**
 * Brand color scale in ascending hue order.
 */
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

/**
 * Convenience tuple references for primitive scales.
 */
export const spacingScaleKeys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14] as const satisfies readonly (keyof typeof spacingScale)[]
export const typographyScaleKeys = Object.keys(typographyScale) as readonly (keyof typeof typographyScale)[]
export const radiusScaleKeys = Object.keys(radiusScale) as readonly (keyof typeof radiusScale)[]
export const breakpointsKeys = Object.keys(breakpoints) as readonly (keyof typeof breakpoints)[]

export type SpacingKeys = keyof typeof spacingScale
export type RadiusKeys = keyof typeof radiusScale
export type BreakpointKeys = keyof typeof breakpoints
export type MotionKeys = keyof typeof motionScale
export type FontWeightKeys = keyof typeof fontWeightScale
