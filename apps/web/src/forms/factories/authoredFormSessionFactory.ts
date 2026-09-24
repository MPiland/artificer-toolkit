import type { ReactNode } from 'react'
import type * as core from 'zod/v4/core'
import type { AuthoredDraftDto } from '@artificer-toolkit/schema/api/content'
import type { SystemResponseDto } from '@artificer-toolkit/schema/api/systems'
import { parseAuthoredDraftPayload } from '#app/data/authoredDrafts'
import { queryKeys as globalQueryKeys } from '#app/lib/queryKeys'
import type { AuthoredFormEditData } from './authoredFormFactories'
import type {
  AuthoredFormPreviewContext,
  AuthoredFormDomain,
  AuthoredFormSession,
  AuthoredFormSessionInput
} from './authoredFormFactories.types'
import type { AuthoredFormActionFactory } from '../actions/authoredFormActionFactories'
import { authoredPreviewFactories } from '../previews/authoredPreviewFactories'

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

export type AuthoredSessionConfig<
  TValues extends AuthoredFormValuesBase,
  TSubmit extends AuthoredFormSubmitBase,
  TAuthored extends AuthoredFormValuesBase,
  TCreateData,
  TEditData extends AuthoredFormEditData<TAuthored>,
  TContext = undefined
> = {
  actionFactory: AuthoredFormActionFactory
  createEmptyValues: (input: { systemId: string }, context: TContext) => TValues
  domain: AuthoredFormDomain
  getCreateContext?: (data: TCreateData) => TContext
  getCreateSystems: (data: TCreateData) => readonly { id: string }[]
  getEditContext?: (data: TEditData) => TContext
  normalizeForSubmit: (values: TValues, context: TContext) => TSubmit
  operations: AuthoredFormOperations<TSubmit>
  queryKeys: AuthoredFormQueryKeys
  renderPreview?: (
    context: AuthoredFormPreviewContext<TValues>,
    sessionContext: TContext
  ) => ReactNode
  resolveCreateSystemId: (systems: readonly { id: string }[], context: TContext) => string | null
  schema: core.$ZodType<TSubmit>
  subjectKindLabel: string
  toCreateData: (data: unknown) => TCreateData
  toEditData: (data: unknown) => TEditData
  toFormValues: (record: TValues | TSubmit | TAuthored, context: TContext) => TValues
}

export function createAuthoredSession<
  TValues extends AuthoredFormValuesBase,
  TSubmit extends AuthoredFormSubmitBase,
  TAuthored extends AuthoredFormValuesBase,
  TCreateData extends { system?: SystemResponseDto | null },
  TEditData extends AuthoredFormEditData<TAuthored>,
  TContext
>(
  { data, mode }: AuthoredFormSessionInput,
  config: AuthoredSessionConfig<TValues, TSubmit, TAuthored, TCreateData, TEditData, TContext>
): AuthoredFormSession {
  if (mode === 'create') {
    return createAuthoredCreateSession(data, config)
  }

  return createAuthoredEditSession(data, mode, config)
}

function createAuthoredCreateSession<
  TValues extends AuthoredFormValuesBase,
  TSubmit extends AuthoredFormSubmitBase,
  TAuthored extends AuthoredFormValuesBase,
  TCreateData extends { system?: SystemResponseDto | null },
  TEditData extends AuthoredFormEditData<TAuthored>,
  TContext
>(
  data: unknown,
  config: AuthoredSessionConfig<TValues, TSubmit, TAuthored, TCreateData, TEditData, TContext>
): AuthoredFormSession {
  const createData = config.toCreateData(data)
  const context = getCreateContext(config, createData)
  const systemId = config.resolveCreateSystemId(config.getCreateSystems(createData), context) ?? ''
  const initialValues = config.createEmptyValues({ systemId }, context)

  return createAuthoredSessionBase({
    config,
    context,
    canCopy: false,
    canDelete: false,
    canSaveDraft: Boolean(systemId),
    hasActiveDraft: false,
    hasInvalidDraft: false,
    initialValues,
    invalidDraftOnly: false,
    isDraft: false,
    key: `${config.actionFactory.subjectKindLabel.toLowerCase()}:create:${systemId || 'missing-system'}`,
    mode: 'create',
    notFound: false,
    provenanceKind: 'OWNED',
    readOnly: false,
    subjectLabel: initialValues.label || `Untitled ${config.actionFactory.subjectKindLabel}`,
    system: createData.system ?? null,
    systemId,
    systemRequired: !systemId
  })
}

function createAuthoredEditSession<
  TValues extends AuthoredFormValuesBase,
  TSubmit extends AuthoredFormSubmitBase,
  TAuthored extends AuthoredFormValuesBase,
  TCreateData extends { system?: SystemResponseDto | null },
  TEditData extends AuthoredFormEditData<TAuthored>,
  TContext
>(
  data: unknown,
  requestedMode: AuthoredFormSession['mode'],
  config: AuthoredSessionConfig<TValues, TSubmit, TAuthored, TCreateData, TEditData, TContext>
): AuthoredFormSession {
  const editData = config.toEditData(data)
  const context = getEditContext(config, editData)
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
  const subjectKindLabel = config.actionFactory.subjectKindLabel

  return createAuthoredSessionBase({
    config,
    context,
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
    systemRequired: false
  })
}

function createAuthoredSessionBase<
  TValues extends AuthoredFormValuesBase,
  TSubmit extends AuthoredFormSubmitBase,
  TAuthored extends AuthoredFormValuesBase,
  TCreateData,
  TEditData extends AuthoredFormEditData<TAuthored>,
  TContext
>({
  activeRecord,
  canCopy,
  canDelete,
  canSaveDraft,
  config,
  context,
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
  systemRequired
}: {
  activeRecord?: TAuthored | null
  canCopy: boolean
  canDelete: boolean
  canSaveDraft: boolean
  config: AuthoredSessionConfig<TValues, TSubmit, TAuthored, TCreateData, TEditData, TContext>
  context: TContext
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
}): AuthoredFormSession {
  const { actionFactory, domain, operations, queryKeys, subjectKindLabel } = config
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
    systemRequired
  }
}

function getCreateContext<
  TValues extends AuthoredFormValuesBase,
  TSubmit extends AuthoredFormSubmitBase,
  TAuthored extends AuthoredFormValuesBase,
  TCreateData,
  TEditData extends AuthoredFormEditData<TAuthored>,
  TContext
>(
  config: AuthoredSessionConfig<TValues, TSubmit, TAuthored, TCreateData, TEditData, TContext>,
  data: TCreateData
): TContext {
  return config.getCreateContext ? config.getCreateContext(data) : (undefined as TContext)
}

function getEditContext<
  TValues extends AuthoredFormValuesBase,
  TSubmit extends AuthoredFormSubmitBase,
  TAuthored extends AuthoredFormValuesBase,
  TCreateData,
  TEditData extends AuthoredFormEditData<TAuthored>,
  TContext
>(
  config: AuthoredSessionConfig<TValues, TSubmit, TAuthored, TCreateData, TEditData, TContext>,
  data: TEditData
): TContext {
  return config.getEditContext ? config.getEditContext(data) : (undefined as TContext)
}
