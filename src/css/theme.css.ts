import { createGlobalTheme, createThemeContract, createTheme } from '@vanilla-extract/css'
import './layers.css'
import './reset.css'
import './app.css'
import { lightColors, darkColors } from './colors.css'
import { borderRadius, borderSize } from './border.css'
import { height, size, space } from './size.css'

export const root = createGlobalTheme(':root', {
  border: {
    size: {
      main: borderSize['border-size-1'],
      emphasis: borderSize['border-size-2'],
    },
    style: 'solid',
    radius: borderRadius['sm'],
  },
  component: {
    button: {
      height: height['sm'],
    },
    input: {
      height: height['sm'],
    },
    appShell: {
      sidebar: {
        spacing: {
          padding: `${space['space-4']} 0`,
          height: {
            header: height['md'],
            item: size['size-9'],
          },
          width: {
            main: '14rem',
            collapsed: `calc(${size['size-9']} + ${space['space-4']})`,
          },
        },
      },
      header: {
        spacing: {
          padding: `${space['space-4']} ${space['space-4']}`,
          height: `calc(${height['md']} + ${space['space-9']})`,
        },
      },
      hamburger: {
        height: 'calc(.5rem * 3)',
        line: {
          height: 'calc(.5rem / 2.25)',
        },
        wrapper: {
          height: '2.5rem',
          width: size['size-9'],
        },
      },
    },
  },
})

export const vars = createThemeContract({
  typography: {
    color: {
      main: '',
      error: '',
    },
    backgroundColor: {
      main: '',
      error: '',
    },
  },
  component: {
    appShell: {
      sidebar: {
        backgroundColor: '',
        border: {
          color: {
            main: '',
          },
        },
      },
    },
    button: {
      backgroundColor: {
        primary: {
          main: '',
          hover: '',
          outlineHover: '',
        },
        warning: {
          main: '',
          hover: '',
          outlineHover: '',
        },
        danger: {
          main: '',
          hover: '',
          outlineHover: '',
        },
        update: {
          main: '',
          hover: '',
          outlineHover: '',
        },
        main: {
          main: '',
          hover: '',
          outlineHover: '',
        },
      },
    },
    input: {
      backgroundColor: '',
      border: {
        color: {
          main: '',
          error: '',
          focus: '',
        },
      },
    },
    card: {
      backgroundColor: {
        header: '',
        main: '',
      },
      border: {
        color: {
          main: '',
        },
      },
    },
    collapse: {
      backgroundColor: {
        header: '',
        main: '',
      },
      border: {
        color: {
          main: '',
        },
      },
    },
    content: {
      backgroundColor: {
        main: '',
        error: '',
      },
      border: {
        color: {
          main: '',
          error: '',
        },
      },
    },
    modal: {
      backgroundColor: {
        main: '',
        overlay: '',
      },
      border: {
        color: {
          main: '',
        },
      },
    },
    tooltip: {
      backgroundColor: {
        main: '',
        error: '',
      },
    },
    floating: {
      backgroundColor: {
        main: '',
        error: '',
      },
    },
    dropdown: {
      activeOption: {
        backgroundColor: '',
      },
    },
  },
})

const colors = {
  light: lightColors,
  dark: darkColors,
}

const themeNames = ['light', 'dark'] as const

type ThemeName = (typeof themeNames)[number]

type ColorPalette = (typeof colors)[ThemeName]

type ColorKey = keyof typeof colors.light & keyof typeof colors.dark

type ColorTokens = {
  content: {
    background: {
      main: ColorKey
      error: ColorKey
    }
  }
  component: {
    background: {
      main: ColorKey
      header: ColorKey
      error: ColorKey
    }
  }
  border: {
    main: ColorKey
    error: ColorKey
    focus: ColorKey
  }
}

const colorTokens: ColorTokens = {
  content: {
    background: {
      main: 'slate1',
      error: 'red1',
    },
  },
  component: {
    background: {
      main: 'slate2',
      header: 'slate4',
      error: 'red3',
    },
  },
  border: {
    main: 'slate7',
    error: 'red7',
    focus: 'blue7',
  },
}

const createColorTheme = (colorPalette: ColorPalette) => ({
  typography: {
    color: {
      main: colorPalette['slate12'],
      error: colorPalette['red12'],
    },
    backgroundColor: {
      main: 'transparent',
      error: colorPalette[colorTokens.component.background.error],
    },
  },
  component: {
    appShell: {
      sidebar: {
        backgroundColor: colorPalette['slate3'],
        border: {
          color: {
            main: colorPalette['slate7'],
          },
        },
      },
    },
    button: {
      backgroundColor: {
        primary: {
          main: colorPalette['blue9'],
          hover: colorPalette['blue10'],
          outlineHover: colorPalette['blue3'],
        },
        warning: {
          main: colorPalette['yellow9'],
          hover: colorPalette['yellow10'],
          outlineHover: colorPalette['yellow3'],
        },
        danger: {
          main: colorPalette['red9'],
          hover: colorPalette['red10'],
          outlineHover: colorPalette['red3'],
        },
        update: {
          main: colorPalette['green9'],
          hover: colorPalette['green10'],
          outlineHover: colorPalette['green3'],
        },
        main: {
          main: colorPalette['slate9'],
          hover: colorPalette['slate10'],
          outlineHover: colorPalette['slate3'],
        },
      },
    },
    card: {
      backgroundColor: {
        main: colorPalette[colorTokens.component.background.main],
        header: colorPalette[colorTokens.component.background.header],
      },
      border: {
        color: {
          main: colorPalette[colorTokens.border.main],
        },
      },
    },
    collapse: {
      backgroundColor: {
        main: colorPalette[colorTokens.component.background.main],
        header: colorPalette[colorTokens.component.background.header],
      },
      border: {
        color: {
          main: colorPalette[colorTokens.border.main],
        },
      },
    },
    content: {
      backgroundColor: {
        main: colorPalette[colorTokens.content.background.main],
        error: colorPalette[colorTokens.content.background.error],
      },
      border: {
        color: {
          main: colorPalette[colorTokens.border.main],
          error: colorPalette[colorTokens.border.error],
        },
      },
    },
    input: {
      backgroundColor: colorPalette[colorTokens.component.background.main],
      border: {
        color: {
          main: colorPalette[colorTokens.border.main],
          error: colorPalette[colorTokens.border.error],
          focus: colorPalette[colorTokens.border.focus],
        },
      },
    },
    modal: {
      backgroundColor: {
        main: colorPalette[colorTokens.component.background.main],
        overlay: 'rgba(0, 0, 0, 0.541)',
      },
      border: {
        color: {
          main: colorPalette[colorTokens.border.main],
        },
      },
    },
    tooltip: {
      backgroundColor: {
        main: colorPalette[colorTokens.component.background.main],
        error: colorPalette[colorTokens.component.background.error],
      },
    },
    floating: {
      backgroundColor: {
        main: colorPalette[colorTokens.component.background.main],
        error: colorPalette[colorTokens.component.background.error],
      },
    },
    dropdown: {
      activeOption: {
        backgroundColor: colorPalette['blue5'],
      },
    },
  },
})

// Generate all themes using a record
const themes = themeNames.reduce((acc, themeName) => {
  acc[themeName] = createTheme(vars, createColorTheme(colors[themeName]))
  return acc
}, {} as Record<ThemeName, string>)

// Export individual themes for backward compatibility
export const light = themes.light
export const dark = themes.dark

export const theme = { ...root, vars }

export type Theme = typeof theme
export type ButtonColor = keyof typeof vars.component.button.backgroundColor
