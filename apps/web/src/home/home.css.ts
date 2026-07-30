import { style } from '@vanilla-extract/css'
import { foundationVars } from '../css/foundations.css.ts'
import { app } from '../css/layers.css.ts'

export const homeStack = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[6]
    }
  }
})

export const homeGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))',
      gap: '1px',
      overflow: 'hidden',
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      backgroundColor: foundationVars.color.border.subtle
    }
  }
})

export const homePanel = style({
  '@layer': {
    [app]: {
      display: 'grid',
      alignContent: 'start',
      gap: foundationVars.space[4],
      minHeight: '9rem',
      padding: foundationVars.space[5],
      backgroundColor: foundationVars.color.surface.panel
    }
  }
})

export const homePanelCopy = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2]
    }
  }
})

export const homePanelTitle = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.heading.fontSize,
      fontWeight: foundationVars.typography.heading.fontWeight,
      lineHeight: foundationVars.typography.heading.lineHeight
    }
  }
})

export const homePanelText = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      lineHeight: foundationVars.typography.bodySm.lineHeight
    }
  }
})
