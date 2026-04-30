import { Alert, Button, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  equipmentAuthoredDtoSchema,
  type EquipmentAuthoredDto
} from '@artificer-toolkit/schema'
import { AuthoredFormPageFrame } from '#components/Form/AuthoredFormPageFrame'
import { InvalidDraftAlert } from '#components/Form/InvalidDraftAlert'
import { parseAuthoredDraftPayload } from '#app/data/authoredDrafts'
import { getEffectReferenceData } from '#app/data/effects'
import { getEquipment, getEquipmentDraft } from '#app/data/equipment/queries'
import { getSystemList } from '#app/data/systems/queries'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { EquipmentForm } from './EquipmentForm'
import { createEmptyEquipment, resolveCreateEquipmentSystemId } from './equipmentAuthoring.utils'
import * as styles from './equipmentAuthoring.css'

export function EquipmentCreatePage({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: systems } = useSuspenseQuery(getSystemList())
  const systemId = resolveCreateEquipmentSystemId(systems)
  const { data: references } = useSuspenseQuery(getEffectReferenceData(systemId ?? undefined))
  const mutation = useMutation({
    mutationFn: (equipment: EquipmentAuthoredDto) => api.content.equipment.activate(equipment),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.equipment.all() })
      notifications.show({ color: 'green', message: 'Equipment created.' })
      if (response?.item.id) {
        await navigate({ to: '/equipment/$equipmentId', params: { equipmentId: response.item.id } })
      }
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not save that equipment yet.' })
  })
  const draftMutation = useMutation({
    mutationFn: (equipment: EquipmentAuthoredDto) => api.content.equipment.saveDraft(equipment),
    onSuccess: async (draft) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.equipment.all() })
      notifications.show({ color: 'green', message: 'Equipment draft saved.' })
      await navigate({ to: '/equipment/$equipmentId/edit', params: { equipmentId: draft.subjectId } })
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not save that draft yet.' })
  })

  if (!systemId) {
    return (
      <AuthoredFormPageFrame contentClassName={styles.contentWide}>
        <Stack>
          <Alert color='yellow'>A system is required before creating equipment.</Alert>
          <Button onClick={() => navigate({ to: '/equipment' })}>Back to equipment</Button>
        </Stack>
      </AuthoredFormPageFrame>
    )
  }

  return (
    <AuthoredFormPageFrame contentClassName={styles.contentWide}>
      <EquipmentForm
        mode='create'
        systemId={systemId}
        userId={userId}
        references={references}
        initialEquipment={createEmptyEquipment({ systemId, userId })}
        onSubmit={async (equipment) => mutation.mutateAsync(equipment).then(() => undefined)}
        onSaveDraft={async (equipment) => draftMutation.mutateAsync(equipment).then(() => undefined)}
      />
    </AuthoredFormPageFrame>
  )
}

export function EquipmentDetailPage({
  equipmentId,
  mode,
  userId
}: {
  equipmentId: string
  mode: 'view' | 'edit'
  userId: string
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: response } = useSuspenseQuery(getEquipment(equipmentId))
  const { data: draft } = useSuspenseQuery(getEquipmentDraft(equipmentId))
  const parsedDraft = parseAuthoredDraftPayload(draft, equipmentAuthoredDtoSchema)
  const draftEquipment = parsedDraft.item
  const systemId = draftEquipment?.systemId ?? response?.item.systemId ?? ''
  const { data: references } = useSuspenseQuery(getEffectReferenceData(systemId))
  const saveMutation = useMutation({
    mutationFn: (equipment: EquipmentAuthoredDto) => api.content.equipment.activate(equipment),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.equipment.all() })
      if (saved?.item.id) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.content.equipment.detail(saved.item.id) })
        await queryClient.invalidateQueries({ queryKey: queryKeys.content.equipment.draft(saved.item.id) })
        await navigate({ to: '/equipment/$equipmentId', params: { equipmentId: saved.item.id } })
      }
      notifications.show({ color: 'green', message: 'Equipment saved.' })
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not save that equipment yet.' })
  })
  const draftMutation = useMutation({
    mutationFn: (equipment: EquipmentAuthoredDto) => api.content.equipment.saveDraft(equipment),
    onSuccess: async (savedDraft) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.equipment.all() })
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.equipment.draft(savedDraft.subjectId) })
      notifications.show({ color: 'green', message: 'Equipment draft saved.' })
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not save that draft yet.' })
  })
  const discardDraftMutation = useMutation({
    mutationFn: () => api.content.equipment.discardDraft(equipmentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.equipment.all() })
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.equipment.draft(equipmentId) })
      notifications.show({ color: 'green', message: 'Stale equipment draft discarded.' })
      if (!response) {
        await navigate({ to: '/equipment' })
      }
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not discard that draft yet.' })
  })
  const copyMutation = useMutation({
    mutationFn: () => api.content.equipment.duplicate(equipmentId),
    onSuccess: async (copied) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.content.equipment.all() })
      notifications.show({ color: 'green', message: 'Equipment duplicated as an owned draft.' })
      if (copied?.subjectId) {
        await navigate({ to: '/equipment/$equipmentId/edit', params: { equipmentId: copied.subjectId } })
      }
    },
    onError: () => notifications.show({ color: 'red', message: 'Could not duplicate that equipment yet.' })
  })

  if (!response && parsedDraft.isInvalid) {
    return (
      <AuthoredFormPageFrame contentClassName={styles.contentWide}>
        <Stack>
          <InvalidDraftAlert
            domainLabel='equipment'
            isDiscarding={discardDraftMutation.isPending}
            onDiscard={() => discardDraftMutation.mutate()}
          />
          <Button onClick={() => navigate({ to: '/equipment' })}>Back to equipment</Button>
        </Stack>
      </AuthoredFormPageFrame>
    )
  }

  if (!response && !draftEquipment) {
    return (
      <AuthoredFormPageFrame contentClassName={styles.contentWide}>
        <Stack>
          <Alert color='yellow'>That equipment could not be found.</Alert>
          <Button onClick={() => navigate({ to: '/equipment' })}>Back to equipment</Button>
        </Stack>
      </AuthoredFormPageFrame>
    )
  }

  const formKey = `${mode}:${equipmentId}:${draft?.updatedAt ?? response?.item.id ?? 'missing'}:${draftEquipment ? 'draft' : 'active'}`

  return (
    <AuthoredFormPageFrame contentClassName={styles.contentWide}>
      <Stack>
        {parsedDraft.isInvalid
          ? (
              <InvalidDraftAlert
                domainLabel='equipment'
                isDiscarding={discardDraftMutation.isPending}
                onDiscard={() => discardDraftMutation.mutate()}
              />
            )
          : null}
        <EquipmentForm
          key={formKey}
          mode={mode}
          systemId={systemId}
          userId={userId}
          references={references}
          initialEquipment={draftEquipment}
          response={response}
          onCopy={() => copyMutation.mutate()}
          onSubmit={async (equipment) => saveMutation.mutateAsync(equipment).then(() => undefined)}
          onSaveDraft={async (equipment) => draftMutation.mutateAsync(equipment).then(() => undefined)}
        />
      </Stack>
    </AuthoredFormPageFrame>
  )
}
