import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../../../css/foundations.css.ts'
import { app } from '../../../../css/layers.css.ts'

export const footer = style({
  '@layer': {
    [app]: {
      minBlockSize: 72,
      padding: `${foundationVars.space[3]} ${foundationVars.space[4]}`,
      borderBlockStart: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.recessed
    }
  }
})

export const footerContent = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      inlineSize: '100%',
      minInlineSize: 0
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
      backgroundColor: foundationVars.color.surface.raised
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
      backgroundColor: foundationVars.color.accent.tertiarySolid,
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
