import { style } from '@vanilla-extract/css'
import { foundationVars } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

const compact = 'screen and (max-width: 48rem)'
const tablet = 'screen and (max-width: 64rem)'

export const page = style({
  '@layer': {
    [app]: {
      boxSizing: 'border-box',
      alignContent: 'start',
      display: 'grid',
      gap: foundationVars.space[5],
      inlineSize: '100%',
      maxInlineSize: '76rem',
      marginInline: 'auto',
      '@media': {
        [compact]: {
          paddingInline: foundationVars.space[3]
        }
      }
    }
  }
})

export const createPage = style({
  '@layer': {
    [app]: {
      maxInlineSize: '48rem'
    }
  }
})

export const pageHeader = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: foundationVars.space[4],
      minInlineSize: 0,
      '@media': {
        [compact]: {
          flexDirection: 'column',
          justifyContent: 'flex-start',
          gap: foundationVars.space[2]
        }
      }
    }
  }
})

export const campaignTitle = style({
  '@layer': {
    [app]: {
      '@media': {
        [compact]: {
          flexBasis: '100%'
        }
      }
    }
  }
})

export const createHeader = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[1],
      maxInlineSize: '65ch'
    }
  }
})

export const headerActions = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'flex-end',
      flexDirection: 'column',
      gap: foundationVars.space[2],

      '@media': {
        [compact]: {
          alignItems: 'flex-start'
        }
      }
    }
  }
})

export const cards = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: foundationVars.space[4],
      '@media': {
        [tablet]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
        [compact]: { gridTemplateColumns: '1fr' }
      }
    }
  }
})

export const card = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      minBlockSize: '10rem',
      padding: foundationVars.space[5],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      background: foundationVars.color.surface.panel,
      color: foundationVars.color.text.primary,
      textDecoration: 'none',
      transition: `border-color ${foundationVars.motion.fast} ease, transform ${foundationVars.motion.fast} ease`,
      ':hover': { borderColor: foundationVars.color.accent.border, transform: 'translateY(-1px)' },
      ':focus-visible': { outline: 'none', boxShadow: foundationVars.shadow.focus }
    }
  }
})

export const archivedCard = style({
  '@layer': { [app]: { background: foundationVars.color.surface.recessed } }
})

export const form = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[4],
      maxInlineSize: '42rem'
    }
  }
})

export const createForm = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[4],
      inlineSize: '100%',
      padding: foundationVars.space[5],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      background: foundationVars.color.surface.panel,
      '@media': {
        [compact]: {
          padding: foundationVars.space[4]
        }
      }
    }
  }
})

export const createActions = style({
  '@layer': {
    [app]: {
      paddingBlockStart: foundationVars.space[1],
      '@media': {
        [compact]: {
          display: 'grid',
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const input = style({
  '@layer': {
    [app]: {
      vars: {
        '--input-bg': foundationVars.color.input.background.default,
        '--input-bd': foundationVars.color.input.border.default,
        '--input-color': foundationVars.color.text.primary,
        '--input-placeholder-color': foundationVars.color.input.placeholder
      },
      minBlockSize: '40px',
      maxInlineSize: '100%',
      borderColor: foundationVars.color.input.border.default,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.input.background.default,
      color: foundationVars.color.text.primary,
      transition: `border-color ${foundationVars.motion.fast} ease, box-shadow ${foundationVars.motion.fast} ease, background ${foundationVars.motion.fast} ease`,
      selectors: {
        '&:hover:not(:disabled)': {
          vars: {
            '--input-bg': foundationVars.color.input.background.hover,
            '--input-bd': foundationVars.color.border.strong
          },
          borderColor: foundationVars.color.border.strong,
          backgroundColor: foundationVars.color.input.background.hover
        },
        '&:focus, &:focus-within': {
          vars: {
            '--input-bd': foundationVars.color.input.border.focus
          },
          borderColor: foundationVars.color.input.border.focus,
          boxShadow: foundationVars.shadow.focus
        },
        '&::placeholder, &[data-placeholder]': {
          color: foundationVars.color.input.placeholder,
          opacity: 1
        },
        '&:disabled, &[data-disabled="true"], &[readonly], &[data-readonly="true"]': {
          vars: {
            '--input-bg': foundationVars.color.input.background.disabled,
            '--input-bd': foundationVars.color.input.border.disabled,
            '--input-color': foundationVars.color.text.secondary
          },
          borderColor: foundationVars.color.input.border.disabled,
          backgroundColor: foundationVars.color.input.background.disabled,
          color: foundationVars.color.text.secondary
        }
      },
      '@media': {
        [compact]: {
          fontSize: '1rem'
        }
      }
    }
  }
})

export const detailWorkspace = style({
  '@layer': {
    [app]: {
      minInlineSize: 0,
      maxInlineSize: '100%',
      overflow: 'hidden'
    }
  }
})

export const detailTabs = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexWrap: 'nowrap',
      gap: foundationVars.space[4],
      inlineSize: '100%',
      minInlineSize: 0,
      maxInlineSize: '100%',
      overflowX: 'auto',
      overflowY: 'hidden',
      borderBlockEnd: 0,
      scrollbarWidth: 'none',
      selectors: {
        '&::before': {
          display: 'none'
        },
        '&::-webkit-scrollbar': {
          display: 'none'
        }
      },
      '@media': {
        [compact]: {
          display: 'none'
        }
      }
    }
  }
})

export const campaignSectionSelect = style({
  '@layer': {
    [app]: {
      display: 'none',
      '@media': {
        [compact]: {
          display: 'block'
        }
      }
    }
  }
})

export const detailTab = style({
  '@layer': {
    [app]: {
      flex: '0 0 auto',
      minBlockSize: '40px',
      padding: `0 0 ${foundationVars.space[2]}`,
      border: 0,
      borderBlockEnd: '2px solid transparent',
      borderRadius: 0,
      background: 'transparent',
      color: foundationVars.color.text.secondary,
      fontWeight: foundationVars.fontWeight.medium,
      transition: `border-color ${foundationVars.motion.fast} ease, color ${foundationVars.motion.fast} ease`,
      selectors: {
        '&:hover': {
          borderBlockEndColor: foundationVars.color.accent.border,
          color: foundationVars.color.text.primary,
          background: 'transparent'
        },
        '&[data-active]': {
          borderBlockEndColor: foundationVars.color.accent.solid,
          color: foundationVars.color.text.primary
        },
        '&:focus-visible': {
          outline: 0,
          borderBlockEndColor: foundationVars.color.accent.solid,
          color: foundationVars.color.text.accent
        }
      }
    }
  }
})

export const panel = style({
  '@layer': {
    [app]: {
      display: 'grid',
      alignContent: 'start',
      gap: foundationVars.space[4],
      minInlineSize: 0,
      padding: foundationVars.space[5],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      background: foundationVars.color.surface.panel,
      '@media': {
        [compact]: {
          padding: foundationVars.space[4]
        }
      }
    }
  }
})

export const memberRow = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[3],
      paddingBlock: foundationVars.space[3],
      selectors: {
        '&:not(:last-child)': {
          borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`
        }
      },
      '@media': { [compact]: { alignItems: 'flex-start', flexDirection: 'column' } }
    }
  }
})

export const emptyState = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[1],
      paddingBlock: foundationVars.space[5],
      color: foundationVars.color.text.secondary
    }
  }
})
