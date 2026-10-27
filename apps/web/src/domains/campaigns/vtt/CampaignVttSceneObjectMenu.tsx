import { Button, Menu } from '@mantine/core'
import { Check, SlidersHorizontal } from 'lucide-react'
import { Fragment, useState, type RefObject } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignSceneStateDto,
  SceneCommandInputDto
} from '@artificer-toolkit/schema/api/vttScenes'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import {
  canMoveSceneToken,
  nudgeSceneToken,
  type SceneTokenNudgeDirection
} from './CampaignVttStage.model'
import * as styles from './CampaignVttStage.css'
import type { VttSceneRenderer } from './vttSceneRenderer'
import { formatSceneMeasurement } from './vttSceneRenderer.model'

/**
 * The Scene's objects as a keyboard menu: focus, preview, nudge and measure from tokens, remove
 * measurements, work doors and, for the GM, set the selected token's cover and reset or reveal fog.
 */
export function CampaignVttSceneObjectMenu({
  boundTokenControl,
  campaign: { gameSystemId, memberships, role },
  currentUserId,
  onDoorState,
  onFogLayer,
  onMeasurement,
  onInspectToken,
  onMeasurementRemove,
  onPreviewToken,
  onSceneCommand,
  onSelectToken,
  onTokenMove,
  previewTokenId,
  renderer,
  scene,
  selectedTokenId
}: {
  boundTokenControl: ReadonlyMap<string, boolean>
  /** The System's cover tiers the GM picks from; undefined while they load or when it has none. */
  campaign: Pick<CampaignDetailDto, 'gameSystemId' | 'memberships' | 'role'>
  currentUserId: string
  onDoorState: (barrierId: string, state: 'CLOSED' | 'LOCKED' | 'OPEN') => void
  onFogLayer: (ownerUserId: string | null, explored: boolean) => void
  onMeasurement: (path: ScenePoint[]) => void
  onInspectToken: (tokenId: string | null) => void
  onMeasurementRemove: (measurementId: string) => void
  onPreviewToken: (tokenId: string | null) => void
  onSelectToken: (tokenId: string | null) => void
  onSceneCommand: (command: SceneCommandInputDto) => void
  onTokenMove: (tokenId: string, position: ScenePoint) => void
  previewTokenId: string | null
  selectedTokenId: string | null
  renderer: RefObject<VttSceneRenderer | null>
  scene: CampaignSceneStateDto
}) {
  const [measurementOriginId, setMeasurementOriginId] = useState<string | null>(null)
  const [measurementAnnouncement, setMeasurementAnnouncement] = useState('')
  const doors = scene.barriers.filter((barrier) => barrier.kind === 'DOOR')
  const coverTiers = useQuery({
    ...convexQuery(convexApi.content.systems.get, { id: gameSystemId }),
    select: (system) => system?.cover?.tiers
  }).data
  const fogOwners = memberships.filter((membership) => membership.role === 'PLAYER')
  const measurementOrigin = scene.tokens.find((token) => token.id === measurementOriginId)
  const coverToken =
    role === 'OWNER' && coverTiers
      ? scene.tokens.find((token) => token.id === selectedTokenId)
      : undefined

  function moveToken(
    token: (typeof scene.tokens)[number],
    direction: SceneTokenNudgeDirection
  ): void {
    onTokenMove(token.id, nudgeSceneToken(scene, token, direction))
  }

  return (
    <>
      <span aria-atomic='true' aria-live='polite' className={styles.visuallyHidden}>
        {measurementAnnouncement}
      </span>
      <Menu
        classNames={{ dropdown: styles.menuDropdown, label: styles.menuLabel }}
        position='bottom-end'
        shadow='none'
        width={260}
        withInitialFocusPlaceholder={false}
      >
        <Menu.Target>
          <Button
            leftSection={<SlidersHorizontal aria-hidden size={16} />}
            size='xs'
            variant='default'
          >
            Scene controls
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <div aria-label='Scene objects' className={styles.menuScroller} role='group' tabIndex={0}>
            <Menu.Label>Tokens</Menu.Label>
            {scene.tokens.length ? (
              scene.tokens.map((token) => (
                <Fragment key={token.id}>
                  <Menu.Item
                    onBlur={() => onInspectToken(null)}
                    rightSection={
                      selectedTokenId === token.id ? <Check aria-hidden size={14} /> : null
                    }
                    onClick={() => {
                      onSelectToken(token.id)
                      renderer.current?.focusToken(token)
                    }}
                    onFocus={() => onInspectToken(token.id)}
                    onMouseEnter={() => onInspectToken(token.id)}
                    onMouseLeave={() => onInspectToken(null)}
                  >
                    Focus {token.label}
                  </Menu.Item>
                  {role === 'OWNER' ? (
                    <Menu.Item
                      closeMenuOnClick={false}
                      rightSection={
                        previewTokenId === token.id ? <Check aria-hidden size={14} /> : null
                      }
                      onClick={() => onPreviewToken(previewTokenId === token.id ? null : token.id)}
                    >
                      {previewTokenId === token.id ? 'Stop previewing' : 'Preview view'}{' '}
                      {token.label}
                    </Menu.Item>
                  ) : null}
                  {canMoveSceneToken(token, { boundTokenControl, currentUserId, role })
                    ? (
                        [
                          ['UP', 'up'],
                          ['DOWN', 'down'],
                          ['LEFT', 'left'],
                          ['RIGHT', 'right']
                        ] as const
                      ).map(([direction, label]) => (
                        <Menu.Item key={direction} onClick={() => moveToken(token, direction)}>
                          Move {token.label} {label}
                        </Menu.Item>
                      ))
                    : null}
                  {scene.tokens.length > 1 ? (
                    <Menu.Item onClick={() => setMeasurementOriginId(token.id)}>
                      Measure from {token.label}
                    </Menu.Item>
                  ) : null}
                </Fragment>
              ))
            ) : (
              <Menu.Item disabled>No visible tokens</Menu.Item>
            )}
            {measurementOrigin ? (
              <>
                <Menu.Divider />
                <Menu.Label>Measure from {measurementOrigin.label}</Menu.Label>
                {scene.tokens
                  .filter((token) => token.id !== measurementOrigin.id)
                  .map((token) => (
                    <Menu.Item
                      key={token.id}
                      onClick={() => {
                        const distance = formatSceneMeasurement(scene.grid, [
                          measurementOrigin.position,
                          token.position
                        ])
                        onMeasurement([measurementOrigin.position, token.position])
                        setMeasurementAnnouncement(
                          `Measured from ${measurementOrigin.label} to ${token.label}: ${distance}.`
                        )
                        setMeasurementOriginId(null)
                      }}
                    >
                      To {token.label} ·{' '}
                      {formatSceneMeasurement(scene.grid, [
                        measurementOrigin.position,
                        token.position
                      ])}
                    </Menu.Item>
                  ))}
                <Menu.Item color='dimmed' onClick={() => setMeasurementOriginId(null)}>
                  Cancel measurement
                </Menu.Item>
              </>
            ) : null}
            {coverToken ? (
              <>
                <Menu.Divider />
                <Menu.Label>Cover for {coverToken.label}</Menu.Label>
                {[
                  { label: 'Automatic', override: undefined },
                  { label: 'No cover', override: { tierCode: null } },
                  ...(coverTiers ?? []).map(({ code, label }) => ({
                    label,
                    override: { tierCode: code }
                  }))
                ].map(({ label, override }) => {
                  const current = coverToken.coverTierOverride
                  const chosen = override
                    ? current?.tierCode === override.tierCode
                    : current === undefined
                  return (
                    <Menu.Item
                      key={override ? `tier:${override.tierCode}` : 'automatic'}
                      rightSection={chosen ? <Check aria-hidden size={14} /> : null}
                      onClick={() => {
                        if (chosen) return
                        const { coverTierOverride: _prior, ...token } = coverToken
                        onSceneCommand({
                          commandId: crypto.randomUUID(),
                          expectedSceneVersion: scene.version,
                          sceneId: scene.id,
                          token: override ? { ...token, coverTierOverride: override } : token,
                          type: 'UPSERT_SCENE_TOKEN'
                        })
                      }}
                    >
                      {label}
                    </Menu.Item>
                  )
                })}
              </>
            ) : null}
            <Menu.Divider />
            <Menu.Label>Measurements</Menu.Label>
            {scene.measurements.length ? (
              scene.measurements.map((measurement, index) => {
                const label = measurement.label ?? `Measurement ${index + 1}`
                const removable = role === 'OWNER' || measurement.createdByUserId === currentUserId
                return (
                  <Menu.Item
                    disabled={!removable}
                    key={measurement.id}
                    onClick={() => onMeasurementRemove(measurement.id)}
                  >
                    {removable ? `Remove ${label}` : label} ·{' '}
                    {formatSceneMeasurement(scene.grid, measurement.path)}
                  </Menu.Item>
                )
              })
            ) : (
              <Menu.Item disabled>No measurements</Menu.Item>
            )}
            <Menu.Divider />
            <Menu.Label>Doors</Menu.Label>
            {doors.length ? (
              doors.map((door, index) => {
                const state = scene.doorStates[door.id] ?? door.initialState
                return (
                  <Fragment key={door.id}>
                    <Menu.Item
                      disabled={state === 'LOCKED' && role === 'PLAYER'}
                      onClick={() =>
                        onDoorState(
                          door.id,
                          state === 'OPEN' ? 'CLOSED' : state === 'LOCKED' ? 'CLOSED' : 'OPEN'
                        )
                      }
                    >
                      Door {index + 1}:{' '}
                      {state === 'OPEN'
                        ? 'Close'
                        : state === 'LOCKED'
                          ? role === 'OWNER'
                            ? 'Unlock'
                            : 'Locked'
                          : 'Open'}
                    </Menu.Item>
                    {role === 'OWNER' && state !== 'LOCKED' ? (
                      <Menu.Item onClick={() => onDoorState(door.id, 'LOCKED')}>
                        Door {index + 1}: Lock
                      </Menu.Item>
                    ) : null}
                  </Fragment>
                )
              })
            ) : (
              <Menu.Item disabled>No doors</Menu.Item>
            )}
            {role === 'OWNER' && scene.fogMode !== 'OFF' ? (
              <>
                <Menu.Divider />
                <Menu.Label>Fog</Menu.Label>
                {scene.fogMode === 'SHARED_PARTY' ? (
                  <>
                    <Menu.Item onClick={() => onFogLayer(null, true)}>Reveal entire map</Menu.Item>
                    <Menu.Item onClick={() => onFogLayer(null, false)}>
                      Reset all exploration
                    </Menu.Item>
                  </>
                ) : fogOwners.length ? (
                  fogOwners.map((membership) => (
                    <Menu.Sub key={membership.userId} position='left-start'>
                      <Menu.Sub.Target>
                        <Menu.Sub.Item>Fog for @{membership.username}</Menu.Sub.Item>
                      </Menu.Sub.Target>
                      <Menu.Sub.Dropdown>
                        <Menu.Item onClick={() => onFogLayer(membership.userId, true)}>
                          Reveal entire map
                        </Menu.Item>
                        <Menu.Item onClick={() => onFogLayer(membership.userId, false)}>
                          Reset exploration
                        </Menu.Item>
                      </Menu.Sub.Dropdown>
                    </Menu.Sub>
                  ))
                ) : (
                  <Menu.Item disabled>No active players</Menu.Item>
                )}
              </>
            ) : null}
          </div>
        </Menu.Dropdown>
      </Menu>
    </>
  )
}
