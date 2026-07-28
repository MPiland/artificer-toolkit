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

export const actionTable = style({
  '@layer': {
    [app]: {
      display: 'grid',
      minWidth: 0
    }
  }
})

export const actionTableHeader = style({
  '@layer': {
    [app]: {
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      color: foundationVars.color.text.muted,
      display: 'grid',
      fontSize: '0.64rem',
      fontWeight: 700,
      gap: '10px',
      gridTemplateColumns:
        '18px minmax(110px, 1fr) minmax(48px, 0.28fr) minmax(54px, 0.3fr) minmax(110px, 0.75fr)',
      letterSpacing: '0.04em',
      padding: '0 0 6px',
      textTransform: 'uppercase'
    }
  }
})

export const actionTableRow = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '10px',
      gridTemplateColumns:
        '18px minmax(110px, 1fr) minmax(48px, 0.28fr) minmax(54px, 0.3fr) minmax(110px, 0.75fr)',
      minHeight: '38px',
      minWidth: 0,
      padding: '7px 0',
      selectors: {
        '&:last-child': {
          borderBottom: 0
        }
      }
    }
  }
})

export const actionIcon = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      border: `1px solid ${foundationVars.color.border.strong}`,
      borderRadius: foundationVars.radius.pill,
      color: foundationVars.color.text.accent,
      display: 'grid',
      height: '18px',
      justifyItems: 'center',
      width: '18px'
    }
  }
})

export const actionKindText = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.68rem',
      fontWeight: 700,
      lineHeight: 1.15,
      textTransform: 'capitalize'
    }
  }
})

export const playTableHeader = style({
  '@layer': {
    [app]: {
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      color: foundationVars.color.text.muted,
      display: 'grid',
      fontSize: '0.66rem',
      fontWeight: 700,
      gap: '10px',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(86px, auto) minmax(96px, auto)',
      letterSpacing: '0.06em',
      padding: '0 0 7px',
      textTransform: 'uppercase'
    }
  }
})

export const playTableRow = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '10px',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(86px, auto) minmax(96px, auto)',
      minHeight: '34px',
      minWidth: 0,
      padding: '8px 0'
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

export const playRowMeta = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.7rem',
      lineHeight: 1.2
    }
  }
})
