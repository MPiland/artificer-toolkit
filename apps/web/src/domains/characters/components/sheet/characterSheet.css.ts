import { style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'

export const shell = style({
  display: 'grid',
  gap: '22px'
})

export const hero = style({
  'background': foundationVars.color.surface.panel,
  'border': `1px solid ${foundationVars.color.border.subtle}`,
  'borderRadius': '24px',
  'boxShadow': foundationVars.shadow.card,
  'display': 'grid',
  'gap': '18px',
  'gridTemplateColumns': 'minmax(0, 1fr) auto',
  'padding': '24px',
  '@media': {
    '(max-width: 760px)': {
      gridTemplateColumns: '1fr'
    }
  }
})

export const eyebrow = style({
  color: foundationVars.color.text.muted,
  fontSize: '0.78rem',
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase'
})

export const heroTitle = style({
  color: foundationVars.color.text.primary,
  fontSize: 'clamp(2rem, 4vw, 3.4rem)',
  lineHeight: 1,
  margin: 0
})

export const heroMeta = style({
  color: foundationVars.color.text.secondary,
  fontSize: '1rem',
  lineHeight: 1.45,
  maxWidth: '70ch'
})

export const heroActions = style({
  'alignItems': 'flex-end',
  'display': 'flex',
  'flexDirection': 'column',
  'gap': '10px',
  '@media': {
    '(max-width: 760px)': {
      alignItems: 'stretch'
    }
  }
})

export const statDock = style({
  'display': 'grid',
  'gap': '12px',
  'gridTemplateColumns': 'repeat(4, minmax(0, 1fr))',
  '@media': {
    '(max-width: 920px)': {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
    },
    '(max-width: 520px)': {
      gridTemplateColumns: '1fr'
    }
  }
})

export const statTile = style({
  background: foundationVars.color.surface.subtle,
  border: `1px solid ${foundationVars.color.border.subtle}`,
  borderRadius: '18px',
  display: 'grid',
  gap: '4px',
  padding: '16px'
})

export const statValue = style({
  color: foundationVars.color.text.primary,
  fontSize: '1.65rem',
  fontWeight: 800,
  lineHeight: 1
})

export const statLabel = style({
  color: foundationVars.color.text.muted,
  fontSize: '0.78rem',
  fontWeight: 750,
  letterSpacing: '0.03em',
  textTransform: 'uppercase'
})

export const contentGrid = style({
  'display': 'grid',
  'gap': '18px',
  'gridTemplateColumns': 'minmax(0, 1fr) 340px',
  '@media': {
    '(max-width: 1080px)': {
      gridTemplateColumns: '1fr'
    }
  }
})

export const panel = style({
  background: foundationVars.color.surface.panel,
  border: `1px solid ${foundationVars.color.border.subtle}`,
  borderRadius: '18px',
  display: 'grid',
  gap: '16px',
  padding: '18px'
})

export const panelHeader = style({
  display: 'flex',
  gap: '12px',
  justifyContent: 'space-between',
  alignItems: 'flex-start'
})

export const panelTitle = style({
  color: foundationVars.color.text.primary,
  fontSize: '1.15rem',
  fontWeight: 800,
  margin: 0
})

export const muted = style({
  color: foundationVars.color.text.secondary
})

export const abilityGrid = style({
  'display': 'grid',
  'gap': '10px',
  'gridTemplateColumns': 'repeat(6, minmax(0, 1fr))',
  '@media': {
    '(max-width: 760px)': {
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'
    },
    '(max-width: 480px)': {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
    }
  }
})

export const abilityTile = style({
  border: `1px solid ${foundationVars.color.border.subtle}`,
  borderRadius: '14px',
  display: 'grid',
  gap: '2px',
  padding: '12px',
  textAlign: 'center'
})

export const rowList = style({
  display: 'grid',
  gap: '10px'
})

export const row = style({
  'alignItems': 'center',
  'border': `1px solid ${foundationVars.color.border.subtle}`,
  'borderRadius': '14px',
  'display': 'grid',
  'gap': '12px',
  'gridTemplateColumns': 'minmax(0, 1fr) auto',
  'padding': '12px',
  '@media': {
    '(max-width: 620px)': {
      alignItems: 'stretch',
      gridTemplateColumns: '1fr'
    }
  }
})

export const inlineEditorShell = style({
  gridColumn: '1 / -1'
})

export const inlineEditor = style({
  display: 'grid',
  gap: '12px'
})

export const compactActions = style({
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
  justifyContent: 'flex-end'
})

export const hpControls = style({
  'display': 'grid',
  'gap': '12px',
  'gridTemplateColumns': 'repeat(3, minmax(0, 1fr))',
  '@media': {
    '(max-width: 760px)': {
      gridTemplateColumns: '1fr'
    }
  }
})

export const sidebar = style({
  display: 'grid',
  gap: '18px',
  alignContent: 'start'
})
