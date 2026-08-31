import { style } from '@vanilla-extract/css'
import { foundationVars } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

export const summary = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[1],
      paddingBlockEnd: foundationVars.space[3]
    }
  }
})

export const actorList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2]
    }
  }
})

export const actor = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: '2.25rem minmax(0, 1fr) auto',
      alignItems: 'center',
      gap: foundationVars.space[2],
      padding: foundationVars.space[3],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      background: foundationVars.color.surface.subtle,
      selectors: {
        '&[data-current]': {
          borderColor: foundationVars.color.accent.border,
          background: foundationVars.color.accent.soft
        }
      }
    }
  }
})

export const initiative = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontVariantNumeric: 'tabular-nums',
      fontWeight: foundationVars.fontWeight.semibold,
      textAlign: 'center'
    }
  }
})

export const currentTurn = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary
    }
  }
})

export const controls = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      paddingBlockStart: foundationVars.space[4]
    }
  }
})

export const controlButtons = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: foundationVars.space[2]
    }
  }
})

export const bindingControls = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      paddingBlockStart: foundationVars.space[2],
      borderBlockStart: `1px solid ${foundationVars.color.border.subtle}`
    }
  }
})
