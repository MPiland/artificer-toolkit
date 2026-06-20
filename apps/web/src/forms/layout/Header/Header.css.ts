import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../../css/foundations.css.ts'
import { app } from '../../../css/layers.css.ts'

const mobile = 'screen and (max-width: 640px)'

export const header = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      maxInlineSize: '100%',
      paddingBlock: foundationVars.space[2],
      paddingInline: foundationVars.space[3],
      borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`,
      '@media': {
        [mobile]: {
          gap: foundationVars.space[3]
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

export const statusBadge = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[1],
      minBlockSize: 24,
      paddingInline: foundationVars.space[2],
      border: `1px solid ${foundationVars.color.accent.border}`,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.accent.soft,
      color: foundationVars.color.text.accent,
      fontSize: '12px',
      fontWeight: foundationVars.fontWeight.bold,
      lineHeight: '16px',
      alignSelf: 'center',
      whiteSpace: 'nowrap'
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
        [mobile]: {
          justifyContent: 'flex-start',
          alignSelf: 'center'
        }
      }
    }
  }
})
