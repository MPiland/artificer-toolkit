import {
  handleAuthoringRequest,
  normalizeNodeRuntimeValues,
  resolveNodeRuntime
} from '@artificer-toolkit/functions'
import {
  nodeRuntimeNormalizeValuesRequestDtoSchema,
  nodeRuntimeResolveRequestDtoSchema
} from '@artificer-toolkit/schema'

export const resolveNodeMapRuntime = handleAuthoringRequest(
  nodeRuntimeResolveRequestDtoSchema,
  async (db, body) => resolveNodeRuntime(db, body)
)

export const normalizeNodeMapRuntimeValues = handleAuthoringRequest(
  nodeRuntimeNormalizeValuesRequestDtoSchema,
  async (db, body) => normalizeNodeRuntimeValues(db, body)
)
