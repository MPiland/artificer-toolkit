import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  CLOSED_RULE_KIND,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TRIGGER
} from '@artificer-toolkit/shared/core'
import { compileCreature, compileFeat, compileVehicle } from '@artificer-toolkit/shared/compilers'
import { backgroundAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/background'
import { classAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/class'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { featAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/feat'
import { raceAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/race'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import { vehicleAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/vehicle'

import { closedRuleEffect } from '../source-data/srd/closed-rule-effect.js'

import { srdBaselineContent } from '../source-data/srd/index.js'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stripHtml(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function collectManualInstructions(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectManualInstructions)
  if (!isRecord(value)) return []

  const own =
    value.effectKind === 'MANUAL_ADJUDICATION' && typeof value.instructions === 'string'
      ? [value.instructions]
      : []

  return [...own, ...Object.values(value).flatMap(collectManualInstructions)]
}

function normalizeSrdText(value: string): string {
  return stripHtml(value)
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&(?:rsquo|#39);/g, "'")
    .replace(/[Ã¢â‚¬ËœÃ¢â‚¬â„¢]/g, "'")
    .replace(/[Ã¢â‚¬ÂÃ¢â‚¬â€˜Ã¢â‚¬â€™Ã¢â‚¬â€œÃ¢â‚¬â€]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('SRD source data', () => {
  it('builds stable closed-rule mechanics with authored invocation intact', () => {
    const effect = closedRuleEffect({
      id: '00000000-0000-0000-0000-000000000001',
      invocation: {
        kind: 'PASSIVE',
        triggerCode: TRIGGER.ACTIVATED,
        range: {
          id: '00000000-0000-0000-0000-000000000002',
          rangeKind: RANGE_KIND.SELF
        }
      },
      ruleKind: CLOSED_RULE_KIND.GRAPPLER_PIN
    })

    expect(effect).toEqual(
      closedRuleEffect({
        id: effect.id,
        invocation: effect.invocation,
        ruleKind: CLOSED_RULE_KIND.GRAPPLER_PIN
      })
    )
    const path = effect.paths[0]
    expect(path?.groupType).toBe(PATH_GROUP_TYPE.SINGLE)
    expect(path?.selectionKind).toBe('FIXED')
    if (path?.selectionKind !== 'FIXED') {
      throw new Error('Expected closed-rule helper to create a single-result path')
    }
    expect(path.resultBlock.outcomes[0]).toMatchObject({
      effectKind: 'CLOSED_RULE',
      ruleKind: CLOSED_RULE_KIND.GRAPPLER_PIN
    })
  })

  it('keeps every manual-adjudication instruction verbatim from the tracked SRD', () => {
    const source = normalizeSrdText(
      readFileSync(new URL('../source-data/srd/SRD_CC_v5.1.txt', import.meta.url), 'utf8')
    )
    const mismatches = Object.values(srdBaselineContent.subjects)
      .flatMap((records) => records)
      .flatMap(collectManualInstructions)
      .filter((instructions) => !source.includes(normalizeSrdText(instructions)))

    expect(mismatches).toEqual([])
  })

  const authoredRootSchemaCases = [
    {
      domain: 'backgrounds',
      schema: backgroundAuthoredDtoSchema,
      records: srdBaselineContent.subjects.backgrounds
    },
    {
      domain: 'classes',
      schema: classAuthoredDtoSchema,
      records: srdBaselineContent.subjects.classes
    },
    {
      domain: 'creatures',
      schema: creatureAuthoredDtoSchema,
      records: srdBaselineContent.subjects.creatures
    },
    {
      domain: 'equipment',
      schema: equipmentAuthoredDtoSchema,
      records: srdBaselineContent.subjects.equipment
    },
    { domain: 'feats', schema: featAuthoredDtoSchema, records: srdBaselineContent.subjects.feats },
    { domain: 'races', schema: raceAuthoredDtoSchema, records: srdBaselineContent.subjects.races },
    {
      domain: 'spells',
      schema: spellAuthoredDtoSchema,
      records: srdBaselineContent.subjects.spells
    },
    {
      domain: 'vehicles',
      schema: vehicleAuthoredDtoSchema,
      records: srdBaselineContent.subjects.vehicles
    }
  ] as const

  it.each(authoredRootSchemaCases)(
    'round-trips every $domain authored root through its transport contract without loss',
    ({ schema, records }) => {
      for (const record of records) {
        expect(schema.parse(record)).toEqual(record)
      }
    },
    15_000
  )

  it('compiles every creature root', () => {
    for (const record of srdBaselineContent.subjects.creatures) {
      expect(compileCreature(record).id).toBe(record.id)
    }
  })

  it('compiles every feat root', () => {
    for (const record of srdBaselineContent.subjects.feats) {
      expect(compileFeat(record).id).toBe(record.id)
    }
  })

  it('compiles every vehicle root', () => {
    for (const record of srdBaselineContent.subjects.vehicles) {
      expect(compileVehicle(record).id).toBe(record.id)
    }
  })
})
