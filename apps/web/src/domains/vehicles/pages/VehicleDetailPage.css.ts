import { style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

const compact = 'screen and (max-width: 720px)'

export const metricGrid = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'gridTemplateColumns': 'repeat(4, minmax(0, 1fr))',
      'gap': foundationVars.space[3],
      '@media': {
        [compact]: {
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
        }
      }
    }
  }
})

export const metricCell = style({
  '@layer': {
    [app]: {
      display: 'grid',
      alignContent: 'start',
      gap: '2px',
      minHeight: '94px',
      padding: foundationVars.space[4],
      border: `1px solid ${foundationVars.color.border.strong}`,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.surface.panel
    }
  }
})

export const metricLabel = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontFamily: foundationVars.font.mono,
      fontSize: foundationVars.typography.caption.fontSize,
      fontWeight: foundationVars.fontWeight.bold,
      lineHeight: foundationVars.typography.caption.lineHeight,
      textTransform: 'uppercase'
    }
  }
})

export const metricValue = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.body.fontSize,
      lineHeight: foundationVars.typography.body.lineHeight
    }
  }
})

export const metricNote = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.caption.fontSize,
      lineHeight: foundationVars.typography.caption.lineHeight
    }
  }
})
