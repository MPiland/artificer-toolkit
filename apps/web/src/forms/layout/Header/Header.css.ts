import { style } from '@vanilla-extract/css'
import { foundationVars, media } from '../../../css/foundations.css.ts'
import { app } from '../../../css/layers.css.ts'

export const header = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[4],
      minBlockSize: 64,
      maxInlineSize: '100%',
      paddingBlock: foundationVars.space[2],
      paddingInline: foundationVars.space[4],
      borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.header,
      '@media': {
        [media.tabletPortrait]: {
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: foundationVars.space[3]
        },
        [media.mobile]: {
          paddingInline: foundationVars.space[3]
        }
      }
    }
  }
})

export const titleRow = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexWrap: 'nowrap',
      alignItems: 'center',
      minInlineSize: 0,
      gap: foundationVars.space[2]
    }
  }
})

export const titleStack = style({
  '@layer': {
    [app]: {
      display: 'grid',
      flex: '0 1 auto',
      minInlineSize: 0
    }
  }
})

export const title = style({
  '@layer': {
    [app]: {
      margin: 0,
      minInlineSize: 0,
      overflow: 'hidden',
      color: foundationVars.color.text.primary,
      fontSize: '22px',
      fontWeight: foundationVars.fontWeight.bold,
      letterSpacing: '0',
      lineHeight: '28px',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const saveState = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[1],
      color: foundationVars.color.text.accent,
      fontSize: foundationVars.typography.bodySm.fontSize,
      lineHeight: '16px',
      whiteSpace: 'nowrap',
      selectors: {
        '&[data-dirty="true"]': {
          color: foundationVars.color.status.warning,
          fontWeight: foundationVars.fontWeight.semibold
        }
      },
      '@media': {
        [media.mobile]: {
          display: 'none'
        }
      }
    }
  }
})

export const provenanceBadge = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[1],
      minBlockSize: 24,
      paddingInline: foundationVars.space[2],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.surface.subtle,
      color: foundationVars.color.text.secondary,
      fontSize: '12px',
      fontWeight: foundationVars.fontWeight.bold,
      lineHeight: '16px',
      alignSelf: 'center',
      whiteSpace: 'nowrap'
    }
  }
})

export const viewActions = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[2],
      marginInlineStart: foundationVars.space[2],
      flexShrink: 0
    }
  }
})

export const formActions = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: foundationVars.space[2],
      alignSelf: 'center',
      minInlineSize: 0,
      flexShrink: 0,
      '@media': {
        [media.tabletPortrait]: {
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          inlineSize: '100%'
        }
      }
    }
  }
})

export const utilityActions = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[2]
    }
  }
})

export const lifecycleActions = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[2]
    }
  }
})
