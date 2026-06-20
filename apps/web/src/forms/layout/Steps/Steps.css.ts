import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../../css/foundations.css.ts'
import { app } from '../../../css/layers.css.ts'

export const shell = style({
  '@layer': {
    [app]: {
      borderInlineEnd: `1px solid ${foundationVars.color.border.strong}`
    }
  }
})

export const collapse = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      blockSize: '100%',
      minBlockSize: 0,
      borderInlineEnd: `1px solid ${foundationVars.color.border.strong}`
    }
  }
})

export const drawerContent = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      blockSize: '100%',
      minBlockSize: 0,
      overflow: 'hidden',
      borderBlockStart: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.recessed,
      color: foundationVars.color.text.primary
    }
  }
})

export const drawerBody = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flex: 1,
      blockSize: '100%',
      minBlockSize: 0,
      overflow: 'hidden',
      padding: 0,
      backgroundColor: foundationVars.color.surface.recessed
    }
  }
})
