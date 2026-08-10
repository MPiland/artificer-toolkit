/**
 * Canonical non-theme primitive colors.
 */
const blackForgeSurfaceScale = {
  header: '#07090b',
  band: '#101214',
  canvas: '#101315',
  rail: '#121517',
  row: '#141719',
  preview: '#15181a',
  panel: '#171a1d',
  hover: '#1d2125',
  raised: '#262a2f',
  emphasized: '#31363c',
  recessed: '#0b0e10',
  fieldBorder: '#343a40',
  structuralBorder: 'rgba(255, 255, 255, 0.07)'
} as const

const colorScale = {
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
  authoring: {
    active: '#eef2f6',
    band: '#ffffff',
    border: '#dfe4ea',
    canvas: '#f7f9fb',
    dock: '#ffffff',
    field: '#ffffff',
    fieldBorder: '#b5b9c6',
    header: '#ffffff',
    notice: '#fff8e8',
    noticeBorder: '#d6b67a',
    panel: '#ffffff',
    preview: '#fffaf1',
    previewBorder: '#d6b67a',
    rail: '#f1f5f9',
    row: '#fbfcfd'
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
    authoring: {
      active: blackForgeSurfaceScale.panel,
      band: blackForgeSurfaceScale.band,
      border: blackForgeSurfaceScale.structuralBorder,
      canvas: blackForgeSurfaceScale.canvas,
      dock: blackForgeSurfaceScale.panel,
      field: blackForgeSurfaceScale.canvas,
      fieldBorder: blackForgeSurfaceScale.fieldBorder,
      header: blackForgeSurfaceScale.band,
      notice: '#191917',
      noticeBorder: 'rgba(214, 182, 122, 0.1)',
      panel: blackForgeSurfaceScale.panel,
      preview: blackForgeSurfaceScale.preview,
      previewBorder: 'rgba(214, 182, 122, 0.16)',
      rail: blackForgeSurfaceScale.rail,
      row: blackForgeSurfaceScale.row
    },
    button: {
      primary: {
        background: 'transparent',
        border: '#ec8c06',
        hover: 'rgba(236, 106, 6, 0.18)',
        active: blackForgeSurfaceScale.raised,
        text: '#ffb690'
      },
      secondary: {
        background: blackForgeSurfaceScale.rail,
        border: '#2a3038',
        hover: blackForgeSurfaceScale.hover,
        active: blackForgeSurfaceScale.canvas,
        text: '#b7bdc4'
      }
    },
    card: {
      background: {
        default: blackForgeSurfaceScale.panel,
        hover: blackForgeSurfaceScale.hover,
        active: blackForgeSurfaceScale.raised
      },
      border: {
        default: blackForgeSurfaceScale.structuralBorder,
        selected: '#ec8c06'
      }
    },
    input: {
      background: {
        default: blackForgeSurfaceScale.canvas,
        hover: blackForgeSurfaceScale.row,
        active: blackForgeSurfaceScale.panel,
        disabled: blackForgeSurfaceScale.rail
      },
      border: {
        default: blackForgeSurfaceScale.fieldBorder,
        focus: '#0ea5c5',
        error: '#e8795f',
        disabled: '#2a3035'
      },
      placeholder: '#7e8790',
      sideButton: blackForgeSurfaceScale.raised
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
      canvas: blackForgeSurfaceScale.canvas,
      subtle: blackForgeSurfaceScale.row,
      panel: blackForgeSurfaceScale.panel,
      raised: blackForgeSurfaceScale.raised,
      recessed: blackForgeSurfaceScale.recessed,
      sidebar: blackForgeSurfaceScale.rail,
      header: blackForgeSurfaceScale.header,
      emphasized: blackForgeSurfaceScale.emphasized
    },
    border: {
      subtle: blackForgeSurfaceScale.structuralBorder,
      strong: blackForgeSurfaceScale.fieldBorder
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
        border: blackForgeSurfaceScale.fieldBorder,
        background: blackForgeSurfaceScale.canvas,
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
