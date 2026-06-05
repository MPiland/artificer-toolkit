import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../../css/foundations.css.ts'
import { app } from '../../../css/layers.css.ts'

export const section = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 0,
      padding: 0,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.surface.panel,
      overflow: 'hidden'
    }
  }
})

export const sectionHeader = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: foundationVars.space[3],
      padding: `${foundationVars.space[3]} ${foundationVars.space[4]}`,
    }
  }
})

export const sectionTitleGroup = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 2,
      minInlineSize: 0
    }
  }
})

export const sectionTitle = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[1],
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: '15px',
      fontWeight: foundationVars.fontWeight.bold,
      lineHeight: '20px'
    }
  }
})

export const sectionDescription = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.muted,
      fontSize: '12px',
      lineHeight: '16px'
    }
  }
})