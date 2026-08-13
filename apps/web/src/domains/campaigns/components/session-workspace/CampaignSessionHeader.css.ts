import { style } from '@vanilla-extract/css'
import { foundationVars } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

const compact = 'screen and (max-width: 48rem)'

export const header = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      gap: foundationVars.space[5],
      alignItems: 'center',
      minInlineSize: 0,
      paddingBlockEnd: foundationVars.space[4],
      borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`,
      '@media': {
        [compact]: { gridTemplateColumns: '1fr', gap: foundationVars.space[3] }
      }
    }
  }
})

export const identity = style({
  '@layer': {
    [app]: {
      display: 'grid',
      justifyItems: 'start',
      gap: foundationVars.space[1]
    }
  }
})

export const back = style({
  '@layer': {
    [app]: {
      marginInlineStart: `calc(${foundationVars.space[2]} * -1)`,
      color: foundationVars.color.text.secondary
    }
  }
})

export const titleField = style({
  '@layer': { [app]: { inlineSize: 'min(34rem, 100%)' } }
})

export const titleInput = style({
  '@layer': {
    [app]: {
      minBlockSize: '2.75rem',
      paddingInline: foundationVars.space[2],
      borderColor: 'transparent',
      background: 'transparent',
      color: foundationVars.color.text.primary,
      fontFamily: foundationVars.font.display,
      fontSize: 'clamp(1.65rem, 4vw, 2.25rem)',
      fontWeight: foundationVars.fontWeight.bold,
      lineHeight: 1.1,
      selectors: {
        '&:hover:not(:disabled)': {
          borderColor: foundationVars.color.border.subtle
        },
        '&:focus': {
          borderColor: foundationVars.color.accent.border,
          background: foundationVars.color.surface.recessed
        },
        '&::placeholder': {
          color: foundationVars.color.text.primary,
          opacity: 1
        }
      }
    }
  }
})

export const utilities = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      gap: foundationVars.space[2],
      flexWrap: 'wrap',
      '@media': {
        [compact]: {
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto'
        }
      }
    }
  }
})
