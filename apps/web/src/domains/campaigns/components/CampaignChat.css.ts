import { style } from '@vanilla-extract/css'
import { foundationVars } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

const compact = 'screen and (max-width: 48rem)'

export const drawerShell = style({
  '@layer': {
    [app]: {
      blockSize: '100dvh',
      inlineSize: 'min(32rem, 100vw)',
      '@media': {
        [compact]: { inlineSize: '100vw' }
      }
    }
  }
})

export const drawerBody = style({
  '@layer': {
    [app]: {
      blockSize: 'calc(100dvh - 4.25rem)',
      minBlockSize: 0,
      overflow: 'hidden',
      padding: 0,
      '@media': {
        [compact]: { blockSize: 'calc(100dvh - 3.75rem)' }
      }
    }
  }
})

export const navigationRow = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flex: '0 0 auto',
      gap: foundationVars.space[2],
      minInlineSize: 'max-content'
    }
  }
})

export const navigationButton = style({
  '@layer': {
    [app]: {
      flex: '0 0 auto'
    }
  }
})

export const navigationBadge = style({
  '@layer': {
    [app]: {
      marginInlineStart: foundationVars.space[1]
    }
  }
})

export const historyControl = style({
  '@layer': {
    [app]: {
      alignSelf: 'center',
      flex: '0 0 auto'
    }
  }
})

export const rollBubble = style({
  '@layer': {
    [app]: {
      borderColor: foundationVars.color.accent.border,
      background: foundationVars.color.accent.soft
    }
  }
})

export const unsentBubble = style({
  '@layer': {
    [app]: {
      borderStyle: 'dashed',
      opacity: 0.72
    }
  }
})
