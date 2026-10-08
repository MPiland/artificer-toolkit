import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const badgeRow = style({
  '@layer': { [app]: { display: 'flex', flexWrap: 'wrap', gap: '6px' } }
})

export const drawerStack = style({
  '@layer': { [app]: { display: 'grid', gap: '16px' } }
})

export const drawerSection = style({
  '@layer': {
    [app]: {
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '10px',
      paddingTop: '16px'
    }
  }
})

export const inlineControlRow = style({
  '@layer': {
    [app]: {
      alignItems: 'end',
      display: 'grid',
      gap: '10px',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      '@media': { '(max-width: 420px)': { gridTemplateColumns: '1fr' } }
    }
  }
})

export const noteViewer = style({
  '@layer': { [app]: { display: 'grid', gap: '24px', minHeight: '360px' } }
})

export const noteHeader = style({
  '@layer': {
    [app]: {
      alignItems: 'start',
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'flex',
      gap: '16px',
      justifyContent: 'space-between',
      paddingBottom: '16px'
    }
  }
})

export const noteTitle = style({
  '@layer': { [app]: { marginTop: '8px', textWrap: 'balance' } }
})

export const noteBody = style({
  '@layer': { [app]: { maxWidth: '72ch', minHeight: '240px' } }
})

export const sheetEmptyState = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'grid',
      gap: '10px',
      justifyItems: 'center',
      minHeight: '320px',
      padding: '32px',
      textAlign: 'center'
    }
  }
})

export const readOnlyDetails = style({
  '@layer': {
    [app]: { borderTop: `1px solid ${foundationVars.color.border.subtle}`, paddingTop: '12px' }
  }
})

export const noteBrowseList = style({
  '@layer': { [app]: { display: 'grid', gap: '4px', maxHeight: '40vh', overflowY: 'auto' } }
})

export const noteBrowseItem = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      appearance: 'none',
      background: 'transparent',
      border: 0,
      borderRadius: foundationVars.radius.md,
      color: foundationVars.color.text.primary,
      cursor: 'pointer',
      display: 'flex',
      font: 'inherit',
      justifyContent: 'space-between',
      padding: '10px',
      textAlign: 'left',
      selectors: {
        '&:hover': { background: foundationVars.color.surface.subtle },
        '&:focus-visible': { outline: `2px solid ${foundationVars.color.accent.solid}` }
      }
    }
  }
})

export const groupManagementRow = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      gap: '12px',
      justifyContent: 'space-between',
      minHeight: '34px'
    }
  }
})

export const modalActions = style({
  '@layer': {
    [app]: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }
  }
})

globalStyle(`${readOnlyDetails} summary`, {
  '@layer': { [app]: { cursor: 'pointer', fontWeight: 700, paddingBlock: '8px' } }
})

globalStyle(`${noteBrowseItem} span`, {
  '@layer': { [app]: { display: 'grid', gap: '2px' } }
})

globalStyle(`${noteBrowseItem} small`, {
  '@layer': { [app]: { color: foundationVars.color.text.secondary } }
})
