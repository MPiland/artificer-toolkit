import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../../css/foundations.css.ts'
import { app } from '../../../css/layers.css.ts'

export const runtimeShell = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(10rem, 14rem) minmax(0, 1fr)',
      gap: foundationVars.space['6'],
      width: '100%'
    }
  },
  '@media': {
    '(max-width: 768px)': {
      gridTemplateColumns: '1fr'
    }
  }
})

export const sectionNav = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      gap: foundationVars.space['2'],
      alignSelf: 'start',
      position: 'sticky',
      top: foundationVars.space['4']
    }
  }
})

export const sectionStack = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      gap: foundationVars.space['5']
    }
  }
})

export const sectionPanel = style({
  '@layer': {
    [app]: {
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      background: foundationVars.color.surface.panel,
      padding: foundationVars.space['5']
    }
  }
})

export const fieldGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: foundationVars.space['4']
    }
  },
  '@media': {
    '(max-width: 768px)': {
      gridTemplateColumns: '1fr'
    }
  }
})

export const wideField = style({
  '@layer': {
    [app]: {
      gridColumn: '1 / -1'
    }
  }
})

export const nestedShell = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      gap: foundationVars.space['3'],
      border: `1px dashed ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      padding: foundationVars.space['4']
    }
  }
})
