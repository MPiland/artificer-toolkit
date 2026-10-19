import { describe, expect, it } from 'vitest'

import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { bestowCurse } from '@artificer-toolkit/source-data/srd/spells/bestow-curse.js'
import { brandingSmite } from '@artificer-toolkit/source-data/srd/spells/branding-smite.js'
import { divineFavor } from '@artificer-toolkit/source-data/srd/spells/divine-favor.js'
import { enlargeReduce } from '@artificer-toolkit/source-data/srd/spells/enlarge-reduce.js'
import { huntersMark } from '@artificer-toolkit/source-data/srd/spells/hunters-mark.js'
import type { SpellAuthored } from '@artificer-toolkit/shared/authored'

import { attackHitEndedEffects } from '../encounterEndedEffectRelease.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import { srdCreatureActor, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { plannedGrantEffect } from './antitoxinEffectFixture.js'
import {
  QUILL_VOLLEY_ID,
  creatureActor,
  prepareCreatureAction,
  quillVolley,
  settleCreatureAction,
  srdDamageTypeId
} from './encounterCreatureAction.js'

const ATTACKER_ID = testUuid(0xd1)
const TARGET_ID = testUuid(0xd2)
const BYSTANDER_ID = testUuid(0xd3)
const EFFECT_ID = testUuid(0xd4)

/** The active effect the real compiler plans for one SRD spell, held by `holderActorId`. */
function spellEffect(
  spell: SpellAuthored,
  input: {
    holderActorId: string
    sourceActorId?: string
    spellCastLevel?: number
    choiceLabel?: string
  }
) {
  return plannedGrantEffect({
    id: EFFECT_ID,
    effect: spell.effects?.[0],
    sourceLabel: spell.label,
    ...input
  })
}

/** A +5 ranged Quill Volley (3 piercing on a hit) at the Ogre (AC 11), under both sides' effects. */
async function quillShot(input: {
  actorActiveEffects?: readonly ActiveRuleEffectRecord[]
  targetActiveEffects?: readonly ActiveRuleEffectRecord[]
  rolls: number[]
}) {
  const prepared = await prepareCreatureAction({
    actor: creatureActor({
      id: ATTACKER_ID,
      label: 'Quill Beast',
      features: [quillVolley({ charges: 1, cost: 1, rangeFeet: 80 })]
    }),
    target: srdCreatureActor({ id: TARGET_ID, creature: srdByLabel(SRD.creatures, 'Ogre') }),
    actorActiveEffects: input.actorActiveEffects ?? [],
    targetActiveEffects: input.targetActiveEffects ?? [],
    featureId: QUILL_VOLLEY_ID,
    overridable: true
  })
  return settleCreatureAction({ prepared, rolls: input.rolls })
}

const PIERCING = srdDamageTypeId('PIERCING')
const RADIANT = srdDamageTypeId('RADIANT')
const NECROTIC = srdDamageTypeId('NECROTIC')

describe('damage under rolled damage-die grants (D156)', () => {
  it("adds Divine Favor's 1d4 radiant as its own damage", async () => {
    const { execution } = await quillShot({
      actorActiveEffects: [spellEffect(divineFavor, { holderActorId: ATTACKER_ID })],
      rolls: [9, 2]
    })
    expect(execution.applications).toMatchObject([
      { kind: 'DAMAGE', requestedAmount: 3, damageTypeId: PIERCING },
      {
        kind: 'DAMAGE',
        requestedAmount: 3,
        damageTypeId: RADIANT,
        sourceNodeId: 'added-1-proposal'
      }
    ])
  })

  it('rolls an added die twice on a critical hit: a natural 20 deals 2 + 3 radiant', async () => {
    const { execution } = await quillShot({
      actorActiveEffects: [spellEffect(divineFavor, { holderActorId: ATTACKER_ID })],
      rolls: [19, 1, 2]
    })
    expect(execution.applications).toMatchObject([
      { requestedAmount: 3, damageTypeId: PIERCING },
      { requestedAmount: 5, damageTypeId: RADIANT }
    ])
  })

  it('rolls no added die on a miss', async () => {
    const { execution } = await quillShot({
      actorActiveEffects: [spellEffect(divineFavor, { holderActorId: ATTACKER_ID })],
      rolls: [1]
    })
    expect(execution.applications).toEqual([])
  })

  it("adds Hunter's Mark's 1d6 of the attack's type only when its caster hits the marked target", async () => {
    const marked = await quillShot({
      targetActiveEffects: [
        spellEffect(huntersMark, { holderActorId: TARGET_ID, sourceActorId: ATTACKER_ID })
      ],
      rolls: [9, 4]
    })
    expect(marked.execution.applications).toMatchObject([
      { requestedAmount: 3, damageTypeId: PIERCING },
      { requestedAmount: 5, damageTypeId: PIERCING, sourceNodeId: 'added-1-proposal' }
    ])
    const markedByAnother = await quillShot({
      targetActiveEffects: [
        spellEffect(huntersMark, { holderActorId: TARGET_ID, sourceActorId: BYSTANDER_ID })
      ],
      rolls: [9]
    })
    expect(markedByAnother.execution.applications).toMatchObject([{ requestedAmount: 3 }])
    expect(markedByAnother.execution.applications).toHaveLength(1)
  })

  it("adds Branding Smite's dice per slot level above 2nd: 3d6 radiant at 3rd level", async () => {
    const { execution } = await quillShot({
      actorActiveEffects: [
        spellEffect(brandingSmite, { holderActorId: ATTACKER_ID, spellCastLevel: 3 })
      ],
      rolls: [9, 0, 1, 2]
    })
    expect(execution.applications).toMatchObject([
      { requestedAmount: 3, damageTypeId: PIERCING },
      { requestedAmount: 6, damageTypeId: RADIANT }
    ])
  })

  it('ends Branding Smite on the first hit and keeps it through a miss', () => {
    const smite = spellEffect(brandingSmite, { holderActorId: ATTACKER_ID, spellCastLevel: 2 })
    const hit = attackHitEndedEffects({
      holderActorId: ATTACKER_ID,
      held: [smite],
      resultPath: 'ON_HIT'
    })
    expect(hit.consumedGrants.map(({ id }) => id)).toEqual([EFFECT_ID])
    const miss = attackHitEndedEffects({
      holderActorId: ATTACKER_ID,
      held: [smite],
      resultPath: 'ON_MISS'
    })
    expect(miss.consumedGrants).toEqual([])
  })

  it("adds Enlarge's 1d4 of the attack's type", async () => {
    const { execution } = await quillShot({
      actorActiveEffects: [
        spellEffect(enlargeReduce, { holderActorId: ATTACKER_ID, choiceLabel: 'Enlarge' })
      ],
      rolls: [9, 1]
    })
    expect(execution.applications).toMatchObject([
      { requestedAmount: 3, damageTypeId: PIERCING },
      { requestedAmount: 2, damageTypeId: PIERCING }
    ])
  })

  it("takes Reduce's 1d4 off the damage: 3 - 1 = 2", async () => {
    const { execution } = await quillShot({
      actorActiveEffects: [
        spellEffect(enlargeReduce, { holderActorId: ATTACKER_ID, choiceLabel: 'Reduce' })
      ],
      rolls: [9, 0]
    })
    expect(execution.applications).toMatchObject([{ requestedAmount: 2, damageTypeId: PIERCING }])
    expect(execution.applications).toHaveLength(1)
  })

  it("floors Reduce's damage at 0 and deals none: 3 - 4", async () => {
    const { execution } = await quillShot({
      actorActiveEffects: [
        spellEffect(enlargeReduce, { holderActorId: ATTACKER_ID, choiceLabel: 'Reduce' })
      ],
      rolls: [9, 3]
    })
    expect(execution.applications).toEqual([])
  })

  it("adds Bestow Curse's 1d8 necrotic when its caster hits the cursed target", async () => {
    const { execution } = await quillShot({
      targetActiveEffects: [
        spellEffect(bestowCurse, {
          holderActorId: TARGET_ID,
          sourceActorId: ATTACKER_ID,
          choiceLabel: 'Necrotic Damage'
        })
      ],
      rolls: [9, 7]
    })
    expect(execution.applications).toMatchObject([
      { requestedAmount: 3, damageTypeId: PIERCING },
      { requestedAmount: 8, damageTypeId: NECROTIC }
    ])
  })

  it("gives the cursed attacker disadvantage only against Bestow Curse's caster", async () => {
    const cursedByTarget = await quillShot({
      actorActiveEffects: [
        spellEffect(bestowCurse, {
          holderActorId: ATTACKER_ID,
          sourceActorId: TARGET_ID,
          choiceLabel: 'Attacks Against You'
        })
      ],
      rolls: [19, 2]
    })
    expect(cursedByTarget.execution.d20).toMatchObject({ rawFaces: [20, 3], total: 8 })
    expect(cursedByTarget.execution.applications).toEqual([])
    const cursedByAnother = await quillShot({
      actorActiveEffects: [
        spellEffect(bestowCurse, {
          holderActorId: ATTACKER_ID,
          sourceActorId: BYSTANDER_ID,
          choiceLabel: 'Attacks Against You'
        })
      ],
      rolls: [9]
    })
    expect(cursedByAnother.execution.d20).toMatchObject({ rawFaces: [10], total: 15 })
  })
})
