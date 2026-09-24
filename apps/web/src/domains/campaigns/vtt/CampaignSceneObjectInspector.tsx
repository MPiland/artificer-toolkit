import {
  Button,
  ColorInput,
  Divider,
  Fieldset,
  Group,
  MultiSelect,
  NumberInput,
  SegmentedControl,
  Select,
  Switch,
  Text,
  TextInput
} from '@mantine/core'
import { Crosshair, Trash2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import type { SceneDefinitionDto } from '@artificer-toolkit/schema/api/vttScenes'
import type { ScenePoint, SceneTokenVision } from '@artificer-toolkit/shared/vtt'
import { convertSceneLightKind, sceneBarrierLabel } from './CampaignSceneObjectInspector.model'
import * as styles from './CampaignScenePreparation.css'

const defaultVision: SceneTokenVision = {
  angleDegrees: 360,
  brightRange: 60,
  dimRange: 120,
  directionDegrees: 0,
  enabled: true
}

export function CampaignSceneObjectInspector({
  disabled,
  memberships,
  section,
  allowRemove = true,
  editDoorInitialState = true,
  showObjectPicker = true,
  showSummary = true,
  creationSlot,
  onChange,
  onFocus,
  scene
}: {
  disabled: boolean
  memberships: CampaignDetailDto['memberships']
  section?: 'ANNOTATION' | 'BARRIER' | 'DARKNESS' | 'FOG' | 'LIGHT' | 'TOKEN'
  allowRemove?: boolean
  editDoorInitialState?: boolean
  showObjectPicker?: boolean
  showSummary?: boolean
  creationSlot?: ReactNode
  onChange: (scene: SceneDefinitionDto) => void
  onFocus: (point: ScenePoint) => void
  scene: SceneDefinitionDto
}) {
  const isSectionVisible = (
    value: 'ANNOTATION' | 'BARRIER' | 'DARKNESS' | 'FOG' | 'LIGHT' | 'TOKEN'
  ) => !section || section === value
  const [barrierId, setBarrierId] = useSelection(scene.barriers.map((barrier) => barrier.id))
  const [lightId, setLightId] = useSelection(scene.lights.map((light) => light.id))
  const [darknessId, setDarknessId] = useSelection(scene.darknessZones.map((zone) => zone.id))
  const [tokenId, setTokenId] = useSelection(scene.tokens.map((token) => token.id))
  const [annotationId, setAnnotationId] = useSelection(scene.annotations.map((note) => note.id))
  const barrier = scene.barriers.find((candidate) => candidate.id === barrierId) ?? null
  const light = scene.lights.find((candidate) => candidate.id === lightId) ?? null
  const darkness = scene.darknessZones.find((candidate) => candidate.id === darknessId) ?? null
  const token = scene.tokens.find((candidate) => candidate.id === tokenId) ?? null
  const annotation = scene.annotations.find((candidate) => candidate.id === annotationId) ?? null
  const playerOptions = memberships
    .filter((membership) => membership.role === 'PLAYER')
    .map((membership) => ({
      label: membership.assignedCharacter
        ? `${membership.username} · ${membership.assignedCharacter.label}`
        : membership.username,
      value: membership.userId
    }))

  return (
    <div aria-label='Scene object properties' className={styles.inspector} role='group'>
      {showSummary ? (
        <div>
          <Text fw={650}>Scene objects</Text>
          <Text c='dimmed' size='xs'>
            {scene.tokens.length} tokens · {scene.barriers.length} barriers · {scene.lights.length}{' '}
            lights
          </Text>
        </div>
      ) : null}
      {creationSlot}
      {isSectionVisible('FOG') ? (
        <Fieldset className={styles.objectFields} disabled={disabled} legend='Fog'>
          <SegmentedControl
            aria-label='Fog visibility'
            data={[
              { label: 'Shared party', value: 'SHARED_PARTY' },
              { label: 'Per player', value: 'PER_PLAYER' }
            ]}
            fullWidth
            size='xs'
            value={scene.fogMode}
            onChange={(fogMode) => {
              if (fogMode === 'SHARED_PARTY' || fogMode === 'PER_PLAYER')
                onChange({ ...scene, fogMode })
            }}
          />
          <SegmentedControl
            aria-label='Default vision reveal timing'
            data={[
              { label: 'While dragging', value: 'ON_DRAG' },
              { label: 'On drop', value: 'ON_DROP' }
            ]}
            fullWidth
            size='xs'
            value={scene.visionRevealMode}
            onChange={(visionRevealMode) => {
              if (visionRevealMode === 'ON_DRAG' || visionRevealMode === 'ON_DROP') {
                onChange({ ...scene, visionRevealMode })
              }
            }}
          />
        </Fieldset>
      ) : null}
      {isSectionVisible('BARRIER') ? (
        <>
          {showObjectPicker ? (
            <ObjectPicker
              empty='Draw a barrier to edit its behavior.'
              label='Barrier'
              value={barrierId}
              values={scene.barriers.map((candidate, index) => ({
                label: `${index + 1}. ${sceneBarrierLabel(candidate)}`,
                value: candidate.id
              }))}
              onChange={setBarrierId}
            />
          ) : null}
          {barrier ? (
            <Fieldset className={styles.objectFields} disabled={disabled} legend={barrier.kind}>
              <Group justify='space-between'>
                <Button
                  leftSection={<Crosshair aria-hidden size={15} />}
                  size='xs'
                  variant='subtle'
                  onClick={() => onFocus(barrier.a)}
                >
                  Focus
                </Button>
                {allowRemove ? (
                  <Button
                    color='red'
                    leftSection={<Trash2 aria-hidden size={15} />}
                    size='xs'
                    variant='subtle'
                    onClick={() =>
                      onChange({
                        ...scene,
                        barriers: scene.barriers.filter((item) => item.id !== barrier.id)
                      })
                    }
                  >
                    Remove
                  </Button>
                ) : null}
              </Group>
              <Group grow>
                <NumberInput
                  label='Start X'
                  value={barrier.a.x}
                  onChange={(value) =>
                    updateNumber(value, (x) =>
                      onChange({
                        ...scene,
                        barriers: scene.barriers.map((item) =>
                          item.id === barrier.id ? { ...item, a: { ...item.a, x } } : item
                        )
                      })
                    )
                  }
                />
                <NumberInput
                  label='Start Y'
                  value={barrier.a.y}
                  onChange={(value) =>
                    updateNumber(value, (y) =>
                      onChange({
                        ...scene,
                        barriers: scene.barriers.map((item) =>
                          item.id === barrier.id ? { ...item, a: { ...item.a, y } } : item
                        )
                      })
                    )
                  }
                />
                <NumberInput
                  label='End X'
                  value={barrier.b.x}
                  onChange={(value) =>
                    updateNumber(value, (x) =>
                      onChange({
                        ...scene,
                        barriers: scene.barriers.map((item) =>
                          item.id === barrier.id ? { ...item, b: { ...item.b, x } } : item
                        )
                      })
                    )
                  }
                />
                <NumberInput
                  label='End Y'
                  value={barrier.b.y}
                  onChange={(value) =>
                    updateNumber(value, (y) =>
                      onChange({
                        ...scene,
                        barriers: scene.barriers.map((item) =>
                          item.id === barrier.id ? { ...item, b: { ...item.b, y } } : item
                        )
                      })
                    )
                  }
                />
              </Group>
              {barrier.kind === 'DOOR' ? (
                <>
                  {editDoorInitialState ? (
                    <SegmentedControl
                      aria-label='Door initial state'
                      data={[
                        { label: 'Closed', value: 'CLOSED' },
                        { label: 'Open', value: 'OPEN' },
                        { label: 'Locked', value: 'LOCKED' }
                      ]}
                      fullWidth
                      size='xs'
                      value={barrier.initialState}
                      onChange={(initialState) => {
                        if (
                          initialState !== 'CLOSED' &&
                          initialState !== 'OPEN' &&
                          initialState !== 'LOCKED'
                        )
                          return
                        onChange({
                          ...scene,
                          barriers: scene.barriers.map((item) =>
                            item.id === barrier.id && item.kind === 'DOOR'
                              ? { ...item, initialState }
                              : item
                          )
                        })
                      }}
                    />
                  ) : null}
                  <NumberInput
                    label='Open angle'
                    max={180}
                    min={-180}
                    value={barrier.openAngleDegrees}
                    onChange={(value) =>
                      updateNumber(value, (openAngleDegrees) =>
                        onChange({
                          ...scene,
                          barriers: scene.barriers.map((item) =>
                            item.id === barrier.id && item.kind === 'DOOR'
                              ? { ...item, openAngleDegrees }
                              : item
                          )
                        })
                      )
                    }
                  />
                  <Switch
                    checked={barrier.blocksMovementWhenClosed}
                    label='Blocks movement when closed'
                    onChange={(event) =>
                      onChange({
                        ...scene,
                        barriers: scene.barriers.map((item) =>
                          item.id === barrier.id && item.kind === 'DOOR'
                            ? { ...item, blocksMovementWhenClosed: event.currentTarget.checked }
                            : item
                        )
                      })
                    }
                  />
                  <Switch
                    checked={barrier.blocksLightWhenClosed}
                    label='Blocks sight when closed'
                    onChange={(event) =>
                      onChange({
                        ...scene,
                        barriers: scene.barriers.map((item) =>
                          item.id === barrier.id && item.kind === 'DOOR'
                            ? { ...item, blocksLightWhenClosed: event.currentTarget.checked }
                            : item
                        )
                      })
                    }
                  />
                </>
              ) : null}
              {barrier.kind === 'TERRAIN' ? (
                <NumberInput
                  label='Movement cost multiplier'
                  max={100}
                  min={1}
                  value={barrier.movementCostMultiplier}
                  onChange={(value) =>
                    updateNumber(value, (movementCostMultiplier) =>
                      onChange({
                        ...scene,
                        barriers: scene.barriers.map((item) =>
                          item.id === barrier.id && item.kind === 'TERRAIN'
                            ? { ...item, movementCostMultiplier }
                            : item
                        )
                      })
                    )
                  }
                />
              ) : null}
              {barrier.kind === 'ONE_WAY' ? (
                <Select
                  label='Blocked direction'
                  data={[
                    { label: 'Left to right', value: 'LEFT_TO_RIGHT' },
                    { label: 'Right to left', value: 'RIGHT_TO_LEFT' }
                  ]}
                  value={barrier.blockedDirection}
                  onChange={(blockedDirection) => {
                    if (
                      blockedDirection === 'LEFT_TO_RIGHT' ||
                      blockedDirection === 'RIGHT_TO_LEFT'
                    )
                      onChange({
                        ...scene,
                        barriers: scene.barriers.map((item) =>
                          item.id === barrier.id && item.kind === 'ONE_WAY'
                            ? { ...item, blockedDirection }
                            : item
                        )
                      })
                  }}
                />
              ) : null}
              {barrier.kind === 'WALL' ||
              barrier.kind === 'WINDOW' ||
              barrier.kind === 'ONE_WAY' ? (
                <>
                  <Switch
                    checked={barrier.blocksMovement}
                    label='Blocks movement'
                    onChange={(event) =>
                      onChange({
                        ...scene,
                        barriers: scene.barriers.map((item) =>
                          item.id === barrier.id && item.kind !== 'DOOR' && item.kind !== 'TERRAIN'
                            ? { ...item, blocksMovement: event.currentTarget.checked }
                            : item
                        )
                      })
                    }
                  />
                  <Switch
                    checked={barrier.blocksLight}
                    label='Blocks sight'
                    onChange={(event) =>
                      onChange({
                        ...scene,
                        barriers: scene.barriers.map((item) =>
                          item.id === barrier.id && item.kind !== 'DOOR' && item.kind !== 'TERRAIN'
                            ? { ...item, blocksLight: event.currentTarget.checked }
                            : item
                        )
                      })
                    }
                  />
                </>
              ) : null}
            </Fieldset>
          ) : null}
          <Divider />
        </>
      ) : null}
      {isSectionVisible('LIGHT') ? (
        <>
          {showObjectPicker ? (
            <ObjectPicker
              empty='Place a light to edit it.'
              label='Light'
              value={lightId}
              values={scene.lights.map((candidate, index) => ({
                label: `${index + 1}. ${candidate.kind.toLowerCase()} light`,
                value: candidate.id
              }))}
              onChange={setLightId}
            />
          ) : null}
          {light ? (
            <Fieldset className={styles.objectFields} disabled={disabled} legend='Light'>
              <Group justify='space-between'>
                <Button
                  leftSection={<Crosshair aria-hidden size={15} />}
                  size='xs'
                  variant='subtle'
                  onClick={() => onFocus(light.position)}
                >
                  Focus
                </Button>
                {allowRemove ? (
                  <Button
                    color='red'
                    leftSection={<Trash2 aria-hidden size={15} />}
                    size='xs'
                    variant='subtle'
                    onClick={() =>
                      onChange({
                        ...scene,
                        lights: scene.lights.filter((item) => item.id !== light.id)
                      })
                    }
                  >
                    Remove
                  </Button>
                ) : null}
              </Group>
              <Group grow>
                <NumberInput
                  label='Map X'
                  value={light.position.x}
                  onChange={(value) =>
                    updateNumber(value, (x) =>
                      onChange({
                        ...scene,
                        lights: scene.lights.map((item) =>
                          item.id === light.id
                            ? { ...item, position: { ...item.position, x } }
                            : item
                        )
                      })
                    )
                  }
                />
                <NumberInput
                  label='Map Y'
                  value={light.position.y}
                  onChange={(value) =>
                    updateNumber(value, (y) =>
                      onChange({
                        ...scene,
                        lights: scene.lights.map((item) =>
                          item.id === light.id
                            ? { ...item, position: { ...item.position, y } }
                            : item
                        )
                      })
                    )
                  }
                />
              </Group>
              <SegmentedControl
                aria-label='Light kind'
                data={[
                  { label: 'Point', value: 'POINT' },
                  { label: 'Cone', value: 'CONE' }
                ]}
                fullWidth
                size='xs'
                value={light.kind}
                onChange={(kind) => {
                  if (kind === 'POINT' || kind === 'CONE')
                    onChange({
                      ...scene,
                      lights: scene.lights.map((item) =>
                        item.id === light.id ? convertSceneLightKind(item, kind) : item
                      )
                    })
                }}
              />
              <NumberInput
                label='Bright radius'
                min={0}
                value={light.brightRadius}
                onChange={(value) =>
                  updateNumber(value, (brightRadius) =>
                    onChange({
                      ...scene,
                      lights: scene.lights.map((item) =>
                        item.id === light.id ? { ...item, brightRadius } : item
                      )
                    })
                  )
                }
              />
              <NumberInput
                label='Dim radius'
                min={0}
                value={light.dimRadius}
                onChange={(value) =>
                  updateNumber(value, (dimRadius) =>
                    onChange({
                      ...scene,
                      lights: scene.lights.map((item) =>
                        item.id === light.id ? { ...item, dimRadius } : item
                      )
                    })
                  )
                }
              />
              <NumberInput
                decimalScale={2}
                label='Intensity'
                max={1}
                min={0}
                step={0.1}
                value={light.intensity}
                onChange={(value) =>
                  updateNumber(value, (intensity) =>
                    onChange({
                      ...scene,
                      lights: scene.lights.map((item) =>
                        item.id === light.id ? { ...item, intensity } : item
                      )
                    })
                  )
                }
              />
              <ColorInput
                eyeDropperButtonProps={{ 'aria-label': 'Pick light color from screen' }}
                format='hex'
                label='Color'
                value={light.color}
                onChange={(color) =>
                  onChange({
                    ...scene,
                    lights: scene.lights.map((item) =>
                      item.id === light.id ? { ...item, color } : item
                    )
                  })
                }
              />
              {light.kind === 'CONE' ? (
                <>
                  <NumberInput
                    label='Direction'
                    max={360}
                    min={0}
                    value={light.directionDegrees}
                    onChange={(value) =>
                      updateNumber(value, (directionDegrees) =>
                        onChange({
                          ...scene,
                          lights: scene.lights.map((item) =>
                            item.id === light.id && item.kind === 'CONE'
                              ? { ...item, directionDegrees }
                              : item
                          )
                        })
                      )
                    }
                  />
                  <NumberInput
                    label='Cone angle'
                    max={360}
                    min={1}
                    value={light.angleDegrees}
                    onChange={(value) =>
                      updateNumber(value, (angleDegrees) =>
                        onChange({
                          ...scene,
                          lights: scene.lights.map((item) =>
                            item.id === light.id && item.kind === 'CONE'
                              ? { ...item, angleDegrees }
                              : item
                          )
                        })
                      )
                    }
                  />
                </>
              ) : null}
            </Fieldset>
          ) : null}
          <Divider />
        </>
      ) : null}
      {isSectionVisible('DARKNESS') ? (
        <>
          {showObjectPicker ? (
            <ObjectPicker
              empty='Draw a darkness zone to edit it.'
              label='Darkness zone'
              value={darknessId}
              values={scene.darknessZones.map((candidate, index) => ({
                label: `Zone ${index + 1}`,
                value: candidate.id
              }))}
              onChange={setDarknessId}
            />
          ) : null}
          {darkness ? (
            <Fieldset className={styles.objectFields} disabled={disabled} legend='Darkness zone'>
              <Group justify='space-between'>
                <Button
                  leftSection={<Crosshair aria-hidden size={15} />}
                  size='xs'
                  variant='subtle'
                  onClick={() => onFocus(darkness.polygon.points[0]!)}
                >
                  Focus
                </Button>
                {allowRemove ? (
                  <Button
                    color='red'
                    leftSection={<Trash2 aria-hidden size={15} />}
                    size='xs'
                    variant='subtle'
                    onClick={() =>
                      onChange({
                        ...scene,
                        darknessZones: scene.darknessZones.filter((item) => item.id !== darkness.id)
                      })
                    }
                  >
                    Remove
                  </Button>
                ) : null}
              </Group>
              <Group grow>
                <NumberInput
                  label='Bounds X'
                  value={darkness.polygon.points[0]!.x}
                  onChange={(value) =>
                    updateNumber(value, (x) =>
                      onChange({
                        ...scene,
                        darknessZones: scene.darknessZones.map((item) =>
                          item.id === darkness.id
                            ? {
                                ...item,
                                polygon: {
                                  points: item.polygon.points.map((point) => ({
                                    ...point,
                                    x: point.x === darkness.polygon.points[0]!.x ? x : point.x
                                  }))
                                }
                              }
                            : item
                        )
                      })
                    )
                  }
                />
                <NumberInput
                  label='Bounds Y'
                  value={darkness.polygon.points[0]!.y}
                  onChange={(value) =>
                    updateNumber(value, (y) =>
                      onChange({
                        ...scene,
                        darknessZones: scene.darknessZones.map((item) =>
                          item.id === darkness.id
                            ? {
                                ...item,
                                polygon: {
                                  points: item.polygon.points.map((point) => ({
                                    ...point,
                                    y: point.y === darkness.polygon.points[0]!.y ? y : point.y
                                  }))
                                }
                              }
                            : item
                        )
                      })
                    )
                  }
                />
              </Group>
              <NumberInput
                decimalScale={2}
                label='Opacity'
                max={1}
                min={0}
                step={0.1}
                value={darkness.opacity}
                onChange={(value) =>
                  updateNumber(value, (opacity) =>
                    onChange({
                      ...scene,
                      darknessZones: scene.darknessZones.map((item) =>
                        item.id === darkness.id ? { ...item, opacity } : item
                      )
                    })
                  )
                }
              />
            </Fieldset>
          ) : null}
          <Divider />
        </>
      ) : null}
      {isSectionVisible('TOKEN') ? (
        <>
          {showObjectPicker ? (
            <ObjectPicker
              empty='Place a token to edit it.'
              label='Token'
              value={tokenId}
              values={scene.tokens.map((candidate) => ({
                label: candidate.label,
                value: candidate.id
              }))}
              onChange={setTokenId}
            />
          ) : null}
          {token ? (
            <Fieldset className={styles.objectFields} disabled={disabled} legend='Token'>
              <Group justify='space-between'>
                <Button
                  leftSection={<Crosshair aria-hidden size={15} />}
                  size='xs'
                  variant='subtle'
                  onClick={() => onFocus(token.position)}
                >
                  Focus
                </Button>
                {allowRemove ? (
                  <Button
                    color='red'
                    leftSection={<Trash2 aria-hidden size={15} />}
                    size='xs'
                    variant='subtle'
                    onClick={() =>
                      onChange({
                        ...scene,
                        tokens: scene.tokens.filter((item) => item.id !== token.id)
                      })
                    }
                  >
                    Remove
                  </Button>
                ) : null}
              </Group>
              <Group grow>
                <NumberInput
                  label='Map X'
                  max={scene.map.width}
                  min={0}
                  value={token.position.x}
                  onChange={(value) =>
                    updateNumber(value, (x) =>
                      onChange({
                        ...scene,
                        tokens: scene.tokens.map((item) =>
                          item.id === token.id
                            ? { ...item, position: { ...item.position, x } }
                            : item
                        )
                      })
                    )
                  }
                />
                <NumberInput
                  label='Map Y'
                  max={scene.map.height}
                  min={0}
                  value={token.position.y}
                  onChange={(value) =>
                    updateNumber(value, (y) =>
                      onChange({
                        ...scene,
                        tokens: scene.tokens.map((item) =>
                          item.id === token.id
                            ? { ...item, position: { ...item.position, y } }
                            : item
                        )
                      })
                    )
                  }
                />
              </Group>
              <TextInput
                label='Label'
                maxLength={160}
                value={token.label}
                onChange={(event) => {
                  const label = event.currentTarget.value
                  if (label.trim())
                    onChange({
                      ...scene,
                      tokens: scene.tokens.map((item) =>
                        item.id === token.id ? { ...item, label } : item
                      )
                    })
                }}
              />
              <Group grow>
                <NumberInput
                  label='Width'
                  min={1}
                  value={token.width}
                  onChange={(value) =>
                    updateNumber(value, (width) =>
                      onChange({
                        ...scene,
                        tokens: scene.tokens.map((item) =>
                          item.id === token.id ? { ...item, width } : item
                        )
                      })
                    )
                  }
                />
                <NumberInput
                  label='Height'
                  min={1}
                  value={token.height}
                  onChange={(value) =>
                    updateNumber(value, (height) =>
                      onChange({
                        ...scene,
                        tokens: scene.tokens.map((item) =>
                          item.id === token.id ? { ...item, height } : item
                        )
                      })
                    )
                  }
                />
              </Group>
              <NumberInput
                label='Rotation'
                max={360}
                min={0}
                value={token.rotationDegrees}
                onChange={(value) =>
                  updateNumber(value, (rotationDegrees) =>
                    onChange({
                      ...scene,
                      tokens: scene.tokens.map((item) =>
                        item.id === token.id ? { ...item, rotationDegrees } : item
                      )
                    })
                  )
                }
              />
              <Switch
                checked={token.hidden}
                label='Hidden from players'
                onChange={(event) =>
                  onChange({
                    ...scene,
                    tokens: scene.tokens.map((item) =>
                      item.id === token.id ? { ...item, hidden: event.currentTarget.checked } : item
                    )
                  })
                }
              />
              <Switch
                checked={token.locked}
                label='Lock token movement'
                onChange={(event) =>
                  onChange({
                    ...scene,
                    tokens: scene.tokens.map((item) =>
                      item.id === token.id ? { ...item, locked: event.currentTarget.checked } : item
                    )
                  })
                }
              />
              <MultiSelect
                data={playerOptions}
                label='Controlled by players'
                value={token.controlledByUserIds}
                onChange={(controlledByUserIds) =>
                  onChange({
                    ...scene,
                    tokens: scene.tokens.map((item) =>
                      item.id === token.id ? { ...item, controlledByUserIds } : item
                    )
                  })
                }
              />
              <Switch
                checked={Boolean(token.vision?.enabled)}
                label='Token vision'
                onChange={(event) =>
                  onChange({
                    ...scene,
                    tokens: scene.tokens.map((item) =>
                      item.id === token.id
                        ? {
                            ...item,
                            vision: event.currentTarget.checked
                              ? (token.vision ?? defaultVision)
                              : null
                          }
                        : item
                    )
                  })
                }
              />
              {token.vision?.enabled ? (
                <>
                  <NumberInput
                    label='Bright vision'
                    min={0}
                    value={token.vision.brightRange}
                    onChange={(value) =>
                      updateNumber(value, (brightRange) =>
                        onChange({
                          ...scene,
                          tokens: scene.tokens.map((item) =>
                            item.id === token.id && item.vision
                              ? { ...item, vision: { ...item.vision, brightRange } }
                              : item
                          )
                        })
                      )
                    }
                  />
                  <NumberInput
                    label='Dim vision'
                    min={0}
                    value={token.vision.dimRange}
                    onChange={(value) =>
                      updateNumber(value, (dimRange) =>
                        onChange({
                          ...scene,
                          tokens: scene.tokens.map((item) =>
                            item.id === token.id && item.vision
                              ? { ...item, vision: { ...item.vision, dimRange } }
                              : item
                          )
                        })
                      )
                    }
                  />
                  <NumberInput
                    label='Vision direction'
                    max={360}
                    min={0}
                    value={token.vision.directionDegrees}
                    onChange={(value) =>
                      updateNumber(value, (directionDegrees) =>
                        onChange({
                          ...scene,
                          tokens: scene.tokens.map((item) =>
                            item.id === token.id && item.vision
                              ? { ...item, vision: { ...item.vision, directionDegrees } }
                              : item
                          )
                        })
                      )
                    }
                  />
                  <NumberInput
                    label='Vision angle'
                    max={360}
                    min={1}
                    value={token.vision.angleDegrees}
                    onChange={(value) =>
                      updateNumber(value, (angleDegrees) =>
                        onChange({
                          ...scene,
                          tokens: scene.tokens.map((item) =>
                            item.id === token.id && item.vision
                              ? { ...item, vision: { ...item.vision, angleDegrees } }
                              : item
                          )
                        })
                      )
                    }
                  />
                </>
              ) : null}
            </Fieldset>
          ) : null}
          <Divider />
        </>
      ) : null}
      {isSectionVisible('ANNOTATION') ? (
        <>
          {showObjectPicker ? (
            <ObjectPicker
              empty='Place a GM note to edit it.'
              label='Note'
              value={annotationId}
              values={scene.annotations.map((candidate, index) => ({
                label: `${index + 1}. ${candidate.text}`,
                value: candidate.id
              }))}
              onChange={setAnnotationId}
            />
          ) : null}
          {annotation ? (
            <Fieldset className={styles.objectFields} disabled={disabled} legend='Note'>
              <Group justify='space-between'>
                <Button
                  leftSection={<Crosshair aria-hidden size={15} />}
                  size='xs'
                  variant='subtle'
                  onClick={() => onFocus(annotation.position)}
                >
                  Focus
                </Button>
                {allowRemove ? (
                  <Button
                    color='red'
                    leftSection={<Trash2 aria-hidden size={15} />}
                    size='xs'
                    variant='subtle'
                    onClick={() =>
                      onChange({
                        ...scene,
                        annotations: scene.annotations.filter((item) => item.id !== annotation.id)
                      })
                    }
                  >
                    Remove
                  </Button>
                ) : null}
              </Group>
              <Group grow>
                <NumberInput
                  label='Map X'
                  max={scene.map.width}
                  min={0}
                  value={annotation.position.x}
                  onChange={(value) =>
                    updateNumber(value, (x) =>
                      onChange({
                        ...scene,
                        annotations: scene.annotations.map((item) =>
                          item.id === annotation.id
                            ? { ...item, position: { ...item.position, x } }
                            : item
                        )
                      })
                    )
                  }
                />
                <NumberInput
                  label='Map Y'
                  max={scene.map.height}
                  min={0}
                  value={annotation.position.y}
                  onChange={(value) =>
                    updateNumber(value, (y) =>
                      onChange({
                        ...scene,
                        annotations: scene.annotations.map((item) =>
                          item.id === annotation.id
                            ? { ...item, position: { ...item.position, y } }
                            : item
                        )
                      })
                    )
                  }
                />
              </Group>
              <TextInput
                label='Text'
                maxLength={2000}
                value={annotation.text}
                onChange={(event) => {
                  const text = event.currentTarget.value
                  if (text.trim())
                    onChange({
                      ...scene,
                      annotations: scene.annotations.map((item) =>
                        item.id === annotation.id ? { ...item, text } : item
                      )
                    })
                }}
              />
              <SegmentedControl
                aria-label='Note visibility'
                data={[
                  { label: 'GM only', value: 'GM_ONLY' },
                  { label: 'Table', value: 'TABLE' }
                ]}
                fullWidth
                size='xs'
                value={annotation.visibility}
                onChange={(visibility) => {
                  if (visibility === 'GM_ONLY' || visibility === 'TABLE')
                    onChange({
                      ...scene,
                      annotations: scene.annotations.map((item) =>
                        item.id === annotation.id ? { ...item, visibility } : item
                      )
                    })
                }}
              />
            </Fieldset>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function ObjectPicker({
  empty,
  label,
  onChange,
  value,
  values
}: {
  empty: string
  label: string
  onChange: (value: string | null) => void
  value: string | null
  values: { label: string; value: string }[]
}) {
  return values.length ? (
    <Select data={values} label={label} value={value} onChange={onChange} />
  ) : (
    <Text c='dimmed' size='sm'>
      {empty}
    </Text>
  )
}

function useSelection(ids: string[]): [string | null, (value: string | null) => void] {
  const [value, setValue] = useState<string | null>(ids[0] ?? null)
  useEffect(() => {
    if (value && ids.includes(value)) return
    setValue(ids[0] ?? null)
  }, [ids, value])
  return [value, setValue]
}

function updateNumber(value: number | string, update: (value: number) => void): void {
  if (typeof value === 'number' && Number.isFinite(value)) update(value)
}
