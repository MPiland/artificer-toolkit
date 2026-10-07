import { describe, expect, it } from 'vitest'
import { EQUIPMENT_CATEGORY_CODE, EQUIPMENT_PROPERTY_CODE } from '@artificer-toolkit/shared/core'

import { prepareDnd5eDisarmContest } from '../systems/dnd5e/optionalActionPolicy.js'
import { SRD_SYSTEM_ID, srdOptionalCombat, testUuid } from '../testing/dnd5eSrdEncounter.js'

const rules = srdOptionalCombat(['DISARM'])
const parameters = rules.snapshot.definitions[0]!.document.parameters
const defenderCheckDefinitionId = (() => {
  if (parameters.kind !== 'DISARM') throw new Error('Expected the SRD Disarm definition.')
  return parameters.defenderCheckDefinitionIds[0]!
})()

function prepare(input: {
  targetProperties: readonly string[]
  attackerSize: string
  targetSize: string
}) {
  const resolution = prepareDnd5eDisarmContest({
    automationMode: 'ASSISTED',
    gameSystemId: SRD_SYSTEM_ID,
    optionalCombatSnapshot: rules.snapshot,
    optionalCombatSnapshotChecksum: rules.checksum,
    attackerActorId: testUuid(1),
    attackerSize: input.attackerSize,
    heldItemId: testUuid(3),
    targetActorId: testUuid(2),
    targetCheckDefinitionId: defenderCheckDefinitionId,
    targetEquipment: { properties: input.targetProperties },
    targetItemOwnerState: 'ENCOUNTER_ACTOR',
    targetSize: input.targetSize,
    triggerCode: 'MELEE_WEAPON_ATTACK',
    sourceEquipment: {
      category: EQUIPMENT_CATEGORY_CODE.WEAPON,
      id: testUuid(4),
      properties: [],
      state: 'EQUIPPED'
    },
    attack: {
      modifier: 5,
      rollMode: 'NORMAL',
      baseContributors: { MELEE: [], RANGED: [], SPELL: [], UNARMED: [] },
      relationshipContributors: []
    }
  })
  if (resolution.kind !== 'PROPOSED')
    throw new Error(`Expected a proposal, got ${resolution.kind}.`)
  return resolution.proposal.contest
}

describe('Disarm contest contributors', () => {
  it('carry only the pending-context contributor keys for a two-handed holder and a size difference', () => {
    const contest = prepare({
      targetProperties: [EQUIPMENT_PROPERTY_CODE.TWO_HANDED],
      attackerSize: 'SMALL',
      targetSize: 'LARGE'
    })
    expect(contest.initiatorMode).toBe('DISADVANTAGE')
    expect(contest.targetMode).toBe('ADVANTAGE')
    const contributors = [...contest.initiatorContributors, ...contest.targetContributors]
    expect(contributors).toHaveLength(2)
    for (const contributor of contributors)
      expect(Object.keys(contributor).sort()).toEqual([
        'domainKey',
        'grantId',
        'influence',
        'sourceId'
      ])
  })
})
