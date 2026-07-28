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
      gap: '4px',
      paddingTop: '8px'
    }
  }
})
