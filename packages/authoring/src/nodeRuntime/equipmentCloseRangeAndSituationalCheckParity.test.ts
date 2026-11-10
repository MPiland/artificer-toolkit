import { describe, expect, it } from 'vitest'

import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { crowbar } from '@artificer-toolkit/source-data/srd/equipment/crowbar.js'
import { glaive } from '@artificer-toolkit/source-data/srd/equipment/glaive.js'
import { lance } from '@artificer-toolkit/source-data/srd/equipment/lance.js'
import { portableRam } from '@artificer-toolkit/source-data/srd/equipment/portable-ram.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-4.T4b (D217): the Lance's disadvantage within 5 ft is its attack range's close range, and
 * the Crowbar's and Portable Ram's check bonuses are a free action's consumed check grant, all core
 * options a Builder author has, so each must pass the equipment node map exactly as authored.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

async function expectKept(authored: EquipmentAuthored) {
  const result = await normalizeNodeRuntimeValues(reader, {
    mapId: 'equipment',
    systemId: srdSystemRecord.id,
    values: structuredClone(authored) as unknown as Record<string, unknown>
  })
  expect(result.clearedPaths).toEqual([])
  expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
}

/** The weapon attack's range, for a variant to change. */
function attackRange(equipment: EquipmentAuthored) {
  const range = equipment.effects?.[0]?.invocation.range
  if (range?.rangeKind !== 'DISTANCE') throw new Error('The weapon must author a distance range.')
  return range
}

/** The check grant's one modifier, for a variant to change. */
function checkModifier(equipment: EquipmentAuthored) {
  const path = equipment.effects?.[0]?.paths[0]
  const outcome = path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
  const modifier = outcome?.effectKind === 'APPLY_GRANT' ? outcome.grants.modifiers?.[0] : undefined
  if (modifier?.valueDomainCode !== 'ABILITY_CHECK')
    throw new Error('The item must grant one ability check modifier.')
  return modifier
}

describe('the Lance’s close range through the equipment node map (SPELLS-4.T4b)', () => {
  it('keeps the SRD Lance’s 10 ft reach with a 5 ft close range exactly as authored', async () => {
    expect(attackRange(lance)).toMatchObject({ amount: 10, closeAmount: 5, unit: 'FEET' })
    await expectKept(lance)
  })

  it('keeps a close range an author gives another reach weapon', async () => {
    const variant = structuredClone(glaive)
    attackRange(variant).closeAmount = 5
    await expectKept(variant)
  })
})

describe('situational check bonuses through the equipment node map (SPELLS-4.T4b)', () => {
  it.each([
    ['Crowbar', crowbar],
    ['Portable Ram', portableRam]
  ])('keeps the SRD %s exactly as authored, with no closed rule', async (_, item) => {
    expect(JSON.stringify(item.effects)).not.toContain('CLOSED_RULE')
    await expectKept(item)
  })

  it('authors the Crowbar as Strength check advantage and the Ram as +4', () => {
    expect(checkModifier(crowbar)).toMatchObject({
      domain: { ability: 'STRENGTH' },
      modifierKind: 'ROLL_INFLUENCE',
      payload: { influence: 'ADVANTAGE' }
    })
    expect(checkModifier(portableRam)).toMatchObject({
      domain: { ability: 'STRENGTH' },
      modifierKind: 'BONUS',
      payload: { valueKind: 'FIXED', amount: 4 }
    })
  })

  it('keeps a variant ram with another bonus and ability the same way', async () => {
    const variant = structuredClone(portableRam)
    const modifier = checkModifier(variant)
    if (modifier.modifierKind !== 'BONUS') throw new Error('The Ram must grant a check bonus.')
    modifier.domain = { ability: 'DEXTERITY' }
    modifier.payload = { valueKind: 'FIXED', amount: 2 }
    await expectKept(variant)
  })
})
