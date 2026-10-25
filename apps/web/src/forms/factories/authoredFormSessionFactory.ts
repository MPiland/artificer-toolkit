import type { ReactNode } from 'react'
import type { ConvexReactClient } from 'convex/react'
import type * as core from 'zod/v4/core'
import type { AuthoredDraftDto } from '@artificer-toolkit/schema/api/content'
import type { AuthoredContentProvenanceDto } from '@artificer-toolkit/schema/api/common'
import type {
  SystemListResponseDto,
  SystemResponseDto
} from '@artificer-toolkit/schema/api/systems'
import { parseAuthoredDraftPayload } from '#app/data/authoredDrafts'
import { queryKeys as globalQueryKeys } from '#app/lib/queryKeys'
import type {
  AuthoredFormFactory,
  AuthoredFormPreviewContext,
  AuthoredFormDomain,
  AuthoredFormSession,
  AuthoredFormSessionInput
} from './authoredFormFactories.types'
import { authoredFormActionFactories } from '../actions/authoredFormActionFactories'
import { authoredPreviewFactories } from '../previews/authoredPreviewFactories'
import { isObjectValue } from '../utils/valueGuards'

type AuthoredFormValuesBase = {
  label?: string | null
  systemId: string
}

type AuthoredFormSubmitBase = AuthoredFormValuesBase & {
  id: string
  label: string
}

type AuthoredFormQueryKeys = {
  all: () => readonly unknown[]
  detail: (id: string) => readonly unknown[]
  detailRoot: (id: string) => readonly unknown[]
  draft: (id: string) => readonly unknown[]
  list: () => readonly unknown[]
}

type AuthoredFormOperations<TSubmit extends object> = {
  activate: (payload: TSubmit) => ReturnType<AuthoredFormSession['operations']['activate']>
  deleteActive: (id: string) => Promise<unknown>
  discardDraft: (id: string) => Promise<unknown>
  duplicate: NonNullable<AuthoredFormSession['operations']['duplicate']>
  saveDraft: (payload: TSubmit) => ReturnType<AuthoredFormSession['operations']['saveDraft']>
}

type AuthoredFormEditResponse<TAuthored extends object> = {
  item?: TAuthored | null
  permissions?: {
    canCopy: boolean
    canDelete: boolean
    canEdit: boolean
  }
  provenance?: AuthoredContentProvenanceDto
}

export type AuthoredFormCreateData = {
  system?: SystemResponseDto | null
  systems: SystemListResponseDto
}

export type AuthoredFormEditData<TAuthored extends object> = {
  draft?: AuthoredDraftDto | null
  response?: AuthoredFormEditResponse<TAuthored> | null
  subjectId: string
  system?: SystemResponseDto | null
}

/** Resolves the per-session context a domain's pure functions need beyond the form values. */
type AuthoredFormContextResolver<TEditData, TContext> = {
  fromCreate: (data: AuthoredFormCreateData) => TContext
  fromEdit: (data: TEditData) => TContext
}

export const noAuthoredFormContext: AuthoredFormContextResolver<object, undefined> = {
  fromCreate: () => undefined,
  fromEdit: () => undefined
}

/**
 * One authored domain's form config: empty values, to-submit and to-form-values, consumed by
 * `defineAuthoredForm`.
 */
type AuthoredFormConfig<
  TValues extends AuthoredFormValuesBase,
  TSubmit extends AuthoredFormSubmitBase,
  TAuthored extends AuthoredFormValuesBase,
  TEditData extends AuthoredFormEditData<TAuthored> = AuthoredFormEditData<TAuthored>,
  TContext = undefined
> = {
  context: AuthoredFormContextResolver<TEditData, TContext>
  createEmptyValues: (input: { systemId: string }, context: TContext) => TValues
  createOperations: (client?: ConvexReactClient) => AuthoredFormOperations<TSubmit>
  domain: AuthoredFormDomain
  normalizeForSubmit: (values: TValues, context: TContext) => TSubmit
  queryKeys: AuthoredFormQueryKeys
  renderPreview?: (
    context: AuthoredFormPreviewContext<TValues>,
    sessionContext: TContext
  ) => ReactNode
  schema: core.$ZodType<TSubmit>
  toFormValues: (record: TValues | TSubmit | TAuthored, context: TContext) => TValues
}

const EMPTY_CREATE_DATA: AuthoredFormCreateData = { systems: [] }
const EMPTY_EDIT_DATA: AuthoredFormEditData<never> = { draft: null, response: null, subjectId: '' }

/** Route loader data arrives type-erased through router matches; this is the one narrowing point. */
function isCreateData(data: unknown): data is AuthoredFormCreateData {
  return isObjectValue(data) && Array.isArray(data.systems)
}

function isEditData<TEditData extends AuthoredFormEditData<object>>(
  data: unknown
): data is TEditData {
  return isObjectValue(data) && typeof data.subjectId === 'string'
}

export function defineAuthoredForm<
  TValues extends AuthoredFormValuesBase,
  TSubmit extends AuthoredFormSubmitBase,
  TAuthored extends AuthoredFormValuesBase,
  TEditData extends AuthoredFormEditData<TAuthored> = AuthoredFormEditData<TAuthored>,
  TContext = undefined
>(
  config: AuthoredFormConfig<TValues, TSubmit, TAuthored, TEditData, TContext>
): AuthoredFormFactory<TValues, TSubmit, TAuthored> {
  const actionFactory = authoredFormActionFactories[config.domain]
  const emptyContext = config.context.fromCreate(EMPTY_CREATE_DATA)

  return {
    createEmptyValues: (input) => config.createEmptyValues(input, emptyContext),
    createSession: (input) => createAuthoredSession(input, config),
    domain: config.domain,
    fallbackLabel: `Untitled ${actionFactory.subjectKindLabel}`,
    mapId: config.domain,
    normalizeForSubmit: (values) => config.normalizeForSubmit(values, emptyContext),
    subjectKindLabel: actionFactory.subjectKindLabel,
    toFormValues: (record) => config.toFormValues(record, emptyContext)
  }
}

function createAuthoredSession<
  TValues extends AuthoredFormValuesBase,
  TSubmit extends AuthoredFormSubmitBase,
  TAuthored extends AuthoredFormValuesBase,
  TEditData extends AuthoredFormEditData<TAuthored>,
  TContext
>(
  { convexClient, data, mode }: AuthoredFormSessionInput,
  config: AuthoredFormConfig<TValues, TSubmit, TAuthored, TEditData, TContext>
): AuthoredFormSession {
  if (mode === 'create') {
    return createAuthoredCreateSession(data, convexClient, config)
  }

  return createAuthoredEditSession(data, mode, convexClient, config)
}

function createAuthoredCreateSession<
  TValues extends AuthoredFormValuesBase,
  TSubmit extends AuthoredFormSubmitBase,
  TAuthored extends AuthoredFormValuesBase,
  TEditData extends AuthoredFormEditData<TAuthored>,
  TContext
>(
  data: unknown,
  convexClient: ConvexReactClient | undefined,
  config: AuthoredFormConfig<TValues, TSubmit, TAuthored, TEditData, TContext>
): AuthoredFormSession {
  const createData = isCreateData(data) ? data : EMPTY_CREATE_DATA
  const context = config.context.fromCreate(createData)
  const systemId = createData.system?.id ?? ''
  const initialValues = config.createEmptyValues({ systemId }, context)
  const { subjectKindLabel } = authoredFormActionFactories[config.domain]

  return createAuthoredSessionBase({
    config,
    context,
    convexClient,
    canCopy: false,
    canDelete: false,
    canSaveDraft: Boolean(systemId),
    hasActiveDraft: false,
    hasInvalidDraft: false,
    initialValues,
    invalidDraftOnly: false,
    isDraft: false,
    key: `${subjectKindLabel.toLowerCase()}:create:${systemId || 'missing-system'}`,
    mode: 'create',
    notFound: false,
    provenanceKind: 'OWNED',
    readOnly: false,
    subjectLabel: initialValues.label || `Untitled ${subjectKindLabel}`,
    system: createData.system ?? null,
    systemId,
    systemRequired: !systemId,
    systems: createData.systems
  })
}

function createAuthoredEditSession<
  TValues extends AuthoredFormValuesBase,
  TSubmit extends AuthoredFormSubmitBase,
  TAuthored extends AuthoredFormValuesBase,
  TEditData extends AuthoredFormEditData<TAuthored>,
  TContext
>(
  data: unknown,
  requestedMode: AuthoredFormSession['mode'],
  convexClient: ConvexReactClient | undefined,
  config: AuthoredFormConfig<TValues, TSubmit, TAuthored, TEditData, TContext>
): AuthoredFormSession {
  const routeEditData = isEditData<TEditData>(data) ? data : undefined
  const editData: AuthoredFormEditData<TAuthored> = routeEditData ?? EMPTY_EDIT_DATA
  const context = routeEditData
    ? config.context.fromEdit(routeEditData)
    : config.context.fromCreate(EMPTY_CREATE_DATA)
  const parsedDraft = parseAuthoredDraftPayload(editData.draft ?? null, config.schema)
  const draftItem = parsedDraft.item
  const activeRecord = editData.response?.item ?? undefined
  const record = draftItem ?? activeRecord ?? null
  const initialValues = record
    ? config.toFormValues(record, context)
    : config.createEmptyValues(
        { systemId: activeRecord?.systemId ?? draftItem?.systemId ?? '' },
        context
      )
  const readOnly =
    requestedMode === 'view' ||
    Boolean(activeRecord && editData.response?.permissions?.canEdit === false)
  const canCopy = Boolean(editData.response?.permissions?.canCopy && editData.subjectId)
  const canDelete =
    !readOnly && Boolean(parsedDraft.draft || editData.response?.permissions?.canDelete)
  const invalidDraftOnly = !editData.response && parsedDraft.isInvalid
  const { subjectKindLabel } = authoredFormActionFactories[config.domain]

  return createAuthoredSessionBase({
    config,
    context,
    convexClient,
    activeRecord,
    canCopy,
    canDelete,
    canSaveDraft: !readOnly,
    draft: parsedDraft.draft,
    hasActiveDraft: Boolean(parsedDraft.draft && activeRecord),
    hasInvalidDraft: Boolean(editData.draft && parsedDraft.isInvalid),
    initialValues,
    invalidDraftOnly,
    isDraft: Boolean(parsedDraft.draft),
    key: `${subjectKindLabel.toLowerCase()}:edit:${editData.subjectId}:${draftItem ? 'draft' : 'active'}`,
    mode: readOnly ? 'view' : 'edit',
    notFound: !editData.response && !draftItem && !invalidDraftOnly,
    provenanceKind: editData.response?.provenance?.kind ?? (editData.draft ? 'OWNED' : null),
    readOnly,
    subjectId: editData.subjectId,
    subjectLabel: initialValues.label || `Untitled ${subjectKindLabel}`,
    system: editData.system ?? null,
    systemId: initialValues.systemId,
    systemRequired: false,
    systems: []
  })
}

function createAuthoredSessionBase<
  TValues extends AuthoredFormValuesBase,
  TSubmit extends AuthoredFormSubmitBase,
  TAuthored extends AuthoredFormValuesBase,
  TEditData extends AuthoredFormEditData<TAuthored>,
  TContext
>({
  activeRecord,
  canCopy,
  canDelete,
  canSaveDraft,
  config,
  context,
  convexClient,
  draft = null,
  hasActiveDraft,
  hasInvalidDraft,
  initialValues,
  invalidDraftOnly,
  isDraft,
  key,
  mode,
  notFound,
  provenanceKind,
  readOnly,
  subjectId,
  subjectLabel,
  system,
  systemId,
  systemRequired,
  systems
}: {
  activeRecord?: TAuthored | null
  canCopy: boolean
  canDelete: boolean
  canSaveDraft: boolean
  config: AuthoredFormConfig<TValues, TSubmit, TAuthored, TEditData, TContext>
  context: TContext
  convexClient: ConvexReactClient | undefined
  draft?: AuthoredDraftDto | null
  hasActiveDraft: boolean
  hasInvalidDraft: boolean
  initialValues: TValues
  invalidDraftOnly: boolean
  isDraft: boolean
  key: string
  mode: AuthoredFormSession['mode']
  notFound: boolean
  provenanceKind: AuthoredFormSession['provenanceKind']
  readOnly: boolean
  subjectId?: string
  subjectLabel: ReactNode
  system?: SystemResponseDto | null
  systemId?: string
  systemRequired: boolean
  systems: SystemListResponseDto
}): AuthoredFormSession {
  const { domain, queryKeys } = config
  const actionFactory = authoredFormActionFactories[domain]
  const { subjectKindLabel } = actionFactory
  const operations = config.createOperations(convexClient)
  const renderPreview:
    | ((previewContext: AuthoredFormPreviewContext<TValues>, sessionContext: TContext) => ReactNode)
    | undefined = config.renderPreview ?? authoredPreviewFactories[domain]
  const sessionContext = context

  return {
    actionFactory,
    activeRecord,
    canCopy,
    canDelete,
    canSaveDraft,
    deleteConfig: {
      deleteActive: async (id) => {
        await operations.deleteActive(id)
      },
      deleteDraft: async (id) => {
        await operations.discardDraft(id)
      },
      detailSubjectQueryKey: queryKeys.detailRoot,
      domainQueryKey: queryKeys.all(),
      draftQueryKey: queryKeys.draft
    },
    domain,
    draft,
    fallbackLabel: `Untitled ${subjectKindLabel}`,
    hasActiveDraft,
    hasInvalidDraft,
    initialValues,
    invalidDraftOnly,
    isDraft,
    key,
    mapId: domain,
    mode,
    normalizeForSubmit: (values) => config.normalizeForSubmit(values as TValues, sessionContext),
    notFound,
    operations: {
      activate: (payload) => operations.activate(payload as TSubmit),
      duplicate: operations.duplicate,
      onActivateSuccess: async (queryClient, response) => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.all() })

        if (response?.item?.id) {
          queryClient.setQueryData(queryKeys.detail(response.item.id), response)
          await queryClient.invalidateQueries({ queryKey: queryKeys.draft(response.item.id) })
        }
      },
      onDiscardDraftSuccess: async (queryClient) => {
        if (!subjectId) return
        await queryClient.invalidateQueries({ queryKey: queryKeys.all() })
        await queryClient.invalidateQueries({ queryKey: queryKeys.draft(subjectId) })
      },
      onDuplicateSuccess: async (queryClient) => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.all() })
      },
      onSaveDraftSuccess: async (queryClient, savedDraft) => {
        queryClient.setQueryData(queryKeys.draft(savedDraft.subjectId), savedDraft)
        queryClient.setQueryData(
          globalQueryKeys.routeIds.resolve(savedDraft.subjectKind, savedDraft.publicId),
          savedDraft.subjectId
        )
        if (savedDraft.draftState === 'DRAFT_ONLY') {
          queryClient.setQueryData(queryKeys.detail(savedDraft.subjectId), null)
        }
        await queryClient.invalidateQueries({ queryKey: queryKeys.list(), refetchType: 'none' })
      },
      saveDraft: (payload) => operations.saveDraft(payload as TSubmit),
      ...(subjectId ? { discardDraft: () => operations.discardDraft(subjectId) } : {})
    },
    provenanceKind,
    readOnly,
    renderPreview: renderPreview
      ? (previewContext) =>
          renderPreview(
            {
              ...previewContext,
              domain,
              system,
              values: previewContext.values as TValues
            },
            sessionContext
          )
      : undefined,
    subjectId,
    subjectKindLabel,
    subjectLabel,
    system,
    systemId,
    systemRequired,
    systems
  }
}
