import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const actionRowIdentity = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '2px',
      gridColumn: '1',
      minWidth: 0
    }
  }
})

export const actionCompactSource = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontSize: '0.66rem',
      lineHeight: 1.2,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      '@media': {
        '(max-width: 620px)': {
          fontSize: '0.6rem'
        }
      }
    }
  }
})

export const actionIdentityButton = style({
  '@layer': {
    [app]: {
      appearance: 'none',
      background: 'transparent',
      border: 0,
      borderRadius: foundationVars.radius.sm,
      color: foundationVars.color.text.primary,
      cursor: 'pointer',
      font: 'inherit',
      fontWeight: 700,
      minHeight: '44px',
      minWidth: 0,
      padding: 0,
      textAlign: 'left',
      selectors: {
        '&:focus-visible': {
          boxShadow: foundationVars.shadow.focus,
          outline: 0
        }
      }
    }
  }
})

export const actionDataCell = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '1px',
      justifyItems: 'center',
      minWidth: 0,
      overflow: 'hidden',
      textAlign: 'center'
    }
  }
})

globalStyle(`${actionDataCell} > strong`, {
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.72rem',
      fontWeight: 650,
      lineHeight: 1.2,
      maxWidth: '100%',
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      width: '100%',
      whiteSpace: 'nowrap',
      '@media': {
        '(max-width: 620px)': {
          overflowWrap: 'anywhere',
          textOverflow: 'clip',
          whiteSpace: 'normal'
        }
      }
    }
  }
})

export const playRowTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '0.78rem',
      fontWeight: 700,
      lineHeight: 1.2
    }
  }
})
