import { style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'

export const builderRoot = style({
  display: 'grid',
  gap: '24px'
})

export const builderHeader = style({
  display: 'flex',
  justifyContent: 'space-between',
  gap: '16px',
  alignItems: 'flex-start'
})

export const eyebrow = style({
  color: foundationVars.color.text.muted,
  fontSize: '0.85rem',
  fontWeight: 700,
  letterSpacing: '0.02em',
  textTransform: 'uppercase'
})

export const title = style({
  color: foundationVars.color.text.primary,
  fontSize: '2rem',
  lineHeight: 1.15,
  margin: 0
})

export const builderShell = style({
  background: foundationVars.color.surface.panel,
  border: `1px solid ${foundationVars.color.border.subtle}`,
  borderRadius: '20px',
  boxShadow: foundationVars.shadow.card,
  display: 'grid',
  gap: '24px',
  padding: '24px'
})

export const section = style({
  borderTop: `1px solid ${foundationVars.color.border.subtle}`,
  display: 'grid',
  gap: '18px',
  paddingTop: '22px'
})

export const sectionHeader = style({
  display: 'grid',
  gap: '4px'
})

export const sectionTitle = style({
  color: foundationVars.color.text.primary,
  fontSize: '1.25rem',
  fontWeight: 750,
  margin: 0
})

export const mutedText = style({
  color: foundationVars.color.text.secondary
})

export const modalCloseButton = style({
  minWidth: '44px',
  minHeight: '44px'
})

export const modalActionButton = style({
  minHeight: '44px'
})

export const fieldGrid = style({
  'display': 'grid',
  'gap': '16px',
  'gridTemplateColumns': 'repeat(12, minmax(0, 1fr))',
  '@media': {
    '(max-width: 760px)': {
      gridTemplateColumns: '1fr'
    }
  }
})

export const fieldSpan6 = style({
  'gridColumn': 'span 6',
  '@media': {
    '(max-width: 760px)': {
      gridColumn: '1'
    }
  }
})

export const fieldSpan4 = style({
  'gridColumn': 'span 4',
  '@media': {
    '(max-width: 760px)': {
      gridColumn: '1'
    }
  }
})

export const fieldSpan12 = style({
  gridColumn: '1 / -1'
})

export const inlinePanel = style({
  background: foundationVars.color.surface.subtle,
  border: `1px solid ${foundationVars.color.border.subtle}`,
  borderRadius: '14px',
  display: 'grid',
  gap: '12px',
  padding: '16px'
})
