import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../../css/foundations.css.ts'
import { app } from '../../../css/layers.css.ts'

export const shell = style({
  '@layer': {
    [app]: {
      borderInlineEnd: `1px solid ${foundationVars.color.authoring.border}`,
      inlineSize: 'clamp(260px, 20vw, 304px)',
      blockSize: '100%',
      minBlockSize: 0,
      flexShrink: 0,
      maxInlineSize: '100%',
      backgroundColor: foundationVars.color.authoring.rail
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
      borderBlockStart: `1px solid ${foundationVars.color.authoring.border}`,
      backgroundColor: foundationVars.color.authoring.rail,
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
      backgroundColor: foundationVars.color.authoring.rail
    }
  }
})

export const drawerAccessibleHeader = style({
  '@layer': {
    [app]: {
      position: 'absolute',
      inlineSize: '1px',
      blockSize: '1px',
      padding: 0,
      overflow: 'hidden',
      clip: 'rect(0 0 0 0)',
      whiteSpace: 'nowrap'
    }
  }
})
