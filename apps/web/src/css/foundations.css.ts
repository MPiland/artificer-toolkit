import {
  breakpoints,
  fontWeightScale,
  lightColorTokens,
  darkColorTokens,
  motionScale,
  radiusScale,
  spacingScale,
  typographyScale
} from '@artificer-toolkit/design-system'
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
      floatingControl: null,
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

const toPxScale = <T extends Record<string, number>>(scale: T) =>
  Object.fromEntries(Object.entries(scale).map(([key, value]) => [key, `${value}px`])) as {
    [K in keyof T]: string
  }

const toRemScale = <T extends Record<string, number>>(scale: T) =>
  Object.fromEntries(Object.entries(scale).map(([key, value]) => [key, `${value}rem`])) as {
    [K in keyof T]: string
  }

const toMsScale = <T extends Record<string, number>>(scale: T) =>
  Object.fromEntries(Object.entries(scale).map(([key, value]) => [key, `${value}ms`])) as {
    [K in keyof T]: string
  }

const toFontWeightScale = <T extends Record<string, number>>(scale: T) =>
  Object.fromEntries(Object.entries(scale).map(([key, value]) => [key, `${value}`])) as {
    [K in keyof T]: string
  }

const toTypographyScale = <
  T extends Record<
    string,
    { fontSize: number; lineHeight: number; fontWeight: number; letterSpacing: number }
  >
>(
  scale: T
) =>
  Object.fromEntries(
    Object.entries(scale).map(([key, token]) => [
      key,
      {
        fontSize: `${token.fontSize}rem`,
        lineHeight: `${token.lineHeight}`,
        fontWeight: `${token.fontWeight}`,
        letterSpacing: `${token.letterSpacing}`
      }
    ])
  ) as {
    [K in keyof T]: {
      fontSize: string
      lineHeight: string
      fontWeight: string
      letterSpacing: string
    }
  }

export const sharedFoundationTokens = {
  font: {
    sans: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', sans-serif",
    display:
      "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', sans-serif",
    mono: "'SFMono-Regular', 'SF Mono', 'JetBrains Mono', 'Fira Code', monospace"
  },
  fontWeight: toFontWeightScale(fontWeightScale),
  size: {
    authStageMax: '1120px',
    authPanelMax: '440px',
    contentMeasure: '32rem'
  },
  space: toRemScale(spacingScale),
  radius: toPxScale(radiusScale),
  shadow: {
    card: 'none',
    cardHover: 'none',
    floatingControl: '0 6px 8px rgba(0, 0, 0, 0.22)',
    focus: '0 0 0 4px rgba(14, 165, 197, 0.24)'
  },
  motion: toMsScale(motionScale),
  typography: toTypographyScale(typographyScale)
} as const

export { brandColorScale } from '@artificer-toolkit/design-system'

export const media = {
  tablet: `screen and (max-width: ${breakpoints.tablet}px)`,
  tabletPortrait: `screen and (max-width: ${breakpoints.tabletPortrait}px) and (orientation: portrait)`,
  mobile: `screen and (max-width: ${breakpoints.mobile}px)`
} as const

createGlobalTheme(':root', foundationVars, {
  ...sharedFoundationTokens,
  color: lightColorTokens.color
})

createGlobalTheme('[data-mantine-color-scheme="dark"]', foundationVars, {
  ...sharedFoundationTokens,
  color: darkColorTokens.color
})
