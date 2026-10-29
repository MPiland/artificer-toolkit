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
          resources: { items: resources.items },
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
