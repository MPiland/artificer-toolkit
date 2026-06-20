import { foundationVars, media } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'
import { style } from '@vanilla-extract/css'

export const canvas = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      inlineSize: '100%',
      padding: `${foundationVars.space[4]} ${foundationVars.space[5]}`,
      minBlockSize: 0,
      minInlineSize: 0,
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
      },
      '@media': {
        [media.tablet]: {
          flex: '0 0 auto',
          position: 'relative',
          zIndex: 20
        }
      }
    }
  }
})
