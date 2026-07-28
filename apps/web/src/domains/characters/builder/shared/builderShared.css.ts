import { style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const builderRoot = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '24px'
    }
  }
})

export const builderHeader = style({
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: '16px',
      alignItems: 'flex-start'
    }
  }
})

export const resolverContent = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '24px'
    }
  }
})

export const stepDescription = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontSize: '1rem',
      lineHeight: 1.45,
      marginTop: '6px',
      maxWidth: '68ch'
    }
  }
})

export const title = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '2rem',
      lineHeight: 1.15,
      margin: 0
    }
  }
})

export const builderShell = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.panel,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.xl,
      boxShadow: foundationVars.shadow.card,
      display: 'grid',
      gap: '24px',
      padding: '24px'
    }
  }
})

export const section = style({
  '@layer': {
    [app]: {
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '18px',
      paddingTop: '22px'
    }
  }
})

export const sectionHeader = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
      justifyContent: 'space-between'
    }
  }
})

export const sectionTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1.25rem',
      fontWeight: 750,
      margin: 0
    }
  }
})

export const mutedText = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary
    }
  }
})

export const fieldGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '16px',
      gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
      '@media': {
        '(max-width: 760px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const stepFieldGroup = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '12px',
      selectors: {
        '& + &': {
          borderTop: `1px solid ${foundationVars.color.border.subtle}`,
          paddingTop: '18px'
        }
      }
    }
  }
})

export const stepFieldGroupTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1rem',
      fontWeight: 750,
      margin: 0
    }
  }
})

export const fieldSpan6 = style({
  '@layer': {
    [app]: {
      gridColumn: 'span 6',
      '@media': {
        '(max-width: 760px)': {
          gridColumn: '1'
        }
      }
    }
  }
})

export const fieldSpan4 = style({
  '@layer': {
    [app]: {
      gridColumn: 'span 4',
      '@media': {
        '(max-width: 760px)': {
          gridColumn: '1'
        }
      }
    }
  }
})

export const fieldSpan12 = style({
  '@layer': {
    [app]: {
      gridColumn: '1 / -1'
    }
  }
})

export const inlinePanel = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.subtle,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      display: 'grid',
      gap: '12px',
      padding: '16px'
    }
  }
})
