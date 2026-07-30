import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'
import * as authoredDetailStyles from '../../components/AuthoredDetail/AuthoredDetail.css'
import * as contextCardStyles from '../../ui/components/ContextCard/ContextCard.css'

export const root = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 0
    }
  }
})

export const previewIdentity = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[1],
      padding: foundationVars.space[3],
      borderBlockEnd: `1px solid ${foundationVars.color.authoring.border}`,
      backgroundColor: foundationVars.color.authoring.header
    }
  }
})

export const previewStatus = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.accent,
      fontSize: '11px',
      fontWeight: foundationVars.fontWeight.bold,
      letterSpacing: '0.05em',
      lineHeight: '16px',
      textTransform: 'uppercase'
    }
  }
})

export const previewTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontFamily: foundationVars.font.display,
      fontSize: '20px',
      fontWeight: foundationVars.fontWeight.bold,
      letterSpacing: '-0.02em',
      lineHeight: '25px'
    }
  }
})

export const equipmentHero = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: '6.5rem minmax(0, 1fr)',
      alignItems: 'start',
      gap: foundationVars.space[3],
      padding: `${foundationVars.space[3]} ${foundationVars.space[3]} 0`,
      borderBlockEnd: `1px solid ${foundationVars.color.authoring.border}`
    }
  }
})

export const equipmentVisual = style({
  '@layer': {
    [app]: {
      display: 'grid',
      placeItems: 'center',
      inlineSize: '6.5rem',
      blockSize: '8.5rem',
      border: `1px solid ${foundationVars.color.authoring.previewBorder}`,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.authoring.header,
      color: foundationVars.color.text.accent
    }
  }
})

export const equipmentIdentity = style({
  '@layer': {
    [app]: {
      display: 'grid',
      alignContent: 'start',
      gap: foundationVars.space[1],
      minInlineSize: 0
    }
  }
})

export const equipmentMeta = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '12px',
      lineHeight: '18px'
    }
  }
})

export const equipmentQuote = style({
  '@layer': {
    [app]: {
      margin: `${foundationVars.space[2]} 0 0`,
      color: foundationVars.color.text.muted,
      fontSize: '13px',
      fontStyle: 'italic',
      lineHeight: '19px'
    }
  }
})

export const rows = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 0,
      margin: 0
    }
  }
})

export const equipmentStats = style([
  rows,
  {
    '@layer': {
      [app]: {
        gridColumn: '1 / -1',
        borderBlockStart: `1px solid ${foundationVars.color.authoring.border}`
      }
    }
  }
])

export const equipmentProse = style({
  '@layer': {
    [app]: {
      padding: foundationVars.space[4],
      borderBlockEnd: `1px solid ${foundationVars.color.authoring.border}`,
      color: foundationVars.color.text.secondary,
      fontSize: '13px',
      lineHeight: '20px'
    }
  }
})

globalStyle(`${equipmentProse} p`, {
  marginBlock: 0
})

export const row = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(5.5rem, 0.8fr) minmax(0, 1.2fr)',
      gap: foundationVars.space[3],
      minWidth: 0,
      paddingBlock: foundationVars.space[2],
      borderBottom: `1px solid ${foundationVars.color.authoring.border}`,

      ':last-child': {
        borderBottom: 0
      }
    }
  }
})

export const rowLabel = style({
  '@layer': {
    [app]: {
      minWidth: 0,
      color: foundationVars.color.text.dim,
      fontSize: '12px',
      fontWeight: foundationVars.fontWeight.bold,
      lineHeight: '16px',
      overflowWrap: 'anywhere'
    }
  }
})

export const rowValue = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: '13px',
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: '18px',
      overflowWrap: 'anywhere'
    }
  }
})

globalStyle(`${root} > ${contextCardStyles.root}`, {
  border: 0,
  borderRadius: 0,
  borderBlockEnd: `1px solid ${foundationVars.color.authoring.border}`,
  backgroundColor: 'transparent'
})

globalStyle(`${root} > ${contextCardStyles.root}:last-child`, {
  borderBlockEnd: 0
})

globalStyle(`${root} ${contextCardStyles.header}`, {
  padding: `${foundationVars.space[4]} ${foundationVars.space[4]} ${foundationVars.space[2]}`
})

globalStyle(`${root} ${contextCardStyles.title}`, {
  color: foundationVars.color.accent.tertiarySolid,
  fontSize: '12px',
  letterSpacing: '0.05em',
  textTransform: 'uppercase'
})

globalStyle(`${root} ${contextCardStyles.body}`, {
  padding: `0 ${foundationVars.space[4]} ${foundationVars.space[4]}`
})

globalStyle(`${root} ${authoredDetailStyles.itemList}`, {
  gap: foundationVars.space[4]
})

globalStyle(`${root} ${authoredDetailStyles.itemTitle}`, {
  fontSize: foundationVars.typography.bodySm.fontSize,
  lineHeight: foundationVars.typography.bodySm.lineHeight
})

globalStyle(`${root} ${authoredDetailStyles.prose}`, {
  fontSize: foundationVars.typography.bodySm.fontSize,
  lineHeight: foundationVars.typography.bodySm.lineHeight
})

export const singleRowValue = style([rowValue])

export const chips = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: foundationVars.space[1]
    }
  }
})

export const chip = style({
  '@layer': {
    [app]: {
      padding: `2px ${foundationVars.space[2]}`,
      border: `1px solid ${foundationVars.color.authoring.border}`,
      borderRadius: foundationVars.radius.pill,
      backgroundColor: foundationVars.color.authoring.row,
      color: foundationVars.color.text.secondary,
      fontSize: '12px',
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: '18px'
    }
  }
})

export const damageList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2]
    }
  }
})

export const damageItem = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[2],
      padding: foundationVars.space[2],
      border: `1px solid ${foundationVars.color.authoring.border}`,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.authoring.row
    }
  }
})

export const damageAmountBase = style({
  '@layer': {
    [app]: {
      fontFamily: foundationVars.font.mono,
      fontSize: '13px',
      fontWeight: foundationVars.fontWeight.bold,
      lineHeight: '18px'
    }
  }
})

export const damageLabel = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '12px',
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: '18px'
    }
  }
})

export const damageAmount = {
  acid: style([damageAmountBase, { color: foundationVars.color.damage.acid }]),
  bludgeoning: style([damageAmountBase, { color: foundationVars.color.damage.bludgeoning }]),
  cold: style([damageAmountBase, { color: foundationVars.color.damage.cold }]),
  fire: style([damageAmountBase, { color: foundationVars.color.damage.fire }]),
  force: style([damageAmountBase, { color: foundationVars.color.damage.force }]),
  lightning: style([damageAmountBase, { color: foundationVars.color.damage.lightning }]),
  necrotic: style([damageAmountBase, { color: foundationVars.color.damage.necrotic }]),
  neutral: style([damageAmountBase, { color: foundationVars.color.text.primary }]),
  piercing: style([damageAmountBase, { color: foundationVars.color.damage.piercing }]),
  poison: style([damageAmountBase, { color: foundationVars.color.damage.poison }]),
  psychic: style([damageAmountBase, { color: foundationVars.color.damage.psychic }]),
  radiant: style([damageAmountBase, { color: foundationVars.color.damage.radiant }]),
  slashing: style([damageAmountBase, { color: foundationVars.color.damage.slashing }]),
  thunder: style([damageAmountBase, { color: foundationVars.color.damage.thunder }])
} as const
