import { describe, expect, it } from 'vitest'
import { compileSpellEffect } from '@artificer-toolkit/shared/compilers'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'

import { compileActionPlacement } from '../encounterActionEntryPointCompiler.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'

const SPELL_CAST_LEVEL = 9

function zonePlacementOf(label: string) {
  const spell = srdBaselineContent.subjects.spells.find((entry) => entry.label === label)
  if (!spell) throw new Error(`SRD spell ${label} is missing.`)
  const [effect] = spell.effects
  if (!effect) throw new Error(`SRD spell ${label} authors no Effect.`)
  const placement = compileActionPlacement(
    dnd5eCharacterRuleActionSystemAdapter,
    characterActionDescriptor(
      compileSpellEffect(
        { attributes: spell.attributes, effects: spell.effects },
        { ...effect, id: ACTION_EFFECT_ID }
      ),
      SPELL_CAST_LEVEL,
      20
    )
  )
  if (placement?.kind !== 'ZONE') throw new Error(`SRD spell ${label} places no zone.`)
  return placement.zonePlacement
}

describe('a Concentration wall holds its zone by Concentration, not a timed duration (QUALITY-15.T3ah)', () => {
  it.each(['Wall of Fire', 'Wall of Force', 'Wall of Ice', 'Wall of Stone'])(
    'places %s maintained by Concentration with no timed duration',
    (label) => {
      const zone = zonePlacementOf(label)
      expect(zone.maintenance).not.toBeNull()
      expect(zone.duration).toBeUndefined()
    }
  )
})
