import { style } from '@vanilla-extract/css'
import { foundationVars, media } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

export const feed = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      minBlockSize: 0,
      color: foundationVars.color.text.primary
    }
  }
})

export const feedContained = style({
  '@layer': {
    [app]: {
      flex: 1,
      inlineSize: '100%',
      blockSize: '100%',
      overflow: 'hidden'
    }
  }
})

export const feedHeader = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flex: 'none',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[4],
      padding: foundationVars.space[4],
      borderBlockEnd: '1px solid ' + foundationVars.color.border.subtle
    }
  }
})

export const feedList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      minBlockSize: 0
    }
  }
})

export const feedListContained = style({
  '@layer': { [app]: { flex: 1, overflowY: 'auto', overscrollBehavior: 'contain' } }
})

export const feedRow = style({
  '@layer': {
    [app]: {
      minInlineSize: 0,
      borderBlockEnd: '1px solid ' + foundationVars.color.border.subtle,
      backgroundColor: foundationVars.color.surface.panel,
      selectors: {
        '&[data-unread]': {
          backgroundColor: foundationVars.color.surface.emphasized
        }
      }
    }
  }
})

export const feedRowMain = style({
  '@layer': {
    [app]: {
      boxSizing: 'border-box',
      display: 'grid',
      gridTemplateColumns: '8px minmax(0, 1fr)',
      alignItems: 'start',
      gap: foundationVars.space[3],
      inlineSize: '100%',
      minBlockSize: 72,
      minInlineSize: 0,
      margin: 0,
      padding: foundationVars.space[4],
      border: 0,
      borderRadius: 0,
      background: 'transparent',
      color: 'inherit',
      font: 'inherit',
      textAlign: 'start',
      selectors: {
        '&:is(button)': { cursor: 'pointer' },
        '&:is(button):hover': { backgroundColor: foundationVars.color.surface.subtle },
        '&:is(button):focus-visible': {
          outline: 'none',
          boxShadow: foundationVars.shadow.focus
        }
      }
    }
  }
})

export const unreadDot = style({
  '@layer': {
    [app]: {
      inlineSize: 8,
      blockSize: 8,
      marginBlockStart: 7,
      borderRadius: foundationVars.radius.pill,
      selectors: {
        '&[data-visible]': { backgroundColor: foundationVars.color.text.accent }
      }
    }
  }
})

export const rowContent = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[1],
      minInlineSize: 0
    }
  }
})

export const rowTitle = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      fontWeight: foundationVars.fontWeight.semibold,
      textOverflow: 'ellipsis'
    }
  }
})

export const rowBody = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      lineHeight: foundationVars.typography.bodySm.lineHeight
    }
  }
})

export const rowTime = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.caption.fontSize,
      lineHeight: foundationVars.typography.caption.lineHeight
    }
  }
})

export const rowAction = style({
  '@layer': { [app]: { minBlockSize: 44, minInlineSize: 44 } }
})

export const emptyState = style({
  '@layer': {
    [app]: {
      display: 'grid',
      flex: 1,
      minBlockSize: '16rem',
      alignContent: 'start',
      justifyItems: 'center',
      gap: foundationVars.space[2],
      padding: `${foundationVars.space[7]} ${foundationVars.space[6]} ${foundationVars.space[6]}`,
      color: foundationVars.color.text.secondary,
      textAlign: 'center'
    }
  }
})

export const centeredState = style({
  '@layer': {
    [app]: {
      display: 'grid',
      flex: 1,
      inlineSize: '100%',
      minBlockSize: '16rem',
      placeItems: 'center'
    }
  }
})

export const drawerContent = style({
  '@layer': {
    [app]: {
      backgroundColor: foundationVars.color.surface.panel,
      color: foundationVars.color.text.primary
    }
  }
})

export const drawerBody = style({
  '@layer': {
    [app]: {
      display: 'flex',
      minBlockSize: 0,
      padding: 0,
      overflow: 'hidden'
    }
  }
})

export const drawerHeader = style({
  '@layer': {
    [app]: {
      borderBlockEnd: '1px solid ' + foundationVars.color.border.subtle
    }
  }
})

export const bellButton = style({
  '@layer': {
    [app]: {
      position: 'relative',
      inlineSize: 36,
      blockSize: 36,
      minBlockSize: 36,
      minInlineSize: 36,
      borderRadius: foundationVars.radius.md,
      selectors: {
        '&::before': {
          position: 'absolute',
          inset: -4,
          content: ''
        }
      }
    }
  }
})

export const page = style({
  '@layer': {
    [app]: {
      inlineSize: 'min(100%, 48rem)',
      marginInline: 'auto',
      border: '1px solid ' + foundationVars.color.border.subtle,
      borderRadius: foundationVars.radius.lg,
      overflow: 'hidden',
      backgroundColor: foundationVars.color.surface.panel,
      '@media': {
        [media.mobile]: {
          inlineSize: '100%',
          borderInline: 0,
          borderRadius: 0
        }
      }
    }
  }
})

export const preferencesControls = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3]
    }
  }
})

export const preferenceControl = style({
  '@layer': {
    [app]: {
      minBlockSize: 44
    }
  }
})

export const visuallyHidden = style({
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0
})
