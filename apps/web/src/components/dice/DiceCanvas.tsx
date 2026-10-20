import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { Physics, useRapier, type RapierContext } from '@react-three/rapier'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Group, Mesh, MeshStandardMaterial, Quaternion } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { RollResultDto } from '@artificer-toolkit/schema/api/rolls'
import type { DicePresentationPreferences } from '#app/settings/dicePreferences'
import {
  getScaledColliderVertices,
  getTargetQuaternion,
  getVisualDiceStages,
  isDieNearlyStill,
  type VisualDie
} from './dice3d.utils'
import * as diceStyles from './dice.css'

type VectorTuple = [number, number, number]
type RotationTuple = [number, number, number, number]
type DieAsset = {
  colliderVertices: Float32Array
  material: MeshStandardMaterial
  mesh: Mesh
  scale: number
}
type DieFrame = { position: VectorTuple; rotation: RotationTuple }
type DiePlayback = {
  asset: DieAsset
  correction: Quaternion
  die: VisualDie
  frames: DieFrame[]
}

function getLaunch(dieId: string, index: number, width: number, height: number) {
  let seed = 2_166_136_261
  for (let cursor = 0; cursor < dieId.length; cursor += 1) {
    seed = Math.imul(seed ^ dieId.charCodeAt(cursor), 16_777_619)
  }
  const sample = (shift: number) => ((seed >>> shift) & 255) / 255
  const column = index % 4
  const row = Math.floor(index / 4)

  return {
    angularVelocity: [4.5 + sample(0) * 3, 6 + sample(8) * 3, 5 + sample(16) * 3] as VectorTuple,
    position: [
      -Math.max(width / 2 - 2, 4) + column * 2.4,
      Math.max(height / 2 - 2, 4) - row * 2.4,
      3 + sample(24) * 0.8
    ] as VectorTuple,
    velocity: [8.5 + sample(16) * 3, -2.5 - sample(8) * 2, 3.5 + sample(0) * 1.5] as VectorTuple
  }
}

function buildPlayback(
  rapier: RapierContext['rapier'],
  dice: VisualDie[],
  assets: Map<VisualDie['die'], DieAsset>,
  width: number,
  height: number
) {
  const halfWidth = width / 2
  const halfHeight = height / 2
  const world = new rapier.World({ x: 0, y: 0, z: -18 })
  world.timestep = 1 / 60

  try {
    const table = world.createRigidBody(rapier.RigidBodyDesc.fixed())
    const addTableCollider = (size: VectorTuple, position: VectorTuple) => {
      const collider = rapier.ColliderDesc.cuboid(...size)
        .setTranslation(...position)
        .setRestitution(0.2)
      world.createCollider(collider, table)
    }
    addTableCollider([halfWidth, halfHeight, 0.25], [0, 0, -1.35])
    addTableCollider([0.25, halfHeight, 4], [-halfWidth, 0, 2])
    addTableCollider([0.25, halfHeight, 4], [halfWidth, 0, 2])
    addTableCollider([halfWidth, 0.25, 4], [0, -halfHeight, 2])
    addTableCollider([halfWidth, 0.25, 4], [0, halfHeight, 2])

    const prepared = dice.map((die, index) => {
      const asset = assets.get(die.die)
      if (!asset) throw new Error(`The d${die.die} model is unavailable.`)
      const launch = getLaunch(die.id, index, width, height)
      const body = world.createRigidBody(
        rapier.RigidBodyDesc.dynamic()
          .setTranslation(...launch.position)
          .setLinvel(...launch.velocity)
          .setAngvel({
            x: launch.angularVelocity[0],
            y: launch.angularVelocity[1],
            z: launch.angularVelocity[2]
          })
          .setLinearDamping(0.22)
          .setAngularDamping(0.28)
          .setCanSleep(false)
      )
      const collider = rapier.ColliderDesc.convexHull(asset.colliderVertices)
      if (!collider) throw new Error(`The d${die.die} model cannot form a convex collider.`)
      collider.setFriction(0.72).setRestitution(0.42)
      world.createCollider(collider, body)
      return { asset, body, die, frames: [] as DieFrame[] }
    })
    const stableFrames = prepared.map(() => 0)

    for (let step = 0; step < 420; step += 1) {
      if (step === 240) {
        prepared.forEach(({ body }) => {
          body.setLinearDamping(2.5)
          body.setAngularDamping(2.5)
        })
      }
      world.step()
      prepared.forEach(({ body, frames }, index) => {
        const position = body.translation()
        const rotation = body.rotation()
        frames.push({
          position: [position.x, position.y, position.z],
          rotation: [rotation.x, rotation.y, rotation.z, rotation.w]
        })
        stableFrames[index] = isDieNearlyStill(body.linvel(), body.angvel())
          ? stableFrames[index] + 1
          : 0
      })
      if (step >= 60 && stableFrames.every((count) => count >= 12)) break
    }

    return prepared.map(({ asset, die, frames }) => {
      const finalRotation = frames.at(-1)?.rotation
      if (!finalRotation) throw new Error(`The d${die.die} simulation did not produce a frame.`)
      const correction = new Quaternion(...finalRotation)
        .invert()
        .multiply(getTargetQuaternion(die.die, die.faceValue))
      return { asset, correction, die, frames } satisfies DiePlayback
    })
  } finally {
    world.free()
  }
}

function PlaybackDie({
  playback,
  onSettled
}: {
  playback: DiePlayback
  onSettled: (id: string) => void
}) {
  const groupRef = useRef<Group>(null)
  const startedAtRef = useRef<number | null>(null)
  const settledRef = useRef(false)
  const firstFrame = playback.frames[0]
  const initialRotation = useMemo(() => new Quaternion(...firstFrame.rotation), [firstFrame])
  const material = useMemo(() => {
    const clonedMaterial = playback.asset.material.clone()
    clonedMaterial.opacity = playback.die.kept ? 1 : 0.38
    clonedMaterial.transparent = !playback.die.kept
    return clonedMaterial
  }, [playback.asset.material, playback.die.kept])

  useEffect(() => () => material.dispose(), [material])

  useFrame(({ clock, invalidate }) => {
    const group = groupRef.current
    if (!group || settledRef.current) return
    startedAtRef.current ??= clock.elapsedTime
    const elapsed = clock.elapsedTime - startedAtRef.current
    const frameIndex = Math.min(Math.floor(elapsed * 60), playback.frames.length - 1)
    const frame = playback.frames[frameIndex]
    group.position.set(...frame.position)
    group.quaternion.set(...frame.rotation)

    if (frameIndex < playback.frames.length - 1) invalidate()
    else {
      settledRef.current = true
      onSettled(playback.die.id)
    }
  })

  return (
    <group position={firstFrame.position} quaternion={initialRotation} ref={groupRef}>
      <group quaternion={playback.correction}>
        <mesh
          castShadow
          geometry={playback.asset.mesh.geometry}
          material={material}
          receiveShadow
          scale={playback.asset.scale}
        />
      </group>
    </group>
  )
}

function DicePlayback({
  assets,
  dice,
  onDieSettled
}: {
  assets: Map<VisualDie['die'], DieAsset>
  dice: VisualDie[]
  onDieSettled: (id: string) => void
}) {
  const { rapier } = useRapier()
  const viewport = useThree((state) => state.viewport)
  const playback = useMemo(
    () => buildPlayback(rapier, dice, assets, viewport.width, viewport.height),
    [assets, dice, rapier, viewport.height, viewport.width]
  )

  return playback.map((die) => (
    <PlaybackDie key={die.die.id} onSettled={onDieSettled} playback={die} />
  ))
}

function DiceTable({
  dice,
  onDieSettled,
  onReady,
  rollId,
  shadowMapSize
}: {
  dice: VisualDie[]
  onDieSettled: (id: string) => void
  onReady: (rollId: string) => void
  rollId?: string
  shadowMapSize: number
}) {
  const diceTypes = useMemo(() => [...new Set(dice.map((die) => die.die))], [dice])
  const models = useLoader(
    GLTFLoader,
    diceTypes.map((die) => `/models/d${die}.glb`)
  )
  const assets = useMemo(
    () =>
      new Map(
        diceTypes.map((die, index) => {
          const mesh = models[index].scene.getObjectByName(`d${die}`)
          if (!(mesh instanceof Mesh)) throw new Error(`The d${die} model is missing its mesh.`)
          if (!(mesh.material instanceof MeshStandardMaterial)) {
            throw new Error(`The d${die} model is missing its standard material.`)
          }
          mesh.geometry.computeBoundingSphere()
          const scale = 1.1 / (mesh.geometry.boundingSphere?.radius || 1)
          return [
            die,
            {
              colliderVertices: getScaledColliderVertices(mesh.geometry.attributes.position, scale),
              material: mesh.material,
              mesh,
              scale
            }
          ] as const
        })
      ),
    [diceTypes, models]
  )

  useEffect(() => {
    if (rollId) onReady(rollId)
  }, [onReady, rollId])

  return (
    <>
      <ambientLight intensity={1.15} />
      <directionalLight
        castShadow
        intensity={3.2}
        position={[-10, -8, 18]}
        shadow-mapSize-height={shadowMapSize}
        shadow-mapSize-width={shadowMapSize}
      />
      <directionalLight intensity={1.1} position={[12, 7, 10]} />
      <Physics colliders={false} gravity={[0, 0, -18]} paused updateLoop='independent'>
        <DicePlayback assets={assets} dice={dice} onDieSettled={onDieSettled} />
      </Physics>
    </>
  )
}

export default function DiceCanvas({
  onReady,
  onRollSettled,
  preferences,
  roll,
  staticFallback
}: {
  onReady: (rollId: string) => void
  onRollSettled: (rollId: string) => void
  preferences: DicePresentationPreferences
  roll?: RollResultDto
  staticFallback: ReactNode
}) {
  const visualStages = useMemo(() => (roll ? getVisualDiceStages(roll) : [[], []]), [roll])
  const playbackStages = visualStages.slice(0, -1)
  const settledDiceForRoll = visualStages.at(-1) ?? []
  const [stageIndex, setStageIndex] = useState(0)
  const playbackDice = playbackStages[Math.min(stageIndex, playbackStages.length - 1)] ?? []
  const settledDice = useRef(new Set<string>())
  const activeRollId = useRef(roll?.id)
  const [settledRollId, setSettledRollId] = useState<string>()
  const dice = settledRollId === roll?.id ? settledDiceForRoll : playbackDice
  const shadowMapSize =
    preferences.shadowQuality === 'HIGH'
      ? 2048
      : preferences.shadowQuality === 'MEDIUM'
        ? 1024
        : 512

  const [seenRollId, setSeenRollId] = useState(roll?.id)
  if (seenRollId !== roll?.id) {
    setSeenRollId(roll?.id)
    setStageIndex(0)
    setSettledRollId(undefined)
  }

  useEffect(() => {
    activeRollId.current = roll?.id
    settledDice.current.clear()
  }, [roll?.id])

  const handleDieSettled = useCallback(
    (id: string) => {
      if (!roll || activeRollId.current !== roll.id) return
      settledDice.current.add(id)
      if (settledDice.current.size === dice.length) {
        const nextStage = playbackStages[stageIndex + 1]
        if (nextStage) {
          const currentIds = new Set(playbackDice.map((die) => die.id))
          settledDice.current = new Set(
            nextStage.filter((die) => currentIds.has(die.id)).map((die) => die.id)
          )
          setStageIndex((current) => current + 1)
          return
        }
        setSettledRollId(roll.id)
        onRollSettled(roll.id)
      }
    },
    [onRollSettled, playbackDice, playbackStages, roll, stageIndex]
  )

  return (
    <div className={diceStyles.diceCanvas}>
      <Canvas
        camera={{ far: 100, near: 0.1, position: [0, 0, 30], zoom: 32 }}
        dpr={preferences.postProcessing ? [1, 1.75] : 1}
        fallback={null}
        flat={!preferences.postProcessing}
        frameloop='demand'
        gl={{
          alpha: true,
          antialias: preferences.postProcessing,
          powerPreference: 'high-performance'
        }}
        orthographic
        shadows='percentage'
        style={{ pointerEvents: 'none' }}
      >
        <DiceTable
          dice={dice}
          onDieSettled={handleDieSettled}
          onReady={onReady}
          rollId={roll?.id}
          shadowMapSize={shadowMapSize}
        />
      </Canvas>
      {roll && settledRollId === roll.id ? staticFallback : null}
    </div>
  )
}
