import { style } from '@vanilla-extract/css'
import { foundationVars } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

const compact = 'screen and (max-width: 48rem)'

export const gmDiceButton = style({
  '@layer': {
    [app]: {
      position: 'fixed',
      insetInlineEnd: foundationVars.space[5],
      insetBlockEnd: foundationVars.space[5],
      zIndex: 20,
      boxShadow: foundationVars.shadow.floatingControl,
      '@media': {
        [compact]: {
          insetInlineEnd: foundationVars.space[3],
          insetBlockEnd: foundationVars.space[3]
        }
      }
    }
  }
})

export const clockSetupGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',

      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
      gap: foundationVars.space[3],
      alignItems: 'end',
      '@media': {
        [compact]: {
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
        }
      }
    }
  }
})

export const clockControl = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[2],
      minInlineSize: 0,
      minBlockSize: '2.75rem',
      '@media': {
        [compact]: {
          inlineSize: 'auto'
        }
      }
    }
  }
})

export const clockSummary = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 2,
      minInlineSize: 0,
      whiteSpace: 'nowrap'
    }
  }
})

export const clockActions = style({
  '@layer': {
    [app]: {
      minInlineSize: 0
    }
  }
})

export const clockSetupPopover = style({
  '@layer': {
    [app]: {
      boxSizing: 'border-box',
      inlineSize: 'min(22rem, calc(100vw - 2.5rem))',
      maxInlineSize: 'calc(100vw - 2.5rem)'
    }
  }
})

export const clockError = style({
  '@layer': {
    [app]: {
      maxInlineSize: '20rem'
    }
  }
})
