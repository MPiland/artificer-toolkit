import { foundationVars } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'
import { style } from '@vanilla-extract/css'

export const canvas = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      inlineSize: '100%',
      minBlockSize: 0,
      minInlineSize: 0,
      overflow: 'hidden'
    }
  }
})

export const content = style({
  '@layer': {
    [app]: {
      flex: '1 1 auto',
      minBlockSize: 0,
      minInlineSize: 0,
      padding: `${foundationVars.space[4]} ${foundationVars.space[5]} calc(44px + ${foundationVars.space[4]} + env(safe-area-inset-bottom))`,
      overflow: 'auto'
    }
  }
})

export const alertSlot = style({
  '@layer': {
    [app]: {
      borderColor: foundationVars.color.status.warning,
      backgroundColor: foundationVars.color.status.warningSoft,
      color: foundationVars.color.text.primary
    }
  }
})

export const actionBarSlot = style({
  '@layer': {
    [app]: {
      vars: {
        '--at-authoring-action-max-width': 'none'
      }
    }
  }
})
