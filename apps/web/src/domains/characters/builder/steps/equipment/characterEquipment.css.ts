import { style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const startingEquipmentPanel = style({
  '@layer': {
    [app]: {
      gap: '10px',
      gridTemplateColumns: 'minmax(0, 1fr)'
    }
  }
})

export const startingEquipmentHeader = style({
  '@layer': {
    [app]: {
      alignItems: 'end',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
      justifyContent: 'space-between'
    }
  }
})

export const startingEquipmentMode = style({
  '@layer': {
    [app]: {
      flex: '0 1 280px'
    }
  }
})

export const startingEquipmentGroup = style({
  '@layer': {
    [app]: {
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      display: 'grid',
      gap: '10px',
      minWidth: 0,
      padding: '12px'
    }
  }
})

export const startingEquipmentGroups = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))'
    }
  }
})

export const startingEquipmentControlRow = style({
  '@layer': {
    [app]: {
      alignItems: 'end',
      display: 'grid',
      gap: '10px',
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(190px, 100%), 1fr))'
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

export const startingEquipmentIncludedList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '4px'
    }
  }
})

export const startingEquipmentItemRow = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary
    }
  }
})

export const startingEquipmentChoiceList = style({
  '@layer': {
    [app]: {
      display: 'contents'
    }
  }
})

export const manualInventoryRow = style({
  '@layer': {
    [app]: {
      alignItems: 'end',
      display: 'grid',
      gap: '10px',
      gridTemplateColumns: 'minmax(220px, 1.25fr) minmax(90px, 0.35fr) minmax(180px, 1fr) auto',
      '@media': {
        '(max-width: 760px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const manualCurrencyRow = style({
  '@layer': {
    [app]: {
      alignItems: 'end',
      display: 'grid',
      gap: '10px',
      gridTemplateColumns: 'minmax(220px, 1fr) minmax(120px, 0.45fr) auto',
      '@media': {
        '(max-width: 760px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const manualPanelHeader = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      justifyContent: 'space-between',
      width: '100%'
    }
  }
})
