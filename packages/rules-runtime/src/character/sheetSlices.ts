import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characterSheetData'
import type {
  CharacterSheetSlice,
  CharacterSheetSliceResponseDto
} from '@artificer-toolkit/schema/api/characterSheetSlices'

/** Selects from an already authorized viewer projection, including its privacy redactions. */
export function projectCharacterSheetSlice<Slice extends CharacterSheetSlice>(
  sheet: CharacterSheetResponseDto,
  slice: Slice
): Extract<CharacterSheetSliceResponseDto, { slice: Slice }>
export function projectCharacterSheetSlice(
  sheet: CharacterSheetResponseDto,
  slice: CharacterSheetSlice
): CharacterSheetSliceResponseDto {
  const { meta, reference, resources, spells } = sheet
  switch (slice) {
    case 'COMMON':
      return {
        slice,
        data: {
          ...(sheet.publicId === undefined ? {} : { publicId: sheet.publicId }),
          meta,
          identity: sheet.identity,
          overview: sheet.overview,
          hasSpellcasting:
            spells.attackBonus != null ||
            spells.saveDc != null ||
            spells.slots.length > 0 ||
            spells.activeGroups.length > 0 ||
            spells.spells.length > 0 ||
            Boolean(spells.preparationSources?.length),
          reference: {
            proficiencies: reference.proficiencies,
            defenses: reference.defenses,
            senses: reference.senses,
            conditionOptions: reference.conditionOptions
          }
        }
      }
    case 'ACTIONS':
      return {
        slice,
        data: {
          meta,
          actions: sheet.actions,
          resources: { items: resources.items },
          spells: { activeGroups: spells.activeGroups, spells: spells.spells, slots: spells.slots }
        }
      }
    case 'SPELLS':
      return { slice, data: { meta, spells } }
    case 'INVENTORY':
      return {
        slice,
        data: {
          meta,
          inventory: sheet.inventory,
          resources: { items: resources.items },
          reference: {
            equipmentOptions: reference.equipmentOptions,
            currencyOptions: reference.currencyOptions
          }
        }
      }
    case 'EXTRAS':
      return { slice, data: { meta, extras: sheet.extras } }
    case 'FEATURES':
      return {
        slice,
        data: {
          meta,
          resources: { items: resources.items, hitDice: resources.hitDice },
          reference: {
            features: reference.features,
            proficiencies: reference.proficiencies,
            defenses: reference.defenses,
            senses: reference.senses
          }
        }
      }
    case 'NOTES':
      return {
        slice,
        data: {
          meta: { characterId: meta.characterId, streamVersion: meta.streamVersion },
          notes: sheet.notes
        }
      }
  }
}

/**
 * The viewer's whole Sheet from the six slices `projectCharacterSheetSlice` selected from it and the
 * notes of the same projection: every Sheet field is in one of them.
 */
export function composeCharacterSheet(
  slices: readonly CharacterSheetSliceResponseDto[],
  notes: CharacterSheetResponseDto['notes']
): CharacterSheetResponseDto {
  const data = <Slice extends Exclude<CharacterSheetSlice, 'NOTES'>>(slice: Slice) => {
    const found = slices.find(
      (candidate): candidate is Extract<CharacterSheetSliceResponseDto, { slice: Slice }> =>
        candidate.slice === slice
    )
    if (!found) throw new Error(`Character Sheet slice ${slice} is missing.`)
    return found.data
  }
  const common = data('COMMON')
  const inventory = data('INVENTORY')
  const features = data('FEATURES')
  return {
    ...(common.publicId === undefined ? {} : { publicId: common.publicId }),
    meta: common.meta,
    identity: common.identity,
    overview: common.overview,
    actions: data('ACTIONS').actions,
    resources: features.resources,
    spells: data('SPELLS').spells,
    inventory: inventory.inventory,
    extras: data('EXTRAS').extras,
    reference: {
      ...features.reference,
      conditionOptions: common.reference.conditionOptions,
      equipmentOptions: inventory.reference.equipmentOptions,
      currencyOptions: inventory.reference.currencyOptions
    },
    notes
  }
}
