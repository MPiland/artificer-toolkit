import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const abilityAssignmentGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
      '@media': {
        '(max-width: 1100px)': {
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'
        },
        '(max-width: 700px)': {
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
        },
        '(max-width: 420px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const abilityAssignmentSlot = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '8px',
      '@media': {
        '(max-width: 1100px)': {
          background: foundationVars.color.surface.panel,
          border: `1px solid ${foundationVars.color.border.subtle}`,
          borderRadius: foundationVars.radius.md,
          padding: '10px'
        }
      }
    }
  }
})

export const hitpointTable = style({
  '@layer': {
    [app]: {
      borderCollapse: 'collapse',
      tableLayout: 'fixed',
      width: '100%',
      '@media': {
        '(max-width: 900px)': {
          tableLayout: 'auto'
        }
      }
    }
  }
})

export const hitpointPanel = style({
  '@layer': {
    [app]: {
      gap: '10px'
    }
  }
})

export const hitpointClassGroup = style({
  '@layer': { [app]: {} }
})

export const hitpointClassHeader = style({
  '@layer': { [app]: {} }
})

export const hitpointRow = style({
  '@layer': { [app]: {} }
})

globalStyle(`${hitpointTable} th`, {
  color: foundationVars.color.text.secondary,
  fontSize: '0.75rem',
  fontWeight: foundationVars.fontWeight.semibold,
  padding: '8px 10px',
  textAlign: 'left'
})

globalStyle(`${hitpointTable} td`, {
  borderTop: `1px solid ${foundationVars.color.border.subtle}`,
  color: foundationVars.color.text.primary,
  padding: '10px',
  verticalAlign: 'middle'
})

globalStyle(`${hitpointTable} th:nth-child(1), ${hitpointTable} td:nth-child(1)`, { width: '14%' })
globalStyle(`${hitpointTable} th:nth-child(2), ${hitpointTable} td:nth-child(2)`, { width: '24%' })
globalStyle(`${hitpointTable} th:nth-child(3), ${hitpointTable} td:nth-child(3)`, { width: '24%' })
globalStyle(`${hitpointTable} th:nth-child(4), ${hitpointTable} td:nth-child(4)`, { width: '22%' })
globalStyle(`${hitpointTable} th:nth-child(5), ${hitpointTable} td:nth-child(5)`, { width: '16%' })

globalStyle(`${hitpointClassGroup} + ${hitpointClassGroup} tr:first-child th`, {
  borderTop: `1px solid ${foundationVars.color.border.strong}`,
  paddingTop: '14px'
})

globalStyle(`${hitpointClassHeader} th`, {
  color: foundationVars.color.text.primary,
  paddingTop: '12px'
})

globalStyle(`${hitpointClassHeader} th > span`, { display: 'inline-block' })
globalStyle(`${hitpointClassHeader} th > span + span`, {
  color: foundationVars.color.text.secondary,
  float: 'right',
  fontWeight: foundationVars.fontWeight.semibold
})

globalStyle(`${hitpointRow}:hover td`, {
  background: foundationVars.color.surface.subtle
})

globalStyle(`${hitpointTable} thead`, {
  '@media': { '(max-width: 900px)': { display: 'none' } }
})

globalStyle(`${hitpointTable} tbody, ${hitpointTable} tr, ${hitpointTable} td`, {
  '@media': { '(max-width: 900px)': { display: 'block', width: '100%' } }
})

globalStyle(`${hitpointTable} td`, {
  '@media': {
    '(max-width: 900px)': {
      borderTop: 0,
      display: 'grid',
      gap: '8px',
      gridTemplateColumns: 'minmax(120px, 0.45fr) minmax(0, 1fr)',
      padding: '5px 10px'
    }
  }
})

globalStyle(`${hitpointTable} td::before`, {
  '@media': {
    '(max-width: 900px)': {
      color: foundationVars.color.text.secondary,
      content: 'attr(data-label)',
      fontSize: '0.75rem',
      fontWeight: foundationVars.fontWeight.semibold
    }
  }
})
