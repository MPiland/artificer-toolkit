import { globalStyle, keyframes, style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

const mobilePageIn = keyframes({
  from: {
    opacity: 0,
    transform: 'translateX(12px)'
  },
  to: {
    opacity: 1,
    transform: 'translateX(0)'
  }
})

export const mobilePager = style({
  '@layer': {
    [app]: {
      display: 'grid',
      flex: '1 1 0',
      gap: '12px',
      gridTemplateRows: 'auto minmax(0, 1fr)',
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden',
      position: 'relative'
    }
  }
})

export const mobilePageLabel = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1.05rem',
      fontWeight: 850,
      lineHeight: 1.15,
      paddingInline: '2px'
    }
  }
})

export const mobilePageViewport = style({
  '@layer': {
    [app]: {
      animation: `${mobilePageIn} 180ms ease-out`,
      boxSizing: 'border-box',
      minHeight: 0,
      minWidth: 0,
      overflowY: 'auto',
      paddingBlockEnd: '72px',
      scrollbarWidth: 'none',
      touchAction: 'pan-y',
      '@media': {
        '(prefers-reduced-motion: reduce)': {
          animation: 'none'
        }
      }
    }
  }
})

globalStyle(`${mobilePageViewport}::-webkit-scrollbar`, {
  display: 'none'
})

export const mobilePageStack = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '12px',
      minWidth: 0
    }
  }
})

export const mobilePageMenu = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '8px',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))'
    }
  }
})

export const mobilePageMenuItem = style({
  '@layer': {
    [app]: {
      borderRadius: foundationVars.radius.md,
      justifyContent: 'flex-start',
      minHeight: '44px',
      selectors: {
        '&[data-active="true"]': {
          color: foundationVars.color.accent.contrast
        }
      }
    }
  }
})

export const mobileFloatingDock = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      bottom: 'calc(18px + env(safe-area-inset-bottom, 0px))',
      boxSizing: 'border-box',
      display: 'flex',
      insetInline: 0,
      justifyContent: 'flex-end',
      paddingInline: '18px',
      pointerEvents: 'none',
      position: 'absolute',
      zIndex: 2
    }
  }
})

export const mobileFloatingButton = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.accent.solid,
      borderRadius: foundationVars.radius.pill,
      color: foundationVars.color.accent.contrast,
      minHeight: '48px',
      minWidth: '48px',
      pointerEvents: 'auto',
      selectors: {
        '&:disabled': {
          opacity: 0.45
        }
      }
    }
  }
})
