import { style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const backgroundDescription = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      lineHeight: 1.6,
      maxWidth: '78ch'
    }
  }
})

export const suggestedCharacteristics = style({
  '@layer': {
    [app]: {
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      overflow: 'hidden'
    }
  }
})

export const suggestedCharacteristicsSummary = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      cursor: 'pointer',
      fontWeight: 700,
      padding: '14px 16px'
    }
  }
})

export const suggestedCharacteristicsContent = style({
  '@layer': {
    [app]: {
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '18px',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      padding: '16px',
      '@media': {
        '(max-width: 760px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const suggestedCharacteristicsIntro = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      gridColumn: '1 / -1',
      margin: 0
    }
  }
})

export const suggestedCharacteristicsGroup = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '10px'
    }
  }
})

export const suggestedCharacteristic = style({
  '@layer': {
    [app]: {
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '6px',
      padding: '10px 12px',
      textAlign: 'left',
      width: '100%'
    }
  }
})

export const suggestedCharacteristicButton = style({
  '@layer': {
    [app]: {
      appearance: 'none',
      background: 'transparent',
      borderBottom: 0,
      borderLeft: 0,
      borderRight: 0,
      color: 'inherit',
      cursor: 'pointer',
      font: 'inherit',
      selectors: {
        '&:hover:not(:disabled)': {
          background: foundationVars.color.surface.subtle
        },
        '&:focus-visible': {
          outline: `2px solid ${foundationVars.color.input.border.focus}`,
          outlineOffset: '-2px'
        },
        '&:disabled': {
          cursor: 'default',
          opacity: 0.68
        }
      }
    }
  }
})

export const suggestedCharacteristicSelected = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.accent.soft
    }
  }
})

export const suggestedCharacteristicHeader = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      fontSize: '0.875rem',
      fontWeight: foundationVars.fontWeight.semibold,
      gap: '12px',
      justifyContent: 'space-between'
    }
  }
})

export const suggestedCharacteristicAction = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.accent,
      flexShrink: 0,
      fontSize: '0.75rem',
      fontWeight: foundationVars.fontWeight.bold
    }
  }
})
