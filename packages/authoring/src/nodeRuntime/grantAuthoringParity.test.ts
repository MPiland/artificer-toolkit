import { describe, expect, it } from 'vitest'

import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'
import { alterSelf } from '@artificer-toolkit/source-data/srd/spells/alter-self.js'
import { bane } from '@artificer-toolkit/source-data/srd/spells/bane.js'
import { bestowCurse } from '@artificer-toolkit/source-data/srd/spells/bestow-curse.js'
import { bless } from '@artificer-toolkit/source-data/srd/spells/bless.js'
import { brandingSmite } from '@artificer-toolkit/source-data/srd/spells/branding-smite.js'
import { divineFavor } from '@artificer-toolkit/source-data/srd/spells/divine-favor.js'
import { enlargeReduce } from '@artificer-toolkit/source-data/srd/spells/enlarge-reduce.js'
import { expeditiousRetreat } from '@artificer-toolkit/source-data/srd/spells/expeditious-retreat.js'
import { foresight } from '@artificer-toolkit/source-data/srd/spells/foresight.js'
import { gaseousForm } from '@artificer-toolkit/source-data/srd/spells/gaseous-form.js'
import { glibness } from '@artificer-toolkit/source-data/srd/spells/glibness.js'
import { guidance } from '@artificer-toolkit/source-data/srd/spells/guidance.js'
import { gustOfWind } from '@artificer-toolkit/source-data/srd/spells/gust-of-wind.js'
import { haste } from '@artificer-toolkit/source-data/srd/spells/haste.js'
import { huntersMark } from '@artificer-toolkit/source-data/srd/spells/hunters-mark.js'
import { rayOfEnfeeblement } from '@artificer-toolkit/source-data/srd/spells/ray-of-enfeeblement.js'
import { resistance } from '@artificer-toolkit/source-data/srd/spells/resistance.js'
import { slow } from '@artificer-toolkit/source-data/srd/spells/slow.js'
import { spiderClimb } from '@artificer-toolkit/source-data/srd/spells/spider-climb.js'
import { sunbeam } from '@artificer-toolkit/source-data/srd/spells/sunbeam.js'
import { telekinesis } from '@artificer-toolkit/source-data/srd/spells/telekinesis.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

describe('a spell authored from core Modifier Grants through the effect node map (SPELLS-4.T2a2, ADR 0038)', () => {
  it.each([
    ['Bane', bane],
    ['Bless', bless],
    ['Foresight', foresight],
    ['Glibness', glibness],
    ['Guidance', guidance],
    ['Resistance', resistance],
    ['Slow', slow],
    // SPELLS-4.T2d: rolled damage dice, a mark, a hit-consumed die and a cast choice.
    ['Divine Favor', divineFavor],
    ['Branding Smite', brandingSmite],
    // SPELLS-4.T2d2: the effect offer (`lifecycle.effectOffers`) Hunter's Mark authors to move itself.
    ["Hunter's Mark", huntersMark],
    ['Enlarge/Reduce', enlargeReduce],
    ['Bestow Curse', bestowCurse],
    // SPELLS-4.T2l-a: the follow-on grant (`lifecycle.onEnd`) Haste's lethargy authors.
    ['Haste', haste],
    // SPELLS-4.T2lb: the actions a held effect offers (`lifecycle.grantedActions`), Haste's extra action and Expeditious Retreat's Dash.
    ['Expeditious Retreat', expeditiousRetreat],
    // SPELLS-4.T2o: a speed equal to another speed (`payload.equalsSpeedId`).
    ['Spider Climb', spiderClimb],
    ['Alter Self', alterSelf],
    // SPELLS-4.T2p: Gaseous Form's speeds, save advantage and nonmagical resistance; Sunbeam's
    // save, damage and blindness; Gust of Wind, Telekinesis and Ray of Enfeeblement as GM rulings.
    ['Gaseous Form', gaseousForm],
    ['Sunbeam', sunbeam],
    ['Gust of Wind', gustOfWind],
    ['Telekinesis', telekinesis],
    ['Ray of Enfeeblement', rayOfEnfeeblement]
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
