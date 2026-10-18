import { describe, expect, it } from 'vitest'
import {
  isInstalledMeleeAttackTrigger,
  requireInstalledConcentrationMaintenanceDefinitionId
} from '../platformRulesRuntime.js'
import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '../systems/dnd5e/concentrationIdentity.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'

const UNINSTALLED_SYSTEM_ID = '00000000-0000-4000-8000-0000000000ff'

describe('installed System classification seam', () => {
  it("resolves the Run's Game System Concentration maintenance rule", () => {
    expect(requireInstalledConcentrationMaintenanceDefinitionId(DND5E_SYSTEM_ID)).toBe(
      DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
    )
  })

  it('classifies melee weapon, unarmed and melee spell attack triggers as melee', () => {
    for (const trigger of ['MELEE_WEAPON_ATTACK', 'UNARMED_ATTACK', 'MELEE_SPELL_ATTACK'])
      expect(isInstalledMeleeAttackTrigger(DND5E_SYSTEM_ID, trigger)).toBe(true)
  })

  it('does not classify ranged attacks or non-attack triggers as melee', () => {
    for (const trigger of ['RANGED_WEAPON_ATTACK', 'RANGED_SPELL_ATTACK', 'CAST_SPELL', 'UNKNOWN'])
      expect(isInstalledMeleeAttackTrigger(DND5E_SYSTEM_ID, trigger)).toBe(false)
  })

  it('rejects a Game System with no installed module instead of defaulting to D&D', () => {
    expect(() =>
      requireInstalledConcentrationMaintenanceDefinitionId(UNINSTALLED_SYSTEM_ID)
    ).toThrow('No rules runtime module is installed')
    expect(() =>
      isInstalledMeleeAttackTrigger(UNINSTALLED_SYSTEM_ID, 'MELEE_WEAPON_ATTACK')
    ).toThrow('No rules runtime module is installed')
  })
})
