import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'

export const root = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3]
    }
  }
})

export const facts = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: foundationVars.space[2],
      margin: 0
    }
  }
})

export const fact = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '2px',
      minWidth: 0,
      padding: foundationVars.space[2],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.surface.recessed
    }
  }
})

export const factLabel = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.dim,
      fontSize: '11px',
      fontWeight: foundationVars.fontWeight.bold,
      lineHeight: '15px'
    }
  }
})

export const factValue = style({
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
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.pill,
      backgroundColor: foundationVars.color.surface.recessed,
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
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.surface.recessed
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
