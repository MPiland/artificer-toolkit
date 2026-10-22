import type { AuthoredDraftDto } from '@artificer-toolkit/schema/api/content'

type AuthoringRouteParams = Record<string, string>

export type AuthoringRouteParamBuilder = (
  publicId: string,
  label: string | null | undefined
) => AuthoringRouteParams

export type AuthoringActionMessages = {
  activateError: string
  activateSuccess: string
  copyError: string
  copySuccess: string
  discardDraftError: string
  discardDraftSuccess: string
  saveDraftError: string
  saveDraftSuccess: string
}

export type AuthoringNotifier = {
  show: (input: { color: 'green' | 'red'; message: string }) => void
}

export type AuthoringNavigate = (input: {
  params?: AuthoringRouteParams
  to: string
}) => Promise<unknown> | void

export type AuthoringRouter = {
  invalidate: () => Promise<unknown> | void
}

type AuthoringMutation<TInput, TOutput> = {
  mutateAsync: (input: TInput) => Promise<TOutput>
}

type AuthoringVoidMutation<TOutput = unknown> = {
  mutateAsync: () => Promise<TOutput>
}

export type ActivatedAuthoringItem = {
  id?: string
  label?: string | null
}

export type ActivatedAuthoringResponse<
  TItem extends ActivatedAuthoringItem = ActivatedAuthoringItem
> =
  | {
      item?: TItem | null
      publicId: string
    }
  | null
  | undefined

export type DraftAuthoringResponse = AuthoredDraftDto

export type DuplicateAuthoringResponse = DraftAuthoringResponse

export type CreateCancelActionArgs = {
  listPath: string
  navigate: AuthoringNavigate
}

export type CreateActivateActionArgs<
  TSubmit extends object,
  TItem extends ActivatedAuthoringItem = ActivatedAuthoringItem
> = {
  activateMutation: AuthoringMutation<TSubmit, ActivatedAuthoringResponse<TItem>>
  buildRouteParams: AuthoringRouteParamBuilder
  detailPath: string
  messages: Pick<AuthoringActionMessages, 'activateError' | 'activateSuccess'>
  navigate: AuthoringNavigate
  notifier: AuthoringNotifier
  readOnly?: boolean
  router?: AuthoringRouter
  subjectId?: string
}

export type CreateDraftActionArgs<
  TSubmit extends object,
  TResponse extends DraftAuthoringResponse = DraftAuthoringResponse
> = {
  buildRouteParams: AuthoringRouteParamBuilder
  draftMutation: AuthoringMutation<TSubmit, TResponse>
  editPath: string
  messages: Pick<AuthoringActionMessages, 'saveDraftError' | 'saveDraftSuccess'>
  navigate: AuthoringNavigate
  notifier: AuthoringNotifier
}

export type CreateUpdateDraftActionArgs<TSubmit extends object> = {
  draftMutation: AuthoringMutation<TSubmit, unknown>
  messages: Pick<AuthoringActionMessages, 'saveDraftError' | 'saveDraftSuccess'>
  notifier: AuthoringNotifier
  readOnly?: boolean
}

export type CreateCopyActionArgs<
  TResponse extends DuplicateAuthoringResponse | null | undefined = DuplicateAuthoringResponse
> = {
  buildRouteParams: AuthoringRouteParamBuilder
  duplicateMutation: AuthoringMutation<string, TResponse>
  editPath: string
  messages: Pick<AuthoringActionMessages, 'copyError' | 'copySuccess'>
  navigate: AuthoringNavigate
  notifier: AuthoringNotifier
  subjectId: string
}

export type CreateDeleteRequestActionArgs = {
  draft: boolean
  label: string | null | undefined
  requestDelete: (input: { id: string; kind: 'active' | 'draft'; label: string }) => void
  subjectKindLabel: string
  subjectId: string
}

export type CreateDiscardDraftActionArgs = {
  activeRecord: object | null | undefined
  discardDraftMutation: AuthoringVoidMutation
  listPath: string
  messages: Pick<AuthoringActionMessages, 'discardDraftError' | 'discardDraftSuccess'>
  navigate: AuthoringNavigate
  notifier: AuthoringNotifier
  router: AuthoringRouter
}
