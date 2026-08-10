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

export const chatLog = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flex: 1,
      flexDirection: 'column',
      gap: foundationVars.space[2],
      minBlockSize: 0,
      overflowY: 'auto',
      padding: foundationVars.space[4],
      background: foundationVars.color.surface.recessed
    }
  }
})

export const chatDrawerContent = style({
  '@layer': {
    [app]: {
      blockSize: '100%',
      display: 'flex',
      flexDirection: 'column',
      minInlineSize: 0
    }
  }
})

export const chatNavigator = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      overflowX: 'auto',
      padding: `${foundationVars.space[2]} ${foundationVars.space[4]}`
    }
  }
})

export const chatMessageRow = style({
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'flex-start',
      inlineSize: '100%'
    }
  }
})

export const chatMessageRowOwn = style({
  '@layer': { [app]: { justifyContent: 'flex-end' } }
})

export const chatBubble = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'grid',
      gap: foundationVars.space[1],
      inlineSize: 'fit-content',
      maxInlineSize: '82%',
      padding: `${foundationVars.space[2]} ${foundationVars.space[3]}`,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: `${foundationVars.radius.lg} ${foundationVars.radius.lg} ${foundationVars.radius.lg} ${foundationVars.radius.sm}`,
      background: foundationVars.color.surface.panel,
      overflowWrap: 'anywhere',
      selectors: {
        '&::after': {
          content: '',
          position: 'absolute',
          insetInlineStart: '-6px',
          insetBlockEnd: '3px',
          inlineSize: '8px',
          blockSize: '10px',
          background: 'inherit',
          clipPath: 'polygon(100% 0, 100% 100%, 0 100%)'
        }
      }
    }
  }
})

export const chatBubbleOwn = style({
  '@layer': {
    [app]: {
      borderColor: foundationVars.color.accent.border,
      borderRadius: `${foundationVars.radius.lg} ${foundationVars.radius.lg} ${foundationVars.radius.sm} ${foundationVars.radius.lg}`,
      background: foundationVars.color.accent.soft,
      selectors: {
        '&::after': {
          insetInlineStart: 'auto',
          insetInlineEnd: '-6px',
          clipPath: 'polygon(0 0, 100% 100%, 0 100%)'
        }
      }
    }
  }
})

export const chatMessageMeta = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      alignItems: 'center',
      gap: foundationVars.space[3]
    }
  }
})

export const chatAuthor = style({
  '@layer': {
    [app]: {
      minInlineSize: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const chatEmpty = style({
  '@layer': {
    [app]: {
      margin: 'auto',
      maxInlineSize: '28ch',
      padding: foundationVars.space[5],
      textAlign: 'center'
    }
  }
})

export const chatComposer = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      padding: foundationVars.space[3],
      borderBlockStart: `1px solid ${foundationVars.color.border.subtle}`,
      background: foundationVars.color.surface.panel
    }
  }
})

export const chatComposerInput = style({
  '@layer': {
    [app]: {
      vars: {
        '--input-bg': foundationVars.color.input.background.default,
        '--input-bd': foundationVars.color.input.border.default,
        '--input-color': foundationVars.color.text.primary,
        '--input-placeholder-color': foundationVars.color.input.placeholder
      },
      borderColor: foundationVars.color.input.border.default,
      background: foundationVars.color.input.background.default,
      color: foundationVars.color.text.primary,
      selectors: {
        '&:focus': {
          borderColor: foundationVars.color.input.border.focus,
          boxShadow: foundationVars.shadow.focus
        }
      }
    }
  }
})

export const chatComposerToolbar = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      gap: foundationVars.space[2],
      justifyContent: 'flex-end',
      flexWrap: 'wrap'
    }
  }
})

export const chatVoice = style({
  '@layer': { [app]: { marginInlineEnd: 'auto' } }
})
