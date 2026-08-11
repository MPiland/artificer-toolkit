import { style } from '@vanilla-extract/css'
import { foundationVars, media } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

export const discoveryTools = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 32rem) auto auto',
      alignItems: 'end',
      gap: foundationVars.space[3],
      '@media': {
        [media.mobile]: {
          gridTemplateColumns: 'minmax(0, 1fr) auto'
        }
      }
    }
  }
})

export const searchField = style({
  '@layer': { [app]: { inlineSize: '100%' } }
})

export const filterButton = style({
  '@layer': { [app]: { justifySelf: 'start' } }
})

export const clearFilters = style({
  '@layer': {
    [app]: {
      '@media': {
        [media.mobile]: {
          gridColumn: '1 / -1',
          justifySelf: 'start'
        }
      }
    }
  }
})

export const drawerFields = style({
  '@layer': { [app]: { display: 'grid', gap: foundationVars.space[4] } }
})

export const drawerContent = style({
  '@layer': {
    [app]: {
      borderInlineStart: `1px solid ${foundationVars.color.border.strong}`,
      backgroundColor: foundationVars.color.surface.panel,
      color: foundationVars.color.text.primary
    }
  }
})

export const drawerHeader = style({
  '@layer': {
    [app]: {
      padding: foundationVars.space[4],
      borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.panel
    }
  }
})

export const drawerTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.heading.fontSize,
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: foundationVars.typography.heading.lineHeight
    }
  }
})

export const drawerBody = style({
  '@layer': {
    [app]: {
      padding: foundationVars.space[4],
      backgroundColor: foundationVars.color.surface.panel
    }
  }
})

export const srStatus = style({
  position: 'absolute',
  inlineSize: '1px',
  blockSize: '1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap'
})
