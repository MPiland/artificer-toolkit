import { globalStyle, style } from '@vanilla-extract/css'
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

export const gmDiceButton = style({
  '@layer': {
    [app]: {
      position: 'fixed',
      insetInlineEnd: foundationVars.space[5],
      insetBlockEnd: foundationVars.space[5],
      zIndex: 20,
      boxShadow: foundationVars.shadow.floatingControl,
      '@media': {
        [compact]: {
          insetInlineEnd: foundationVars.space[3],
          insetBlockEnd: foundationVars.space[3]
        }
      }
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

export const sessionHeader = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      gap: foundationVars.space[5],
      alignItems: 'center',
      minInlineSize: 0,
      paddingBlockEnd: foundationVars.space[4],
      borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`,
      '@media': {
        [compact]: {
          gridTemplateColumns: '1fr',
          gap: foundationVars.space[3]
        }
      }
    }
  }
})

export const sessionHeaderIdentity = style({
  '@layer': {
    [app]: {
      display: 'grid',
      justifyItems: 'start',
      gap: foundationVars.space[1],
      minInlineSize: 0
    }
  }
})

export const sessionTitleField = style({
  '@layer': {
    [app]: {
      flex: '1 1 auto',
      minInlineSize: 0,
      maxInlineSize: '34rem'
    }
  }
})

export const sessionTitleInput = style({
  '@layer': {
    [app]: {
      blockSize: 'auto',
      minBlockSize: '2.75rem',
      paddingInline: foundationVars.space[2],
      borderColor: 'transparent',
      background: 'transparent',
      color: foundationVars.color.text.primary,
      fontFamily: foundationVars.font.display,
      fontSize: 'clamp(1.65rem, 4vw, 2.25rem)',
      fontWeight: foundationVars.fontWeight.bold,
      lineHeight: 1.1,
      selectors: {
        '&:hover:not(:disabled)': {
          borderColor: foundationVars.color.border.subtle
        },
        '&:focus': {
          borderColor: foundationVars.color.accent.border,
          background: foundationVars.color.surface.recessed
        },
        '&::placeholder': {
          color: foundationVars.color.text.primary,
          opacity: 1
        }
      }
    }
  }
})

export const sessionBack = style({
  '@layer': {
    [app]: {
      marginInlineStart: `calc(${foundationVars.space[2]} * -1)`,
      color: foundationVars.color.text.secondary
    }
  }
})

export const sessionHeaderUtilities = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      gap: foundationVars.space[2],
      minInlineSize: 0,
      flexWrap: 'wrap',
      '@media': {
        [compact]: {
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          alignItems: 'center',
          inlineSize: '100%'
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

export const sectionGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1.5fr) minmax(17rem, 1fr)',
      gap: foundationVars.space[5],
      alignItems: 'start',
      minInlineSize: 0,
      '@media': { [tablet]: { gridTemplateColumns: '1fr' } }
    }
  }
})

export const inventoryWorkspace = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[5],
      inlineSize: '100%',
      maxInlineSize: '72rem',
      minInlineSize: 0
    }
  }
})

export const inventoryPanel = style({
  '@layer': {
    [app]: {
      maxInlineSize: '64rem'
    }
  }
})

export const overviewStack = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[4],
      inlineSize: '100%',
      maxInlineSize: '56rem'
    }
  }
})

export const partyPanel = style({
  '@layer': {
    [app]: {
      inlineSize: '100%',
      maxInlineSize: '64rem'
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

export const sessionsPanel = style([
  panel,
  {
    '@layer': {
      [app]: {
        gap: foundationVars.space[3],
        padding: foundationVars.space[4]
      }
    }
  }
])

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

export const characterAssignment = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[3],
      paddingBlock: foundationVars.space[3],
      '@media': {
        [compact]: {
          alignItems: 'stretch',
          flexDirection: 'column'
        }
      }
    }
  }
})

export const characterPickerGrid = style({
  '@layer': { [app]: { paddingBlock: foundationVars.space[2] } }
})

export const characterPickerCard = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      minBlockSize: '6rem',
      padding: foundationVars.space[4],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      background: foundationVars.color.surface.panel,
      color: foundationVars.color.text.primary,
      textAlign: 'start',
      transition: `border-color ${foundationVars.motion.fast} ease, background ${foundationVars.motion.fast} ease`,
      selectors: {
        '&:hover:not(:disabled)': {
          borderColor: foundationVars.color.accent.border,
          background: foundationVars.color.surface.raised
        },
        '&:focus-visible': {
          outline: 0,
          boxShadow: foundationVars.shadow.focus
        },
        '&[data-selected]': {
          borderColor: foundationVars.color.accent.border,
          background: foundationVars.color.accent.soft
        },
        '&:disabled': { cursor: 'default' }
      }
    }
  }
})

export const clockSetupGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
      gap: foundationVars.space[3],
      alignItems: 'end',
      '@media': {
        [compact]: {
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
        }
      }
    }
  }
})

export const chatLog = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flex: 1,
      flexDirection: 'column',
      gap: foundationVars.space[2],
      minBlockSize: 0,
      overflowY: 'auto',
      padding: foundationVars.space[4],
      background: foundationVars.color.surface.recessed
    }
  }
})

export const chatDrawerShell = style({
  '@layer': { [app]: { blockSize: '100dvh' } }
})

export const chatDrawerBody = style({
  '@layer': {
    [app]: {
      blockSize: 'calc(100dvh - 4.25rem)',
      minBlockSize: 0,
      overflow: 'hidden',
      padding: 0
    }
  }
})

export const chatDrawerContent = style({
  '@layer': {
    [app]: {
      blockSize: '100%',
      display: 'flex',
      flexDirection: 'column',
      minInlineSize: 0
    }
  }
})

export const chatNavigator = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      overflowX: 'auto',
      padding: `${foundationVars.space[2]} ${foundationVars.space[4]}`
    }
  }
})

export const chatMessageRow = style({
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'flex-start',
      inlineSize: '100%'
    }
  }
})

export const chatMessageRowOwn = style({
  '@layer': { [app]: { justifyContent: 'flex-end' } }
})

export const chatBubble = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'grid',
      gap: foundationVars.space[1],
      inlineSize: 'fit-content',
      maxInlineSize: '82%',
      padding: `${foundationVars.space[2]} ${foundationVars.space[3]}`,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: `${foundationVars.radius.lg} ${foundationVars.radius.lg} ${foundationVars.radius.lg} ${foundationVars.radius.sm}`,
      background: foundationVars.color.surface.panel,
      overflowWrap: 'anywhere',
      selectors: {
        '&::after': {
          content: '',
          position: 'absolute',
          insetInlineStart: '-6px',
          insetBlockEnd: '3px',
          inlineSize: '8px',
          blockSize: '10px',
          background: 'inherit',
          clipPath: 'polygon(100% 0, 100% 100%, 0 100%)'
        }
      }
    }
  }
})

export const chatBubbleOwn = style({
  '@layer': {
    [app]: {
      borderColor: foundationVars.color.accent.border,
      borderRadius: `${foundationVars.radius.lg} ${foundationVars.radius.lg} ${foundationVars.radius.sm} ${foundationVars.radius.lg}`,
      background: foundationVars.color.accent.soft,
      selectors: {
        '&::after': {
          insetInlineStart: 'auto',
          insetInlineEnd: '-6px',
          clipPath: 'polygon(0 0, 100% 100%, 0 100%)'
        }
      }
    }
  }
})

export const chatMessageMeta = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      alignItems: 'center',
      gap: foundationVars.space[3]
    }
  }
})

export const chatAuthor = style({
  '@layer': {
    [app]: {
      minInlineSize: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const chatEmpty = style({
  '@layer': {
    [app]: {
      margin: 'auto',
      maxInlineSize: '28ch',
      padding: foundationVars.space[5],
      textAlign: 'center'
    }
  }
})

export const chatComposer = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      padding: foundationVars.space[3],
      borderBlockStart: `1px solid ${foundationVars.color.border.subtle}`,
      background: foundationVars.color.surface.panel
    }
  }
})

export const chatComposerInput = style({
  '@layer': {
    [app]: {
      vars: {
        '--input-bg': foundationVars.color.input.background.default,
        '--input-bd': foundationVars.color.input.border.default,
        '--input-color': foundationVars.color.text.primary,
        '--input-placeholder-color': foundationVars.color.input.placeholder
      },
      borderColor: foundationVars.color.input.border.default,
      background: foundationVars.color.input.background.default,
      color: foundationVars.color.text.primary,
      selectors: {
        '&:focus': {
          borderColor: foundationVars.color.input.border.focus,
          boxShadow: foundationVars.shadow.focus
        }
      }
    }
  }
})

export const chatComposerToolbar = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      gap: foundationVars.space[2],
      justifyContent: 'flex-end',
      flexWrap: 'wrap'
    }
  }
})

export const chatVoice = style({
  '@layer': { [app]: { marginInlineEnd: 'auto' } }
})

export const chatEntry = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[1],
      padding: foundationVars.space[3],
      borderRadius: foundationVars.radius.md,
      background: foundationVars.color.surface.panel
    }
  }
})

export const compactActions = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: foundationVars.space[2]
    }
  }
})

export const encounterEmpty = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[3],
      paddingBlock: foundationVars.space[3],
      '@media': { [compact]: { alignItems: 'stretch', flexDirection: 'column' } }
    }
  }
})

export const encounterActorSummary = style({
  '@layer': {
    [app]: {
      paddingBlock: foundationVars.space[2],
      selectors: {
        '&:not(:last-child)': {
          borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`
        }
      }
    }
  }
})

export const sessionAttendanceGrid = style({
  '@layer': {
    [app]: {
      minInlineSize: 0
    }
  }
})

export const sessionUtilityPanel = style([
  panel,
  {
    '@layer': {
      [app]: {
        gap: foundationVars.space[3],
        padding: foundationVars.space[4]
      }
    }
  }
])

export const sessionScheduleGrid = style({
  '@layer': {
    [app]: {
      alignItems: 'end'
    }
  }
})

globalStyle(`${sessionScheduleGrid} > *`, {
  '@layer': {
    [app]: {
      minInlineSize: 0
    }
  }
})

export const sessionSectionCollection = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      background: foundationVars.color.surface.recessed
    }
  }
})

export const sessionSectionKind = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      padding: foundationVars.space[4],
      selectors: {
        '&:not(:last-child)': {
          borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`
        }
      }
    }
  }
})

export const sessionSectionAccordion = style({
  '@layer': {
    [app]: {
      minInlineSize: 0
    }
  }
})

export const sessionSectionAdder = style({
  '@layer': {
    [app]: {
      minBlockSize: '4rem',
      padding: foundationVars.space[3]
    }
  }
})

export const sessionReferenceRow = style({
  '@layer': {
    [app]: {
      minBlockSize: '2.75rem',
      paddingInline: foundationVars.space[3],
      borderRadius: foundationVars.radius.md,
      background: foundationVars.color.surface.recessed
    }
  }
})

export const sessionReferenceEditor = style({
  '@layer': {
    [app]: {
      padding: foundationVars.space[4],
      borderRadius: foundationVars.radius.lg,
      background: foundationVars.color.surface.recessed
    }
  }
})

export const sessionPartyGrid = style({
  '@layer': {
    [app]: {
      minInlineSize: 0
    }
  }
})

export const sessionPartyCard = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      minBlockSize: '10rem',
      padding: foundationVars.space[4],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      background: foundationVars.color.surface.recessed,
      selectors: {
        '&[data-absent]': {
          opacity: 0.65
        }
      }
    }
  }
})

export const sessionEncounterPanel = style([
  panel,
  {
    '@layer': {
      [app]: {
        gap: foundationVars.space[3],
        padding: foundationVars.space[4]
      }
    }
  }
])

export const sessionCompletion = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      padding: foundationVars.space[4],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      background: foundationVars.color.surface.recessed
    }
  }
})

export const sessionAttendanceCard = style({
  '@layer': {
    [app]: {
      display: 'block',
      inlineSize: '100%',
      minBlockSize: '3.5rem',
      padding: foundationVars.space[3],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      background: foundationVars.color.surface.recessed,
      color: foundationVars.color.text.primary,
      textAlign: 'start',
      selectors: {
        '&[data-selected]': {
          borderColor: foundationVars.color.accent.border,
          background: foundationVars.color.accent.soft
        }
      }
    }
  }
})

export const sessionEncounterAdder = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      justifyItems: 'start',
      paddingBlockStart: foundationVars.space[3],
      borderBlockStart: `1px solid ${foundationVars.color.border.subtle}`,
      selectors: {
        '&[data-open]': {
          padding: foundationVars.space[4],
          borderBlockStart: 0,
          borderRadius: foundationVars.radius.md,
          background: foundationVars.color.surface.recessed
        }
      },
      borderRadius: foundationVars.radius.md,
      color: foundationVars.color.text.primary
    }
  }
})

export const sessionEncounterSelect = style({
  '@layer': {
    [app]: {
      flex: '1 1 18rem',
      minInlineSize: 'min(18rem, 100%)'
    }
  }
})

export const sessionEncounterRow = style({
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'space-between',
      inlineSize: '100%',
      minBlockSize: '3rem',
      paddingInline: foundationVars.space[3],
      border: 0,
      borderRadius: foundationVars.radius.md,
      background: foundationVars.color.surface.recessed,
      color: foundationVars.color.text.primary,
      textAlign: 'start'
    }
  }
})

export const sessionEncounterWorkspace = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(12rem, 16rem) minmax(0, 1fr)',
      gap: foundationVars.space[4],
      alignItems: 'start',
      minInlineSize: 0,
      '@media': {
        [tablet]: {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const encounterManager = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      minInlineSize: 0,
      paddingBlockStart: foundationVars.space[2],
      '@media': {
        [tablet]: {
          paddingBlockStart: 0
        }
      }
    }
  }
})

export const encounterActorItem = style({
  '@layer': {
    [app]: {
      selectors: {
        '&[data-current]': {
          borderColor: foundationVars.color.accent.border
        }
      }
    }
  }
})

export const encounterActorHeader = style({
  '@layer': {
    [app]: {
      inlineSize: '100%'
    }
  }
})

export const encounterActorControl = style({
  '@layer': {
    [app]: {
      flex: '1 1 auto',
      minInlineSize: 0
    }
  }
})

export const encounterActorControls = style({
  '@layer': {
    [app]: {
      alignItems: 'flex-end',
      gap: foundationVars.space[3],
      '@media': {
        [compact]: {
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          inlineSize: '100%'
        }
      }
    }
  }
})

export const encounterNumericField = style({
  '@layer': {
    [app]: {
      flex: '0 0 6.5rem',
      inlineSize: '6.5rem',
      '@media': {
        [compact]: {
          inlineSize: '100%'
        }
      }
    }
  }
})

export const encounterRoundField = style({
  '@layer': {
    [app]: {
      inlineSize: '5.5rem'
    }
  }
})

export const encounterTurnSelect = style({
  '@layer': {
    [app]: {
      minInlineSize: '12rem',
      maxInlineSize: '18rem',
      '@media': {
        [compact]: {
          flex: '1 1 100%',
          maxInlineSize: 'none'
        }
      }
    }
  }
})

export const encounterTurnButton = style({
  '@layer': {
    [app]: {
      flex: '0 0 8rem',
      inlineSize: '8rem',
      '@media': {
        [compact]: {
          flex: '1 1 8rem',
          inlineSize: 'auto'
        }
      }
    }
  }
})

export const inlineFieldIconAction = style({
  '@layer': {
    [app]: {
      minInlineSize: '2.5rem',
      inlineSize: '2.5rem',
      minBlockSize: '2.5rem',
      blockSize: '2.5rem'
    }
  }
})

export const encounterVisibility = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      minBlockSize: '2.25rem',
      paddingBlockEnd: '0.3rem',
      '@media': {
        [compact]: {
          minBlockSize: 'auto',
          paddingBlock: foundationVars.space[2]
        }
      }
    }
  }
})

export const encounterStatBlock = style({
  '@layer': {
    [app]: {
      display: 'grid',
      overflow: 'hidden',
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      background: foundationVars.color.surface.panel
    }
  }
})

export const encounterStatSummary = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
      margin: 0,
      paddingBlock: foundationVars.space[3],
      '@media': {
        [compact]: {
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          rowGap: foundationVars.space[3]
        }
      }
    }
  }
})

export const encounterAbilities = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(6, minmax(2.5rem, 1fr))',
      margin: 0,
      padding: `${foundationVars.space[3]} ${foundationVars.space[4]}`,
      borderBlock: `1px solid ${foundationVars.color.border.subtle}`,
      background: foundationVars.color.surface.recessed,
      textAlign: 'center',
      '@media': {
        [compact]: {
          gridTemplateColumns: 'repeat(3, minmax(2.5rem, 1fr))',
          rowGap: foundationVars.space[3]
        }
      }
    }
  }
})

export const encounterDefenseList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      margin: 0,
      padding: `${foundationVars.space[3]} ${foundationVars.space[4]}`
    }
  }
})

globalStyle(`${encounterStatSummary} > div`, {
  '@layer': {
    [app]: {
      minInlineSize: 0,
      paddingInline: foundationVars.space[4]
    }
  }
})

globalStyle(`${encounterStatSummary} dt, ${encounterAbilities} dt`, {
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontSize: foundationVars.typography.caption.fontSize,
      lineHeight: 1.3
    }
  }
})

globalStyle(`${encounterStatSummary} dd`, {
  '@layer': {
    [app]: {
      margin: 0,
      overflowWrap: 'anywhere',
      fontSize: foundationVars.typography.bodySm.fontSize,
      fontWeight: foundationVars.fontWeight.semibold
    }
  }
})

globalStyle(`${encounterAbilities} dd`, {
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'center',
      gap: foundationVars.space[1],
      margin: 0,
      fontSize: foundationVars.typography.bodySm.fontSize
    }
  }
})

globalStyle(`${encounterAbilities} dd span`, {
  '@layer': { [app]: { color: foundationVars.color.text.muted } }
})

globalStyle(`${encounterDefenseList} > div`, {
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: '8rem minmax(0, 1fr)',
      gap: foundationVars.space[2],
      '@media': { [compact]: { gridTemplateColumns: '1fr' } }
    }
  }
})

globalStyle(`${encounterDefenseList} dt`, {
  '@layer': { [app]: { fontWeight: foundationVars.fontWeight.semibold } }
})

globalStyle(`${encounterDefenseList} dd`, {
  '@layer': { [app]: { margin: 0 } }
})

export const partyInventoryActionGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(12rem, 1fr) 8rem 10rem',
      alignItems: 'end',
      gap: foundationVars.space[3],
      minInlineSize: 0,
      '@media': {
        [compact]: {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const partyInventoryAddSection = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      paddingBlockStart: foundationVars.space[2]
    }
  }
})

export const partyInventoryActionList = style({
  '@layer': {
    [app]: {
      display: 'grid'
    }
  }
})

export const partyInventoryActionRow = style([
  partyInventoryActionGrid,
  {
    '@layer': {
      [app]: {
        paddingBlock: foundationVars.space[3],
        selectors: {
          '&:not(:last-child)': {
            borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`
          }
        }
      }
    }
  }
])

export const partyInventoryActionButtons = style({
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
      gap: foundationVars.space[2],
      '@media': {
        [compact]: {
          justifyContent: 'flex-start'
        }
      }
    }
  }
})

export const confirmActions = style({
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: foundationVars.space[2],
      '@media': {
        [compact]: {
          flexDirection: 'column-reverse'
        }
      }
    }
  }
})

export const inventoryTransferGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(12rem, 1fr) minmax(12rem, 1fr) 7rem auto',
      alignItems: 'end',
      gap: foundationVars.space[3],
      minInlineSize: 0,
      '@media': {
        [tablet]: {
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
        },
        [compact]: {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const encounterReminders = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      paddingBlock: foundationVars.space[3]
    }
  }
})

export const encounterReminderRow = style({
  '@layer': {
    [app]: {
      minBlockSize: '2.75rem',
      paddingInline: foundationVars.space[3],
      borderRadius: foundationVars.radius.md,
      background: foundationVars.color.surface.recessed
    }
  }
})

export const encounterReminderEditor = style({
  '@layer': {
    [app]: {
      padding: foundationVars.space[4],
      borderRadius: foundationVars.radius.lg,
      background: foundationVars.color.surface.recessed
    }
  }
})

export const encounterTimelineRow = style({
  '@layer': {
    [app]: {
      minBlockSize: '2.5rem',
      selectors: {
        '&:not(:last-child)': {
          borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`
        }
      }
    }
  }
})

export const encounterBuilderGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1.45fr) minmax(18rem, .75fr)',
      gap: foundationVars.space[4],
      alignItems: 'start',
      minInlineSize: 0,
      '@media': {
        [tablet]: {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const encounterBuilderSourceRow = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(14rem, 1fr) auto',
      inlineSize: '100%',
      '@media': {
        [compact]: {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const encounterBuilderCustomRow = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(12rem, 1fr) minmax(8rem, 0.45fr) auto',
      inlineSize: '100%',
      '@media': {
        [compact]: {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

globalStyle(`${encounterBuilderSourceRow} > :last-child`, {
  '@layer': { [app]: { justifySelf: 'start' } }
})

globalStyle(`${encounterBuilderCustomRow} > :last-child`, {
  '@layer': { [app]: { justifySelf: 'start' } }
})

export const denominationGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(7rem, 1fr) minmax(5rem, .5fr) minmax(7rem, .6fr) auto',
      gap: foundationVars.space[2],
      alignItems: 'end',
      '@media': { [compact]: { gridTemplateColumns: '1fr 1fr' } }
    }
  }
})

export const clockControl = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[2],
      minInlineSize: 0,
      minBlockSize: '2.75rem',
      '@media': {
        [compact]: {
          inlineSize: 'auto'
        }
      }
    }
  }
})

export const clockSummary = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 2,
      minInlineSize: 0,
      whiteSpace: 'nowrap'
    }
  }
})

export const clockActions = style({
  '@layer': {
    [app]: {
      minInlineSize: 0
    }
  }
})

export const clockSetupPopover = style({
  '@layer': {
    [app]: {
      boxSizing: 'border-box',
      inlineSize: 'min(22rem, calc(100vw - 2.5rem))',
      maxInlineSize: 'calc(100vw - 2.5rem)'
    }
  }
})

export const clockError = style({
  '@layer': {
    [app]: {
      maxInlineSize: '20rem'
    }
  }
})

export const sessionEditor = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      maxInlineSize: '36rem',
      padding: foundationVars.space[4],
      borderRadius: foundationVars.radius.md,
      background: foundationVars.color.surface.recessed
    }
  }
})

export const sessionList = style({
  '@layer': {
    [app]: {
      minInlineSize: 0
    }
  }
})

export const sessionRow = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      gap: foundationVars.space[2],
      selectors: {
        '&:not(:last-child)': {
          borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`
        }
      }
    }
  }
})

export const sessionRowMain = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[4],
      flex: 1,
      minInlineSize: 0,
      minBlockSize: '4.5rem',
      padding: `${foundationVars.space[3]} ${foundationVars.space[2]}`,
      borderRadius: foundationVars.radius.md,
      color: foundationVars.color.text.primary,
      textAlign: 'start',
      transition: `background ${foundationVars.motion.fast} ease, color ${foundationVars.motion.fast} ease`,
      selectors: {
        '&:hover': {
          background: foundationVars.color.surface.recessed
        },
        '&:focus-visible': {
          outline: 0,
          boxShadow: foundationVars.shadow.focus
        }
      },
      '@media': {
        [compact]: {
          gap: foundationVars.space[2]
        }
      }
    }
  }
})

export const sessionOpenCue = style({
  '@layer': {
    [app]: {
      flexShrink: 0,
      color: foundationVars.color.text.secondary
    }
  }
})

export const sessionOpenLabel = style({
  '@layer': {
    [app]: {
      '@media': {
        [compact]: {
          display: 'none'
        }
      }
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

export const notesWorkspace = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: '11rem minmax(0, 1fr)',
      gap: foundationVars.space[5],
      minInlineSize: 0,
      '@media': {
        [compact]: {
          gridTemplateColumns: '1fr',
          gap: foundationVars.space[3]
        }
      }
    }
  }
})

export const notesRail = style({
  '@layer': {
    [app]: {
      display: 'grid',
      alignContent: 'start',
      gap: foundationVars.space[1],
      paddingBlockStart: foundationVars.space[2],
      '@media': {
        [compact]: {
          display: 'none'
        }
      }
    }
  }
})

export const notesRailItem = style({
  '@layer': {
    [app]: {
      minBlockSize: '2.5rem',
      paddingInline: foundationVars.space[3],
      border: 0,
      borderRadius: foundationVars.radius.md,
      background: 'transparent',
      color: foundationVars.color.text.secondary,
      textAlign: 'start',
      cursor: 'pointer',
      selectors: {
        '&:hover': {
          background: foundationVars.color.surface.recessed,
          color: foundationVars.color.text.primary
        },
        '&[data-active]': {
          background: foundationVars.color.accent.soft,
          color: foundationVars.color.text.primary,
          fontWeight: foundationVars.fontWeight.semibold
        },
        '&:focus-visible': {
          outline: 0,
          boxShadow: foundationVars.shadow.focus
        }
      }
    }
  }
})

export const notesContent = style({
  '@layer': {
    [app]: {
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

export const notesMobileSelect = style({
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

export const notesSection = style({
  '@layer': {
    [app]: {
      display: 'grid',
      alignContent: 'start',
      gap: foundationVars.space[4],
      minInlineSize: 0
    }
  }
})

export const partyGrid = style({
  '@layer': {
    [app]: {
      minInlineSize: 0
    }
  }
})

export const partyCard = style({
  '@layer': {
    [app]: {
      display: 'grid',
      alignContent: 'start',
      gap: foundationVars.space[3],
      minInlineSize: 0,
      padding: foundationVars.space[4],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      background: foundationVars.color.surface.recessed
    }
  }
})

export const partySummary = style({
  '@layer': {
    [app]: {
      paddingBlock: foundationVars.space[2],
      borderBlock: `1px solid ${foundationVars.color.border.subtle}`
    }
  }
})
