import { style } from '@vanilla-extract/css'
import { foundationVars, media } from '../../../css/foundations.css.ts'
import { app } from '../../../css/layers.css.ts'

export const shell = style({
  '@layer': {
    [app]: {
      border: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.panel,
      inlineSize: '20rem',
      maxInlineSize: '100%',
      '@media': {
        [media.tablet]: {
          inlineSize: '100%',
          borderRadius: 'none'
        }
      }
    }
  }
})

export const collapse = style({
  '@layer': {
    [app]: {
      flex: '0 0 20rem',
      blockSize: '100%',
      inlineSize: '20rem',
      minBlockSize: 0
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
      fontSize: '15px',
      fontWeight: foundationVars.fontWeight.bold,
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
      padding: foundationVars.space[4],
      overflowY: 'auto'
    }
  }
})

export const closeButton = style({
  '@layer': {
    [app]: {
      marginInlineEnd: 'auto',
      marginInlineStart: 0
    }
  }
})
