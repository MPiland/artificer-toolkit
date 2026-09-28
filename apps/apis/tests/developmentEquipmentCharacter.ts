import assert from 'node:assert/strict'
import type { ConvexHttpClient } from 'convex/browser'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { acquiredEquipmentRulesSchema } from '@artificer-toolkit/schema/projections/acquiredEquipmentRules'
import type { CharacterStateDto } from '@artificer-toolkit/schema/subjects/character'
import type { CharacterSheetCommandInputDto } from '@artificer-toolkit/schema/api/characterSheetCommands'
import type { DevelopmentClient } from './developmentClient'
import { createDevelopmentCharacter } from './developmentCharacterFixture'
import { api } from '../convex/_generated/api.js'

export async function verifyEquipmentCharacterDeletion({
  owner,
  other,
  anonymous,
  characterId
}: {
  owner: DevelopmentClient & Pick<ConvexHttpClient, 'action'>
  other: DevelopmentClient
  anonymous: DevelopmentClient
  characterId: string
}) {
  const { committed, character, equipment } = await createDevelopmentCharacter(owner, characterId)
  let version = committed.streamVersion
  async function execute(command: CharacterSheetCommandInputDto) {
    const result = await owner.mutation(api.characters.sheetCommands.execute, {
      id: characterId,
      command
    })
    version = result.streamVersion
    return result
  }
  await execute({
    type: 'ADD_INVENTORY_ITEM',
    commandId: crypto.randomUUID(),
    expectedVersion: version,
    equipmentId: equipment.subjectId,
    quantity: 1,
    customName: 'Disposable pack'
  })
  const current = await owner.query(api.characters.builder.activeCharacter, { id: characterId })
  assert.ok(current)
  const pack = current.state.equipment.inventory.find(
    (item) => item.equipmentId === equipment.subjectId
  )
  assert.ok(pack)
  await execute({
    type: 'ADD_INVENTORY_ITEM',
    commandId: crypto.randomUUID(),
    expectedVersion: version,
    equipmentId: club.id,
    quantity: 1,
    containerId: pack.id,
    notes: 'Private surviving item'
  })
  if (fighter.category !== 'BASE') throw new Error('Retention requires the base Fighter.')
  await execute({
    type: 'ADJUST_CURRENCY',
    commandId: crypto.randomUUID(),
    expectedVersion: version,
    kind: 'RULESET',
    currencyId: fighter.startingGold.currencyId,
    amount: 10,
    containerId: pack.id
  })
  await execute({
    type: 'CREATE_NOTE',
    commandId: crypto.randomUUID(),
    expectedVersion: version,
    title: 'Private survivor',
    body: 'Keep the original private text.',
    groupId: 'session-notes'
  })
  await execute({
    type: 'UPSERT_SHEET_ADJUSTMENT',
    commandId: crypto.randomUUID(),
    expectedVersion: version,
    adjustment: {
      id: crypto.randomUUID(),
      family: 'ABILITY',
      ability: 'STRENGTH',
      field: 'SCORE_OVERRIDE',
      value: 20,
      sourceNote: 'Private surviving override'
    }
  })
  const opened = await owner.mutation(api.characters.drafts.create, {
    id: characterId,
    systemId: character.systemId
  })
  const saved = await owner.mutation(api.characters.drafts.save, {
    characterId,
    expectedDraftId: opened.id,
    mode: 'edit',
    character: { ...opened.payload.character, label: 'Retained working draft' }
  })
  const before = await owner.query(api.characters.builder.activeCharacter, { id: characterId })
  assert.ok(before)
  const remove = { subjectKind: 'EQUIPMENT' as const, subjectId: equipment.subjectId }
  await assert.rejects(
    anonymous.mutation(api.content.deletion.deleteActive, remove),
    /Unauthenticated/
  )
  await assert.rejects(
    other.mutation(api.content.deletion.deleteActive, remove),
    /cannot be deleted/
  )
  assert.deepEqual(
    await owner.query(api.characters.builder.activeCharacter, { id: characterId }),
    before
  )
  await owner.mutation(api.content.deletion.deleteActive, remove)
  assert.equal(
    await owner.query(api.content.details.get, {
      subjectKind: 'EQUIPMENT',
      id: equipment.subjectId
    }),
    null
  )
  const [after, remainingDraft, sheet] = await Promise.all([
    owner.query(api.characters.builder.activeCharacter, { id: characterId }),
    owner.query(api.characters.drafts.get, { id: characterId }),
    owner.query(api.characters.sheet.get, { id: characterId })
  ])
  assert.ok(
    after && remainingDraft && sheet,
    'Independent Character must retain its playable Sheet and draft.'
  )
  assert.equal(remainingDraft.id, saved.id)
  assert.equal(remainingDraft.payload.character.label, 'Retained working draft')
  for (const value of [after, remainingDraft.payload.character]) {
    const retainedPack: CharacterStateDto['equipment']['inventory'][number] | undefined =
      value.state.equipment.inventory.find((item) => item.id === pack.id)
    assert.ok(
      retainedPack?.retainedRulesJson,
      'Held Equipment must retain usable rules after source deletion.'
    )
    assert.equal(retainedPack.equipmentId, equipment.subjectId)
    assert.equal(retainedPack.quantity, pack.quantity)
    assert.equal(retainedPack.customName, pack.customName)
    const retainedRules = acquiredEquipmentRulesSchema.parse(
      JSON.parse(retainedPack.retainedRulesJson)
    )
    assert.equal(retainedRules.equipmentId, equipment.subjectId)
    assert.equal(retainedRules.systemId, character.systemId)
    assert.ok(
      retainedRules.sources.some(
        (source) => source.subjectKind === 'EQUIPMENT' && source.subjectId === equipment.subjectId
      )
    )
    const nested = value.state.equipment.inventory.find(
      (item) => item.notes === 'Private surviving item'
    )
    assert.ok(nested)
    assert.equal(nested.containerId, pack.id)
    assert.deepEqual(value.state.notes, before.state.notes)
    assert.deepEqual(value.state.noteGroups, before.state.noteGroups)
    assert.deepEqual(value.state.currency, before.state.currency)
  }
  assert.equal(sheet.overview.abilities.find((item) => item.ability === 'STRENGTH')?.score, 20)
  assert.ok(sheet.inventory.containers?.some((container) => container.id === pack.id))
  assert.equal(
    sheet.reference.equipmentOptions.some((option) => option.id === equipment.subjectId),
    true
  )
  version = sheet.meta.streamVersion
  for (const command of [
    { type: 'ADD_INVENTORY_ITEM' as const, equipmentId: equipment.subjectId, quantity: 1 },
    { type: 'UPDATE_INVENTORY_ITEM' as const, itemId: pack.id, quantity: 2 }
  ])
    await assert.rejects(
      () =>
        owner.mutation(api.characters.sheetCommands.execute, {
          id: characterId,
          command: { ...command, commandId: crypto.randomUUID(), expectedVersion: version }
        }),
      /source access|unavailable|not available|not found/i
    )
  assert.deepEqual(
    await owner.query(api.characters.builder.activeCharacter, { id: characterId }),
    after
  )
  assert.deepEqual(
    await owner.query(api.characters.drafts.get, { id: characterId }),
    remainingDraft
  )
  assert.deepEqual(await owner.query(api.characters.sheet.get, { id: characterId }), sheet)
  await execute({
    type: 'UPDATE_INVENTORY_ITEM',
    itemId: pack.id,
    quantity: 1,
    customName: 'Retained pack',
    commandId: crypto.randomUUID(),
    expectedVersion: version
  })
  const playable = await owner.query(api.characters.sheet.get, { id: characterId })
  assert.ok(playable?.inventory.containers?.some((container) => container.id === pack.id))
  assert.equal(await other.query(api.characters.builder.activeCharacter, { id: characterId }), null)
  assert.equal(await other.query(api.characters.sheet.get, { id: characterId }), null)
  console.log(
    'Equipment source deletion preserved the acquired backpack, nested item, placed currency and strict raw rules in active/saved Characters; the retained container remained playable while new copies, growth and foreign access were denied; private notes, override and draft identity survived.'
  )
}
