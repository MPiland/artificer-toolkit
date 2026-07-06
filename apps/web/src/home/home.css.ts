import { style } from '@vanilla-extract/css'
import { foundationVars } from '../css/foundations.css.ts'
import { app } from '../css/layers.css.ts'

export const homeStack = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[8],
      padding: foundationVars.space[4]
    }
  }
})

export const homeGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))',
      gap: foundationVars.space[4]
    }
  }
})

export const homePanel = style({
  '@layer': {
    [app]: {
      display: 'grid',
      alignContent: 'space-between',
      gap: foundationVars.space[6],
      minHeight: '12rem',
      padding: foundationVars.space[6],
      border: `1px solid ${foundationVars.color.card.border.default}`,
      borderRadius: foundationVars.radius.xl,
      backgroundColor: foundationVars.color.card.background.default,
      boxShadow: foundationVars.shadow.card
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

export const homeMeta = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.accent,
      fontSize: foundationVars.typography.caption.fontSize,
      fontWeight: foundationVars.fontWeight.bold,
      letterSpacing: '0.08em',
      lineHeight: foundationVars.typography.caption.lineHeight,
      textTransform: 'uppercase'
    }
  }
})
