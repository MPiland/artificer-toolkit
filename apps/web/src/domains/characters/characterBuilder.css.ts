import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const builderRoot = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '24px'
    }
  }
})

export const builderHeader = style({
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: '16px',
      alignItems: 'flex-start'
    }
  }
})

export const stepDescription = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontSize: '1rem',
      lineHeight: 1.45,
      marginTop: '6px',
      maxWidth: '68ch'
    }
  }
})

export const title = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '2rem',
      lineHeight: 1.15,
      margin: 0
    }
  }
})

export const builderShell = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.panel,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.xl,
      boxShadow: foundationVars.shadow.card,
      display: 'grid',
      gap: '24px',
      padding: '24px'
    }
  }
})

export const section = style({
  '@layer': {
    [app]: {
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '18px',
      paddingTop: '22px'
    }
  }
})

export const sectionHeader = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '4px'
    }
  }
})

export const sectionTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1.25rem',
      fontWeight: 750,
      margin: 0
    }
  }
})

export const mutedText = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary
    }
  }
})

export const modalCloseButton = style({
  '@layer': {
    [app]: {
      minWidth: '44px',
      minHeight: '44px'
    }
  }
})

export const modalActionButton = style({
  '@layer': {
    [app]: {
      minHeight: '44px'
    }
  }
})

export const fieldGrid = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'gap': '16px',
      'gridTemplateColumns': 'repeat(12, minmax(0, 1fr))',
      '@media': {
        '(max-width: 760px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const fieldSpan6 = style({
  '@layer': {
    [app]: {
      'gridColumn': 'span 6',
      '@media': {
        '(max-width: 760px)': {
          gridColumn: '1'
        }
      }
    }
  }
})

export const fieldSpan4 = style({
  '@layer': {
    [app]: {
      'gridColumn': 'span 4',
      '@media': {
        '(max-width: 760px)': {
          gridColumn: '1'
        }
      }
    }
  }
})

export const fieldSpan12 = style({
  '@layer': {
    [app]: {
      gridColumn: '1 / -1'
    }
  }
})

export const inlinePanel = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.subtle,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      display: 'grid',
      gap: '12px',
      padding: '16px'
    }
  }
})

export const grantedFeatureSection = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '12px'
    }
  }
})

export const grantedFeatureItem = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.panel,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      display: 'grid',
      gap: '12px',
      padding: '14px'
    }
  }
})

export const grantedFeatureHeader = style({
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: '12px'
    }
  }
})

export const grantedFeatureDescription = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.95rem',
      lineHeight: 1.55
    }
  }
})

export const grantedFeatureChoices = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '12px'
    }
  }
})

export const choiceSlotGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))'
    }
  }
})

export const startingEquipmentPanel = style({
  '@layer': {
    [app]: {
      gap: '14px'
    }
  }
})

export const startingEquipmentGroup = style({
  '@layer': {
    [app]: {
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      display: 'grid',
      gap: '12px',
      padding: '14px'
    }
  }
})

export const startingEquipmentGroupHeader = style({
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: '12px',
      alignItems: 'flex-start'
    }
  }
})

export const startingEquipmentOptionDetails = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '12px'
    }
  }
})

export const startingEquipmentIncludedList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '8px'
    }
  }
})

export const startingEquipmentItemRow = style({
  '@layer': {
    [app]: {
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      color: foundationVars.color.text.primary,
      paddingTop: '8px'
    }
  }
})

export const startingEquipmentChoiceList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '10px'
    }
  }
})

globalStyle(`${grantedFeatureDescription} p`, {
  margin: 0
})

globalStyle(`${grantedFeatureDescription} p + p`, {
  marginTop: '8px'
})

globalStyle(`${grantedFeatureDescription} ul, ${grantedFeatureDescription} ol`, {
  margin: '8px 0 0',
  paddingLeft: '20px'
})
