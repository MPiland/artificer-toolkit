import { describe, expect, it } from 'vitest'

import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'
import { antipathySympathy } from '@artificer-toolkit/source-data/srd/spells/antipathy-sympathy.js'
import { calmEmotions } from '@artificer-toolkit/source-data/srd/spells/calm-emotions.js'
import { contagion } from '@artificer-toolkit/source-data/srd/spells/contagion.js'
import { contingency } from '@artificer-toolkit/source-data/srd/spells/contingency.js'
import { delayedBlastFireball } from '@artificer-toolkit/source-data/srd/spells/delayed-blast-fireball.js'
import { glyphOfWarding } from '@artificer-toolkit/source-data/srd/spells/glyph-of-warding.js'
import { feeblemind } from '@artificer-toolkit/source-data/srd/spells/feeblemind.js'
import { freedomOfMovement } from '@artificer-toolkit/source-data/srd/spells/freedom-of-movement.js'
import { jump } from '@artificer-toolkit/source-data/srd/spells/jump.js'
import { levitate } from '@artificer-toolkit/source-data/srd/spells/levitate.js'
import { magicJar } from '@artificer-toolkit/source-data/srd/spells/magic-jar.js'
import { planarBinding } from '@artificer-toolkit/source-data/srd/spells/planar-binding.js'
import { projectImage } from '@artificer-toolkit/source-data/srd/spells/project-image.js'
import { reverseGravity } from '@artificer-toolkit/source-data/srd/spells/reverse-gravity.js'
import { timeStop } from '@artificer-toolkit/source-data/srd/spells/time-stop.js'
import { stormOfVengeance } from '@artificer-toolkit/source-data/srd/spells/storm-of-vengeance.js'
import { symbol } from '@artificer-toolkit/source-data/srd/spells/symbol.js'
import { silentImage } from '@artificer-toolkit/source-data/srd/spells/silent-image.js'
import { teleport } from '@artificer-toolkit/source-data/srd/spells/teleport.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

describe('a spell whose core-option outcome keeps a GM ruling beside it (SPELLS-4.T2a5, SPELLS-4.T2u, SPELLS-4.T2l3, SPELLS-4.T2m3, SPELLS-4.T2m2, SPELLS-4.T2q, SPELLS-4.T2s, SPELLS-4.T2r, D156)', () => {
  it.each([
    ['Feeblemind', feeblemind],
    ['Silent Image', silentImage],
    ['Teleport', teleport],
    // SPELLS-4.T2o (D187a): no 3D position model, so the movement is a GM ruling.
    ['Jump', jump],
    ['Levitate', levitate],
    ['Reverse Gravity', reverseGravity],
    ['Time Stop', timeStop],
    // SPELLS-4.T2m3 (D187a): the 7-day disease outlasts the active-effect turn cap, so it is a GM ruling.
    ['Contagion', contagion],
    // SPELLS-4.T2q (D187a): no armed, staged or deferred zone exists, so each is a GM ruling.
    ['Glyph of Warding', glyphOfWarding],
    ['Symbol', symbol],
    ['Delayed Blast Fireball', delayedBlastFireball],
    ['Storm of Vengeance', stormOfVengeance],
    // SPELLS-4.T2m2 (D187a): magical paralysis and restraint are source-trait condition immunities;
    // the speed, terrain and escape clauses are a GM ruling. Calm Emotions is a GM ruling.
    ['Freedom of Movement', freedomOfMovement],
    ['Calm Emotions', calmEmotions],
    // SPELLS-4.T2s (D187a): possession, the bound service and the illusory double are GM rulings.
    ['Magic Jar', magicJar],
    ['Planar Binding', planarBinding],
    ['Project Image', projectImage],
    // SPELLS-4.T2r (D187a): no creature-kind aura or stored spell exists, so each is a GM ruling.
    ['Antipathy/Sympathy', antipathySympathy],
    ['Contingency', contingency]
  ])('keeps the SRD %s effect exactly as authored', async (_name, spell) => {
    // Equipment authoring the spell's effects: the effect list every owner shares.
    const authored = { ...structuredClone(caltropsBagOf20), effects: spell.effects }
    const result = await normalizeNodeRuntimeValues(reader, {
      mapId: 'equipment',
      systemId: srdSystemRecord.id,
      values: structuredClone(authored) as Record<string, unknown>
    })
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(
      (authored as EquipmentAuthored).effects
    )
  })
})
