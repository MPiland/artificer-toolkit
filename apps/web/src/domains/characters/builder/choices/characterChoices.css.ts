import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const grantedFeatureSection = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '16px'
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
      padding: '16px'
    }
  }
})

export const grantedFeatureDetails = style({
  '@layer': {
    [app]: {
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '10px',
      paddingTop: '10px'
    }
  }
})

export const grantedFeatureDetail = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '4px'
    }
  }
})

export const grantedFeatureRow = style({
  '@layer': {
    [app]: {
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '8px',
      paddingBlock: '10px'
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
      fontSize: '1rem',
      lineHeight: 1.55,
      maxWidth: '72ch',
      textWrap: 'pretty'
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

export const spellChoiceLists = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '18px'
    }
  }
})

export const spellPickerSection = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '10px'
    }
  }
})

export const spellPickerHeader = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      gap: '16px',
      justifyContent: 'space-between'
    }
  }
})

export const spellPickerList = style({
  '@layer': {
    [app]: {
      borderBlock: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      maxHeight: '420px',
      overflowY: 'auto'
    }
  }
})

export const spellPickerRow = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'grid',
      gap: '16px',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      minHeight: '52px',
      padding: '8px 4px',
      selectors: {
        '& + &': {
          borderTop: `1px solid ${foundationVars.color.border.subtle}`
        }
      }
    }
  }
})

export const spellPickerDetails = style({
  '@layer': {
    [app]: {
      minWidth: 0
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
