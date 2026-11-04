import { Button } from '@mantine/core'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useMutation as useConvexMutation } from 'convex/react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { ConfirmDeleteModal } from '#app/components/ConfirmDelete/ConfirmDeleteModal'

export function SceneDeleteAction({
  campaignId,
  scene,
  onDeleted
}: {
  campaignId: string
  scene: { id: string; name: string; version: number }
  onDeleted: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const removeScene = useConvexMutation(convexApi.scenes.definitions.remove)
  const remove = useMutation({
    mutationFn: () =>
      removeScene({ campaignId, sceneId: scene.id, expectedVersion: scene.version }),
    onSuccess: () => {
      setConfirming(false)
      onDeleted()
    }
  })

  return (
    <>
      <Button color='red' variant='subtle' onClick={() => setConfirming(true)}>
        Delete scene
      </Button>
      <ConfirmDeleteModal
        body={`Permanently delete ${scene.name}? Its map placements, loot and any live showing are removed. This can’t be undone.`}
        confirmLabel='Delete scene'
        errorMessage={
          remove.error ? 'That scene couldn’t be deleted. Reload it and try again.' : null
        }
        isDeleting={remove.isPending}
        opened={confirming}
        title='Delete scene?'
        onClose={() => setConfirming(false)}
        onConfirm={() => remove.mutate()}
      />
    </>
  )
}
