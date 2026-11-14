import type { ServerRuleExecutionD20PolicyDto } from '@artificer-toolkit/schema/shared/ruleExecutionEvidence'
import { describe, expect, it } from 'vitest'

import { targetSaveWindow } from '../encounterActionSaveWindow.js'
import { DND5E_ABILITY_DEFINITION_ID_BY_CODE } from '../systems/dnd5e/identity.js'
import { SRD_SYSTEM_ID, testUuid } from '../testing/dnd5eSrdEncounter.js'

/**
 * The dice a roll's window offers its roller (D168). A reaction against another creature's attack
 * roll is a reaction child that rolls its own die (D219), so the window holds only the roller's.
 */

const CHECKSUM = 'a'.repeat(64)
const heldDie = {
  effectId: testUuid(0x7e0),
  grantId: testUuid(0x7e1),
  label: 'Held',
  count: 1,
  faces: 4 as const,
  sign: 'ADD' as const
}

const attackPolicy: ServerRuleExecutionD20PolicyDto = {
  requestNodeId: 'attack',
  rollMode: 'NORMAL',
  keep: 'FIRST',
  contributors: [],
  contributorChecksum: CHECKSUM,
  modifier: 4,
  dc: 13
}
const savePolicy = {
  ...attackPolicy,
  savingThrowAbilityDefinitionId: DND5E_ABILITY_DEFINITION_ID_BY_CODE.DEXTERITY
}

describe('the dice an attack roll’s d20 window offers its roller', () => {
  it('offers the attacker the dice it holds for an attack roll', () => {
    expect(targetSaveWindow(SRD_SYSTEM_ID, [], [heldDie]).heldDice(attackPolicy)).toEqual([heldDie])
  })

  it('offers an attack roll nothing when the attacker holds nothing', () => {
    expect(targetSaveWindow(SRD_SYSTEM_ID, [], []).heldDice(attackPolicy)).toEqual([])
  })

  it('offers a saving throw the target’s held dice, never the attacker’s', () => {
    expect(targetSaveWindow(SRD_SYSTEM_ID, [], [heldDie]).heldDice(savePolicy)).toEqual([])
  })
})
