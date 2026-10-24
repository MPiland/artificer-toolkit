import { Alert, Loader } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import { useVttMapDelivery } from '#app/data/media'
import * as styles from './CampaignShownSceneViewer.css'
import { createVttSceneRenderer, type VttSceneRenderer } from './vttSceneRenderer'

const noTokens: ReadonlyMap<string, boolean> = new Map()

/** Renders a shown Scene read-only: the map and its fog, with every edit and live callback inert. */
export function CampaignShownSceneCanvas({
  currentUserId,
  gameSystemId,
  scene
}: {
  currentUserId: string
  gameSystemId: string
  scene: CampaignSceneStateDto
}) {
  const host = useRef<HTMLDivElement>(null)
  const [renderer, setRenderer] = useState<VttSceneRenderer | null>(null)
  const mapDelivery = useVttMapDelivery(scene.map.assetId, (delivery) =>
    renderer?.retryMap(delivery)
  )

  useEffect(() => {
    const element = host.current
    if (!element) return
    let disposed = false
    void createVttSceneRenderer(
      element,
      {
        onMapLoadStatus: mapDelivery.onMapLoadStatus,
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
      },
      gameSystemId
    ).then((created) => {
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
  }, [gameSystemId])

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
