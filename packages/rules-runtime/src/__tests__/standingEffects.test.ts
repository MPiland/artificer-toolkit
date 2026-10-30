import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { PathLifecycleReturnsOn } from '@artificer-toolkit/shared/core'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_SYSTEM_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { heldIncomingGate } from '../encounterIncomingAttackGate.js'
import { discoverEncounterFeatureActions } from '../encounterFeatureActionCapabilityDiscoveryRegistry.js'
import { characterStandingEffects, prepareRestStandingEffects } from '../standingEffectPlans.js'
import { SRD, evaluateSrdCharacter, srdByLabel, srdFeature } from '../testing/dnd5eSrdCharacter.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'
import {
  STANDING_WARD_EFFECT_ID,
  STANDING_WARD_FEATURE_ID,
  standingWardFeature
} from '../testing/standingWardFeature.js'
import { creatureActor } from './encounterCreatureAction.js'

const MONK = srdByLabel(SRD.classes, 'Monk')
const CHARACTER_ID = testUuid(0x5e0)
const HOLDER_ID = testUuid(0x5e1)
const ATTACKER_ID = testUuid(0x5e2)
const ENCOUNTER_ID = testUuid(0x5e3)
const REST_COMMAND_ID = testUuid(0x5e4)
const conditionDefinitionIds = srdSystemRecord.conditionTypes.map(({ id }) => id)
const abilityDefinitions = (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))

/** A Monk who holds the homebrew standing ward that returns on the given rest. */
function wardedMonkStanding(returnsOn: PathLifecycleReturnsOn) {
  const monk = evaluateSrdCharacter({
    classes: [{ label: 'Monk', level: 3 }],
    abilities: { WISDOM: 16 },
    extraFeatures: [standingWardFeature(returnsOn)],
    features: [
      {
        acquisitionId: 'acquired:standing-ward',
        featureId: STANDING_WARD_FEATURE_ID,
        source: { kind: 'CLASS', classId: MONK.id, classLevel: 1 },
        timing: { kind: 'CLASS_LEVEL', classId: MONK.id, classLevel: 1 }
      }
    ]
  })
  return characterStandingEffects({
    sources: monk.standingEffectSources,
    gameSystemId: SRD_SYSTEM_ID,
    conditionDefinitionIds,
    abilityDefinitions
  })
}

function armAtRest(input: {
  returnsOn: PathLifecycleReturnsOn
  restKind: 'SHORT' | 'LONG'
  held?: readonly ActiveRuleEffectRecord[]
}) {
  return prepareRestStandingEffects({
    standing: wardedMonkStanding(input.returnsOn),
    restKind: input.restKind,
    holder: {
      actorId: HOLDER_ID,
      conditionIds: [],
      effectiveSize: null,
      lifetimeScope: 'OWNER',
      hidden: false,
      held: input.held ?? []
    },
    origin: { characterId: CHARACTER_ID, occurrenceId: REST_COMMAND_ID, commandId: REST_COMMAND_ID }
  })
}

/** The armed effect as its store holds it. */
function stored(armed: ReturnType<typeof armAtRest>[number]): ActiveRuleEffectRecord {
  return {
    id: armed.id,
    owner: { kind: 'CHARACTER', characterId: CHARACTER_ID },
    definition: armed.definition,
    lifecycle: armed.lifecycle,
    sourceEncounterId: null,
    maintainedEffectStateId: null,
    createdOrdinal: 1,
    version: 1,
    definitionChecksum: 'a'.repeat(64),
    lifecycleChecksum: 'b'.repeat(64),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
}

describe('standing effects (SPELLS-31.2)', () => {
  it('finds a Character’s authored standing effect under its feature label', () => {
    expect(wardedMonkStanding('LONG_REST')).toMatchObject([
      { effectId: STANDING_WARD_EFFECT_ID, label: 'Standing Ward', returnsOn: 'LONG_REST' }
    ])
  })

  it('a long rest turns an ended long-rest effect back on, a short rest does not', () => {
    expect(armAtRest({ returnsOn: 'LONG_REST', restKind: 'SHORT' })).toEqual([])
    const [armed, ...rest] = armAtRest({ returnsOn: 'LONG_REST', restKind: 'LONG' })
    expect(rest).toEqual([])
    expect(armed?.definition).toMatchObject({
      authoredEffectId: STANDING_WARD_EFFECT_ID,
      recurrence: { lifetimeScope: 'OWNER', expiration: { kind: 'INDEFINITE' } },
      origin: {
        kind: 'CHARACTER',
        sourceAggregateId: CHARACTER_ID,
        sourceOccurrenceId: REST_COMMAND_ID,
        rootCommandId: REST_COMMAND_ID
      }
    })
    expect(armed?.definition.recurrence.endTriggers).toEqual([
      { event: 'ACTION_TRAIT', trait: 'ATTACK_ROLL', against: 'ENEMY' },
      { event: 'ACTION_TRAIT', trait: 'SPELL_CAST', against: 'ENEMY' }
    ])
  })

  it('either rest turns an ended short-rest effect back on', () => {
    expect(armAtRest({ returnsOn: 'SHORT_REST', restKind: 'SHORT' })).toHaveLength(1)
    expect(armAtRest({ returnsOn: 'SHORT_REST', restKind: 'LONG' })).toHaveLength(1)
  })

  it('a rest leaves a held effect alone and makes the same id when replayed', () => {
    const [armed] = armAtRest({ returnsOn: 'LONG_REST', restKind: 'LONG' })
    expect(armed).toBeDefined()
    expect(armAtRest({ returnsOn: 'LONG_REST', restKind: 'LONG' })[0]?.id).toBe(armed!.id)
    expect(armAtRest({ returnsOn: 'LONG_REST', restKind: 'LONG', held: [stored(armed!)] })).toEqual(
      []
    )
  })

  it('a Character’s held standing ward is owned by its holder, whose save DC it uses', () => {
    const [armed] = armAtRest({ returnsOn: 'LONG_REST', restKind: 'LONG' })
    const gate = heldIncomingGate({
      holderActorId: HOLDER_ID,
      effects: [stored(armed!)],
      grantFold: null,
      attackerCreatureTypeId: null,
      attacker: { actorId: ATTACKER_ID, characterId: null }
    })
    expect(gate).toMatchObject({ wardId: armed!.id, ownerActorId: HOLDER_ID })
    expect(gate?.payload.savingThrow.dcMethod).toBe('DERIVED_DC')
  })

  it('finds the SRD Tranquility as a long-rest Sanctuary at the Monk’s own Wisdom DC', () => {
    const monk = evaluateSrdCharacter({
      classes: [{ label: 'Monk', level: 11, subclass: 'Way of the Open Hand' }],
      features: [
        srdFeature({
          owner: 'SUBCLASS',
          classLabel: 'Monk',
          subclassLabel: 'Way of the Open Hand',
          featureLabel: 'Tranquility',
          level: 11
        })
      ]
    })
    const standing = characterStandingEffects({
      sources: monk.standingEffectSources,
      gameSystemId: SRD_SYSTEM_ID,
      conditionDefinitionIds,
      abilityDefinitions
    })
    expect(standing).toMatchObject([{ label: 'Tranquility', returnsOn: 'LONG_REST' }])
    const [armed] = prepareRestStandingEffects({
      standing,
      restKind: 'LONG',
      holder: {
        actorId: HOLDER_ID,
        conditionIds: [],
        effectiveSize: null,
        lifetimeScope: 'OWNER',
        hidden: false,
        held: []
      },
      origin: {
        characterId: CHARACTER_ID,
        occurrenceId: REST_COMMAND_ID,
        commandId: REST_COMMAND_ID
      }
    })
    expect(armed?.definition.recurrence.endTriggers).toEqual([
      { event: 'ACTION_TRAIT', trait: 'ATTACK_ROLL', against: 'ENEMY' },
      { event: 'ACTION_TRAIT', trait: 'SPELL_CAST', against: 'ENEMY' }
    ])
    const gate = heldIncomingGate({
      holderActorId: HOLDER_ID,
      effects: [stored(armed!)],
      grantFold: null,
      attackerCreatureTypeId: null,
      attacker: { actorId: ATTACKER_ID, characterId: null }
    })
    expect(gate).toMatchObject({ ownerActorId: HOLDER_ID })
    expect(gate?.payload.savingThrow).toMatchObject({
      dcMethod: 'DERIVED_DC',
      abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.WISDOM,
      baseDc: 8,
      bonuses: [
        { bonusKind: 'ABILITY_MODIFIER', abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.WISDOM },
        { bonusKind: 'PROFICIENCY_BONUS' }
      ]
    })
  })

  it('finds a Creature’s standing effect and offers it as no action', () => {
    const { availableAtLevel: _level, ...ward } = standingWardFeature('SHORT_REST')
    const discovered = discoverEncounterFeatureActions({
      spells: new Map(),
      actor: creatureActor({ id: HOLDER_ID, label: 'Warded', features: [ward] }),
      conditionDefinitionIds,
      abilityDefinitions
    })
    expect(discovered.standingEffects).toMatchObject([
      { effectId: STANDING_WARD_EFFECT_ID, label: 'Standing Ward', returnsOn: 'SHORT_REST' }
    ])
    expect(discovered.available.some(({ label }) => label.startsWith('Standing Ward'))).toBe(false)
  })

  it('holds no standing effect for a returning effect that never ends', () => {
    const feature = standingWardFeature('LONG_REST')
    const endless = {
      ...feature,
      effects: feature.effects?.map((effect) => ({
        ...effect,
        paths: effect.paths.map((path) =>
          'resultBlock' in path
            ? {
                ...path,
                resultBlock: { ...path.resultBlock, lifecycle: { returnsOn: 'LONG_REST' as const } }
              }
            : path
        )
      }))
    }
    const { availableAtLevel: _level, ...ward } = endless
    expect(
      discoverEncounterFeatureActions({
        spells: new Map(),
        actor: creatureActor({ id: HOLDER_ID, label: 'Warded', features: [ward] }),
        conditionDefinitionIds,
        abilityDefinitions
      }).standingEffects
    ).toEqual([])
  })

  it('is scoped to its own encounter for a Creature', () => {
    const [armed] = prepareRestStandingEffects({
      standing: wardedMonkStanding('LONG_REST'),
      restKind: 'LONG',
      holder: {
        actorId: HOLDER_ID,
        conditionIds: [],
        effectiveSize: null,
        lifetimeScope: 'ENCOUNTER',
        hidden: false,
        held: []
      },
      origin: {
        encounterId: ENCOUNTER_ID,
        currentActorId: null,
        occurrenceId: REST_COMMAND_ID,
        commandId: REST_COMMAND_ID
      }
    })
    expect(armed?.definition).toMatchObject({
      recurrence: { lifetimeScope: 'ENCOUNTER' },
      origin: { kind: 'ENCOUNTER', sourceAggregateId: ENCOUNTER_ID, sourceActorId: HOLDER_ID }
    })
  })
})
