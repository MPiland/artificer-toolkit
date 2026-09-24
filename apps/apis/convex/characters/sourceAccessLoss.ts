import type {
  CharacterAuthored,
  CharacterProvenance
} from '@artificer-toolkit/shared/subjects/authored'
import { getCharacterChosenGrantSelectionIdentityKey } from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterSourceLossTarget } from '@artificer-toolkit/rules-runtime/character/characterSourceLoss'
import { getCharacterAuthoredChoiceKinds } from '@artificer-toolkit/rules-runtime/character/characterSourceReferences'
import { readAcquiredEquipmentRules } from '@artificer-toolkit/rules-runtime/character/acquiredEquipmentRules'
import type { QueryCtx } from '../_generated/server'
import { loadCharacterRuleContext, readCharacterPublication, readCharacterSources } from './context'

type SubjectKind = CharacterSourceLossTarget['subjectKind']

export async function readCharacterAuthoredChoiceKinds(
  ctx: QueryCtx,
  character: CharacterAuthored
): Promise<ReadonlyMap<string, SubjectKind>> {
  if (!character.intent.chosenGrantSelections?.length) return new Map()
  return getCharacterAuthoredChoiceKinds(
    character,
    await loadCharacterRuleContext(ctx, character, character.userId)
  )
}

function addId(
  ids: Map<string, Set<SubjectKind>>,
  subjectKind: SubjectKind,
  id: string | undefined
): void {
  if (!id) return
  const kinds = ids.get(id) ?? new Set<SubjectKind>()
  kinds.add(subjectKind)
  ids.set(id, kinds)
}

function addProvenance(ids: Map<string, Set<SubjectKind>>, source: CharacterProvenance): void {
  switch (source.kind) {
    case 'BACKGROUND':
      addId(ids, 'BACKGROUND', source.backgroundId)
      break
    case 'CLASS':
      addId(ids, 'CLASS', source.classId)
      break
    case 'FEAT':
      addId(ids, 'FEAT', source.featId)
      break
    case 'RACE':
      addId(ids, 'RACE', source.raceId)
      break
    case 'SUBCLASS':
      addId(ids, 'CLASS', source.subclassId)
      break
    case 'SUBRACE':
      addId(ids, 'RACE', source.subraceId)
      break
  }
}

async function referencedIds(
  ctx: QueryCtx,
  character: CharacterAuthored,
  allowRetainedEquipment: boolean
): Promise<Map<string, Set<SubjectKind>>> {
  const ids = new Map<string, Set<SubjectKind>>()
  addId(ids, 'RACE', character.intent.race.raceId)
  addId(ids, 'RACE', character.intent.race.subraceId)
  addId(ids, 'BACKGROUND', character.intent.background.backgroundId)
  for (const entry of character.intent.classes) {
    addId(ids, 'CLASS', entry.classId)
    addId(ids, 'CLASS', entry.subclassId)
  }

  for (const acquisition of character.intent.featureAcquisitions) {
    addProvenance(ids, acquisition.source)
  }
  for (const selection of character.intent.chosenGrantSelections ?? []) {
    addProvenance(ids, selection.source)
  }
  for (const selection of character.intent.spellSelections ?? []) {
    addProvenance(ids, selection.source)
    for (const id of selection.spells) addId(ids, 'SPELL', id)
  }
  for (const grant of character.intent.resourceGrants ?? []) addProvenance(ids, grant.source)
  for (const selection of character.intent.ancestrySelections ?? []) {
    addProvenance(ids, selection.source)
  }

  for (const decision of [
    character.intent.startingEquipment?.class,
    character.intent.startingEquipment?.background
  ])
    for (const group of decision?.groups ?? [])
      for (const selection of group.selections ?? []) addId(ids, 'EQUIPMENT', selection.equipmentId)
  for (const item of character.state.equipment.inventory) {
    if (item.retainedRulesJson)
      readAcquiredEquipmentRules(item.retainedRulesJson, item.equipmentId, character.systemId)
    if (!allowRetainedEquipment || !item.retainedRulesJson)
      addId(ids, 'EQUIPMENT', item.equipmentId)
  }
  for (const entry of character.state.classes ?? []) {
    for (const id of entry.spells?.learned ?? []) addId(ids, 'SPELL', id)
    for (const id of entry.spells?.prepared ?? []) addId(ids, 'SPELL', id)
  }
  for (const entry of character.state.creatures ?? []) addId(ids, 'CREATURE', entry.creatureId)
  for (const entry of character.state.vehicles ?? []) addId(ids, 'VEHICLE', entry.vehicleId)

  const choices = await readCharacterAuthoredChoiceKinds(ctx, character)
  for (const selection of character.intent.chosenGrantSelections ?? []) {
    const subjectKind = choices.get(getCharacterChosenGrantSelectionIdentityKey(selection))
    if (subjectKind) for (const id of selection.targetIds) addId(ids, subjectKind, id)
  }
  return ids
}

export async function readCharacterSourceAccessLoss(
  ctx: QueryCtx,
  character: CharacterAuthored,
  options: { allowRetainedEquipment?: boolean } = {}
): Promise<CharacterSourceLossTarget[]> {
  const access = await readCharacterSources(ctx, character, character.userId)
  const targets: CharacterSourceLossTarget[] = []
  for (const [subjectId, subjectKinds] of await referencedIds(
    ctx,
    character,
    options.allowRetainedEquipment === true
  )) {
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', subjectId))
      .unique()
    if (!root || !subjectKinds.has(root.subjectKind)) continue
    const publication = await readCharacterPublication(
      ctx,
      root,
      character.systemId,
      character.userId,
      access
    )
    if (!publication) targets.push({ subjectKind: root.subjectKind, subjectId: root.id })
  }
  return targets.sort((left, right) =>
    `${left.subjectKind}:${left.subjectId}`.localeCompare(`${right.subjectKind}:${right.subjectId}`)
  )
}
