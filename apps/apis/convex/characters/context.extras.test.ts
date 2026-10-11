import { describe, expect, it } from 'vitest'
import { createEmptyCharacterAuthored } from '@artificer-toolkit/shared/character'
import { evaluateCharacterRules } from '@artificer-toolkit/rules-runtime/character/characterRuleEvaluation'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { shieldWood } from '@artificer-toolkit/source-data/srd/equipment/shield-wood.js'
import { cat } from '@artificer-toolkit/source-data/srd/creatures/cat.js'
import { rowboat } from '@artificer-toolkit/source-data/srd/vehicles/rowboat.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { fixture, input } from '../../tests/fixtures/characters'
import { srdPrintedArmorClass, srdWolf } from '../../tests/fixtures/srdCreatures'
import { importedSubject } from '../../tests/fixtures/publication'
import { api, internal } from '../_generated/api'
import { loadCharacterRuleContext } from './context'

describe('current Character extra sources', () => {
  it('loads selected current Creature/Vehicle documents once and supplies companion policy facts', async () => {
    const { t, owner, other } = await fixture()
    await t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [
        importedSubject({ subjectKind: 'CREATURE', ...cat, document: { ...cat, features: [] } }),
        importedSubject({
          subjectKind: 'VEHICLE',
          ...rowboat,
          document: { ...rowboat, features: [] }
        })
      ]
    })
    const ownedDraft = await owner.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'CREATURE',
      subjectId: cat.id
    })
    if (!ownedDraft.updatedAt) throw new Error('Missing Creature draft timestamp.')
    const ownedCat = creatureAuthoredDtoSchema.parse(ownedDraft.payload)
    await owner.caller.mutation(api.content.publication.publishDraft, {
      subjectKind: 'CREATURE',
      subjectId: ownedDraft.subjectId,
      expectedDraftUpdatedAt: ownedDraft.updatedAt
    })
    const character = createEmptyCharacterAuthored({ ...input(), userId: owner.userId })
    character.state.creatures = ['first-cat', 'second-cat'].map((id) => ({
      id,
      creatureId: ownedCat.id,
      relationshipKind: 'COMPANION',
      originKind: 'WORLD'
    }))
    character.state.vehicles = [{ id: 'boat', vehicleId: rowboat.id }]
    const result = await t.run(async (ctx) => {
      const context = await loadCharacterRuleContext(ctx, character, owner.userId)
      return {
        creatures: [...context.creaturesById.values()],
        vehicles: [...context.vehiclesById.values()],
        companions: evaluateCharacterRules({
          character,
          context,
          creaturesById: context.creaturesById
        }).snapshot.companions
      }
    })
    expect(result.creatures.map((creature) => creature.id)).toEqual([ownedCat.id])
    expect(result.vehicles.map((vehicle) => vehicle.id)).toEqual([rowboat.id])
    expect(result.companions).toEqual([
      expect.objectContaining({
        companionInstanceId: 'first-cat',
        creatureId: ownedCat.id,
        maxHitPoints: cat.hitPoints
      }),
      expect.objectContaining({
        companionInstanceId: 'second-cat',
        creatureId: ownedCat.id,
        maxHitPoints: cat.hitPoints
      })
    ])
    await expect(
      t.run((ctx) => loadCharacterRuleContext(ctx, character, other.userId))
    ).rejects.toThrow('current user')

    expect(
      await t.run(async (ctx) => {
        const context = await loadCharacterRuleContext(
          ctx,
          { ...character, userId: other.userId },
          other.userId
        )
        return { creatures: context.creaturesById.size, vehicles: context.vehiclesById.size }
      })
    ).toEqual({ creatures: 0, vehicles: 1 })

    const edit = await owner.caller.mutation(api.content.drafts.save, {
      subjectKind: 'CREATURE',
      subjectId: ownedCat.id,
      systemId: ownedCat.systemId,
      label: ownedCat.label,
      payload: { ...ownedCat, hitPoints: 8 }
    })
    expect(
      await t.run(async (ctx) => {
        const context = await loadCharacterRuleContext(ctx, character, owner.userId)
        return context.creaturesById.get(ownedCat.id)?.hitPoints
      })
    ).toBe(cat.hitPoints)
    if (!edit.updatedAt) throw new Error('Missing edited Creature draft timestamp.')
    await owner.caller.mutation(api.content.publication.publishDraft, {
      subjectKind: 'CREATURE',
      subjectId: ownedCat.id,
      expectedDraftUpdatedAt: edit.updatedAt
    })
    const updated = await t.run(async (ctx) => {
      const context = await loadCharacterRuleContext(ctx, character, owner.userId)
      return evaluateCharacterRules({ character, context, creaturesById: context.creaturesById })
        .snapshot.companions
    })
    expect(updated?.map((companion) => companion.maxHitPoints)).toEqual([8, 8])
    expect(result.companions?.map((companion) => companion.maxHitPoints)).toEqual([
      cat.hitPoints,
      cat.hitPoints
    ])

    character.state.creatures[0]!.creatureId = rowboat.id
    character.state.creatures[1]!.creatureId = crypto.randomUUID()
    character.state.vehicles[0]!.vehicleId = cat.id
    expect(
      await t.run(async (ctx) => {
        const context = await loadCharacterRuleContext(ctx, character, owner.userId)
        return { creatures: context.creaturesById.size, vehicles: context.vehiclesById.size }
      })
    ).toEqual({ creatures: 0, vehicles: 0 })
  })
  it('computes a companion Creature armor class from its loadout Equipment', async () => {
    const { t, owner } = await fixture()
    const shieldedWolf = {
      ...srdWolf,
      equipmentLoadout: [
        {
          id: crypto.randomUUID(),
          equipmentId: shieldWood.id,
          quantity: 1,
          useState: 'OFF_HAND' as const,
          attuned: false,
          actionFeatureIds: []
        }
      ]
    }
    await t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [
        importedSubject({
          subjectKind: 'CREATURE',
          ...shieldedWolf,
          document: shieldedWolf
        }),
        importedSubject({ subjectKind: 'EQUIPMENT', ...shieldWood, document: shieldWood })
      ]
    })
    const character = createEmptyCharacterAuthored({ ...input(), userId: owner.userId })
    character.state.creatures = [
      {
        id: 'shield-wolf',
        creatureId: shieldedWolf.id,
        relationshipKind: 'COMPANION',
        originKind: 'WORLD'
      }
    ]
    const companions = await t.run(async (ctx) => {
      const context = await loadCharacterRuleContext(ctx, character, owner.userId)
      return evaluateCharacterRules({ character, context, creaturesById: context.creaturesById })
        .snapshot.companions
    })
    expect(companions).toEqual([
      expect.objectContaining({
        companionInstanceId: 'shield-wolf',
        armorClass: srdPrintedArmorClass(srdWolf) + 2
      })
    ])
  })
})
