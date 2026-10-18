import { describe, expect, it } from 'vitest'

import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { SRD_DAMAGE_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { encounterActionChoiceTarget } from '../encounterAreaAction.js'
import { planEncounterPlacedZone } from '../encounterPlacedZone.js'
import { chosenZonePlacement } from '../encounterZonePlacement.js'
import { DND5E_SAVE_DC_FACT_KEY } from '../systems/dnd5e/effectActionCompiler.js'
import {
  compileItemEntry,
  extraId,
  variantEquipment,
  type ZoneParts
} from '../testing/authoredZoneFixture.js'
import { carryingFireShield, shieldOutcomes, shields } from '../testing/fireShieldZoneFixture.js'

/**
 * SPELLS-20 T4e (D140): an ON_USE CHOICE whose every option places one zone compiles to a cast-time
 * pick between those zones. Proved on a Caltrops variant authored from core options, not on any spell.
 */

const SHARP_ID = extraId(0x101)
const SHARPER_ID = extraId(0x102)

/** A copy with every authored `id` inside it renamed, so the two picks never share an identity. */
function reidentified<T>(value: T, offset: number): T {
  let next = offset
  return JSON.parse(JSON.stringify(value), (key, item: unknown) =>
    key === 'id' && typeof item === 'string' ? extraId(next++) : item
  ) as T
}

/** The Caltrops variant whose use picks its own zone or the zone `changeSecond` authors. */
function pickBetween(changeSecond: (parts: ZoneParts) => void): EquipmentAuthored {
  const equipment = variantEquipment(() => {})
  const effect = equipment.effects?.[0]
  const path = effect?.paths[0]
  const secondPath = variantEquipment(changeSecond).effects?.[0]?.paths[0]
  if (!effect || path?.selectionKind !== 'FIXED' || secondPath?.selectionKind !== 'FIXED')
    throw new Error('Caltrops must author one zone path.')
  const { resultBlock, ...shared } = path
  effect.paths[0] = {
    ...shared,
    groupType: 'CHOICE',
    selectionKind: 'CHOICE',
    options: [
      { id: SHARP_ID, order: 1, label: 'Sharp', resultBlock },
      {
        id: SHARPER_ID,
        order: 2,
        label: 'Sharper',
        resultBlock: reidentified(secondPath.resultBlock, 0x110)
      }
    ]
  }
  return equipment
}

const harderSave = ({ invocation }: ZoneParts) => {
  const { id, abilityDefinitionId } = invocation.savingThrow
  invocation.savingThrow = { id, abilityDefinitionId, dcMethod: 'FIXED_DC', baseDc: 18 }
}

/** The pick compiled through the real policy and entry compiler, required to compile. */
function compiledPick(changeSecond: (parts: ZoneParts) => void) {
  const entry = compileItemEntry(pickBetween(changeSecond))
  if (entry.schemaVersion !== 4 || entry.compilation.kind !== 'COMPILED')
    throw new Error('The pick must compile to a v4 entry.')
  return { entry, compilation: entry.compilation }
}

describe('a cast-time pick between zones (SPELLS-20 T4e, D140)', () => {
  it('compiles one zone per option, each keeping its own save', () => {
    const placement = compiledPick(harderSave).compilation.zonePlacement
    if (!placement) throw new Error('The pick must place a zone.')

    expect(chosenZonePlacement(placement, SHARP_ID)?.entry.adapterFacts).toMatchObject({
      [DND5E_SAVE_DC_FACT_KEY]: 15
    })
    expect(chosenZonePlacement(placement, SHARPER_ID)?.entry.adapterFacts).toMatchObject({
      [DND5E_SAVE_DC_FACT_KEY]: 18
    })
    expect(chosenZonePlacement(placement, undefined)).toBeNull()
    expect(chosenZonePlacement(placement, extraId(0x1ff))).toBeNull()
  })

  it('offers the options by label, each aimed at a point (D154)', () => {
    const { entry, compilation } = compiledPick(harderSave)
    const point = {
      kind: 'POINT',
      area: { kind: 'CUBE', edgeLength: { amount: 5, unit: 'FEET' } }
    }

    expect(
      encounterActionChoiceTarget(entry.targetPolicy, null, compilation.zonePlacement)
    ).toEqual({
      kind: 'ZONE_OPTIONS',
      options: [
        { id: SHARP_ID, label: 'Sharp', target: point },
        { id: SHARPER_ID, label: 'Sharper', target: point }
      ]
    })
  })

  it('aims each option at its own area when the zones cover different areas (D154)', () => {
    const { entry, compilation } = compiledPick(({ zone }) => {
      zone.shape = {
        id: zone.shape!.id,
        shapeKind: 'CUBE',
        edgeLength: { amount: 10, unit: 'FEET' }
      }
    })

    expect(
      encounterActionChoiceTarget(entry.targetPolicy, null, compilation.zonePlacement)
    ).toMatchObject({
      kind: 'ZONE_OPTIONS',
      options: [
        { id: SHARP_ID, target: { kind: 'POINT', area: { edgeLength: { amount: 5 } } } },
        { id: SHARPER_ID, target: { kind: 'POINT', area: { edgeLength: { amount: 10 } } } }
      ]
    })
  })
})

const damageType = (code: string) => SRD_DAMAGE_TYPES.find((type) => type.code === code)!.id

/** What a shield's zone does: the dice it rolls, their damage type and the grant its caster holds. */
function shieldEffect({ zone }: ReturnType<typeof shields>[number]) {
  const { nodes } = zone.entry.frozenGraph.definition
  return {
    dice: nodes
      .filter((node) => node.operation.key === 'evidence.integer-range')
      .map((node) => node.inputs.max),
    damageTypes: nodes.flatMap(({ inputs }) => (inputs.damageTypeId ? [inputs.damageTypeId] : [])),
    grant: zone.sourceGrant && {
      initialRemaining: zone.sourceGrant.initialRemaining,
      modifiers: zone.sourceGrant.modifierGrantContribution?.modifiers
    }
  }
}

describe('Fire Shield: a cast-time pick between shields that burn a melee attacker (SPELLS-20 T6d1, D153)', () => {
  it('compiles each shield to a 5 ft zone on its caster answering only melee hits, lasting the Run', () => {
    const picked = shields(carryingFireShield())
    expect(picked.map(({ label }) => label)).toEqual(['Warm shield', 'Chill shield'])
    for (const { zone } of picked) {
      expect(zone).toMatchObject({
        attachment: 'SOURCE',
        shape: { shapeKind: 'SPHERE', radius: { amount: 5, unit: 'FEET' } },
        triggerModes: [],
        retaliatesMeleeHits: true,
        maintenance: null,
        grant: null
      })
      expect(zone).not.toHaveProperty('turnTriggers')
    }
  })

  it('places each shield on its caster’s token, answering melee hits and nothing else (T6d2a)', () => {
    const casterToken = { tokenId: extraId(0x1c1), width: 100 }
    for (const { zone } of shields(carryingFireShield())) {
      const { placement } = planEncounterPlacedZone({
        zone,
        id: extraId(0x1c2),
        maintainedEffectStateId: null,
        encounterId: extraId(0x1c3),
        occurrenceId: extraId(0x1c4),
        rootCommandId: extraId(0x1c5),
        sourceActorId: extraId(0x1c6),
        point: { x: 500, y: 500 },
        area: { kind: 'RADIUS', radius: 100 },
        sourceToken: casterToken,
        saveDc: null
      })
      expect(placement).toMatchObject({
        anchorKind: 'TOKEN',
        sourceTokenId: casterToken.tokenId,
        triggerModes: [],
        retaliatesMeleeHits: true
      })
      expect(placement).not.toHaveProperty('turnTriggers')
    }
  })

  it('burns with 2d8 of the shield’s element and gives its caster ten minutes of resistance to the other', () => {
    const [warm, chill] = shields(carryingFireShield()).map(shieldEffect)
    for (const [shield, eruption, resistance] of [
      [warm, 'FIRE', 'COLD'],
      [chill, 'COLD', 'FIRE']
    ] as const) {
      expect(shield?.dice).toEqual([
        { kind: 'LITERAL', value: 8 },
        { kind: 'LITERAL', value: 8 }
      ])
      expect(shield?.damageTypes).toEqual([{ kind: 'LITERAL', value: damageType(eruption) }])
      expect(shield?.grant).toEqual({
        initialRemaining: 100,
        modifiers: [expect.objectContaining({ payload: { damageTypeId: damageType(resistance) } })]
      })
    }
  })

  it('compiles a shield authored from the same core options with another radius, dice, element and resistance the same way (ADR 0038)', () => {
    const [warm] = shields(
      carryingFireShield((effects) => {
        const [zone, grant] = shieldOutcomes(effects)[0]!
        if (
          zone?.effectKind !== 'MANIFEST' ||
          zone.manifestKind !== 'ZONE' ||
          grant?.effectKind !== 'APPLY_GRANT'
        )
          throw new Error('Each shield authors a zone and a grant.')
        const radius = { amount: 10, unit: 'FEET' as const }
        const invocationShape = effects[0]!.invocation.shape
        if (invocationShape?.shapeKind !== 'SPHERE' || zone.shape?.shapeKind !== 'SPHERE')
          throw new Error('The shield authors a sphere.')
        effects[0]!.invocation.shape = { ...invocationShape, radius }
        for (const outcomes of shieldOutcomes(effects)) {
          const shieldZone = outcomes[0]
          if (shieldZone?.effectKind === 'MANIFEST' && shieldZone.shape?.shapeKind === 'SPHERE')
            shieldZone.shape = { ...shieldZone.shape, radius }
        }
        const damagePath = zone.components?.[0]?.behaviors?.[0]?.paths[0]
        const damage =
          damagePath?.selectionKind === 'FIXED' ? damagePath.resultBlock.outcomes[0] : undefined
        if (damage?.effectKind !== 'DAMAGE' || !('diceConfig' in damage))
          throw new Error('The shield deals dice.')
        damage.diceConfig = '3d6'
        damage.damageTypeId = damageType('LIGHTNING')
        grant.grants!.modifiers![0]!.payload = { damageTypeId: damageType('ACID') }
      })
    )
    expect(warm?.zone).toMatchObject({
      attachment: 'SOURCE',
      shape: { radius: { amount: 10 } },
      retaliatesMeleeHits: true
    })
    expect(shieldEffect(warm!)).toEqual({
      dice: [
        { kind: 'LITERAL', value: 6 },
        { kind: 'LITERAL', value: 6 },
        { kind: 'LITERAL', value: 6 }
      ],
      damageTypes: [{ kind: 'LITERAL', value: damageType('LIGHTNING') }],
      grant: {
        initialRemaining: 100,
        modifiers: [expect.objectContaining({ payload: { damageTypeId: damageType('ACID') } })]
      }
    })
  })

  it('gives the caster no grant from a shield authored without one', () => {
    const picked = shields(
      carryingFireShield((effects) => {
        for (const outcomes of shieldOutcomes(effects)) outcomes.splice(1)
      })
    )
    for (const { zone } of picked) expect(zone).not.toHaveProperty('sourceGrant')
  })

  it.each([
    ['two grants', (outcomes: unknown[]) => outcomes.push(structuredClone(outcomes[1]))],
    [
      'an outcome other than a grant',
      (outcomes: unknown[]) =>
        outcomes.splice(1, 1, {
          id: extraId(0x1b0),
          effectKind: 'ACTION_ECONOMY_RULE',
          ruleKind: 'LOSE_ACTION'
        })
    ]
  ])('places no zone beside %s', (_name, change) => {
    const entry = compileItemEntry(
      carryingFireShield((effects) => {
        for (const outcomes of shieldOutcomes(effects)) change(outcomes)
      })
    )
    expect(
      entry.schemaVersion === 4 &&
        entry.compilation.kind === 'COMPILED' &&
        entry.compilation.zonePlacement
    ).toBeFalsy()
  })
})
