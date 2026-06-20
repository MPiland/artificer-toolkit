import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../../css/foundations.css.ts'
import { app } from '../../../css/layers.css.ts'

export const shell = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      inlineSize: '20rem',
      blockSize: '100%',
      minInlineSize: 0,
      minBlockSize: 0,
      overflow: 'hidden',
      backgroundColor: foundationVars.color.surface.recessed,
      color: foundationVars.color.text.primary
    }
  }
})

export const content = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      blockSize: '100%',
      minBlockSize: 0
    }
  }
})

export const item = style({
  '@layer': {
    [app]: {
      display: 'contents'
    }
  }
})

export const collapse = style({
  '@layer': {
    [app]: {
      flex: '0 0 auto',
      blockSize: '100%',
      minBlockSize: 0
    }
  }
})

export const header = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[2],
      minBlockSize: `calc(${foundationVars.space[2]} + 24px + ${foundationVars.space[2]})`,
      paddingInline: `${foundationVars.space[3]} ${foundationVars.space[3]}`,
      paddingInlineStart: `calc(${foundationVars.space[3]} + 24px + ${foundationVars.space[4]})`,
      fontSize: 'large',
      fontWeight: 700,
      paddingBlock: 0
    }
  }
})

export const footer = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[1],
      minBlockSize: 34,
      padding: `${foundationVars.space[1]} ${foundationVars.space[3]}`
    }
  }
})
