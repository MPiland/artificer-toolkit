import { describe, expect, it } from 'vitest'

import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import type { EffectPathAuthored } from '@artificer-toolkit/shared/authored'
import {
  compileSpell,
  type CompiledEffect,
  type CompiledEffectEntry
} from '@artificer-toolkit/shared/compilers'
import { cloneAuthoredItem } from '@artificer-toolkit/shared/utils'

import { createEffectRepository } from '../repositories/index.js'
import { SRD_SYSTEM_ID } from '../source-data/srd/vocabulary.js'
import { acidArrow } from '../source-data/srd/spells/acid-arrow.js'
import { aid } from '../source-data/srd/spells/aid.js'
import { astralProjection } from '../source-data/srd/spells/astral-projection.js'
import { barkskin } from '../source-data/srd/spells/barkskin.js'
import { bladeBarrier } from '../source-data/srd/spells/blade-barrier.js'
import { eldritchBlast } from '../source-data/srd/spells/eldritch-blast.js'
import { fleshToStone } from '../source-data/srd/spells/flesh-to-stone.js'
import { continualFlame } from '../source-data/srd/spells/continual-flame.js'
import { irresistibleDance } from '../source-data/srd/spells/irresistible-dance.js'
import { maze } from '../source-data/srd/spells/maze.js'
import { phantasmalKiller } from '../source-data/srd/spells/phantasmal-killer.js'
import { planarBinding } from '../source-data/srd/spells/planar-binding.js'
import { protectionFromEnergy } from '../source-data/srd/spells/protection-from-energy.js'
import { spareTheDying } from '../source-data/srd/spells/spare-the-dying.js'
import { spiritualWeapon } from '../source-data/srd/spells/spiritual-weapon.js'
import { stinkingCloud } from '../source-data/srd/spells/stinking-cloud.js'
import { sunburst } from '../source-data/srd/spells/sunburst.js'
import { telepathicBond } from '../source-data/srd/spells/telepathic-bond.js'
import { transportViaPlants } from '../source-data/srd/spells/transport-via-plants.js'
import { treeStride } from '../source-data/srd/spells/tree-stride.js'
import { weird } from '../source-data/srd/spells/weird.js'
import { InMemoryDb } from './helpers/in-memory-db.js'

function isResolvedEntry(entry: CompiledEffectEntry): entry is CompiledEffect {
  return entry.resolutionKind !== 'ROLL_TABLE_REPEAT'
}

function isFixedPath(
  path: EffectPathAuthored
): path is Extract<EffectPathAuthored, { selectionKind: 'FIXED' }> {
  return path.selectionKind === 'FIXED'
}

describe('SRD spell semantic mechanics', () => {
  it('compiles Acid Arrow hit, miss, delayed damage, and slot scaling', () => {
    expect(spellAuthoredDtoSchema.safeParse(acidArrow).success).toBe(true)

    const entries = (compileSpell(acidArrow).effects?.[0]?.entries ?? []).filter(isResolvedEntry)
    const initialDamage = entries.find(
      (entry) =>
        entry.pathCode === 'ON_HIT' &&
        entry.outcome.effectKind === 'DAMAGE' &&
        'level' in entry.outcome &&
        entry.outcome.level === 2
    )
    expect(initialDamage?.outcome).toMatchObject({ dice: '4d4' })

    const missDamage = entries.find(
      (entry) =>
        entry.pathCode === 'ON_MISS' &&
        entry.outcome.effectKind === 'DAMAGE' &&
        'level' in entry.outcome &&
        entry.outcome.level === 2
    )
    expect(missDamage?.outcome).toMatchObject({ dice: '4d4', amountKind: 'HALF' })

    const lingeringAcid = entries.find(
      (entry) => entry.pathCode === 'ON_HIT' && entry.outcome.effectKind === 'MANIFEST'
    )
    expect(lingeringAcid?.outcome).toMatchObject({ attachmentKind: 'PRIMARY_TARGET' })
    if (
      !lingeringAcid ||
      lingeringAcid.outcome.effectKind !== 'MANIFEST' ||
      lingeringAcid.outcome.manifestKind !== 'OBJECT'
    ) {
      throw new Error('Acid Arrow is missing its lingering acid manifest.')
    }
    const delayedEntries = lingeringAcid.outcome.components?.[0]?.behaviors?.[0]?.entries ?? []
    expect(lingeringAcid.outcome.components?.[0]?.interactionKind).toBe(
      'END_OF_ATTACHED_TARGET_NEXT_TURN'
    )
    expect(
      delayedEntries
        .filter(isResolvedEntry)
        .some(
          (entry) =>
            entry.outcome.effectKind === 'DAMAGE' &&
            'level' in entry.outcome &&
            'dice' in entry.outcome &&
            entry.outcome.level === 2 &&
            entry.outcome.dice === '2d4'
        )
    ).toBe(true)
  })

  it('compiles Flesh to Stone thresholds, petrification, and duration completion', () => {
    expect(spellAuthoredDtoSchema.safeParse(fleshToStone).success).toBe(true)

    const followUp = compileSpell(fleshToStone)
      .effects?.[0]?.entries.filter(isResolvedEntry)
      .find((entry) => entry.outcome.effectKind === 'FOLLOW_UP_SAVE')
    expect(followUp?.outcome).toMatchObject({
      timing: 'TARGET_TURN_END',
      attempts: {
        kind: 'THRESHOLDS',
        successesToEnd: 3,
        failuresToResolve: 3,
        consecutive: false
      },
      onFailure: {
        kind: 'OUTCOMES',
        outcomes: [expect.objectContaining({ effectKind: 'CONDITION' })]
      },
      onDurationComplete: {
        kind: 'OUTCOMES',
        endCurrent: true,
        outcomes: [expect.objectContaining({ effectKind: 'CONDITION' })]
      }
    })
  })

  it('round-trips new authored outcomes and remaps their nested owned IDs when cloned', async () => {
    const db = new InMemoryDb()
    const repository = createEffectRepository(db as never, SRD_SYSTEM_ID)

    for (const spell of [acidArrow, fleshToStone]) {
      const effect = spell.effects?.[0]
      if (!effect) throw new Error(`${spell.label} is missing its audited effect.`)

      await repository.upsert(effect)
      await expect(repository.findById(effect.id)).resolves.toEqual(effect)
    }

    const clone = cloneAuthoredItem(acidArrow)
    expect(spellAuthoredDtoSchema.safeParse(clone).success).toBe(true)
    expect(clone.effects?.[0]?.id).not.toBe(acidArrow.effects?.[0]?.id)
    const sourceHit = acidArrow.effects?.[0]?.paths
      .filter(isFixedPath)
      .find((path) => path.pathCode === 'ON_HIT')
    const cloneHit = clone.effects?.[0]?.paths
      .filter(isFixedPath)
      .find((path) => path.pathCode === 'ON_HIT')
    expect(cloneHit?.resultBlock.outcomes[1]?.id).not.toBe(sourceHit?.resultBlock.outcomes[1]?.id)
  })

  it('compiles Spare the Dying as stabilization with its SRD exclusions', () => {
    expect(spellAuthoredDtoSchema.safeParse(spareTheDying).success).toBe(true)
    const compiled = compileSpell(spareTheDying).effects?.[0]

    expect(compiled?.invocation.targeting).toMatchObject({
      selectionKind: 'SINGLE_TARGET',
      excludedCreatureTypeIds: expect.arrayContaining([expect.any(String), expect.any(String)])
    })
    expect(compiled?.entries.filter(isResolvedEntry)[0]?.outcome).toMatchObject({
      effectKind: 'STABILIZE'
    })
  })

  it('preserves Phantasmal Killer recurring saves and scaled damage', async () => {
    expect(spellAuthoredDtoSchema.safeParse(phantasmalKiller).success).toBe(true)
    const effect = phantasmalKiller.effects?.[0]
    if (!effect) throw new Error('Phantasmal Killer is missing its audited effect.')

    const followUp = compileSpell(phantasmalKiller)
      .effects?.[0]?.entries.filter(isResolvedEntry)
      .find((entry) => entry.outcome.effectKind === 'FOLLOW_UP_SAVE')?.outcome
    expect(followUp).toMatchObject({
      effectKind: 'FOLLOW_UP_SAVE',
      timing: 'TARGET_TURN_END',
      attempts: { kind: 'ONCE', repeatOnFailure: true },
      onSuccess: { kind: 'END' },
      onFailure: {
        kind: 'OUTCOMES',
        endCurrent: false,
        outcomes: expect.arrayContaining([
          expect.objectContaining({ effectKind: 'DAMAGE', level: 4, dice: '4d10' }),
          expect.objectContaining({ effectKind: 'DAMAGE', level: 9, dice: '9d10' })
        ])
      }
    })

    const repository = createEffectRepository(new InMemoryDb() as never, SRD_SYSTEM_ID)
    await repository.upsert(effect)
    await expect(repository.findById(effect.id)).resolves.toEqual(effect)
  })

  it('preserves Eldritch Blast beam counts and repeated-target semantics', async () => {
    expect(spellAuthoredDtoSchema.safeParse(eldritchBlast).success).toBe(true)
    const effect = eldritchBlast.effects?.[0]
    if (!effect) throw new Error('Eldritch Blast is missing its audited effect.')

    const compiled = compileSpell(eldritchBlast).effects?.[0]
    expect(compiled?.invocation.targeting).toMatchObject({
      selectionKind: 'CHOSEN_CREATURES',
      allowRepeatedTargets: true,
      resolutionCountScaling: {
        breakpoints: [
          expect.objectContaining({ level: 1, value: { amount: 1 } }),
          expect.objectContaining({ level: 5, value: { amount: 2 } }),
          expect.objectContaining({ level: 11, value: { amount: 3 } }),
          expect.objectContaining({ level: 17, value: { amount: 4 } })
        ]
      }
    })
    expect(
      compiled?.entries
        .filter(isResolvedEntry)
        .filter((entry) => entry.pathCode === 'ON_HIT')
        .map((entry) => entry.outcome)
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ effectKind: 'DAMAGE', level: 1, dice: '1d10' }),
        expect.objectContaining({ effectKind: 'DAMAGE', level: 17, dice: '1d10' })
      ])
    )

    const repository = createEffectRepository(new InMemoryDb() as never, SRD_SYSTEM_ID)
    await repository.upsert(effect)
    await expect(repository.findById(effect.id)).resolves.toEqual(effect)
  })

  it('compiles every Protection from Energy resistance choice', () => {
    expect(spellAuthoredDtoSchema.safeParse(protectionFromEnergy).success).toBe(true)
    const entries = (compileSpell(protectionFromEnergy).effects?.[0]?.entries ?? []).filter(
      isResolvedEntry
    )

    expect(entries.map((entry) => entry.label)).toEqual([
      'Acid',
      'Cold',
      'Fire',
      'Lightning',
      'Thunder'
    ])
    expect(entries.every((entry) => entry.outcome.effectKind === 'APPLY_GRANT')).toBe(true)
  })

  it('compiles Sunburst and Weird recurring saves without manual placeholders', () => {
    for (const spell of [sunburst, weird]) {
      expect(spellAuthoredDtoSchema.safeParse(spell).success).toBe(true)
      const entries = (compileSpell(spell).effects?.[0]?.entries ?? []).filter(isResolvedEntry)
      expect(entries.some((entry) => entry.outcome.effectKind === 'MANUAL_ADJUDICATION')).toBe(
        false
      )
      expect(entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            outcome: expect.objectContaining({
              effectKind: 'FOLLOW_UP_SAVE',
              attempts: { kind: 'ONCE', repeatOnFailure: true },
              timing: 'TARGET_TURN_END'
            })
          })
        ])
      )
    }

    const sunburstEntries = (compileSpell(sunburst).effects?.[0]?.entries ?? []).filter(
      isResolvedEntry
    )
    expect(
      sunburstEntries.find(
        (entry) => entry.pathCode === 'ON_SAVE_SUCCESS' && entry.outcome.effectKind === 'DAMAGE'
      )?.outcome
    ).toMatchObject({ dice: '12d6', multiplier: 0.5 })
  })

  it('compiles every restored missing SRD spell root without losing its mechanics', () => {
    const restoredSpells = [
      barkskin,
      bladeBarrier,
      stinkingCloud,
      telepathicBond,
      transportViaPlants,
      treeStride
    ]
    expect(restoredSpells.every((spell) => spellAuthoredDtoSchema.safeParse(spell).success)).toBe(
      true
    )

    expect(
      compileSpell(barkskin).effects?.[0]?.entries.filter(isResolvedEntry)[0]?.outcome
    ).toMatchObject({
      effectKind: 'ARMOR_CLASS_FLOOR',
      minimum: 16
    })

    const bladeForms = (compileSpell(bladeBarrier).effects?.[0]?.entries ?? []).filter(
      isResolvedEntry
    )
    expect(bladeForms.map((entry) => entry.label)).toEqual(['Straight Wall', 'Ringed Wall'])
    for (const form of bladeForms) {
      expect(form.outcome).toMatchObject({
        effectKind: 'MANIFEST',
        components: [
          expect.objectContaining({
            interactionKinds: ['ENTER_SPACE', 'START_TURN_IN_SPACE'],
            movementCostMultiplier: 2,
            blockingRules: ['THREE_QUARTERS_COVER']
          })
        ]
      })
    }

    const cloud =
      compileSpell(stinkingCloud).effects?.[0]?.entries.filter(isResolvedEntry)[0]?.outcome
    expect(cloud).toMatchObject({
      effectKind: 'MANIFEST',
      spreadsAroundCorners: true,
      obscurementKind: 'HEAVY',
      destructionCriteria: [
        expect.objectContaining({ minimumMilesPerHour: 10, afterRounds: 4 }),
        expect.objectContaining({ minimumMilesPerHour: 20, afterRounds: 1 })
      ],
      components: [
        expect.objectContaining({
          requiresFullyWithin: true,
          automaticSaveSuccessConditions: ['DOES_NOT_BREATHE', 'POISON_IMMUNE']
        })
      ]
    })

    expect(
      compileSpell(telepathicBond).effects?.[0]?.entries.filter(isResolvedEntry)[0]?.outcome
    ).toMatchObject({
      effectKind: 'TELEPATHIC_LINK',
      maximumCreatures: 8,
      anyDistance: true,
      crossesPlanes: false,
      requiresSharedLanguage: false
    })
    expect(
      compileSpell(transportViaPlants).effects?.[0]?.entries.filter(isResolvedEntry)[0]?.outcome
    ).toMatchObject({
      effectKind: 'PLANT_PORTAL',
      minimumPlantSize: 'LARGE',
      movementCost: { amount: 5, unit: 'FEET' }
    })
    expect(
      compileSpell(treeStride).effects?.[0]?.entries.filter(isResolvedEntry)[0]?.outcome
    ).toMatchObject({
      effectKind: 'TREE_STRIDE',
      destinationDistance: { amount: 500, unit: 'FEET' },
      usesPerRound: 1,
      mustEndTurnOutside: true
    })
  })

  it('round-trips and clones every restored missing spell mechanic', async () => {
    const repository = createEffectRepository(new InMemoryDb() as never, SRD_SYSTEM_ID)
    for (const spell of [
      barkskin,
      bladeBarrier,
      stinkingCloud,
      telepathicBond,
      transportViaPlants,
      treeStride
    ]) {
      const effect = spell.effects?.[0]
      if (!effect) throw new Error(`${spell.label} is missing its audited effect.`)
      await repository.upsert(effect)
      const hydrated = await repository.findById(effect.id)
      expect(JSON.parse(JSON.stringify(hydrated))).toEqual(JSON.parse(JSON.stringify(effect)))
    }

    const clone = cloneAuthoredItem(stinkingCloud)
    expect(spellAuthoredDtoSchema.safeParse(clone).success).toBe(true)
    expect(clone.effects?.[0]?.id).not.toBe(stinkingCloud.effects?.[0]?.id)
    expect(clone.effects?.[0]?.paths[0]?.id).not.toBe(stinkingCloud.effects?.[0]?.paths[0]?.id)
  })

  it('compiles Aid, Continual Flame, and Spiritual Weapon without manual placeholders', () => {
    for (const spell of [aid, continualFlame, spiritualWeapon]) {
      expect(spellAuthoredDtoSchema.safeParse(spell).success).toBe(true)
      const compiled = compileSpell(spell)
      expect(
        compiled.effects?.some((effect) =>
          effect.entries
            .filter(isResolvedEntry)
            .some((entry) => entry.outcome.effectKind === 'MANUAL_ADJUDICATION')
        )
      ).toBe(false)
    }

    expect(
      (compileSpell(aid).effects?.[0]?.entries ?? [])
        .filter(isResolvedEntry)
        .map((entry) => entry.outcome)
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ effectKind: 'APPLY_GRANT' }),
        expect.objectContaining({
          effectKind: 'HEAL',
          levels: expect.arrayContaining([
            expect.objectContaining({ level: 2, amount: 5 }),
            expect.objectContaining({ level: 9, amount: 40 })
          ])
        })
      ])
    )

    expect(
      compileSpell(continualFlame).effects?.[0]?.entries.filter(isResolvedEntry)[0]?.outcome
    ).toMatchObject({
      effectKind: 'MANIFEST',
      attachmentKind: 'TOUCHED_OBJECT',
      light: {
        bright: { amount: 20, unit: 'FEET' },
        dimAdditional: { amount: 20, unit: 'FEET' }
      }
    })

    const weapon = compileSpell(spiritualWeapon)
      .effects?.[0]?.entries.filter(isResolvedEntry)
      .find((entry) => entry.outcome.effectKind === 'MANIFEST')?.outcome
    expect(weapon).toMatchObject({
      effectKind: 'MANIFEST',
      manifestKind: 'WEAPON',
      behaviors: [
        expect.objectContaining({
          invocation: expect.objectContaining({ activation: { code: 'FREE' } })
        }),
        expect.objectContaining({
          invocation: expect.objectContaining({ activation: { code: 'BONUS_ACTION', amount: 1 } })
        })
      ]
    })
  })

  it('preserves closed SRD rules through validation, compilation, persistence, and cloning', async () => {
    const spells = [
      [astralProjection, 'ASTRAL_PROJECTION'],
      [irresistibleDance, 'IRRESISTIBLE_DANCE'],
      [maze, 'MAZE'],
      [planarBinding, 'PLANAR_BINDING']
    ] as const
    const repository = createEffectRepository(new InMemoryDb() as never, SRD_SYSTEM_ID)

    for (const [spell, ruleKind] of spells) {
      expect(spellAuthoredDtoSchema.safeParse(spell).success).toBe(true)
      expect(
        compileSpell(spell)
          .effects?.[0]?.entries.filter(isResolvedEntry)
          .find((entry) => entry.outcome.effectKind === 'CLOSED_RULE')?.outcome
      ).toMatchObject({ effectKind: 'CLOSED_RULE', ruleKind })

      const effect = spell.effects?.[0]
      if (!effect) throw new Error(`${spell.label} is missing its audited effect.`)
      await repository.upsert(effect)
      await expect(repository.findById(effect.id)).resolves.toEqual(effect)
    }

    const clone = cloneAuthoredItem(astralProjection)
    const sourcePath = astralProjection.effects?.[0]?.paths[0]
    const clonedPath = clone.effects?.[0]?.paths[0]
    if (!sourcePath || !clonedPath || !isFixedPath(sourcePath) || !isFixedPath(clonedPath)) {
      throw new Error('Astral Projection must compile from a fixed path.')
    }
    expect(clonedPath.resultBlock.outcomes[0]?.id).not.toBe(sourcePath.resultBlock.outcomes[0]?.id)
  })
})
