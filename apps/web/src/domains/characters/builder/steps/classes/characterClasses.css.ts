import { style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const classSection = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '12px',
      paddingBlock: '4px 16px',
      selectors: {
        '& + &': {
          borderTop: `1px solid ${foundationVars.color.border.subtle}`,
          paddingTop: '20px'
        }
      }
    }
  }
})

export const classHeader = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
      justifyContent: 'space-between'
    }
  }
})

export const classIdentity = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px'
    }
  }
})

export const classTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1.25rem',
      fontWeight: 750,
      lineHeight: 1.3,
      margin: 0
    }
  }
})

export const classLevelField = style({
  '@layer': {
    [app]: {
      width: '64px'
    }
  }
})

export const classProficiencyCard = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.subtle,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      display: 'grid',
      gap: '10px',
      padding: '16px'
    }
  }
})

export const classProficiencyRow = style({
  '@layer': {
    [app]: {
      alignItems: 'start',
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'minmax(110px, 0.35fr) minmax(0, 1fr)',
      minHeight: '34px',
      '@media': {
        '(max-width: 620px)': {
          alignItems: 'stretch',
          gap: '4px',
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const classProficiencyContent = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '8px',
      minWidth: 0
    }
  }
})
