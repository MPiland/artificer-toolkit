import { normalizeNodeRuntimeValues, resolveNodeRuntime } from '@artificer-toolkit/authoring/nodeRuntime'
import { createSrdNodeRuntimeReader } from '@artificer-toolkit/authoring/nodeRuntime/srdSourceReader'
import type {
  NodeRuntimeNormalizeValuesRequestDto,
  NodeRuntimeResolveRequestDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

type FixtureRequest<TRequest> = Omit<TRequest, 'systemId'> & { systemId?: string }

/** Resolves a node map through the real `packages/authoring` resolver, as the server does. */
export function resolveFixtureNodeRuntime(
  request: FixtureRequest<NodeRuntimeResolveRequestDto>,
  system: SystemAuthoredDto = srdSystemRecord
) {
  return resolveNodeRuntime(createSrdNodeRuntimeReader(system), {
    ...request,
    systemId: request.systemId ?? system.id
  })
}

export function normalizeFixtureNodeRuntimeValues(
  request: FixtureRequest<NodeRuntimeNormalizeValuesRequestDto>,
  system: SystemAuthoredDto = srdSystemRecord
) {
  return normalizeNodeRuntimeValues(createSrdNodeRuntimeReader(system), {
    ...request,
    systemId: request.systemId ?? system.id
  })
}
