import type { ChargeAuthored } from '#authored'
import { SPELL_GRANT_ATTRIBUTE_REGISTRY } from '#core'
import type { NodeMap } from '#util'

export type SpellGrantNodePayloads = {
  limitedUse: ChargeAuthored
  castAtLevel: { level: number }
}

export const SPELL_GRANT_NODE_MAP: NodeMap<SpellGrantNodePayloads> = {
  limitedUse: {
    kind: 'LEAF',
    meta: SPELL_GRANT_ATTRIBUTE_REGISTRY.LIMITED_USE,
    payload: 'limitedUse'
  },
  castAtLevel: {
    kind: 'LEAF',
    meta: SPELL_GRANT_ATTRIBUTE_REGISTRY.CAST_AT_LEVEL,
    payload: 'castAtLevel'
  },
  concentration: {
    kind: 'KNOT',
    meta: SPELL_GRANT_ATTRIBUTE_REGISTRY.CONCENTRATION
  },
  ritual: {
    kind: 'KNOT',
    meta: SPELL_GRANT_ATTRIBUTE_REGISTRY.RITUAL
  },
  selfOnly: {
    kind: 'KNOT',
    meta: SPELL_GRANT_ATTRIBUTE_REGISTRY.SELF_ONLY
  },
  castAtWill: {
    kind: 'KNOT',
    meta: SPELL_GRANT_ATTRIBUTE_REGISTRY.CAST_AT_WILL
  },
  prepared: {
    kind: 'KNOT',
    meta: SPELL_GRANT_ATTRIBUTE_REGISTRY.PREPARED
  },
  known: {
    kind: 'KNOT',
    meta: SPELL_GRANT_ATTRIBUTE_REGISTRY.KNOWN
  }
}
