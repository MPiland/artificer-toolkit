import { createGlobalTheme, createThemeContract, createTheme } from '@vanilla-extract/css'
import './layers.css'
import './reset.css'
import './app.css'
import { lightColors, darkColors } from './colors.css'
import { borderRadius, borderSize } from './border.css'
import { height, size, space } from './size.css'

const colorTokens = {
  content: {
    background: {
      main: 'slate1' as keyof typeof lightColors,
      error: 'red1' as keyof typeof lightColors,
    },
  },
  component: {
    background: {
      main: 'slate2' as keyof typeof lightColors,
      header: 'slate4' as keyof typeof lightColors,
      error: 'red3' as keyof typeof lightColors,
    },
  },
  border: {
    main: 'slate7' as keyof typeof lightColors,
    error: 'red7' as keyof typeof lightColors,
    focus: 'blue7' as keyof typeof lightColors,
  },
}

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
  },
})

export const light = createTheme(vars, {
  typography: {
    color: {
      main: lightColors['slate12'],
      error: lightColors['red12'],
    },
    backgroundColor: {
      main: 'transparent',
      error: lightColors[colorTokens.component.background.error],
    },
  },
  component: {
    appShell: {
      sidebar: {
        backgroundColor: lightColors['slate3'],
        border: {
          color: {
            main: lightColors['slate7'],
          },
        },
      },
    },
    button: {
      backgroundColor: {
        primary: {
          main: lightColors['blue9'],
          hover: lightColors['blue10'],
          outlineHover: lightColors['blue3'],
        },
        warning: {
          main: lightColors['yellow9'],
          hover: lightColors['yellow10'],
          outlineHover: lightColors['yellow3'],
        },
        danger: {
          main: lightColors['red9'],
          hover: lightColors['red10'],
          outlineHover: lightColors['red3'],
        },
        update: {
          main: lightColors['green9'],
          hover: lightColors['green10'],
          outlineHover: lightColors['green3'],
        },
        main: {
          main: lightColors['slate9'],
          hover: lightColors['slate10'],
          outlineHover: lightColors['slate3'],
        },
      },
    },
    card: {
      backgroundColor: {
        main: lightColors[colorTokens.component.background.main],
        header: lightColors[colorTokens.component.background.header],
      },
      border: {
        color: {
          main: lightColors[colorTokens.border.main],
        },
      },
    },
    collapse: {
      backgroundColor: {
        main: lightColors[colorTokens.component.background.main],
      },
      border: {
        color: {
          main: lightColors[colorTokens.border.main],
        },
      },
    },
    content: {
      backgroundColor: {
        main: lightColors[colorTokens.content.background.main],
        error: lightColors[colorTokens.content.background.error],
      },
      border: {
        color: {
          main: lightColors[colorTokens.border.main],
          error: lightColors[colorTokens.border.error],
        },
      },
    },
    input: {
      backgroundColor: lightColors[colorTokens.component.background.main],
      border: {
        color: {
          main: lightColors[colorTokens.border.main],
          error: lightColors[colorTokens.border.error],
          focus: lightColors[colorTokens.border.focus],
        },
      },
    },
    modal: {
      backgroundColor: {
        main: lightColors[colorTokens.component.background.main],
        overlay: 'rgba(0, 0, 0, 0.541)',
      },
      border: {
        color: {
          main: lightColors[colorTokens.border.main],
        },
      },
    },
    tooltip: {
      backgroundColor: {
        main: lightColors[colorTokens.component.background.main],
        error: lightColors[colorTokens.component.background.error],
      },
    },
    floating: {
      backgroundColor: {
        main: lightColors[colorTokens.component.background.main],
        error: lightColors[colorTokens.component.background.error],
      },
    },
  },
})

export const dark = createTheme(vars, {
  typography: {
    color: {
      main: darkColors['slate12'],
      error: darkColors['red12'],
    },
    backgroundColor: {
      main: 'transparent',
      error: darkColors[colorTokens.component.background.error],
    },
  },
  component: {
    appShell: {
      sidebar: {
        backgroundColor: darkColors['slate3'],
        border: {
          color: {
            main: darkColors['slate7'],
          },
        },
      },
    },
    button: {
      backgroundColor: {
        primary: {
          main: darkColors['blue9'],
          hover: darkColors['blue10'],
          outlineHover: darkColors['blue3'],
        },
        warning: {
          main: darkColors['yellow9'],
          hover: darkColors['yellow10'],
          outlineHover: darkColors['yellow3'],
        },
        danger: {
          main: darkColors['red9'],
          hover: darkColors['red10'],
          outlineHover: darkColors['red3'],
        },
        update: {
          main: darkColors['green9'],
          hover: darkColors['green10'],
          outlineHover: darkColors['green3'],
        },
        main: {
          main: darkColors['slate9'],
          hover: darkColors['slate10'],
          outlineHover: darkColors['slate3'],
        },
      },
    },
    card: {
      backgroundColor: {
        main: darkColors[colorTokens.component.background.main],
        header: darkColors[colorTokens.component.background.header],
      },
      border: {
        color: {
          main: darkColors[colorTokens.border.main],
        },
      },
    },
    collapse: {
      backgroundColor: {
        main: darkColors[colorTokens.component.background.main],
      },
      border: {
        color: {
          main: darkColors[colorTokens.border.main],
        },
      },
    },
    content: {
      backgroundColor: {
        main: darkColors[colorTokens.content.background.main],
        error: darkColors[colorTokens.content.background.error],
      },
      border: {
        color: {
          main: darkColors[colorTokens.border.main],
          error: darkColors[colorTokens.border.error],
        },
      },
    },
    input: {
      backgroundColor: darkColors[colorTokens.component.background.main],
      border: {
        color: {
          main: darkColors[colorTokens.border.main],
          error: darkColors[colorTokens.border.error],
          focus: darkColors[colorTokens.border.focus],
        },
      },
    },
    modal: {
      backgroundColor: {
        main: darkColors[colorTokens.component.background.main],
        overlay: 'rgba(0, 0, 0, 0.541)',
      },
      border: {
        color: {
          main: darkColors[colorTokens.border.main],
        },
      },
    },
    tooltip: {
      backgroundColor: {
        main: darkColors[colorTokens.component.background.main],
        error: darkColors[colorTokens.component.background.error],
      },
    },
    floating: {
      backgroundColor: {
        main: darkColors[colorTokens.component.background.main],
        error: darkColors[colorTokens.component.background.error],
      },
    },
  },
})

export const theme = { ...root, vars }

export type Theme = typeof theme
export type ButtonColor = keyof typeof vars.component.button.backgroundColor
