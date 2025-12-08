import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { type RapierRigidBody, RigidBody } from '@react-three/rapier'
import { useEffect, useMemo, useRef, useState, use } from 'react'
import { Mesh, type MeshStandardMaterial } from 'three'
import { DiceContext } from './DiceContext'
import type { DieType, DiceProps } from './Dice.types'
import {
  applyRotationMatrix,
  dot,
  quaternionToMatrix,
  calculateTopVertex,
  mapVertexToNumber,
  diceNormalsMap,
} from './Dice.utils'

const Dice = ({
  position = [0, 0, 0],
  linearVelocity = [0, 0, 0],
  rotation = [0, 0, 0],
  gravityScale = 0,
  friction = 0,
  die,
  restitution = 0,
  id,
  ...props
}: DiceProps) => {
  const useDiceModel = (die: DieType) => {
    const path = `/models/d${die}.glb`
    return useGLTF(path)
  }

  const { nodes } = useDiceModel(die)
  const rigidBodyRef = useRef<RapierRigidBody>(null)
  const [diceValue, setDiceValue] = useState<number | null>(null)
  const { updateDiceResult, dice } = use(DiceContext)

  useEffect(() => {
    if (diceValue != null && !dice.results?.some((result) => result.id === id) && die) {
      updateDiceResult(die, diceValue, id)
    }
  }, [diceValue, id, die, updateDiceResult, dice])

  const faceNormals = useMemo(() => diceNormalsMap[die], [die])

  useFrame(() => {
    const body = rigidBodyRef.current
    if (body) {
      const isMoving = body.isMoving()

      if (!isMoving && diceValue == null) {
        const position = body.translation()
        const rotation = body.rotation()

        let calculatedValue: number | undefined = undefined
        if (die !== 4) {
          // Dice is at rest, calculate top face
          const up = [0, 0, 1]
          const rotationMatrix = quaternionToMatrix(rotation)
          let maxDot = -Infinity

          for (const { normal, value } of faceNormals) {
            // Transform normal by dice's rotation
            const transformedNormal = applyRotationMatrix(normal, rotationMatrix)
            const dotProduct = dot(up, transformedNormal)

            if (dotProduct > maxDot) {
              maxDot = dotProduct
              calculatedValue = value
            }
          }
        } else {
          const topVertexIndex = calculateTopVertex(position, rotation)

          // Map the top vertex index to the corresponding number on the dice
          calculatedValue = mapVertexToNumber(topVertexIndex)
        }
        setDiceValue(calculatedValue || null)
      }
    }
  })

  return (
    <RigidBody
      ref={rigidBodyRef}
      type='dynamic'
      position={position}
      gravityScale={gravityScale}
      linearVelocity={linearVelocity}
      rotation={rotation}
      friction={friction}
      restitution={restitution}
      mass={2000}
      includeInvisible
    >
      <mesh {...props} geometry={(nodes[`d${die}`] as Mesh).geometry} castShadow receiveShadow>
        <meshStandardMaterial
          attach='material'
          map={((nodes[`d${die}`] as Mesh).material as MeshStandardMaterial).map}
        />
      </mesh>
    </RigidBody>
  )
}

export default Dice
