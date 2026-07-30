import { foundationVars, media } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'
import { style } from '@vanilla-extract/css'
import {
  AUTHORING_WIDE_DESKTOP_QUERY,
  AUTHORING_WORKING_STAGE_MAX_WIDTH
} from '../authoringWorkspace.constants'

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
      backgroundColor: foundationVars.color.authoring.canvas,
      borderInline: `1px solid ${foundationVars.color.authoring.border}`
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
        [AUTHORING_WIDE_DESKTOP_QUERY]: {
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: `${foundationVars.space[4]} ${foundationVars.space[4]} calc(72px + ${foundationVars.space[3]})`
        },
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

export const stage = style({
  '@layer': {
    [app]: {
      display: 'grid',
      alignContent: 'start',
      gap: foundationVars.space[3],
      inlineSize: '100%',
      minInlineSize: 0,
      '@media': {
        [AUTHORING_WIDE_DESKTOP_QUERY]: {
          maxInlineSize: AUTHORING_WORKING_STAGE_MAX_WIDTH,
          padding: 0,
          border: 0,
          borderRadius: 0,
          backgroundColor: 'transparent'
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
        '--at-authoring-action-max-width': AUTHORING_WORKING_STAGE_MAX_WIDTH
      }
    }
  }
})
