import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const inspector = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      display: 'grid',
      minHeight: '100%'
    }
  }
})

export const section = style({
  '@layer': {
    [app]: {
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '12px',
      padding: '20px',
      selectors: {
        '&:first-child': {
          borderTop: 0
        }
      }
    }
  }
})

export const disclosureSection = style({
  '@layer': {
    [app]: {
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      paddingInline: '10px'
    }
  }
})

export const disclosureRoot = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 0
    }
  }
})

export const disclosureItem = style({
  '@layer': {
    [app]: {
      background: 'transparent',
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: 0,
      selectors: {
        '&[data-active]': {
          background: 'transparent'
        },
        '&:last-child': {
          borderBottom: 0
        }
      }
    }
  }
})

export const disclosureControl = style({
  '@layer': {
    [app]: {
      background: 'transparent',
      minHeight: '46px',
      padding: '12px 0',
      selectors: {
        '&[data-active]': {
          background: 'transparent'
        }
      }
    }
  }
})

export const disclosureContent = style({
  '@layer': {
    [app]: {
      background: 'transparent',
      padding: '12px 0 16px'
    }
  }
})

export const disclosureBody = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '16px'
    }
  }
})

export const infoGroup = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '8px'
    }
  }
})

export const summary = style({
  '@layer': {
    [app]: {
      alignItems: 'start',
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'minmax(0, 1fr) auto'
    }
  }
})

export const summaryValue = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '2rem',
      fontWeight: 780,
      letterSpacing: '-0.025em',
      lineHeight: 1
    }
  }
})

export const summaryLabel = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.78rem',
      fontWeight: 700
    }
  }
})

export const stateBadge = style({
  '@layer': {
    [app]: {
      letterSpacing: 0,
      textTransform: 'none'
    }
  }
})

export const sectionTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '0.9rem',
      fontWeight: 760,
      lineHeight: 1.2,
      margin: 0
    }
  }
})

export const featureList = style({
  '@layer': {
    [app]: {
      display: 'grid'
    }
  }
})

export const featureEntry = style({
  '@layer': {
    [app]: {
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '8px',
      paddingBlock: '12px',
      selectors: {
        '&:first-child': {
          paddingTop: 0
        },
        '&:last-child': {
          borderBottom: 0,
          paddingBottom: 0
        }
      }
    }
  }
})

export const featureDescription = style({})

globalStyle(`${featureDescription} > *`, {
  '@layer': {
    [app]: {
      fontSize: '0.875rem',
      lineHeight: 1.55
    }
  }
})

export const muted = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontSize: '0.78rem',
      lineHeight: 1.45
    }
  }
})

export const calculationList = style({
  '@layer': {
    [app]: {
      display: 'grid'
    }
  }
})

export const calculationRow = style({
  '@layer': {
    [app]: {
      alignItems: 'start',
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      paddingBlock: '9px',
      selectors: {
        '&:last-child': {
          borderBottom: 0
        }
      }
    }
  }
})

export const suppressed = style({
  '@layer': {
    [app]: {
      opacity: 0.62,
      textDecoration: 'line-through'
    }
  }
})
