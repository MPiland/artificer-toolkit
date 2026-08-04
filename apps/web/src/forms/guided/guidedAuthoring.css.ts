import { keyframes, style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

const reveal = keyframes({
  from: { opacity: 0, transform: 'translateX(12px)' },
  to: { opacity: 1, transform: 'translateX(0)' }
})

export const root = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      gap: foundationVars.space[6],
      inlineSize: '100%',
      marginInline: 'auto',
      maxInlineSize: '48rem',
      minBlockSize: '100%',
      padding: '4px 0 20px'
    }
  }
})

export const header = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      gap: foundationVars.space[4],
      justifyContent: 'space-between'
    }
  }
})

export const headerMeta = style({
  '@layer': {
    [app]: {
      alignItems: 'baseline',
      display: 'flex',
      flexWrap: 'wrap',
      gap: foundationVars.space[3]
    }
  }
})

export const headerLabel = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '0.95rem',
      fontWeight: foundationVars.fontWeight.semibold
    }
  }
})

export const headerStep = style({
  '@layer': {
    [app]: { color: foundationVars.color.text.muted, fontSize: '0.875rem' }
  }
})

export const headerAction = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      flexShrink: 0,
      fontSize: '0.875rem',
      minBlockSize: 44
    }
  }
})

export const progress = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 6,
      listStyle: 'none',
      margin: 0,
      padding: 0
    }
  }
})

export const progressItem = style({ '@layer': { [app]: { display: 'block', minInlineSize: 0 } } })

export const progressBar = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.border.subtle,
      borderRadius: 999,
      display: 'block',
      height: 4,
      transition: 'background-color 160ms ease-out',
      selectors: {
        '&[data-current="true"]': { background: foundationVars.color.accent.solid },
        '&[data-complete="true"]': { background: foundationVars.color.accent.tertiarySolid }
      },
      '@media': { '(prefers-reduced-motion: reduce)': { transition: 'none' } }
    }
  }
})

export const srOnly = style({
  '@layer': {
    [app]: {
      border: 0,
      clip: 'rect(0 0 0 0)',
      clipPath: 'inset(50%)',
      height: 1,
      margin: -1,
      overflow: 'hidden',
      padding: 0,
      position: 'absolute',
      whiteSpace: 'nowrap',
      width: 1
    }
  }
})

export const heading = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: 'clamp(1.9rem, 4vw, 2.25rem)',
      letterSpacing: '-0.025em',
      lineHeight: 1.1,
      margin: 0,
      outline: 'none'
    }
  }
})

export const description = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '1rem',
      lineHeight: 1.5,
      margin: '8px 0 0',
      maxInlineSize: '68ch'
    }
  }
})

export const screen = style({
  '@layer': {
    [app]: {
      animation: `${reveal} 200ms ease-out both`,
      display: 'grid',
      gap: foundationVars.space[5],
      '@media': { '(prefers-reduced-motion: reduce)': { animation: 'none' } }
    }
  }
})

export const choiceGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[4],
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      '@media': { '(max-width: 760px)': { gridTemplateColumns: '1fr' } }
    }
  }
})

export const choiceButton = style({
  '@layer': {
    [app]: {
      backgroundColor: foundationVars.color.card.background.default,
      borderColor: foundationVars.color.card.border.default,
      color: foundationVars.color.text.primary,
      height: 'auto',
      minHeight: 116,
      padding: foundationVars.space[5],
      textAlign: 'left',
      transition: 'border-color 160ms ease-out, background-color 160ms ease-out',
      ':hover': {
        backgroundColor: foundationVars.color.card.background.hover,
        borderColor: foundationVars.color.card.border.selected
      },
      ':focus-visible': {
        outline: `2px solid ${foundationVars.color.accent.focus}`,
        outlineOffset: 2
      },
      selectors: {
        '&[data-selected="true"]': {
          backgroundColor: foundationVars.color.card.background.active,
          borderColor: foundationVars.color.card.border.selected
        }
      },
      '@media': {
        '(max-width: 760px)': { minHeight: 96, padding: foundationVars.space[4] },
        '(prefers-reduced-motion: reduce)': { transition: 'none' }
      }
    }
  }
})

export const outcomeGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      '@media': {
        '(max-width: 760px)': { gridTemplateColumns: '1fr' }
      }
    }
  }
})

export const outcomeButton = style([
  choiceButton,
  {
    '@layer': {
      [app]: {
        minHeight: 88,
        padding: foundationVars.space[4]
      }
    }
  }
])

export const choiceIcon = style({
  '@layer': { [app]: { color: foundationVars.color.accent.solid, flexShrink: 0 } }
})

export const choiceCopy = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[1],
      minInlineSize: 0,
      textAlign: 'left',
      whiteSpace: 'normal'
    }
  }
})

export const choiceTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1rem',
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: 1.25
    }
  }
})

export const choiceDescription = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      display: 'block',
      fontSize: '0.85rem',
      fontWeight: foundationVars.fontWeight.regular,
      lineHeight: 1.4,
      whiteSpace: 'normal'
    }
  }
})

export const copyPanel = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.card.background.default,
      border: `1px solid ${foundationVars.color.card.border.default}`,
      borderRadius: foundationVars.radius.md,
      padding: foundationVars.space[5]
    }
  }
})

export const sourceSummary = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.card.background.hover,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.sm,
      display: 'grid',
      gap: foundationVars.space[2],
      padding: foundationVars.space[4]
    }
  }
})

export const fields = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[4],
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      '@media': { '(max-width: 760px)': { gridTemplateColumns: '1fr' } }
    }
  }
})

export const full = style({ '@layer': { [app]: { gridColumn: '1 / -1' } } })

export const navigation = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'flex',
      gap: foundationVars.space[3],
      justifyContent: 'space-between',
      marginBlockStart: 'auto',
      paddingTop: 18
    }
  }
})

export const navigationAction = style({ '@layer': { [app]: { minBlockSize: 44 } } })

export const summary = style({
  '@layer': { [app]: { display: 'grid', gap: 10, margin: 0, padding: 0 } }
})

export const summaryRow = style({
  '@layer': {
    [app]: {
      alignItems: 'baseline',
      display: 'grid',
      gap: foundationVars.space[3],
      gridTemplateColumns: 'minmax(120px, 0.35fr) minmax(0, 1fr)',
      '@media': { '(max-width: 560px)': { gap: 2, gridTemplateColumns: '1fr' } }
    }
  }
})

export const summaryLabel = style({
  '@layer': { [app]: { color: foundationVars.color.text.muted, fontSize: '0.9rem' } }
})

export const summaryValue = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontWeight: foundationVars.fontWeight.semibold
    }
  }
})

export const featureSummary = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 2,
      minInlineSize: 0
    }
  }
})
