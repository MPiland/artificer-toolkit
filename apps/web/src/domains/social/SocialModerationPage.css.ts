import { style } from '@vanilla-extract/css'
import { foundationVars, media } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

const portrait = 'screen and (max-width: 64rem) and (orientation: portrait)'

export const page = style({
  '@layer': {
    [app]: {
      boxSizing: 'border-box',
      display: 'grid',
      alignContent: 'start',
      gap: foundationVars.space[5],
      inlineSize: '100%',
      maxInlineSize: '76rem',
      marginInline: 'auto'
    }
  }
})

export const headerCopy = style({
  '@layer': { [app]: { display: 'grid', gap: foundationVars.space[1], maxInlineSize: '68ch' } }
})

export const detailGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1.65fr) minmax(16rem, 0.75fr)',
      alignItems: 'start',
      gap: foundationVars.space[4],
      '@media': { [portrait]: { gridTemplateColumns: '1fr' } }
    }
  }
})

export const rows = style({
  '@layer': { [app]: { display: 'grid', gap: foundationVars.space[3] } }
})

export const panel = style({
  '@layer': {
    [app]: {
      display: 'grid',
      alignContent: 'start',
      gap: foundationVars.space[4],
      padding: foundationVars.space[5],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      background: foundationVars.color.surface.panel,
      '@media': { [media.mobile]: { padding: foundationVars.space[4] } }
    }
  }
})

export const prose = style({
  '@layer': {
    [app]: {
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
      color: foundationVars.color.text.secondary
    }
  }
})

export const evidence = style({
  '@layer': {
    [app]: {
      maxBlockSize: '22rem',
      overflow: 'auto',
      padding: foundationVars.space[3],
      borderRadius: foundationVars.radius.md,
      background: foundationVars.color.surface.recessed,
      color: foundationVars.color.text.primary,
      fontFamily: foundationVars.font.mono,
      fontSize: foundationVars.typography.caption.fontSize,
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere'
    }
  }
})
