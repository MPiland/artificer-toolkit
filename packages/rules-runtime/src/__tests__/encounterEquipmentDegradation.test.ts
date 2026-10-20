import { compileEffect, compileEquipment } from '@artificer-toolkit/shared/compilers'
import { rustMonster } from '@artificer-toolkit/source-data/srd/creatures/rust-monster.js'
import { blackPudding } from '@artificer-toolkit/source-data/srd/creatures/black-pudding.js'
import { chainMail } from '@artificer-toolkit/source-data/srd/equipment/chain-mail.js'
import { mace } from '@artificer-toolkit/source-data/srd/equipment/mace.js'
import { leatherArmor } from '@artificer-toolkit/source-data/srd/equipment/leather-armor.js'
import { longsword } from '@artificer-toolkit/source-data/srd/equipment/longsword.js'
import { longbow } from '@artificer-toolkit/source-data/srd/equipment/longbow.js'
import { shieldMetal } from '@artificer-toolkit/source-data/srd/equipment/shield-metal.js'
import { describe, expect, it } from 'vitest'

import { planEncounterEquipmentDegradation } from '../encounterEquipmentDegradation.js'

const featureEffect = (
  creature: typeof rustMonster,
  label: string
): Parameters<typeof compileEffect>[0] => {
  const effect = creature.features?.find((feature) => feature.label === label)?.effects?.[0]
  if (!effect) throw new Error(`${label} has no Effect.`)
  return effect
}
const antennae = { compiledEffect: compileEffect(featureEffect(rustMonster, 'Antennae')) }
const corrosion = {
  compiledEffect: compileEffect(
    blackPudding.features?.find((feature) => feature.label === 'Corrosive Form')?.effects?.[1] ??
      (() => {
        throw new Error('Corrosive Form has no weapon-hit Effect.')
      })()
  )
}
const pseudopod = { compiledEffect: compileEffect(featureEffect(blackPudding, 'Pseudopod')) }

function worn(
  instanceId: string,
  authored: Parameters<typeof compileEquipment>[0],
  options: { degradation?: number; equipped?: boolean } = {}
) {
  return {
    instanceId,
    equippedState: options.equipped === false ? undefined : { slot: 'WORN' as const },
    degradation: options.degradation,
    compiledItem: compileEquipment(authored)
  }
}

describe('planEncounterEquipmentDegradation (SPELLS-33 T6i)', () => {
  it('corrodes worn armor by one step and keeps it while it still offers more than 10', () => {
    expect(
      planEncounterEquipmentDegradation({
        capability: pseudopod,
        resultPath: 'ON_HIT',
        items: [worn('a', chainMail, { degradation: 2 })]
      })
    ).toEqual({ kind: 'DEGRADE', itemInstanceId: 'a', afterPenalty: 3, destroyed: false })
  })

  it('destroys armor whose offered armor class falls to 10', () => {
    expect(
      planEncounterEquipmentDegradation({
        capability: pseudopod,
        resultPath: 'ON_HIT',
        items: [worn('a', leatherArmor)]
      })
    ).toEqual({ kind: 'DEGRADE', itemInstanceId: 'a', afterPenalty: 1, destroyed: true })
  })

  it('degrades nothing on a path the effect does not author, and says so', () => {
    expect(
      planEncounterEquipmentDegradation({
        capability: pseudopod,
        resultPath: 'ON_MISS',
        items: [worn('a', chainMail)]
      })
    ).toEqual({ kind: 'NONE', reason: 'NO_DEGRADATION' })
  })

  it('is a no-op against a target that is not a Character, with the reason', () => {
    expect(
      planEncounterEquipmentDegradation({
        capability: pseudopod,
        resultPath: 'ON_HIT',
        items: null
      })
    ).toEqual({ kind: 'NONE', reason: 'NOT_CHARACTER' })
  })

  it('skips unequipped, magic and wrong-material items', () => {
    const magicMail = {
      ...chainMail,
      properties: [...(chainMail.properties ?? []), 'MAGIC' as const]
    }
    expect(
      planEncounterEquipmentDegradation({
        capability: pseudopod,
        resultPath: 'ON_HIT',
        items: [worn('a', chainMail, { equipped: false }), worn('b', magicMail)]
      })
    ).toEqual({ kind: 'NONE', reason: 'NO_ELIGIBLE_ITEM' })
    expect(
      planEncounterEquipmentDegradation({
        capability: antennae,
        resultPath: 'ON_SAVE_FAIL',
        items: [worn('a', leatherArmor)]
      })
    ).toEqual({ kind: 'NONE', reason: 'NO_ELIGIBLE_ITEM' })
  })

  it('rusts metal armor before a shield, destroys a +2 shield at -2 and a weapon at -5', () => {
    const rust = (items: ReturnType<typeof worn>[]) =>
      planEncounterEquipmentDegradation({ capability: antennae, resultPath: 'ON_SAVE_FAIL', items })
    expect(rust([worn('s', shieldMetal), worn('a', chainMail)])).toMatchObject({
      itemInstanceId: 'a',
      afterPenalty: 1,
      destroyed: false
    })
    expect(rust([worn('s', shieldMetal)])).toMatchObject({ afterPenalty: 1, destroyed: false })
    expect(rust([worn('s', shieldMetal, { degradation: 1 })])).toMatchObject({
      itemInstanceId: 's',
      afterPenalty: 2,
      destroyed: true
    })
    expect(rust([worn('w', longsword, { degradation: 3 })])).toMatchObject({
      itemInstanceId: 'w',
      afterPenalty: 4,
      destroyed: false
    })
    expect(rust([worn('w', longsword, { degradation: 4 })])).toMatchObject({
      afterPenalty: 5,
      destroyed: true
    })
  })

  it('narrows to the chosen item', () => {
    expect(
      planEncounterEquipmentDegradation({
        capability: antennae,
        resultPath: 'ON_SAVE_FAIL',
        items: [worn('a', chainMail), worn('w', longsword)],
        chosenItemInstanceId: 'w'
      })
    ).toMatchObject({ itemInstanceId: 'w', afterPenalty: 1 })
  })

  describe('Corrosive Form: the weapon that hit (SPELLS-33 T6i2)', () => {
    const corrode = (items: ReturnType<typeof worn>[], chosenItemInstanceId?: string) =>
      planEncounterEquipmentDegradation({
        capability: corrosion,
        resultPath: 'PASSIVE',
        subject: 'ATTACKER_WEAPON',
        items,
        chosenItemInstanceId
      })

    it('degrades the chosen metal or wood weapon and destroys it at -5', () => {
      expect(corrode([worn('w', longsword, { degradation: 1 })], 'w')).toEqual({
        kind: 'DEGRADE',
        itemInstanceId: 'w',
        afterPenalty: 2,
        destroyed: false
      })
      expect(corrode([worn('c', mace, { degradation: 4 })], 'c')).toMatchObject({
        afterPenalty: 5,
        destroyed: true
      })
    })

    it('does not touch a launcher, whose ammunition is spent by the shot', () => {
      expect(corrode([worn('b', longbow)], 'b')).toEqual({
        kind: 'NONE',
        reason: 'NO_ELIGIBLE_ITEM'
      })
    })

    it('ignores entries of the other subject, in both directions', () => {
      expect(
        planEncounterEquipmentDegradation({
          capability: corrosion,
          resultPath: 'PASSIVE',
          items: [worn('w', longsword)]
        })
      ).toEqual({ kind: 'NONE', reason: 'NO_DEGRADATION' })
      expect(
        planEncounterEquipmentDegradation({
          capability: pseudopod,
          resultPath: 'ON_HIT',
          subject: 'ATTACKER_WEAPON',
          items: [worn('a', chainMail)]
        })
      ).toEqual({ kind: 'NONE', reason: 'NO_DEGRADATION' })
    })

    it('is a no-op for a Creature attacker, with the reason', () => {
      expect(corrode([] as ReturnType<typeof worn>[]).kind).toBe('NONE')
      expect(
        planEncounterEquipmentDegradation({
          capability: corrosion,
          resultPath: 'PASSIVE',
          subject: 'ATTACKER_WEAPON',
          items: null
        })
      ).toEqual({ kind: 'NONE', reason: 'NOT_CHARACTER' })
    })
  })
})
