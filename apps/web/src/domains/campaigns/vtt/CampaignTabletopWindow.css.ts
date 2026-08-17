import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

const compact = 'screen and (max-width: 48rem)'

export const page = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateRows: 'auto minmax(0, 1fr)',
      inlineSize: '100%',
      minBlockSize: '100dvh',
      maxBlockSize: '100dvh',
      background: foundationVars.color.surface.header,
      color: foundationVars.color.text.primary
    }
  }
})

export const header = style({
  '@layer': {
    [app]: {
      zIndex: 5,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[3],
      minInlineSize: 0,
      minBlockSize: '3.75rem',
      padding: `${foundationVars.space[2]} ${foundationVars.space[3]}`,
      borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`,
      background: foundationVars.color.surface.panel,
      boxShadow: foundationVars.shadow.card,
      '@media': {
        [compact]: {
          alignItems: 'stretch',
          flexDirection: 'column'
        }
      }
    }
  }
})

export const identity = style({
  '@layer': {
    [app]: {
      minInlineSize: 0
    }
  }
})

export const stage = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      minBlockSize: 0,
      padding: foundationVars.space[2],
      background: '#0b0d0f',
      '@media': {
        [compact]: {
          padding: 0
        }
      }
    }
  }
})

globalStyle(`${stage} > section`, {
  '@layer': {
    [app]: {
      blockSize: '100%'
    }
  }
})
