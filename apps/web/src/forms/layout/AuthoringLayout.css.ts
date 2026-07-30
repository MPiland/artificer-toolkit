import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'

export const canvas = style({
  '@layer': {
    [app]: {
      vars: {
        [foundationVars.color.input.background.default]: foundationVars.color.authoring.field,
        [foundationVars.color.input.border.default]: foundationVars.color.authoring.fieldBorder
      },
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      blockSize: '100%',
      maxBlockSize: '100dvh',
      inlineSize: '100%',
      minBlockSize: 0,
      minInlineSize: 0,
      overflow: 'hidden',
      backgroundColor: foundationVars.color.authoring.canvas
    }
  }
})

export const workspace = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'row',
      flex: '1 1 auto',
      blockSize: 'auto',
      inlineSize: '100%',
      minBlockSize: 0,
      minInlineSize: 0,
      overflow: 'hidden'
    }
  }
})
