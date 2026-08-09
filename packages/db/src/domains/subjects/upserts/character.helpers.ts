import type { DBLike } from '#types'
import type { CharacterAuthored } from '@artificer-toolkit/shared'
import { assertNever } from '../../../utils/index.js'

type RowLike = Record<string, unknown>
type DeleteByCharacterDb = {
  deleteFrom: (table: string) => {
    where: (
      column: 'character_id',
      op: '=',
      value: string
    ) => {
      execute: () => Promise<unknown>
    }
  }
}

type ExistingCharacterChildIds = {
  currencyGroupIds: string[]
  featureAcquisitionIds: string[]
  chosenGrantSelectionIds: string[]
  spellSelectionIds: string[]
}

type CharacterFeatureSelectionValue = NonNullable<
  NonNullable<
    CharacterAuthored['intent']['featureAcquisitions'][number]['selections']
  >[number]['values']
>[number]

type CharacterInventoryItem = CharacterAuthored['state']['equipment']['inventory'][number]
type CharacterCurrencyGroup = CharacterAuthored['state']['currency'][number]
type CharacterInventoryPlacement = {
  kind: 'CREATURE' | 'VEHICLE'
  id: string
}

type CharacterInventoryOwner = { id: string }

async function resolveCharacterInventoryOwner(
  db: DBLike,
  characterId: string
): Promise<CharacterInventoryOwner> {
  let owner = await db
    .selectFrom('inventory_owners')
    .select('id')
    .where('kind', '=', 'CHARACTER')
    .where('character_id', '=', characterId)
    .executeTakeFirst()

  if (!owner) {
    await db
      .insertInto('inventory_owners')
      .values({ id: characterId, kind: 'CHARACTER', character_id: characterId })
      .onConflict((oc) => oc.column('id').doNothing())
      .execute()
    owner = await db
      .selectFrom('inventory_owners')
      .select('id')
      .where('kind', '=', 'CHARACTER')
      .where('character_id', '=', characterId)
      .executeTakeFirst()
  }

  if (!owner) {
    throw new Error(`Character "${characterId}" is missing its inventory owner.`)
  }

  return owner
}

function placementRows(
  characterId: string,
  creatureEquipment: CharacterAuthored['state']['creatureEquipment'] | undefined,
  vehicleEquipment: CharacterAuthored['state']['vehicleEquipment'] | undefined,
  inventoryIds: ReadonlySet<string>
): Map<string, CharacterInventoryPlacement> {
  const placements = new Map<string, CharacterInventoryPlacement>()
  for (const [instanceId, assignments] of Object.entries(creatureEquipment ?? {})) {
    for (const assignment of assignments) {
      if (!inventoryIds.has(assignment.equipmentItemId)) {
        throw new Error(
          `Character ${characterId} creature equipment references missing inventory item ${assignment.equipmentItemId}.`
        )
      }
      if (placements.has(assignment.equipmentItemId)) {
        throw new Error(`Character ${characterId} assigns an inventory item more than once.`)
      }
      placements.set(assignment.equipmentItemId, { kind: 'CREATURE', id: instanceId })
    }
  }
  for (const [instanceId, assignments] of Object.entries(vehicleEquipment ?? {})) {
    for (const assignment of assignments) {
      if (!inventoryIds.has(assignment.equipmentItemId)) {
        throw new Error(
          `Character ${characterId} vehicle equipment references missing inventory item ${assignment.equipmentItemId}.`
        )
      }
      if (placements.has(assignment.equipmentItemId)) {
        throw new Error(`Character ${characterId} assigns an inventory item more than once.`)
      }
      placements.set(assignment.equipmentItemId, { kind: 'VEHICLE', id: instanceId })
    }
  }
  return placements
}

export async function replaceCharacterInventoryItems(
  db: DBLike,
  characterId: string,
  inventory: CharacterInventoryItem[],
  equipped: string[],
  attuned: string[],
  creatureEquipment?: CharacterAuthored['state']['creatureEquipment'],
  vehicleEquipment?: CharacterAuthored['state']['vehicleEquipment'],
  options: { resetMissingCurrencyContainers?: boolean } = {}
): Promise<void> {
  const owner = await resolveCharacterInventoryOwner(db, characterId)
  const orderedInventory = sortByDependency(
    inventory,
    (item) => item.id,
    (item) => item.containerId,
    `Character equipment for ${characterId}`
  )
  const inventoryIds = new Set(orderedInventory.map((item) => item.id))
  for (const itemId of [...equipped, ...attuned]) {
    if (!inventoryIds.has(itemId)) {
      throw new Error(`Character ${characterId} references missing inventory item ${itemId}.`)
    }
  }
  const placements = placementRows(characterId, creatureEquipment, vehicleEquipment, inventoryIds)
  const existingItems = await db
    .selectFrom('inventory_items')
    .select(['id', 'container_id'])
    .where('owner_id', '=', owner.id)
    .execute()
  const nextIds = new Set(orderedInventory.map((item) => item.id))
  const currencyGroups = await db
    .selectFrom('inventory_currency_groups')
    .select(['id', 'container_item_id'])
    .where('owner_id', '=', owner.id)
    .execute()
  for (const group of currencyGroups) {
    if (group.container_item_id && !nextIds.has(group.container_item_id)) {
      if (!options.resetMissingCurrencyContainers) {
        throw new Error(
          `Character ${characterId} currency group ${group.id} references removed container ${group.container_item_id}.`
        )
      }
      await db
        .insertInto('inventory_currency_groups')
        .values({ id: group.id, owner_id: owner.id, container_item_id: null })
        .onConflict((oc) =>
          oc.column('id').doUpdateSet((eb) => ({
            container_item_id: eb.ref('excluded.container_item_id')
          }))
        )
        .execute()
    }
  }
  const removedItems = sortByDependency(
    existingItems,
    (item) => item.id,
    (item) => item.container_id ?? undefined,
    `Existing character equipment for ${characterId}`
  ).reverse()
  for (const item of removedItems) {
    if (!nextIds.has(item.id)) {
      await db
        .deleteFrom('inventory_items')
        .where('owner_id', '=', owner.id)
        .where('id', '=', item.id)
        .execute()
    }
  }

  for (const item of orderedInventory) {
    const placement = placements.get(item.id)
    await db
      .insertInto('inventory_items')
      .values({
        id: item.id,
        owner_id: owner.id,
        equipment_id: item.equipmentId,
        quantity: item.quantity,
        container_id: item.containerId ?? null,
        custom_name: item.customName ?? null,
        notes: item.notes ?? null,
        equipped: equipped.includes(item.id),
        attuned: attuned.includes(item.id),
        placement_kind: placement?.kind ?? null,
        placement_id: placement?.id ?? null
      })
      .onConflict((oc) =>
        oc.column('id').doUpdateSet((eb) => ({
          owner_id: eb.ref('excluded.owner_id'),
          equipment_id: eb.ref('excluded.equipment_id'),
          quantity: eb.ref('excluded.quantity'),
          container_id: eb.ref('excluded.container_id'),
          custom_name: eb.ref('excluded.custom_name'),
          notes: eb.ref('excluded.notes'),
          equipped: eb.ref('excluded.equipped'),
          attuned: eb.ref('excluded.attuned'),
          placement_kind: eb.ref('excluded.placement_kind'),
          placement_id: eb.ref('excluded.placement_id')
        }))
      )
      .execute()
  }
}

export async function replaceCharacterCurrency(
  db: DBLike,
  characterId: string,
  currency: CharacterCurrencyGroup[]
): Promise<void> {
  const owner = await resolveCharacterInventoryOwner(db, characterId)
  const inventoryItems = await db
    .selectFrom('inventory_items')
    .select('id')
    .where('owner_id', '=', owner.id)
    .execute()
  const inventoryIds = new Set(inventoryItems.map((item) => item.id))
  const groupIds = new Set<string>()
  for (const group of currency) {
    if (!group.id) {
      throw new Error(`Character ${characterId} has a currency group without an id.`)
    }
    if (groupIds.has(group.id)) {
      throw new Error(`Character ${characterId} has duplicate currency group ${group.id}.`)
    }
    if (group.containerId && !inventoryIds.has(group.containerId)) {
      throw new Error(
        `Character ${characterId} currency group references missing container ${group.containerId}.`
      )
    }
    groupIds.add(group.id)
  }

  await db
    .deleteFrom('inventory_currency_balances')
    .where('owner_id', '=', owner.id)
    .execute()
  await db
    .deleteFrom('inventory_currency_groups')
    .where('owner_id', '=', owner.id)
    .execute()
  await insertRows(
    db,
    'inventory_currency_groups',
    currency.map((group) => ({
      id: group.id,
      owner_id: owner.id,
      container_item_id: group.containerId ?? null
    }))
  )
  const ids = [
    ...new Set(currency.flatMap((group) => group.currencies.map((entry) => entry.currencyId)))
  ]
  const [rulesetRows, campaignRows] = await Promise.all([
    ids.length > 0
      ? db.selectFrom('currencies').select('id').where('id', 'in', ids).execute()
      : Promise.resolve([]),
    ids.length > 0
      ? db
          .selectFrom('campaign_currency_denominations')
          .select('id')
          .where('id', 'in', ids)
          .execute()
      : Promise.resolve([])
  ])
  const campaignIds = new Set(campaignRows.map((row) => row.id))
  const rulesetIds = new Set(rulesetRows.map((row) => row.id))
  await insertRows(
    db,
    'inventory_currency_balances',
    currency.flatMap((group) =>
      group.currencies.map((entry) => {
        const isCampaign = campaignIds.has(entry.currencyId) && !rulesetIds.has(entry.currencyId)
        return {
          owner_id: owner.id,
          group_id: group.id,
          ruleset_currency_id: isCampaign ? null : entry.currencyId,
          campaign_denomination_id: isCampaign ? entry.currencyId : null,
          amount: entry.amount
        }
      })
    )
  )
}

export function serializeSelectionValue(value: CharacterFeatureSelectionValue) {
  switch (value.kind) {
    case 'ID':
      return {
        value_kind: 'ID',
        text_value: value.id,
        number_value: null,
        boolean_value: null
      }

    case 'IDS':
      return {
        value_kind: 'IDS',
        text_value: JSON.stringify(value.ids),
        number_value: null,
        boolean_value: null
      }

    case 'NUMBER':
      return {
        value_kind: 'NUMBER',
        text_value: null,
        number_value: value.value,
        boolean_value: null
      }

    case 'BOOLEAN':
      return {
        value_kind: 'BOOLEAN',
        text_value: null,
        number_value: null,
        boolean_value: value.value
      }

    default:
      return assertNever(value)
  }
}

export function mapTiming(
  timing: CharacterAuthored['intent']['featureAcquisitions'][number]['timing']
) {
  switch (timing.kind) {
    case 'IMMEDIATE':
      return {
        timing_kind: 'IMMEDIATE',
        timing_level: null,
        timing_class_id: null,
        timing_class_level: null
      }

    case 'CHARACTER_LEVEL':
      return {
        timing_kind: 'CHARACTER_LEVEL',
        timing_level: timing.level,
        timing_class_id: null,
        timing_class_level: null
      }

    case 'CLASS_LEVEL':
      return {
        timing_kind: 'CLASS_LEVEL',
        timing_level: null,
        timing_class_id: timing.classId,
        timing_class_level: timing.classLevel
      }

    default:
      return assertNever(timing)
  }
}

export function mapFeatureSource(
  source: CharacterAuthored['intent']['featureAcquisitions'][number]['source']
) {
  switch (source.kind) {
    case 'CLASS':
      return {
        source_kind: 'CLASS',
        class_id: source.classId,
        subclass_id: null,
        race_id: null,
        subrace_id: null,
        ancestry_id: null,
        option_id: null,
        acquired_parent_id: null,
        background_id: null,
        feat_id: null,
        reason: null
      }

    case 'SUBCLASS':
      return {
        source_kind: 'SUBCLASS',
        class_id: null,
        subclass_id: source.subclassId,
        race_id: null,
        subrace_id: null,
        ancestry_id: null,
        option_id: null,
        acquired_parent_id: null,
        background_id: null,
        feat_id: null,
        reason: null
      }

    case 'RACE':
      return {
        source_kind: 'RACE',
        class_id: null,
        subclass_id: null,
        race_id: source.raceId,
        subrace_id: null,
        ancestry_id: null,
        option_id: null,
        acquired_parent_id: null,
        background_id: null,
        feat_id: null,
        reason: null
      }

    case 'SUBRACE':
      return {
        source_kind: 'SUBRACE',
        class_id: null,
        subclass_id: null,
        race_id: null,
        subrace_id: source.subraceId,
        ancestry_id: null,
        option_id: null,
        acquired_parent_id: null,
        background_id: null,
        feat_id: null,
        reason: null
      }

    case 'ANCESTRY':
      return {
        source_kind: 'ANCESTRY',
        class_id: null,
        subclass_id: null,
        race_id: null,
        subrace_id: null,
        ancestry_id: source.ancestryId,
        option_id: source.optionId,
        acquired_parent_id: null,
        background_id: null,
        feat_id: null,
        reason: null
      }

    case 'BACKGROUND':
      return {
        source_kind: 'BACKGROUND',
        class_id: null,
        subclass_id: null,
        race_id: null,
        subrace_id: null,
        ancestry_id: null,
        option_id: null,
        acquired_parent_id: null,
        background_id: source.backgroundId,
        feat_id: null,
        reason: null
      }

    case 'FEAT':
      return {
        source_kind: 'FEAT',
        class_id: null,
        subclass_id: null,
        race_id: null,
        subrace_id: null,
        ancestry_id: null,
        option_id: null,
        acquired_parent_id: null,
        background_id: null,
        feat_id: source.featId,
        reason: null
      }

    case 'FEATURE':
      return {
        source_kind: 'FEATURE',
        class_id: null,
        subclass_id: null,
        race_id: null,
        subrace_id: null,
        ancestry_id: null,
        option_id: null,
        acquired_parent_id: null,
        background_id: null,
        feat_id: null,
        reason: null
      }

    case 'OPTION':
      return {
        source_kind: 'OPTION',
        class_id: null,
        subclass_id: null,
        race_id: null,
        subrace_id: null,
        ancestry_id: null,
        option_id: source.optionId,
        acquired_parent_id: source.acquiredParentId,
        background_id: null,
        feat_id: null,
        reason: null
      }

    case 'MANUAL':
      return {
        source_kind: 'MANUAL',
        class_id: null,
        subclass_id: null,
        race_id: null,
        subrace_id: null,
        ancestry_id: null,
        option_id: null,
        acquired_parent_id: null,
        background_id: null,
        feat_id: null,
        reason: source.reason ?? null
      }

    default:
      return assertNever(source)
  }
}

export function mapChosenGrantSelectionSource(
  source: NonNullable<CharacterAuthored['intent']['chosenGrantSelections']>[number]['source']
) {
  const emptyReferences = {
    class_id: null,
    subclass_id: null,
    source_class_level: null,
    race_id: null,
    subrace_id: null,
    ancestry_id: null,
    option_id: null,
    acquired_parent_id: null,
    background_id: null,
    feat_id: null,
    feature_id: null,
    reason: null
  }

  switch (source.kind) {
    case 'CLASS':
      return {
        ...emptyReferences,
        source_kind: 'CLASS',
        class_id: source.classId,
        source_class_level: source.classLevel ?? null
      }
    case 'SUBCLASS':
      return {
        ...emptyReferences,
        source_kind: 'SUBCLASS',
        subclass_id: source.subclassId,
        source_class_level: source.classLevel ?? null
      }
    case 'RACE':
      return {
        ...emptyReferences,
        source_kind: 'RACE',
        race_id: source.raceId
      }
    case 'SUBRACE':
      return {
        ...emptyReferences,
        source_kind: 'SUBRACE',
        subrace_id: source.subraceId
      }
    case 'ANCESTRY':
      return {
        ...emptyReferences,
        source_kind: 'ANCESTRY',
        ancestry_id: source.ancestryId,
        option_id: source.optionId
      }
    case 'BACKGROUND':
      return {
        ...emptyReferences,
        source_kind: 'BACKGROUND',
        background_id: source.backgroundId
      }
    case 'FEAT':
      return {
        ...emptyReferences,
        source_kind: 'FEAT',
        feat_id: source.featId
      }
    case 'FEATURE':
      return {
        ...emptyReferences,
        source_kind: 'FEATURE',
        feature_id: source.featureId
      }
    case 'OPTION':
      return {
        ...emptyReferences,
        source_kind: 'OPTION',
        acquired_parent_id: source.acquiredParentId,
        option_id: source.optionId
      }
    case 'MANUAL':
      return {
        ...emptyReferences,
        source_kind: 'MANUAL',
        reason: source.reason ?? null
      }
    default:
      return assertNever(source)
  }
}

export function mapSpellSelectionSource(
  source: NonNullable<CharacterAuthored['intent']['spellSelections']>[number]['source']
) {
  switch (source.kind) {
    case 'CLASS':
      return {
        source_kind: 'CLASS',
        class_id: source.classId,
        subclass_id: null,
        feature_id: null,
        option_id: null,
        acquired_parent_id: null
      }

    case 'SUBCLASS':
      return {
        source_kind: 'SUBCLASS',
        class_id: null,
        subclass_id: source.subclassId,
        feature_id: null,
        option_id: null,
        acquired_parent_id: null
      }

    case 'FEATURE':
      return {
        source_kind: 'FEATURE',
        class_id: null,
        subclass_id: null,
        feature_id: source.featureId,
        option_id: null,
        acquired_parent_id: null
      }

    case 'OPTION':
      return {
        source_kind: 'OPTION',
        class_id: null,
        subclass_id: null,
        feature_id: null,
        option_id: source.optionId,
        acquired_parent_id: source.acquiredParentId
      }

    default:
      return assertNever(source)
  }
}

export function mapResourceGrantSource(
  source: NonNullable<CharacterAuthored['intent']['resourceGrants']>[number]['source']
) {
  switch (source.kind) {
    case 'CLASS':
      return {
        source_kind: 'CLASS',
        class_id: source.classId,
        subclass_id: null,
        feature_id: null,
        option_id: null,
        acquired_parent_id: null
      }

    case 'SUBCLASS':
      return {
        source_kind: 'SUBCLASS',
        class_id: null,
        subclass_id: source.subclassId,
        feature_id: null,
        option_id: null,
        acquired_parent_id: null
      }

    case 'FEATURE':
      return {
        source_kind: 'FEATURE',
        class_id: null,
        subclass_id: null,
        feature_id: source.featureId,
        option_id: null,
        acquired_parent_id: null
      }

    case 'OPTION':
      return {
        source_kind: 'OPTION',
        class_id: null,
        subclass_id: null,
        feature_id: null,
        option_id: source.optionId,
        acquired_parent_id: source.acquiredParentId
      }

    default:
      return assertNever(source)
  }
}

export function sortByDependency<T>(
  items: T[],
  getId: (item: T) => string,
  getDependencyId: (item: T) => string | undefined,
  label: string
): T[] {
  const knownIds = new Set(items.map(getId))

  for (const item of items) {
    const dependencyId = getDependencyId(item)

    if (dependencyId && !knownIds.has(dependencyId)) {
      throw new Error(`${label} references missing dependency "${dependencyId}".`)
    }
  }

  const pending = [...items]
  const resolvedIds = new Set<string>()
  const ordered: T[] = []

  while (pending.length > 0) {
    let inserted = false

    for (let index = 0; index < pending.length; index += 1) {
      const item = pending[index] as T
      const dependencyId = getDependencyId(item)

      if (!dependencyId || resolvedIds.has(dependencyId)) {
        ordered.push(item)
        resolvedIds.add(getId(item))
        pending.splice(index, 1)
        inserted = true
        break
      }
    }

    if (!inserted) {
      throw new Error(`${label} contains a cyclical dependency chain.`)
    }
  }

  return ordered
}

export function countRolls(rolls: Array<{ die: number; value: number }>) {
  const counts = new Map<string, number>()

  for (const roll of rolls) {
    const key = `${roll.die}:${roll.value}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return counts
}

export async function insertRows(db: DBLike, table: string, rows: RowLike[]) {
  if (rows.length === 0) {
    return
  }

  await db
    .insertInto(table as never)
    .values(rows as never)
    .execute()
}

async function collectExistingChildIds(
  db: DBLike,
  characterId: string
): Promise<ExistingCharacterChildIds> {
  const [currencyGroupRows, featureAcquisitionRows, chosenGrantSelectionRows, spellSelectionRows] =
    await Promise.all([
      db
        .selectFrom('character_currency_groups')
        .select(['id'])
        .where('character_id', '=', characterId)
        .execute(),
      db
        .selectFrom('character_feature_acquisitions')
        .select(['id'])
        .where('character_id', '=', characterId)
        .execute(),
      db
        .selectFrom('character_chosen_grant_selections')
        .select(['id'])
        .where('character_id', '=', characterId)
        .execute(),
      db
        .selectFrom('character_spell_selections')
        .select(['id'])
        .where('character_id', '=', characterId)
        .execute()
    ])

  return {
    currencyGroupIds: currencyGroupRows.map((row) => row.id),
    featureAcquisitionIds: featureAcquisitionRows.map((row) => row.id),
    chosenGrantSelectionIds: chosenGrantSelectionRows.map((row) => row.id),
    spellSelectionIds: spellSelectionRows.map((row) => row.id)
  }
}

export async function deleteExistingCharacterChildren(db: DBLike, characterId: string) {
  const existing = await collectExistingChildIds(db, characterId)
  const deleteByCharacterDb = db as unknown as DeleteByCharacterDb

  for (const groupId of existing.currencyGroupIds) {
    await db.deleteFrom('character_currencies').where('group_id', '=', groupId).execute()
  }

  for (const featureAcquisitionId of existing.featureAcquisitionIds) {
    await db
      .deleteFrom('character_feature_selection_values')
      .where('feature_acquisition_id', '=', featureAcquisitionId)
      .execute()
    await db
      .deleteFrom('character_feature_selection_records')
      .where('feature_acquisition_id', '=', featureAcquisitionId)
      .execute()
  }

  for (const selectionId of existing.chosenGrantSelectionIds) {
    await db
      .deleteFrom('character_chosen_grant_selection_targets')
      .where('selection_id', '=', selectionId)
      .execute()
  }

  for (const spellSelectionId of existing.spellSelectionIds) {
    await db
      .deleteFrom('character_spell_selection_spells')
      .where('selection_id', '=', spellSelectionId)
      .execute()
  }

  await db.deleteFrom('character_resources').where('character_id', '=', characterId).execute()
  await deleteByCharacterDb
    .deleteFrom('character_spell_slot_state')
    .where('character_id', '=', characterId)
    .execute()
  await deleteByCharacterDb
    .deleteFrom('character_conditions')
    .where('character_id', '=', characterId)
    .execute()
  await deleteByCharacterDb
    .deleteFrom('character_exhaustion')
    .where('character_id', '=', characterId)
    .execute()
  await deleteByCharacterDb
    .deleteFrom('character_notes')
    .where('character_id', '=', characterId)
    .execute()
  await deleteByCharacterDb
    .deleteFrom('character_note_groups')
    .where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_attuned').where('character_id', '=', characterId).execute()
  await db.deleteFrom('character_equipped').where('character_id', '=', characterId).execute()
  await db.deleteFrom('character_class_spells').where('character_id', '=', characterId).execute()
  await db
    .deleteFrom('character_class_equipment_items')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_class_equipment_groups')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_class_equipment_session')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_background_equipment_items')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_background_equipment_groups')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_background_equipment_session')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_creature_equipment')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_vehicle_equipment')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_creature_hit_dice_state')
    .where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_creatures').where('character_id', '=', characterId).execute()
  await db.deleteFrom('character_vehicles').where('character_id', '=', characterId).execute()
  await db.deleteFrom('character_currency_groups').where('character_id', '=', characterId).execute()
  await db.deleteFrom('character_equipment').where('character_id', '=', characterId).execute()
  await db
    .deleteFrom('character_chosen_grant_selections')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_feature_acquisitions')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_spell_selections')
    .where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_resource_grants').where('character_id', '=', characterId).execute()
  await db
    .deleteFrom('character_abilities_manual_rolled_rolls')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_abilities_manual_rolled_groups')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_abilities_manual_assignments')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_abilities_manual_rolled')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_abilities_point_buy_distributed')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_abilities_point_buy')
    .where('character_id', '=', characterId)
    .execute()
  await db
    .deleteFrom('character_abilities_standard_array')
    .where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_abilities').where('character_id', '=', characterId).execute()
  await db.deleteFrom('character_hit_dice_state').where('character_id', '=', characterId).execute()
  await db.deleteFrom('character_hitpoint_state').where('character_id', '=', characterId).execute()
  await db
    .deleteFrom('character_hitpoint_level_rolls')
    .where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_hitpoint_levels').where('character_id', '=', characterId).execute()
  await db.deleteFrom('character_hitpoint_intent').where('character_id', '=', characterId).execute()
  await db.deleteFrom('character_classes').where('character_id', '=', characterId).execute()
  await db
    .deleteFrom('character_ancestry_acquisitions')
    .where('character_id', '=', characterId)
    .execute()
  await db.deleteFrom('character_background').where('character_id', '=', characterId).execute()
  await db.deleteFrom('character_race').where('character_id', '=', characterId).execute()
  await db.deleteFrom('character_advancement').where('character_id', '=', characterId).execute()
  await db.deleteFrom('character_profile').where('character_id', '=', characterId).execute()
}
