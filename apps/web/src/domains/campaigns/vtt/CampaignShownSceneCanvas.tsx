import { Alert, Loader } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useConvex } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import { api } from '@artificer-toolkit/apis/convex/api'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import { queryKeys } from '#app/lib/queryKeys'
import * as styles from './CampaignShownSceneViewer.css'
import { createVttSceneRenderer, type VttSceneRenderer } from './vttSceneRenderer'

const noTokens: ReadonlyMap<string, boolean> = new Map()

/** Renders a shown Scene read-only: the map and its fog, with every edit and live callback inert. */
export function CampaignShownSceneCanvas({
  currentUserId,
  scene
}: {
  currentUserId: string
  scene: CampaignSceneStateDto
}) {
  const convex = useConvex()
  const host = useRef<HTMLDivElement>(null)
  const [renderer, setRenderer] = useState<VttSceneRenderer | null>(null)
  const mapDelivery = useQuery({
    queryFn: () =>
      convex.action(api.media.vttMapActions.getDelivery, { assetId: scene.map.assetId }),
    queryKey: queryKeys.media.vttMap(scene.map.assetId),
    refetchInterval: 4 * 60_000,
    refetchOnWindowFocus: false,
    staleTime: 4 * 60_000
  })

  useEffect(() => {
    const element = host.current
    if (!element) return
    let disposed = false
    void createVttSceneRenderer(element, {
      onCreateBarrier: () => undefined,
      onCreateDarkness: () => undefined,
      onCreateLight: () => undefined,
      onCreateToken: () => undefined,
      onDoorState: () => undefined,
      onMeasurementCommit: () => undefined,
      onMeasurementPreview: () => undefined,
      onPing: () => false,
      onTokenCommit: () => undefined,
      onTokenPreview: () => undefined
    }).then((created) => {
      if (disposed) created.destroy()
      else setRenderer(created)
    })
    return () => {
      disposed = true
      setRenderer((current) => {
        current?.destroy()
        return null
      })
    }
  }, [])

  useEffect(() => {
    renderer?.update({
      boundTokenControl: noTokens,
      currentUserId,
      mapDelivery: mapDelivery.data ?? null,
      mode: 'PLAY',
      role: 'PLAYER',
      scene,
      tool: 'PAN'
    })
  }, [currentUserId, mapDelivery.data, renderer, scene])

  return (
    <>
      {mapDelivery.error ? (
        <Alert color='red'>
          The map is unavailable. Close this and ask the GM to show it again.
        </Alert>
      ) : null}
      <div aria-label={`Map of ${scene.name}`} className={styles.canvasFrame} ref={host} role='img'>
        {mapDelivery.isPending ? <Loader size='sm' /> : null}
      </div>
    </>
  )
}
