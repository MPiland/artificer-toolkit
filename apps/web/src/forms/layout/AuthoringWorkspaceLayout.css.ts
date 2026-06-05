import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'

const tablet = 'screen and (max-width: 992px)'
const mobile = 'screen and (max-width: 760px)'

export const shell = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateRows: 'minmax(0, 1fr) auto',
      minBlockSize: 'calc(100dvh - 48px)',
      minInlineSize: 0,
      overflow: 'hidden',
      backgroundColor: foundationVars.color.surface.canvas,
      color: foundationVars.color.text.primary
    }
  }
})

export const canvas = style({
  '@layer': {
    [app]: {
      minBlockSize: 0,
      minInlineSize: 0,
      overflowY: 'auto',
      padding: foundationVars.space[5],
      scrollbarGutter: 'stable',
      '@media': {
        [mobile]: {
          padding: `${foundationVars.space[4]} ${foundationVars.space[4]} ${foundationVars.space[6]}`
        }
      }
    }
  }
})

export const content = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 52rem) minmax(17rem, 23rem)',
      alignItems: 'start',
      gap: foundationVars.space[5],
      inlineSize: 'min(100%, 80rem)',
      minInlineSize: 0,
      '@media': {
        [tablet]: {
          gridTemplateColumns: 'minmax(0, 1fr)',
          inlineSize: '100%'
        }
      }
    }
  }
})

export const contentStack = style({
  '@layer': {
    [app]: {
      display: 'grid',
      alignContent: 'start',
      gap: foundationVars.space[4],
      minInlineSize: 0
    }
  }
})

export const previewRail = style({
  '@layer': {
    [app]: {
      display: 'grid',
      alignContent: 'start',
      gap: foundationVars.space[3],
      minInlineSize: 0,
      '@media': {
        [tablet]: {
          display: 'none'
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
        '--at-authoring-action-max-width': '80rem'
      },
      gridColumn: '1 / -1'
    }
  }
})
