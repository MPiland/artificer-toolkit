import { describe, expect, it, vi } from 'vitest'
import {
  createActivateAction,
  createCancelAction,
  createCopyAction,
  createCreateDraftAction,
  createDeleteRequestAction,
  createDiscardDraftAction,
  createUpdateDraftAction
} from './authoringActionBuilders'
import { authoredFormActionFactories } from './authoredFormActionFactories'
import type {
  AuthoringNavigate,
  AuthoringNotifier,
  AuthoringRouter
} from './authoringActionBuilders.types'

type SubmitPayload = {
  label: string
}

const messages = {
  activateError: 'Could not activate that race yet.',
  activateSuccess: 'Race activated.',
  copyError: 'Could not duplicate that race yet.',
  copySuccess: 'Race duplicated as an owned draft.',
  discardDraftError: 'Could not discard that draft yet.',
  discardDraftSuccess: 'Stale race draft discarded.',
  saveDraftError: 'Could not save that draft yet.',
  saveDraftSuccess: 'Race draft saved.'
}

describe('authoring action builders', () => {
  it('uses detail routes for activation targets', () => {
    expect(authoredFormActionFactories.class.activatePath).toBe('/classes/$classPublicId/$classSlug')
    expect(authoredFormActionFactories.equipment.activatePath).toBe(
      '/equipment/$equipmentPublicId/$equipmentSlug'
    )
    expect(authoredFormActionFactories.vehicle.activatePath).toBe(
      '/vehicles/$vehiclePublicId/$vehicleSlug'
    )
  })

  it('creates a cancel action that navigates to the list route', async () => {
    const navigate = createNavigate()
    const action = createCancelAction({ listPath: '/races', navigate })

    await action()

    expect(navigate).toHaveBeenCalledWith({ to: '/races' })
  })

  it('navigates to detail after create activation returns an item', async () => {
    const navigate = createNavigate()
    const router = createRouter()
    const notifier = createNotifier()
    const activateMutation = {
      mutateAsync: vi.fn(async (_payload: SubmitPayload) => ({
        item: { id: 'race-new', label: 'New Race' },
        publicId: 'race-new-public'
      }))
    }
    const action = createActivateAction({
      activateMutation,
      buildRouteParams,
      detailPath: '/races/$racePublicId/$raceSlug',
      messages,
      navigate,
      notifier,
      router
    })

    await action({ label: 'New Race' })

    expect(activateMutation.mutateAsync).toHaveBeenCalledWith({ label: 'New Race' })
    expect(notifier.show).toHaveBeenCalledWith({ color: 'green', message: messages.activateSuccess })
    expect(navigate).toHaveBeenCalledWith({
      params: { racePublicId: 'race-new-public', raceSlug: 'new-race' },
      to: '/races/$racePublicId/$raceSlug'
    })
    expect(router.invalidate).not.toHaveBeenCalled()
  })

  it('invalidates the current route after edit activation returns the same item', async () => {
    const navigate = createNavigate()
    const router = createRouter()
    const notifier = createNotifier()
    const activateMutation = {
      mutateAsync: vi.fn(async (_payload: SubmitPayload) => ({
        item: { id: 'race-1', label: 'Race One' },
        publicId: 'race-one'
      }))
    }
    const action = createActivateAction({
      activateMutation,
      buildRouteParams,
      detailPath: '/races/$racePublicId/$raceSlug',
      messages,
      navigate,
      notifier,
      router,
      subjectId: 'race-1'
    })

    await action({ label: 'Race One' })

    expect(navigate).not.toHaveBeenCalled()
    expect(router.invalidate).toHaveBeenCalled()
  })

  it('shows an activation failure notification', async () => {
    const notifier = createNotifier()
    const activateMutation = {
      mutateAsync: vi.fn(async (_payload: SubmitPayload) => {
        throw new Error('activate failed')
      })
    }
    const action = createActivateAction({
      activateMutation,
      buildRouteParams,
      detailPath: '/races/$racePublicId/$raceSlug',
      messages,
      navigate: createNavigate(),
      notifier
    })

    await action({ label: 'Broken Race' })

    expect(notifier.show).toHaveBeenCalledWith({ color: 'red', message: messages.activateError })
  })

  it('navigates to edit after creating a draft', async () => {
    const navigate = createNavigate()
    const notifier = createNotifier()
    const draftMutation = {
      mutateAsync: vi.fn(async (_payload: SubmitPayload) => ({
        label: 'Draft Race',
        publicId: 'draft-race'
      }))
    }
    const action = createCreateDraftAction({
      buildRouteParams,
      draftMutation,
      editPath: '/races/$racePublicId/$raceSlug/edit',
      messages,
      navigate,
      notifier
    })

    await action({ label: 'Draft Race' })

    expect(notifier.show).toHaveBeenCalledWith({ color: 'green', message: messages.saveDraftSuccess })
    expect(navigate).toHaveBeenCalledWith({
      params: { racePublicId: 'draft-race', raceSlug: 'draft-race' },
      to: '/races/$racePublicId/$raceSlug/edit'
    })
  })

  it('invalidates after updating a draft', async () => {
    const router = createRouter()
    const notifier = createNotifier()
    const draftMutation = {
      mutateAsync: vi.fn(async (_payload: SubmitPayload) => undefined)
    }
    const action = createUpdateDraftAction({
      draftMutation,
      messages,
      notifier,
      router
    })

    await action({ label: 'Updated Race' })

    expect(notifier.show).toHaveBeenCalledWith({ color: 'green', message: messages.saveDraftSuccess })
    expect(router.invalidate).toHaveBeenCalled()
  })

  it('skips draft updates when read only', async () => {
    const draftMutation = {
      mutateAsync: vi.fn(async (_payload: SubmitPayload) => undefined)
    }
    const action = createUpdateDraftAction({
      draftMutation,
      messages,
      notifier: createNotifier(),
      readOnly: true,
      router: createRouter()
    })

    await action({ label: 'Read Only Race' })

    expect(draftMutation.mutateAsync).not.toHaveBeenCalled()
  })

  it('navigates to the copied draft edit route', async () => {
    const navigate = createNavigate()
    const notifier = createNotifier()
    const duplicateMutation = {
      mutateAsync: vi.fn(async (_subjectId: string) => ({
        label: 'Copied Race',
        publicId: 'copied-race',
        subjectId: 'copy-1'
      }))
    }
    const action = createCopyAction({
      buildRouteParams,
      duplicateMutation,
      editPath: '/races/$racePublicId/$raceSlug/edit',
      messages,
      navigate,
      notifier,
      subjectId: 'race-1'
    })

    await action()

    expect(duplicateMutation.mutateAsync).toHaveBeenCalledWith('race-1')
    expect(notifier.show).toHaveBeenCalledWith({ color: 'green', message: messages.copySuccess })
    expect(navigate).toHaveBeenCalledWith({
      params: { racePublicId: 'copied-race', raceSlug: 'copied-race' },
      to: '/races/$racePublicId/$raceSlug/edit'
    })
  })

  it('builds the delete request action without opening confirmation UI itself', () => {
    const requestDelete = vi.fn()
    const action = createDeleteRequestAction({
      draft: true,
      label: '',
      requestDelete,
      subjectId: 'race-1',
      subjectKindLabel: 'Race'
    })

    action()

    expect(requestDelete).toHaveBeenCalledWith({
      id: 'race-1',
      kind: 'draft',
      label: 'Untitled Race'
    })
  })

  it('navigates to the list route when discarding a draft without an active record', async () => {
    const navigate = createNavigate()
    const router = createRouter()
    const notifier = createNotifier()
    const discardDraftMutation = {
      mutateAsync: vi.fn(async () => undefined)
    }
    const action = createDiscardDraftAction({
      activeRecord: null,
      discardDraftMutation,
      listPath: '/races',
      messages,
      navigate,
      notifier,
      router
    })

    await action()

    expect(notifier.show).toHaveBeenCalledWith({ color: 'green', message: messages.discardDraftSuccess })
    expect(navigate).toHaveBeenCalledWith({ to: '/races' })
    expect(router.invalidate).not.toHaveBeenCalled()
  })

  it('invalidates when discarding a draft with an active record', async () => {
    const navigate = createNavigate()
    const router = createRouter()
    const discardDraftMutation = {
      mutateAsync: vi.fn(async () => undefined)
    }
    const action = createDiscardDraftAction({
      activeRecord: { id: 'race-1' },
      discardDraftMutation,
      listPath: '/races',
      messages,
      navigate,
      notifier: createNotifier(),
      router
    })

    await action()

    expect(navigate).not.toHaveBeenCalled()
    expect(router.invalidate).toHaveBeenCalled()
  })
})

function buildRouteParams(publicId: string, label: string | null | undefined) {
  return {
    racePublicId: publicId,
    raceSlug: label?.toLowerCase().replaceAll(' ', '-') ?? 'untitled'
  }
}

function createNavigate(): AuthoringNavigate {
  return vi.fn(async () => undefined)
}

function createNotifier(): AuthoringNotifier {
  return {
    show: vi.fn()
  }
}

function createRouter(): AuthoringRouter {
  return {
    invalidate: vi.fn(async () => undefined)
  }
}
