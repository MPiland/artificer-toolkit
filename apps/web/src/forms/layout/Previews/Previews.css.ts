import { style } from '@vanilla-extract/css'
import { foundationVars, media } from '../../../css/foundations.css.ts'
import { app } from '../../../css/layers.css.ts'

export const shell = style({
  '@layer': {
    [app]: {
      borderInlineStart: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.recessed,
      inlineSize: '19rem',
      maxInlineSize: '100%',
      '@media': {
        [media.tablet]: {
          inlineSize: '100%',
          borderRadius: 0,
          borderInlineStart: 0
        }
      }
    }
  }
})

export const header = style({
  '@layer': {
    [app]: {
      minBlockSize: 'auto',
      padding: `${foundationVars.space[3]} ${foundationVars.space[4]}`,
      paddingInlineStart: foundationVars.space[4],
      backgroundColor: foundationVars.color.surface.emphasized,
      borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`,
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      fontWeight: foundationVars.fontWeight.bold,
      letterSpacing: '0.02em',
      lineHeight: '20px'
    }
  }
})

export const content = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      blockSize: 'auto',
      padding: foundationVars.space[3],
      overflowY: 'auto'
    }
  }
})

export const drawerBody = style({
  '@layer': {
    [app]: {
      padding: 0,
      blockSize: '100%'
    }
  }
})

export const closeButton = style({
  '@layer': {
    [app]: {
      marginInlineEnd: 'auto',
      marginInlineStart: 0,
      display: 'inline-flex'
    }
  }
})
