import { Button, Fieldset, NumberInput, Select } from '@mantine/core'
import { useEffect, useState } from 'react'
import type { SceneDefinitionDto } from '@artificer-toolkit/schema/api/vttScenes'
import {
  createSceneObject,
  sceneCreationDefaults,
  type SceneCreationKind
} from './SceneObjectCreator.model'
import * as styles from './CampaignScenePreparation.css'

const options = [
  'WALL',
  'DOOR',
  'WINDOW',
  'ONE_WAY',
  'TERRAIN',
  'LIGHT',
  'DARKNESS',
  'TOKEN',
  'ANNOTATION'
] as const

export function SceneObjectCreator({
  disabled,
  scene,
  onCreate
}: {
  disabled: boolean
  scene: SceneDefinitionDto
  onCreate: (next: SceneDefinitionDto) => void
}) {
  const defaults = sceneCreationDefaults(scene)
  const [kind, setKind] = useState<SceneCreationKind>('WALL')
  const [x, setX] = useState(defaults.x)
  const [y, setY] = useState(defaults.y)
  const [length, setLength] = useState(defaults.length)
  useEffect(() => {
    const next = sceneCreationDefaults(scene)
    setX(next.x)
    setY(next.y)
    setLength(next.length)
  }, [scene.grid, scene.map.height, scene.map.width])
  return (
    <Fieldset className={styles.objectFields} disabled={disabled} legend='Create scene object'>
      <Select
        data={options.map((value) => ({ label: value.replace('_', ' ').toLowerCase(), value }))}
        label='Object type'
        value={kind}
        onChange={(value) => {
          const selected = options.find((candidate) => candidate === value)
          if (selected) setKind(selected)
        }}
      />
      <NumberInput
        label='Map X'
        max={scene.map.width}
        min={0}
        value={x}
        onChange={(value) => setX(numberValue(value, x))}
      />
      <NumberInput
        label='Map Y'
        max={scene.map.height}
        min={0}
        value={y}
        onChange={(value) => setY(numberValue(value, y))}
      />
      {kind === 'DARKNESS' ||
      kind === 'WALL' ||
      kind === 'DOOR' ||
      kind === 'WINDOW' ||
      kind === 'ONE_WAY' ||
      kind === 'TERRAIN' ? (
        <NumberInput
          label={kind === 'DARKNESS' ? 'Size' : 'Length'}
          min={1}
          value={length}
          onChange={(value) => setLength(Math.max(1, numberValue(value, length)))}
        />
      ) : null}
      <Button onClick={() => onCreate(createSceneObject(scene, kind, { x, y }, length))}>
        Create {kind.replace('_', ' ').toLowerCase()}
      </Button>
    </Fieldset>
  )
}

function numberValue(value: number | string, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
