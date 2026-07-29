import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const selectionModalContent = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.panel,
      borderRadius: '12px',
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100dvh - 48px)',
      maxHeight: 'calc(100dvh - 48px)',
      maxWidth: '1200px',
      minHeight: 0,
      overflow: 'hidden',
      width: 'calc(100vw - 48px)',
      '@media': {
        '(max-width: 700px)': {
          borderRadius: 0,
          height: '100dvh',
          maxHeight: '100dvh',
          maxWidth: '100vw',
          width: '100vw'
        }
      }
    }
  }
})

export const selectionModalInner = style({
  '@layer': {
    [app]: {
      '@media': {
        '(max-width: 700px)': {
          padding: 0
        }
      }
    }
  }
})

export const selectionModalHeader = style({
  '@layer': {
    [app]: {
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      flex: '0 0 auto',
      minHeight: '56px',
      paddingInline: 'clamp(16px, 3vw, 32px)'
    }
  }
})

export const selectionModalTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1.5rem',
      fontWeight: 750
    }
  }
})

export const selectionModalBody = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flex: '1 1 auto',
      minHeight: 0,
      overflow: 'hidden',
      padding: 0
    }
  }
})

export const selectionModalLayout = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateRows: 'auto minmax(0, 1fr)',
      height: '100%',
      minHeight: 0,
      overflow: 'hidden',
      width: '100%'
    }
  }
})

export const selectionModalIntro = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '14px',
      padding: '16px clamp(16px, 3vw, 32px)',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 360px)',
      alignItems: 'end',
      '@media': {
        '(max-width: 700px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const selectionModalScroller = style({
  '@layer': {
    [app]: {
      minHeight: 0,
      overscrollBehavior: 'contain',
      overflowY: 'auto',
      padding: '4px clamp(16px, 3vw, 32px) 24px',
      scrollbarGutter: 'stable'
    }
  }
})

export const selectionGroup = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '12px',
      paddingTop: '20px',
      selectors: {
        '& + &': {
          borderTop: `1px solid ${foundationVars.color.border.subtle}`,
          marginTop: '24px'
        }
      }
    }
  }
})

export const selectionGroupTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1.1rem',
      fontWeight: 750,
      margin: 0
    }
  }
})

export const selectionCardGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '16px',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      '@media': {
        '(max-width: 900px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const selectionCard = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.panel,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: '12px',
      color: foundationVars.color.text.primary,
      display: 'grid',
      gap: '12px',
      padding: '20px',
      textAlign: 'left',
      transition: 'border-color 160ms ease-out, background-color 160ms ease-out',
      selectors: {
        '&:hover': {
          borderColor: foundationVars.color.border.strong
        }
      },
      '@media': {
        '(prefers-reduced-motion: reduce)': {
          transition: 'none'
        }
      }
    }
  }
})

export const selectionCardSelected = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.accent.soft,
      borderColor: foundationVars.color.accent.border
    }
  }
})

export const selectionCardHeader = style({
  '@layer': {
    [app]: {
      alignItems: 'baseline',
      display: 'flex',
      gap: '12px',
      justifyContent: 'space-between'
    }
  }
})

export const selectionCardTitleGroup = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      flex: 1,
      gap: '10px',
      minWidth: 0
    }
  }
})

export const selectionCardIndicator = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      border: `1px solid ${foundationVars.color.border.strong}`,
      borderRadius: '999px',
      color: foundationVars.color.text.accent,
      display: 'inline-flex',
      flex: '0 0 20px',
      height: '20px',
      justifyContent: 'center',
      width: '20px'
    }
  }
})

export const selectionCardTitle = style({
  '@layer': {
    [app]: {
      cursor: 'pointer',
      flex: 1
    }
  }
})

export const selectionCardTitleText = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1.125rem',
      fontWeight: 750,
      lineHeight: 1.25,
      textWrap: 'balance'
    }
  }
})

export const selectionCardBody = style({
  '@layer': {
    [app]: {
      cursor: 'pointer',
      display: 'grid',
      gap: '12px'
    }
  }
})

export const selectionCardRadio = style({
  '@layer': {
    [app]: {
      height: '1px',
      margin: '-1px',
      opacity: 0,
      overflow: 'hidden',
      position: 'absolute',
      width: '1px'
    }
  }
})

export const selectionCardDescription = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      display: 'block',
      fontSize: '1rem',
      lineHeight: 1.55,
      maxHeight: '4.65em',
      maxWidth: '68ch',
      overflow: 'hidden',
      textWrap: 'pretty'
    }
  }
})

export const selectionCardDetails = style({
  '@layer': {
    [app]: {
      display: 'grid',
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      gap: '8px',
      paddingTop: '12px',
      margin: 0
    }
  }
})

export const selectionCardPrimaryDetails = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '10px',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      margin: 0
    }
  }
})

export const selectionCardPrimaryDetail = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.subtle,
      borderRadius: foundationVars.radius.md,
      display: 'grid',
      gap: '2px',
      padding: '10px 12px'
    }
  }
})

export const selectionCardPrimaryValue = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1.125rem',
      fontWeight: 750,
      lineHeight: 1.35,
      margin: 0
    }
  }
})

export const selectionCardDetail = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '4px',
      gridTemplateColumns: 'minmax(90px, 0.35fr) minmax(0, 1fr)'
    }
  }
})

export const selectionCardDetailLabel = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontSize: '0.75rem',
      fontWeight: 700
    }
  }
})

export const selectionCardDetailValue = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '0.9375rem',
      lineHeight: 1.45,
      margin: 0
    }
  }
})

export const selectionCardDetailUnmet = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.status.danger
    }
  }
})

export const selectionEmptyState = style({
  '@layer': {
    [app]: {
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      display: 'grid',
      gap: '4px',
      padding: '24px'
    }
  }
})

globalStyle(`${selectionCardDescription} p`, {
  margin: 0
})

globalStyle(`${selectionCardDescription} p + p`, {
  marginTop: '8px'
})

globalStyle(`${selectionCardPrimaryDetail}:only-child`, {
  gridColumn: '1 / -1'
})

globalStyle(`${selectionCardRadio}:focus-visible ~ ${selectionCardHeader}`, {
  outline: `2px solid ${foundationVars.color.input.border.focus}`,
  outlineOffset: '6px'
})

globalStyle(`${selectionCardRadio}:checked ~ ${selectionCardHeader} ${selectionCardIndicator}`, {
  background: foundationVars.color.accent.soft,
  borderColor: foundationVars.color.accent.border
})

globalStyle(`${selectionCardDetailUnmet} dt, ${selectionCardDetailUnmet} dd`, {
  color: foundationVars.color.status.danger
})

globalStyle(`${selectionCardRadio}:disabled ~ ${selectionCardHeader}`, {
  cursor: 'not-allowed'
})

globalStyle(`${selectionCardRadio}:disabled ~ ${selectionCardBody}`, {
  cursor: 'not-allowed'
})
