import type { RaceResponseDto } from '@artificer-toolkit/schema/api/content'
import type { RaceAuthoredDto } from '@artificer-toolkit/schema/subjects/race'

export function resolveRaceParentPreview(
  selectedRace: RaceAuthoredDto | null,
  parentResponse: RaceResponseDto | null
): Extract<RaceAuthoredDto, { category: 'BASE' }> | null {
  const parent = parentResponse?.item
  if (
    selectedRace?.category !== 'SUBRACE' ||
    parent?.category !== 'BASE' ||
    parent.id !== selectedRace.parentRaceId ||
    parent.systemId !== selectedRace.systemId
  ) {
    return null
  }
  return parent
}
