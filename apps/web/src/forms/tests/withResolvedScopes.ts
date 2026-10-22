import { resolveNestedRuntimeScopes } from '@artificer-toolkit/authoring/nodeRuntime'
import type { NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { createSrdNodeRuntimeReader } from '@artificer-toolkit/authoring/nodeRuntime/srdSourceReader'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/** Adds the child scopes the real resolver returns for every populated group in `model`. */
export async function withResolvedScopes(
  model: NodeRuntimeResolveResponseDto,
  values: object
): Promise<NodeRuntimeResolveResponseDto> {
  const scopes = await resolveNestedRuntimeScopes(
    createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists),
    {
      mapId: model.mapId,
      values: Object.fromEntries(Object.entries(values)),
      systemId: srdSystemRecord.id
    },
    model.steps
  )
  return { ...model, scopes }
}
