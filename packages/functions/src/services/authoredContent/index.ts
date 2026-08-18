export {
  activateAuthoredDomainDraft,
  activateAuthoredDomainInput,
  authoredDomainConfigs,
  deleteAuthoredDomainActive,
  discardAuthoredDomainDraft,
  duplicateAuthoredDomain,
  getAuthoredDomain,
  getAuthoredDomainDraft,
  listAuthoredDomain,
  saveAuthoredDomainInputDraft
} from './authoredDomainService.js'
export type {
  AuthoredContentInput,
  AuthoredDomainRuntimeConfig,
  DirectAuthoredDomainConfig
} from './authoredDomainService.js'
export {
  AUTHORED_DOCUMENT_SCHEMA_VERSION,
  AUTHORED_PROJECTION_COMPILER_VERSION,
  AUTHORED_PROJECTION_SCHEMA_VERSION,
  publishVersionedAuthoredAggregate
} from './versionedAuthoring.js'
