import { style } from '@vanilla-extract/css'
import { foundationVars } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

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
