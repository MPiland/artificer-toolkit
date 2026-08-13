import { createVar, style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css'
import { app } from '../../css/layers.css'

export const nodeColor = createVar()

export const root = style({
  '@layer': {
    [app]: {
      position: 'absolute',
      zIndex: 5,
      insetBlockStart: '6.5rem',
      insetInlineEnd: foundationVars.space[3],
      display: 'flex',
      flexDirection: 'column',
      gap: foundationVars.space[2],
      inlineSize: '9.5rem',
      maxBlockSize: 'calc(100% - 7.25rem)',
      minBlockSize: 0,
      padding: foundationVars.space[2],
      overflow: 'auto',
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.surface.panel,
      boxShadow: foundationVars.shadow.card,
      color: foundationVars.color.text.primary,
      transition: `inline-size ${foundationVars.motion.fast}`,
      selectors: {
        '&[data-collapsed]': {
          inlineSize: '3rem'
        }
      }
    }
  }
})

export const header = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: foundationVars.space[1],
      selectors: {
        [`${root}[data-collapsed] &`]: {
          justifyContent: 'center'
        }
      }
    }
  }
})

export const heading = style({
  '@layer': {
    [app]: {
      margin: 0,
      fontFamily: foundationVars.font.sans,
      fontSize: foundationVars.typography.label.fontSize,
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: foundationVars.typography.label.lineHeight
    }
  }
})

export const hint = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.muted,
      fontSize: foundationVars.typography.caption.fontSize,
      lineHeight: foundationVars.typography.caption.lineHeight
    }
  }
})

export const list = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[1]
    }
  }
})

export const item = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      gap: foundationVars.space[2],
      minBlockSize: '2.25rem',
      paddingInline: foundationVars.space[2],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderInlineStart: `3px solid ${nodeColor}`,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.surface.subtle,
      color: foundationVars.color.text.primary,
      cursor: 'grab',
      fontSize: foundationVars.typography.caption.fontSize,
      fontWeight: foundationVars.fontWeight.medium,
      lineHeight: foundationVars.typography.caption.lineHeight,
      transition: `border-color ${foundationVars.motion.fast}, background-color ${foundationVars.motion.fast}`,
      userSelect: 'none',
      selectors: {
        [`${root}[data-collapsed] &`]: {
          justifyContent: 'center',
          paddingInline: foundationVars.space[1]
        },
        '&:hover:not([data-disabled])': {
          borderColor: foundationVars.color.border.strong,
          borderInlineStartColor: nodeColor,
          backgroundColor: foundationVars.color.surface.raised
        },
        '&:active:not([data-disabled])': {
          cursor: 'grabbing'
        },
        '&[data-disabled]': {
          cursor: 'not-allowed',
          opacity: 0.5
        }
      }
    }
  }
})

export const icon = style({
  '@layer': {
    [app]: {
      display: 'grid',
      flex: '0 0 auto',
      inlineSize: '1.125rem',
      blockSize: '1.125rem',
      placeItems: 'center',
      color: nodeColor
    }
  }
})

export const label = style({
  '@layer': {
    [app]: {
      minInlineSize: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})
