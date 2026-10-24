import type { ReactNode } from 'react'
import type { ConvexReactClient } from 'convex/react'
import type { QueryClient } from '@tanstack/react-query'
import type { AuthoredDraftDto } from '@artificer-toolkit/schema/api/content'
import type { SystemResponseDto } from '@artificer-toolkit/schema/api/systems'
import type {
  ActivatedAuthoringResponse,
  DraftAuthoringResponse,
  DuplicateAuthoringResponse
} from '../actions'
import type { AuthoredFormActionFactory } from '../actions/authoredFormActionFactories'
import type { AuthoringFormMode } from '../layout/AuthoringFormContext'

export type AuthoredFormDomain =
  | 'background'
  | 'class'
  | 'creature'
  | 'equipment'
  | 'feat'
  | 'race'
  | 'spell'
  | 'vehicle'

export type AuthoredFormFactoryBase = {
  domain: AuthoredFormDomain
  fallbackLabel: string
  mapId: AuthoredFormDomain
  subjectKindLabel: string
}

export type AuthoredFormSessionInput = {
  convexClient?: ConvexReactClient
  data: unknown
  mode: AuthoringFormMode
}

export type AuthoredFormPreviewContext<TValues extends object = object> = {
  domain: AuthoredFormDomain
  label: string
  statusLabel: string
  system?: SystemResponseDto | null
  values: TValues
}

type AuthoredFormOperationConfig = {
  activate: (payload: object) => Promise<ActivatedAuthoringResponse>
  deleteActive?: (id: string) => Promise<void>
  deleteDraft?: (id: string) => Promise<void>
  discardDraft?: () => Promise<unknown>
  duplicate?: (subjectId: string) => Promise<DuplicateAuthoringResponse | null | undefined>
  onActivateSuccess?: (
    queryClient: QueryClient,
    response: ActivatedAuthoringResponse
  ) => Promise<void> | void
  onDiscardDraftSuccess?: (queryClient: QueryClient) => Promise<void> | void
  onDuplicateSuccess?: (queryClient: QueryClient) => Promise<void> | void
  onSaveDraftSuccess?: (
    queryClient: QueryClient,
    draft: DraftAuthoringResponse
  ) => Promise<void> | void
  saveDraft: (payload: object) => Promise<DraftAuthoringResponse>
}

type AuthoredFormDeleteConfig = {
  deleteActive: (id: string) => Promise<void>
  deleteDraft: (id: string) => Promise<void>
  detailSubjectQueryKey: readonly unknown[] | ((id: string) => readonly unknown[])
  domainQueryKey: readonly unknown[]
  draftQueryKey: readonly unknown[] | ((id: string) => readonly unknown[])
}

export type AuthoredFormSession = {
  actionFactory: AuthoredFormActionFactory
  activeRecord?: object | null
  canCopy: boolean
  canDelete: boolean
  canSaveDraft: boolean
  deleteConfig?: AuthoredFormDeleteConfig
  domain: AuthoredFormDomain
  draft?: AuthoredDraftDto | null
  fallbackLabel: string
  hasActiveDraft: boolean
  hasInvalidDraft: boolean
  initialValues: object
  invalidDraftOnly: boolean
  isDraft: boolean
  key: string
  mapId: AuthoredFormDomain
  mode: AuthoringFormMode
  normalizeForSubmit: (values: object) => object
  notFound: boolean
  operations: AuthoredFormOperationConfig
  provenanceKind: 'MASTER' | 'OWNED' | null
  readOnly: boolean
  renderPreview?: (context: AuthoredFormPreviewContext) => ReactNode
  subjectId?: string
  subjectKindLabel: string
  subjectLabel: ReactNode
  system?: SystemResponseDto | null
  systemId?: string
  systemRequired: boolean
}

export type AuthoredFormFactory<
  TValues extends object,
  TSubmit extends object,
  TAuthored extends object = TSubmit
> = AuthoredFormFactoryBase & {
  createEmptyValues: (input: { systemId: string }) => TValues
  createSession: (input: AuthoredFormSessionInput) => AuthoredFormSession
  normalizeForSubmit: (values: TValues) => TSubmit
  toFormValues: (record: TValues | TSubmit | TAuthored) => TValues
}
