import { describe, expect, it } from 'vitest'

import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'
import { beaconOfHope } from '@artificer-toolkit/source-data/srd/spells/beacon-of-hope.js'
import { blur } from '@artificer-toolkit/source-data/srd/spells/blur.js'
import { enthrall } from '@artificer-toolkit/source-data/srd/spells/enthrall.js'
import { arcaneSword } from '@artificer-toolkit/source-data/srd/spells/arcane-sword.js'
import { faithfulHound } from '@artificer-toolkit/source-data/srd/spells/faithful-hound.js'
import { flameBlade } from '@artificer-toolkit/source-data/srd/spells/flame-blade.js'
import { guidingBolt } from '@artificer-toolkit/source-data/srd/spells/guiding-bolt.js'
import { heatMetal } from '@artificer-toolkit/source-data/srd/spells/heat-metal.js'
import { vampiricTouch } from '@artificer-toolkit/source-data/srd/spells/vampiric-touch.js'
import { light } from '@artificer-toolkit/source-data/srd/spells/light.js'
import { mageArmor } from '@artificer-toolkit/source-data/srd/spells/mage-armor.js'
import { magicWeapon } from '@artificer-toolkit/source-data/srd/spells/magic-weapon.js'
import { mindBlank } from '@artificer-toolkit/source-data/srd/spells/mind-blank.js'
import { mirrorImage } from '@artificer-toolkit/source-data/srd/spells/mirror-image.js'
import { produceFlame } from '@artificer-toolkit/source-data/srd/spells/produce-flame.js'
import { passWithoutTrace } from '@artificer-toolkit/source-data/srd/spells/pass-without-trace.js'
import { sequester } from '@artificer-toolkit/source-data/srd/spells/sequester.js'
import { reincarnate } from '@artificer-toolkit/source-data/srd/spells/reincarnate.js'
import { revivify } from '@artificer-toolkit/source-data/srd/spells/revivify.js'
import { shillelagh } from '@artificer-toolkit/source-data/srd/spells/shillelagh.js'
import { spiritualWeapon } from '@artificer-toolkit/source-data/srd/spells/spiritual-weapon.js'
import { trueResurrection } from '@artificer-toolkit/source-data/srd/spells/true-resurrection.js'
import { trueStrike } from '@artificer-toolkit/source-data/srd/spells/true-strike.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

/** D156 T2a3, T2a4, T2e, T2g1, T2k1, T2n1 and T2v2a3d: spells converted from closed rules to core options (ADR 0038 parity). */
describe('spells authored from core options through the effect node map (SPELLS-4.T2a3, T2a4, T2e, T2g1, T2k1, T2n1, T2v2a3d, T2w, SPELLS-8.T7)', () => {
  it.each([
    ['Beacon of Hope', beaconOfHope],
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
    ['Vampiric Touch', vampiricTouch],
    ['Flame Blade', flameBlade],
    ['Produce Flame', produceFlame],
    ['True Strike', trueStrike],
    ['Revivify', revivify],
    ['Reincarnate', reincarnate],
    ['True Resurrection', trueResurrection],
    ['Spiritual Weapon', spiritualWeapon],
    // SPELLS-8.T7 (D187a): a summoned sword the caster attacks through, like Spiritual Weapon.
    ['Arcane Sword', arcaneSword],
    // SPELLS-4.T2w (D187a): a summon, with the bark and bite as a GM ruling.
    ['Faithful Hound', faithfulHound]
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

  it('authors a homebrew healing-maximizing grant with a different save ability', async () => {
    const effects = structuredClone(beaconOfHope.effects)
    const [path] = effects![0]!.paths as unknown as [
      { resultBlock: { outcomes: [{ grants: { modifiers: { domain: { ability?: string } }[] } }] } }
    ]
    const [grant] = path.resultBlock.outcomes
    grant.grants.modifiers[0]!.domain.ability = 'CHARISMA'
    const authored = { ...structuredClone(caltropsBagOf20), effects }
    const result = await normalizeNodeRuntimeValues(reader, {
      mapId: 'equipment',
      systemId: srdSystemRecord.id,
      values: structuredClone(authored) as Record<string, unknown>
    })
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
  })
})
