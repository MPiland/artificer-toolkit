import { style } from '@vanilla-extract/css'
import { foundationVars } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

const compact = 'screen and (max-width: 48rem)'

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
