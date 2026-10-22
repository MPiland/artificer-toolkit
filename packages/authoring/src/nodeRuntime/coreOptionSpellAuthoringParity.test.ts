import { describe, expect, it } from 'vitest'

import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'
import { blur } from '@artificer-toolkit/source-data/srd/spells/blur.js'
import { enthrall } from '@artificer-toolkit/source-data/srd/spells/enthrall.js'
import { guidingBolt } from '@artificer-toolkit/source-data/srd/spells/guiding-bolt.js'
import { heatMetal } from '@artificer-toolkit/source-data/srd/spells/heat-metal.js'
import { light } from '@artificer-toolkit/source-data/srd/spells/light.js'
import { mageArmor } from '@artificer-toolkit/source-data/srd/spells/mage-armor.js'
import { magicWeapon } from '@artificer-toolkit/source-data/srd/spells/magic-weapon.js'
import { mindBlank } from '@artificer-toolkit/source-data/srd/spells/mind-blank.js'
import { mirrorImage } from '@artificer-toolkit/source-data/srd/spells/mirror-image.js'
import { passWithoutTrace } from '@artificer-toolkit/source-data/srd/spells/pass-without-trace.js'
import { sequester } from '@artificer-toolkit/source-data/srd/spells/sequester.js'
import { shillelagh } from '@artificer-toolkit/source-data/srd/spells/shillelagh.js'
import { trueStrike } from '@artificer-toolkit/source-data/srd/spells/true-strike.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

/** D156 T2a3, T2a4, T2e and T2k1: spells converted from closed rules to core options (ADR 0038 parity). */
describe('spells authored from core options through the effect node map (SPELLS-4.T2a3, T2a4, T2e, T2k1)', () => {
  it.each([
    ['Blur', blur],
    ['Enthrall', enthrall],
    ['Guiding Bolt', guidingBolt],
    ['Light', light],
    ['Mage Armor', mageArmor],
    ['Mind Blank', mindBlank],
    ['Mirror Image', mirrorImage],
    ['Pass without Trace', passWithoutTrace],
    ['Sequester', sequester],
    ['Shillelagh', shillelagh],
    ['Magic Weapon', magicWeapon],
    ['Heat Metal', heatMetal],
    ['True Strike', trueStrike]
  ])('keeps the SRD %s effect exactly as authored', async (_name, spell) => {
    const authored = { ...structuredClone(caltropsBagOf20), effects: spell.effects }
    const result = await normalizeNodeRuntimeValues(reader, {
      mapId: 'equipment',
      systemId: srdSystemRecord.id,
      values: structuredClone(authored) as Record<string, unknown>
    })
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
  })
})
