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
      gridTemplateRows: 'auto minmax(0, 1fr) auto',
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden',
      position: 'relative',
      '@media': {
        '(min-width: 761px)': {
          display: 'contents'
        }
      }
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
      paddingInline: '2px',
      '@media': {
        '(min-width: 761px)': {
          display: 'none'
        }
      }
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
      scrollbarWidth: 'none',
      touchAction: 'pan-y',
      '@media': {
        '(min-width: 761px)': {
          display: 'contents'
        },
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
      boxSizing: 'border-box',
      display: 'flex',
      justifyContent: 'space-between',
      padding: '0 18px calc(8px + env(safe-area-inset-bottom, 0px))',
      pointerEvents: 'none',
      position: 'static',
      width: '100%',
      zIndex: 2,
      '@media': {
        '(min-width: 761px)': {
          bottom: '20px',
          insetInline: 'auto',
          left: '20px',
          padding: 0,
          position: 'fixed',
          width: 'auto',
          zIndex: 120
        },
        '(min-width: 761px) and (max-width: 959px) and (orientation: portrait)': {
          bottom: '76px'
        }
      }
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
      },
      '@media': {
        '(min-width: 761px)': {
          selectors: {
            '&[data-section-navigation="true"]': {
              display: 'none'
            }
          }
        }
      }
    }
  }
})
