import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../../../css/foundations.css.ts'
import { app } from '../../../../css/layers.css.ts'

export const footer = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr)',
      alignItems: 'stretch',
      justifyContent: 'stretch',
      gap: 0,
      flexShrink: 0,
      minBlockSize: 72,
      padding: 0,
      borderBlockStart: `1px solid ${foundationVars.color.authoring.border}`,
      backgroundColor: foundationVars.color.authoring.rail
    }
  }
})

export const cancelRow = style({
  '@layer': {
    [app]: {
      boxSizing: 'border-box',
      inlineSize: '100%',
      minInlineSize: 0,
      padding: `4px ${foundationVars.space[4]}`
    }
  }
})

export const cancelAction = style({
  '@layer': {
    [app]: {
      minBlockSize: 36,
      justifyContent: 'flex-start',
      color: foundationVars.color.text.secondary,
      fontWeight: foundationVars.fontWeight.semibold,
      ':hover': {
        backgroundColor: foundationVars.color.status.dangerSoft,
        color: foundationVars.color.text.primary
      },
      ':focus-visible': {
        outline: 'none',
        boxShadow: foundationVars.shadow.focus
      },
      ':disabled': {
        color: foundationVars.color.text.muted
      }
    }
  }
})

export const statusContent = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      boxSizing: 'border-box',
      inlineSize: '100%',
      minInlineSize: 0,
      padding: `${foundationVars.space[3]} ${foundationVars.space[4]}`
    }
  }
})

export const progressTrack = style({
  '@layer': {
    [app]: {
      position: 'relative',
      blockSize: 4,
      inlineSize: '100%',
      overflow: 'hidden',
      borderRadius: foundationVars.radius.pill,
      backgroundColor: foundationVars.color.authoring.active
    }
  }
})

export const progressFill = style({
  '@layer': {
    [app]: {
      display: 'block',
      blockSize: '100%',
      inlineSize: 'var(--authoring-progress, 0%)',
      borderRadius: 'inherit',
      backgroundColor: foundationVars.color.accent.solid,
      transition: `inline-size ${foundationVars.motion.base} cubic-bezier(0.2, 0, 0, 1)`,
      '@media': {
        '(prefers-reduced-motion: reduce)': {
          transition: 'none'
        }
      }
    }
  }
})

export const summaryRow = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[2]
    }
  }
})
