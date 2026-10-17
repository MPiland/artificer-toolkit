import { SRD_ABILITIES, srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { dnd5eCharacterActionCapabilityAdapter } from '../systems/dnd5e/characterActionCapabilityDiscovery.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { createPlatformRulesRuntime } from '../platformRulesRuntime.js'
import { RuleRuntimeSourceIntegrityError } from '../rulesRuntimeService.js'
import { evaluateSrdCharacter } from '../testing/dnd5eSrdCharacter.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'

/** Pauses an SRD Potion of Healing on its first heal die through the real compiler and kernel. */
async function pausedPotionOfHealing() {
  const character = evaluateSrdCharacter({
    classes: [{ label: 'Fighter', level: 1 }],
    items: [{ label: 'Potion of Healing' }]
  })
  const itemInstanceId = character.itemInstanceId('Potion of Healing')
  const index = character.facts.actionCandidates.findIndex(
    (candidate) => candidate.equipment?.itemInstanceId === itemInstanceId
  )
  const candidate = character.facts.actionCandidates[index]
  const decision = character.output.actionDecisions.find(
    (entry) => entry.actionId === candidate?.actionId
  )
  const action = dnd5eCharacterActionCapabilityAdapter.discover({
    candidates: character.facts.actionCandidates,
    conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
    abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code })),
    entryPoints: character.entryPoints
  })[index]
  if (!decision || !action) throw new Error('The Potion of Healing action was not discovered.')

  const runtime = createPlatformRulesRuntime({
    definitions: {
      async requireCurrent() {
        throw new Error('Definitions are not used by resolved graphs.')
      }
    }
  })
  const published = dnd5eCharacterRuleActionSystemAdapter.compile({ action })
  const bound = dnd5eCharacterRuleActionSystemAdapter.bindFacts({
    published,
    actionMechanic: { ...decision.mechanic, save: null },
    sourceDerivedFacts: {},
    targetActorId: testUuid(0xe2),
    targetDerivedFacts: {},
    targetConditionIds: [],
    currentHitPoints: 1,
    temporaryHitPoints: 0,
    maximumHitPoints: 30,
    targetScalarValues: {},
    defenses: []
  })
  const paused = await runtime.executeResolved({
    command: { definitionId: published.id, occurrenceId: testUuid(0xe3), facts: bound.facts },
    published
  })
  if (paused.status !== 'PAUSED') throw new Error('The potion did not pause for its heal die.')
  return { runtime, continuation: paused.continuation }
}

describe('resuming a paused rule continuation validates its graph', () => {
  it('resumes the compiler-admitted graph', async () => {
    const { runtime, continuation } = await pausedPotionOfHealing()
    const resumed = await runtime.resumeWithGraph!({
      continuation,
      response: { requestId: continuation.request.requestId, value: continuation.request.min }
    })
    expect(resumed.graph).toEqual(continuation.graph)
    expect(['PAUSED', 'COMPLETE']).toContain(resumed.result.status)
  })

  it.each([
    'node order that is not the compiler-admitted order',
    'capability contract version its Game System does not register'
  ])('refuses a graph tampered with a %s', async (tampering) => {
    const { runtime, continuation } = await pausedPotionOfHealing()
    const { graph } = continuation
    expect(graph.nodes.length).toBeGreaterThan(1)
    const tampered = {
      continuation: {
        ...continuation,
        graph: tampering.startsWith('node order')
          ? { ...graph, nodes: [...graph.nodes].reverse() }
          : { ...graph, capabilityContractVersion: graph.capabilityContractVersion + 1 }
      },
      response: { requestId: continuation.request.requestId, value: continuation.request.min }
    }
    await expect(runtime.resume(tampered)).rejects.toBeInstanceOf(RuleRuntimeSourceIntegrityError)
    await expect(runtime.resumeWithGraph!(tampered)).rejects.toBeInstanceOf(
      RuleRuntimeSourceIntegrityError
    )
  })
})
