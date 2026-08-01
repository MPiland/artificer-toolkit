import { style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const drawerContent = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.canvas,
      borderLeft: `1px solid ${foundationVars.color.border.subtle}`
    }
  }
})

export const drawerHeader = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.panel,
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      minHeight: '52px',
      paddingInline: '16px'
    }
  }
})

export const drawerTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '0.95rem',
      fontWeight: 760
    }
  }
})

export const drawerBody = style({
  '@layer': {
    [app]: {
      padding: 0
    }
  }
})
