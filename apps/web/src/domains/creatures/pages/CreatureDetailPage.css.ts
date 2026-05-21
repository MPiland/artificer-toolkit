import { style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

const compact = 'screen and (max-width: 720px)'

export const statBlock = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[4]
    }
  }
})

export const abilityGrid = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'gridTemplateColumns': 'repeat(6, minmax(0, 1fr))',
      'gap': foundationVars.space[2],
      '@media': {
        [compact]: {
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'
        }
      }
    }
  }
})

export const abilityCell = style({
  '@layer': {
    [app]: {
      display: 'grid',
      justifyItems: 'center',
      gap: '2px',
      minHeight: '82px',
      padding: `${foundationVars.space[3]} ${foundationVars.space[2]}`,
      border: `1px solid ${foundationVars.color.border.strong}`,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.surface.panel
    }
  }
})

export const abilityLabel = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontFamily: foundationVars.font.mono,
      fontSize: foundationVars.typography.caption.fontSize,
      fontWeight: foundationVars.fontWeight.bold,
      lineHeight: foundationVars.typography.caption.lineHeight
    }
  }
})

export const abilityScore = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.heading.fontSize,
      lineHeight: '1.1'
    }
  }
})

export const abilityModifier = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontFamily: foundationVars.font.mono,
      fontSize: foundationVars.typography.caption.fontSize,
      fontWeight: foundationVars.fontWeight.semibold
    }
  }
})

export const speedGrid = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: foundationVars.space[2]
    }
  }
})

export const speedPill = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[2],
      minHeight: '32px',
      padding: `${foundationVars.space[1]} ${foundationVars.space[3]}`,
      border: `1px solid ${foundationVars.color.border.strong}`,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.input.background.default,
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.bodySm.fontSize
    }
  }
})
