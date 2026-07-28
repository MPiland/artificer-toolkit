import type { CharacterBuilderPayloadDto } from '@artificer-toolkit/schema/api/characters'
import type { CharacterFormValues } from './characterBuilder.types'

export type CharacterBuilderRendererProps = {
  payload: CharacterBuilderPayloadDto
  resolveDebounceMs?: number
  onResolve: (character: CharacterFormValues) => Promise<void> | void
}
