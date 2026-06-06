import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '../../../css/foundations.css.ts'
import { app } from '../../../css/layers.css.ts'

export const root = style({
  '@layer': {
    [app]: {
      position: 'sticky',
      insetBlockEnd: 0,
      zIndex: 2,
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(4rem, 1fr))',
      gap: foundationVars.space[1],
      padding: `${foundationVars.space[1]} ${foundationVars.space[2]}`,
      borderBlockStart: `1px solid ${foundationVars.color.border.strong}`,
      backgroundColor: foundationVars.color.surface.header,
      color: foundationVars.color.text.secondary
    }
  }
})

export const item = style({
  '@layer': {
    [app]: {
      display: 'grid',
      justifyItems: 'center',
      alignContent: 'center',
      gap: 2,
      minBlockSize: 46,
      padding: foundationVars.space[1],
      borderRadius: foundationVars.radius.sm,
      color: 'inherit',
      cursor: 'pointer',
      transition: `background-color ${foundationVars.motion.fast} ease, color ${foundationVars.motion.fast} ease`,
      ':hover': {
        backgroundColor: foundationVars.color.surface.subtle,
        color: foundationVars.color.text.primary
      },
      ':focus-visible': {
        outline: 'none',
        boxShadow: foundationVars.shadow.focus
      }
    }
  }
})

export const itemActive = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.accent
    }
  }
})

export const label = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      maxInlineSize: '100%',
      fontSize: '11px',
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: '13px',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const menuItemText = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 1,
      minInlineSize: 0
    }
  }
})

globalStyle(`${menuItemText} > span:last-child`, {
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '11px'
    }
  }
})
