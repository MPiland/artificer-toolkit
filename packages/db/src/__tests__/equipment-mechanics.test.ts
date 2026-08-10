import { describe, expect, it } from 'vitest'

import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { compileEquipment } from '@artificer-toolkit/shared/subjects/compilers'

import { alchemistsFireFlask } from '../source-data/srd/equipment/alchemists-fire-flask.js'
import { antitoxinVial } from '../source-data/srd/equipment/antitoxin-vial.js'
import { ballBearingsBagOf1000 } from '../source-data/srd/equipment/ball-bearings-bag-of-1000.js'
import { caltropsBagOf20 } from '../source-data/srd/equipment/caltrops-bag-of-20.js'
import { climbersKit } from '../source-data/srd/equipment/climbers-kit.js'
import { healersKit10Uses } from '../source-data/srd/equipment/healers-kit-10-uses.js'
import { huntingTrap } from '../source-data/srd/equipment/hunting-trap.js'
import { manacles } from '../source-data/srd/equipment/manacles.js'
import { net } from '../source-data/srd/equipment/net.js'
import { oilFlask } from '../source-data/srd/equipment/oil-flask.js'
import { poisonBasicVial } from '../source-data/srd/equipment/poison-basic-vial.js'

const equipment = [
  alchemistsFireFlask,
  antitoxinVial,
  ballBearingsBagOf1000,
  caltropsBagOf20,
  climbersKit,
  healersKit10Uses,
  huntingTrap,
  manacles,
  net,
  oilFlask,
  poisonBasicVial
]

describe('SRD equipment mechanics', () => {
  it('validates and compiles every formerly manual equipment rule', () => {
    for (const item of equipment) {
      expect(equipmentAuthoredDtoSchema.safeParse(item).success, item.label).toBe(true)
      expect(compileEquipment(item).effects?.length, item.label).toBeGreaterThan(0)
      expect(JSON.stringify(item), item.label).not.toContain('MANUAL_ADJUDICATION')
    }
  })

  it('preserves the high-risk interaction descriptors', () => {
    const netLimit = compileEquipment(net).effects?.[1]?.entries[0]
    expect(
      netLimit?.resolutionKind === 'ROLL_TABLE_REPEAT' ? undefined : netLimit?.outcome
    ).toMatchObject({
      effectKind: 'ACTION_ECONOMY_RULE',
      ruleKind: 'MAX_ATTACKS_PER_ACTIVATION',
      maximum: 1
    })
    expect(compileEquipment(healersKit10Uses).charges).toMatchObject({
      amount: 10,
      resetKind: 'MANUAL'
    })
    expect(JSON.stringify(compileEquipment(caltropsBagOf20))).toContain('ON_HIT_POINTS_REGAINED')
    expect(JSON.stringify(compileEquipment(oilFlask))).toContain('TARGET_TAKES_FIRE_DAMAGE')
    expect(JSON.stringify(compileEquipment(poisonBasicVial))).toContain('SOURCE_HIT')
  })
})
