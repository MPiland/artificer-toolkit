import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'
import { panel } from './campaigns.css'

const compact = 'screen and (max-width: 48rem)'

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
