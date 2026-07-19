import { foundationVars, media } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'
import { style } from '@vanilla-extract/css'

export const canvas = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 auto',
      inlineSize: '100%',
      minBlockSize: 0,
      minInlineSize: 0,
      overflow: 'hidden',
      backgroundColor: foundationVars.color.surface.canvas
    }
  }
})

export const content = style({
  '@layer': {
    [app]: {
      flex: '1 1 auto',
      minBlockSize: 0,
      minInlineSize: 0,
      padding: `${foundationVars.space[4]} ${foundationVars.space[5]} calc(44px + ${foundationVars.space[5]} + env(safe-area-inset-bottom))`,
      overflow: 'auto',
      '@media': {
        [media.tablet]: {
          paddingInline: foundationVars.space[4]
        },
        [media.mobile]: {
          padding: `${foundationVars.space[3]} ${foundationVars.space[3]} calc(44px + ${foundationVars.space[5]} + env(safe-area-inset-bottom))`
        }
      }
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
