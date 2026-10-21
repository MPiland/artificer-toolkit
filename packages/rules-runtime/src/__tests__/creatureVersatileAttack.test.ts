import { SRD_ABILITIES, srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { prepareEncounterActionMechanics } from '../encounterActionMechanicsPreparation.js'
import { resolveEncounterActionSource } from '../encounterActionSources.js'
import { discoverEncounterFeatureActionCapabilities } from '../encounterFeatureActionCapabilityDiscoveryRegistry.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import { creatureFeature, srdCreatureActor, testUuid } from '../testing/dnd5eSrdEncounter.js'
import {
  creatureEncounter,
  settleCreatureAction,
  srdDamageTypeId
} from './encounterCreatureAction.js'

const ATTACKER_ID = testUuid(0xd1)
const TARGET_ID = testUuid(0xd2)

/** One grip of a seeded SRD Creature's versatile attack against the seeded Ogre (AC 11). */
async function versatileAttack(input: {
  attacker: string
  grip: 'ONE_HANDED' | 'TWO_HANDED'
  rolls: number[]
}) {
  const creature = srdByLabel(SRD.creatures, input.attacker)
  const actor = srdCreatureActor({ id: ATTACKER_ID, creature })
  const target = srdCreatureActor({ id: TARGET_ID, creature: srdByLabel(SRD.creatures, 'Ogre') })
  const longsword = creatureFeature(creature, 'Longsword')
  const capability = discoverEncounterFeatureActionCapabilities({
    spells: new Map(),
    actor,
    conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
    abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code }))
  }).find((entry) => entry.ownerFeatureId === longsword.id && entry.grip === input.grip)
  if (!capability) throw new Error(`The ${input.grip} Longsword was not discovered.`)
  const { state, movementTargets } = creatureEncounter([actor, target])
  const prepared = await prepareEncounterActionMechanics({
    state,
    actor,
    target,
    actors: [actor, target],
    actionId: capability.actionId,
    wieldConflictAcceptance: { kind: 'UNPROMPTED' },
    overridable: true,
    movementTargets,
    loadSource: async (source) =>
      resolveEncounterActionSource({ spells: new Map(), ...source, system: srdSystemRecord }),
    loadRelationshipFacts: async () => []
  })
  const { execution } = await settleCreatureAction({ prepared, rolls: input.rolls })
  return {
    actionId: capability.actionId,
    damage: execution.applications.flatMap((application) =>
      application.kind === 'DAMAGE'
        ? [[application.requestedAmount, application.damageTypeId] as const]
        : []
    )
  }
}

describe('versatile Creature weapons (D57 ruling 1)', () => {
  it('offers each grip as its own action with its printed damage', async () => {
    // Drider Longsword: 1d8 + 3 slashing one-handed, or 1d10 + 3 two-handed; a 15 hits.
    const oneHanded = await versatileAttack({
      attacker: 'Drider',
      grip: 'ONE_HANDED',
      rolls: [14, 4]
    })
    const twoHanded = await versatileAttack({
      attacker: 'Drider',
      grip: 'TWO_HANDED',
      rolls: [14, 8]
    })
    expect(oneHanded.actionId).not.toBe(twoHanded.actionId)
    expect(oneHanded.damage).toEqual([[5 + 3, srdDamageTypeId('SLASHING')]])
    expect(twoHanded.damage).toEqual([[9 + 3, srdDamageTypeId('SLASHING')]])
  })

  it('keeps shared hit damage on both grips', async () => {
    // Erinyes Longsword: 1d8 + 4 or 1d10 + 4 slashing, plus 3d8 poison either way.
    const twoHanded = await versatileAttack({
      attacker: 'Erinyes',
      grip: 'TWO_HANDED',
      rolls: [14, 9, 0, 1, 2]
    })
    expect(twoHanded.damage).toEqual([
      [10 + 4, srdDamageTypeId('SLASHING')],
      [1 + 2 + 3, srdDamageTypeId('POISON')]
    ])
  })
})
