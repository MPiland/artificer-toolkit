import { describe, expect, it } from 'vitest'
import { SRD_ABILITY_DEFINITION_IDS } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { encounterMoraleRollers, rollEncounterMoraleSave } from '../encounterMoraleSave.js'
import type { MoraleSaveProposal } from '../optionalCombatPolicyCapability.js'
import {
  SRD_SYSTEM_ID,
  srdCreatureActor,
  srdCreatureTarget,
  srdDefinitions,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'
import { GOBLIN } from './encounterActiveEffectFixtures.js'

const WISDOM = SRD_ABILITY_DEFINITION_IDS.WISDOM
const goblin = srdCreatureActor({ id: testUuid(0x71), creature: GOBLIN })
const target = srdCreatureTarget(goblin)

const proposal: MoraleSaveProposal = {
  pin: {
    definitionChecksum: 'a'.repeat(64),
    definitionId: testUuid(0x72),
    definitionVersion: 1,
    moduleContractVersion: 1,
    moduleKey: 'MORALE'
  },
  triggerKind: 'INDIVIDUAL_REDUCED_TO_HALF',
  scope: 'SUBJECT',
  rollerActorId: goblin.id,
  groupLeaderActorId: null,
  memberActorIds: [goblin.id],
  abilityDefinitionId: WISDOM,
  difficultyClass: 10,
  contributors: [],
  automaticFailure: false,
  successDisposition: 'CONTINUE',
  failureDisposition: 'FLEE'
}

function roll(input: Partial<Parameters<typeof rollEncounterMoraleSave>[0]>) {
  return rollEncounterMoraleSave({
    gameSystemId: SRD_SYSTEM_ID,
    roller: target,
    proposal,
    roll: { kind: 'AUTO_ROLL' },
    requestId: 'morale-1',
    nextInt: () => 0,
    ...input
  })
}

describe('encounter morale save roll', () => {
  it('keeps entered faces against the authored DC', () => {
    const evidence = roll({ roll: { kind: 'ENTER_DICE', rawFaces: [14], rollMode: 'NORMAL' } })
    expect(evidence).toMatchObject({ requestId: 'morale-1', selectedNatural: 14, dc: 10 })
    expect(evidence.total).toBe(14 + evidence.modifier)
  })

  it('rolls the server die under the frozen mode for an auto roll', () => {
    const evidence = roll({ nextInt: () => 6 })
    expect(evidence.rawFaces).toEqual([7])
    expect(evidence.selectedNatural).toBe(7)
  })

  it('refuses a roller without a saving throw for the check', () => {
    expect(() => roll({ proposal: { ...proposal, abilityDefinitionId: testUuid(0x73) } })).toThrow(
      'no saving throw'
    )
  })
})

describe('encounter morale rollers', () => {
  it('reads each creature’s ability to act and its save modifiers', async () => {
    const rollers = await encounterMoraleRollers({
      gameSystemId: SRD_SYSTEM_ID,
      targets: [target],
      definitions: srdDefinitions
    })
    const entry = rollers.get(goblin.id)
    expect(entry?.canAct).toBe(true)
    expect(entry?.saveModifiers.has(WISDOM)).toBe(true)
  })
})
