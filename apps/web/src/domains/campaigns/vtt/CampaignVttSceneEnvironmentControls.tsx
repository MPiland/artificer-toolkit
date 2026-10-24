import { Select, Switch } from '@mantine/core'
import type { MutableRefObject } from 'react'
import type {
  CampaignSceneStateDto,
  SceneCommandInputDto
} from '@artificer-toolkit/schema/api/vttScenes'

/** The GM's Scene-wide environment: daylight, fog of war, and when vision reveals fog. */
export function CampaignVttSceneEnvironmentControls({
  scene,
  sceneRef,
  disabled,
  dispatch,
  onFogOff
}: {
  scene: CampaignSceneStateDto
  sceneRef: MutableRefObject<CampaignSceneStateDto | undefined>
  disabled: boolean
  dispatch: (command: SceneCommandInputDto) => void
  onFogOff: () => void
}) {
  return (
    <>
      <Switch
        aria-label='Daylight'
        checked={scene.daylight}
        disabled={disabled}
        label='Daylight'
        size='xs'
        onChange={(event) => {
          const current = sceneRef.current
          if (!current) return
          dispatch({
            commandId: crypto.randomUUID(),
            daylight: event.currentTarget.checked,
            expectedSceneVersion: current.version,
            illumination: current.ambientIllumination,
            sceneId: current.id,
            type: 'SET_SCENE_AMBIENT_ILLUMINATION'
          })
        }}
      />
      <Select
        aria-label='Fog of war'
        data={[
          { label: 'Fog off', value: 'OFF' },
          { label: 'Shared party fog', value: 'SHARED_PARTY' },
          { label: 'Per-player fog', value: 'PER_PLAYER' }
        ]}
        disabled={disabled}
        size='xs'
        value={scene.fogMode}
        onChange={(value) => {
          if (value !== 'OFF' && value !== 'SHARED_PARTY' && value !== 'PER_PLAYER') return
          const current = sceneRef.current
          if (!current) return
          if (value === 'OFF') onFogOff()
          dispatch({
            commandId: crypto.randomUUID(),
            expectedSceneVersion: current.version,
            mode: value,
            sceneId: current.id,
            type: 'SET_SCENE_FOG_MODE'
          })
        }}
      />
      {scene.fogMode !== 'OFF' ? (
        <Select
          aria-label='Vision reveal timing'
          data={[
            { label: 'Reveal while dragging', value: 'ON_DRAG' },
            { label: 'Reveal on drop', value: 'ON_DROP' }
          ]}
          disabled={disabled}
          size='xs'
          value={scene.visionRevealMode}
          onChange={(value) => {
            if (value !== 'ON_DRAG' && value !== 'ON_DROP') return
            const current = sceneRef.current
            if (!current) return
            dispatch({
              commandId: crypto.randomUUID(),
              expectedSceneVersion: current.version,
              mode: value,
              sceneId: current.id,
              type: 'SET_SCENE_VISION_REVEAL_MODE'
            })
          }}
        />
      ) : null}
    </>
  )
}
