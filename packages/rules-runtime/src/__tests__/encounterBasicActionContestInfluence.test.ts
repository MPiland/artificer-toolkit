import { describe, expect, it } from 'vitest'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { SRD_BASIC_ACTION_IDS } from '@artificer-toolkit/source-data/srd/basicActions.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { prepareEncounterActionMechanics } from '../encounterActionMechanicsPreparation.js'
import { resolveEncounterActionSource } from '../encounterActionSources.js'
import {
  encounterBasicActionId,
  readEncounterBasicActionEntries
} from '../encounterBasicActionCapabilityDiscovery.js'
import { prepareEncounterBasicActionContest } from '../encounterBasicActionContest.js'
import { withEncounterConditionMechanics } from '../encounterConditionMechanics.js'
import { buildMovementTarget } from '../encounterMovementTargets.js'
import {
  CAMPAIGN_ID,
  ENCOUNTER_ID,
  SRD_SYSTEM_ID,
  srdCondition,
  srdCreatureActor,
  srdDefinitions,
  srdEncounterState,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import { srdConditionDefinitionSource } from './srdConditionDefinitions.js'

/**
 * MOVE-2.T2b: a picked option's own influence on the initiator's contest check joins the
 * initiator's other contributors, and the System resolves them to one roll mode (D148): the
 * options still share the one contest.
 */

const SHOVER_ID = testUuid(0x2b01)
const TARGET_ID = testUuid(0x2b02)
const veteran = srdByLabel(SRD.creatures, 'Veteran')

/** The SRD Shove with its options' influences set by option index, as a homebrew copy authors. */
async function shoveWith(
  influences: Readonly<Record<number, string>>
): Promise<ReusableDefinitionCurrentDto> {
  const shove = await srdDefinitions.requireCurrent(SRD_BASIC_ACTION_IDS.SHOVE)
  const { document } = shove
  if (document.kind !== 'BASIC_ACTION') throw new Error('The SRD Shove is not a basic action.')
  const effects = document.effects.map((effect) => ({
    ...effect,
    paths: effect.paths.map((path) =>
      path.selectionKind === 'CHOICE'
        ? {
            ...path,
            options: path.options.map((option, index) => {
              const influence = influences[index]
              return influence ? { ...option, initiatorCheckInfluence: influence } : option
            })
          }
        : path
    )
  }))
  return { ...shove, document: { ...document, effects } }
}

/** The authored option ids of the Shove, in order. */
function optionIds(definition: ReusableDefinitionCurrentDto) {
  if (definition.document.kind !== 'BASIC_ACTION') throw new Error('Not a basic action.')
  return definition.document.effects.flatMap((effect) =>
    effect.paths.flatMap((path) =>
      path.selectionKind === 'CHOICE' ? path.options.map(({ id }) => id) : []
    )
  )
}

/** Seals a Veteran's Shove of another Veteran, picking the option at `optionIndex`. */
async function sealedShove(input: {
  definition: ReusableDefinitionCurrentDto
  optionIndex: number
  shoverConditionIds?: readonly string[]
}) {
  const shover = srdCreatureActor({
    id: SHOVER_ID,
    creature: veteran,
    conditionIds: input.shoverConditionIds ?? []
  })
  const target = srdCreatureActor({ id: TARGET_ID, creature: veteran })
  const actors: EncounterRunActorState[] = [shover, target]
  const state = srdEncounterState({ actors, currentActorId: shover.id })
  const facts = async (actor: EncounterRunActorState) =>
    withEncounterConditionMechanics({
      target: buildMovementTarget({
        actor,
        activeEffects: [],
        characterFacts: null,
        campaignId: CAMPAIGN_ID,
        gameSystemId: SRD_SYSTEM_ID
      }),
      gameSystemId: SRD_SYSTEM_ID,
      definitions: srdConditionDefinitionSource()
    })
  const movementTargets = new Map([
    [shover.id, await facts(shover)],
    [target.id, await facts(target)]
  ])
  const [effect] =
    input.definition.document.kind === 'BASIC_ACTION' ? input.definition.document.effects : []
  if (!effect) throw new Error('The Shove has no effect.')
  const actionId = encounterBasicActionId(shover.id, input.definition.id, effect.id)
  const choiceOptionId = optionIds(input.definition)[input.optionIndex]
  const command: ResolveEncounterActionInputDto = {
    encounterId: ENCOUNTER_ID,
    commandId: testUuid(0x2b03),
    expectedVersion: state.version,
    type: 'RESOLVE_ACTION',
    actorId: shover.id,
    actionId,
    target: { kind: 'ACTOR', actorId: target.id, choiceOptionId },
    acceptedWieldConflict: null,
    acknowledgedWarnings: [],
    sceneContext: null
  }
  const prepared = await prepareEncounterActionMechanics({
    state,
    actor: shover,
    target,
    actors,
    actionId,
    choiceOptionId,
    wieldConflictAcceptance: { kind: 'UNPROMPTED' },
    overridable: true,
    movementTargets,
    loadSource: async (source) =>
      resolveEncounterActionSource({
        spells: new Map(),
        ...source,
        system: srdSystemRecord,
        basicActions: await readEncounterBasicActionEntries({
          actorId: shover.id,
          actionId,
          gameSystemId: SRD_SYSTEM_ID,
          definitions: { requireCurrent: async () => input.definition }
        })
      }),
    loadRelationshipFacts: async () => []
  })
  const { contest } = prepareEncounterBasicActionContest({
    state,
    actor: shover,
    target,
    command,
    prepared,
    sceneContext: null,
    system: srdSystemRecord,
    actionEconomy: null
  })
  return contest.initiator
}

describe("a picked option's influence on the initiator's contest check (MOVE-2.3)", () => {
  it('rolls the picked option at disadvantage, recording the option as its contributor', async () => {
    const definition = await shoveWith({ 1: 'DISADVANTAGE' })
    const initiator = await sealedShove({ definition, optionIndex: 1 })
    expect(initiator.rollMode).toBe('DISADVANTAGE')
    expect(initiator.contributors).toEqual([
      {
        sourceId: `${optionIds(definition)[1]}:pick`,
        grantId: null,
        domainKey: null,
        influence: 'DISADVANTAGE',
        source: { kind: 'AUTHORED', id: definition.id, holderActorId: SHOVER_ID }
      }
    ])
  })

  it('leaves an option without an influence to roll normally', async () => {
    const initiator = await sealedShove({
      definition: await shoveWith({ 1: 'DISADVANTAGE' }),
      optionIndex: 0
    })
    expect(initiator.rollMode).toBe('NORMAL')
    expect(initiator.contributors).toEqual([])
  })

  it("cancels an option's advantage against a Poisoned shover's disadvantage", async () => {
    const POISONED = srdCondition('Poisoned')
    const definition = await shoveWith({ 0: 'ADVANTAGE' })
    const poisoned = await sealedShove({
      definition,
      optionIndex: 1,
      shoverConditionIds: [POISONED]
    })
    expect(poisoned.rollMode).toBe('DISADVANTAGE')
    const both = await sealedShove({ definition, optionIndex: 0, shoverConditionIds: [POISONED] })
    expect(both.rollMode).toBe('NORMAL')
    expect(both.contributors.map(({ influence, source }) => [source.kind, influence])).toEqual(
      expect.arrayContaining([
        ['AUTHORED', 'ADVANTAGE'],
        ['CONDITION', 'DISADVANTAGE']
      ])
    )
  })
})
