import { describe, expect, it } from 'vitest'

import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { barbarian } from '@artificer-toolkit/source-data/srd/classes/barbarian.js'
import { bard } from '@artificer-toolkit/source-data/srd/classes/bard.js'
import { cleric } from '@artificer-toolkit/source-data/srd/classes/cleric.js'
import { lifeDomainCleric } from '@artificer-toolkit/source-data/srd/classes/life-domain.js'
import { monk } from '@artificer-toolkit/source-data/srd/classes/monk.js'
import { paladin } from '@artificer-toolkit/source-data/srd/classes/paladin.js'
import { warlock } from '@artificer-toolkit/source-data/srd/classes/warlock.js'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { SRD_DAMAGE_TYPES, srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'

/**
 * SPELLS-31.T3a-T3c (D156): Fast Movement, Divine Strike, Purity of Body, Magical Secrets, Divine
 * Sense, Signature Spells, Empty Body, Devil's Sight, Gaze of Two Minds and Divine Intervention
 * resolve from the
 * same core options a Builder author has on a class feature or option, so each must pass the class
 * node map exactly as authored, as must a homebrew variant built from those options.
 */

const reader = createSrdNodeRuntimeReader()

function normalize(values: ClassAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'class',
    systemId: srdSystemRecord.id,
    values: structuredClone(values) as unknown as Record<string, unknown>
  })
}

function feature(record: ClassAuthored, label: string): FeatureAuthored {
  const found = record.features?.find((entry) => entry.label === label)
  if (!found) throw new Error(`${record.label} has no ${label}.`)
  return found
}

/** The authored nodes a case names: the features with its label, or one option of `parent`. */
function caseNodes(record: ClassAuthored, label: string, parent?: string) {
  return parent === undefined
    ? (record.features?.filter((entry) => entry.label === label) ?? [])
    : (feature(record, parent).options?.filter((entry) => entry.label === label) ?? [])
}

function option(record: ClassAuthored, parent: string, label: string) {
  const [found] = caseNodes(record, label, parent)
  if (!found) throw new Error(`${parent} has no ${label}.`)
  return found
}

/**
 * The Cleric without its starting equipment: the warhammer option's EQUIPMENT_PROFICIENCY
 * eligibility reads `proficiency_grant_equipment`, which the node runtime does not trust yet (a
 * separate defect), and the features this file proves do not depend on it.
 */
const { startingEquipment: _clericStartingEquipment, ...clericIntervention } = cleric

const fire = SRD_DAMAGE_TYPES.find(({ code }) => code === 'FIRE')!.id

/** Each SRD feature, and a homebrew variant authored from the same options. */
const CASES: ReadonlyArray<{
  record: ClassAuthored
  label: string
  /** The feature whose option this case is. */
  parent?: string
  variant: () => ClassAuthored
}> = [
  {
    record: barbarian,
    label: 'Fast Movement',
    variant: () => {
      const record = structuredClone(barbarian)
      const [speed] = feature(record, 'Fast Movement').grants?.modifiers ?? []
      if (speed?.valueDomainCode !== 'SPEED' || speed.modifierKind !== 'BONUS')
        throw new Error('Fast Movement must author a speed bonus.')
      speed.payload = { amount: 15, unit: 'FEET' }
      return record
    }
  },
  {
    record: lifeDomainCleric,
    label: 'Divine Strike',
    variant: () => {
      const record = structuredClone(lifeDomainCleric)
      for (const effect of feature(record, 'Divine Strike').effects ?? []) {
        const path = effect.paths[0]
        const damage = path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
        if (damage?.effectKind !== 'DAMAGE' || !('levels' in damage) || !damage.levels)
          throw new Error('Divine Strike must author level-scaled damage.')
        damage.damageTypeId = fire
        damage.levels = damage.levels.map((level) => ({ ...level, diceConfig: '1d6' }))
      }
      return record
    }
  },
  {
    record: monk,
    label: 'Purity of Body',
    variant: () => {
      const record = structuredClone(monk)
      const [poison] = feature(record, 'Purity of Body').grants?.modifiers ?? []
      if (poison?.valueDomainCode !== 'DAMAGE_IMMUNITY')
        throw new Error('Purity of Body must author a damage immunity.')
      poison.domain = { damageTypeId: fire }
      return record
    }
  },
  {
    record: bard,
    label: 'Magical Secrets',
    variant: () => {
      const record = structuredClone(bard)
      const [secrets] = feature(record, 'Magical Secrets').grants?.spells ?? []
      if (secrets?.selectionKind !== 'CHOSEN' || !('count' in secrets))
        throw new Error('Magical Secrets must be a flat chosen grant.')
      secrets.count = 3
      return record
    }
  },
  {
    record: paladin,
    label: 'Divine Sense',
    variant: () => {
      const record = structuredClone(paladin)
      const { charges } = feature(record, 'Divine Sense')
      if (charges?.limitKind !== 'FIXED_AMOUNT')
        throw new Error('Divine Sense must author a fixed charge with a bonus.')
      charges.amount = 2
      return record
    }
  },
  {
    record: wizard,
    label: 'Signature Spells',
    variant: () => {
      const record = structuredClone(wizard)
      const [signature] = feature(record, 'Signature Spells').grants?.spells ?? []
      if (!signature?.charges) throw new Error('Signature Spells must author limited-use charges.')
      signature.charges.resetKind = 'LONG_REST'
      return record
    }
  },
  {
    record: monk,
    label: 'Empty Body',
    variant: () => {
      const record = structuredClone(monk)
      const [effect] = feature(record, 'Empty Body').effects ?? []
      if (effect?.invocation.kind !== 'ACTION' || !effect.invocation.resourceUse)
        throw new Error('Empty Body must spend ki as an action.')
      effect.invocation.resourceUse.cost = 6
      return record
    }
  },
  {
    record: warlock,
    label: "Devil's Sight",
    parent: 'Eldritch Invocations',
    variant: () => {
      const record = structuredClone(warlock)
      const [sight] = option(record, 'Eldritch Invocations', "Devil's Sight").grants?.senses ?? []
      if (sight?.range?.rangeKind !== 'DISTANCE')
        throw new Error("Devil's Sight must author a ranged sense grant.")
      sight.range.amount = 60
      return record
    }
  },
  {
    record: warlock,
    label: 'Gaze of Two Minds',
    parent: 'Eldritch Invocations',
    variant: () => {
      const record = structuredClone(warlock)
      const [effect] = option(record, 'Eldritch Invocations', 'Gaze of Two Minds').effects ?? []
      const path = effect?.paths[0]
      if (path?.selectionKind !== 'FIXED')
        throw new Error('Gaze of Two Minds must author a fixed self path.')
      path.resultBlock.outcomes = path.resultBlock.outcomes.slice(0, 1)
      return record
    }
  },
  {
    record: clericIntervention,
    label: 'Divine Intervention',
    variant: () => {
      const record = structuredClone(clericIntervention)
      const { charges } = feature(record, 'Divine Intervention')
      if (charges?.limitKind !== 'FIXED_AMOUNT')
        throw new Error('Divine Intervention must author a fixed long-rest charge.')
      charges.amount = 2
      return record
    }
  }
]

describe('class features resolved from core options through the class node map (SPELLS-31.T3a-T3c)', () => {
  it.each(CASES)('keeps the SRD $label exactly as authored, with no closed rule', async (entry) => {
    const nodes = caseNodes(entry.record, entry.label, entry.parent)
    expect(nodes.length).toBeGreaterThan(0)
    expect(JSON.stringify(nodes)).not.toContain('CLOSED_RULE')
    const result = await normalize(entry.record)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(entry.record.features)
  })

  it.each(CASES)('keeps a homebrew $label variant the same way', async (entry) => {
    const authored = entry.variant()
    expect(authored.features).not.toEqual(entry.record.features)
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
  })
})
