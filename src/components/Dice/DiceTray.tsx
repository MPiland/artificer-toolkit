import { Physics } from '@react-three/rapier'
import Boundary from './Boundary'
import { Suspense, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { DiceContext } from './DiceContext'
import { use } from 'react'

const DiceTray = () => {
  const { dice, setDice } = use(DiceContext)
  const { width, height } = useThree((state) => state.viewport)

  useEffect(() => {
    setDice.canvasHeight(height)
    setDice.canvasWidth(width)
  }, [height, setDice, width])

  // Calculate positions and sizes for the walls
  const wallThickness = 2 // Adjust as needed
  const wallHeight = 200 // Adjust as needed
  const wallX = width / 2 + wallThickness / 2
  const wallY = height / 2 + wallThickness / 2

  return (
    <>
      <Suspense>
        <directionalLight position={[-20, -20, 8]} intensity={5} />
        <directionalLight position={[30, 10, 12]} intensity={1} />
        <Physics gravity={[0, 0, -9.81]} colliders={'hull'}>
          <Boundary position={[0, 0, 0]} args={[width, height, wallThickness]} color='grey' transparent={true} />
          <Boundary
            position={[0, -wallY, 0]}
            args={[width, wallThickness, wallHeight]}
            color='lightgreen'
            transparent={true}
          />
          <Boundary
            position={[0, wallY, 0]}
            args={[width, wallThickness, wallHeight]}
            color='lightblue'
            transparent={true}
          />
          <Boundary
            position={[-wallX, 0, 0]}
            args={[wallThickness, height, wallHeight]}
            color='red'
            transparent={true}
          />
          <Boundary
            position={[wallX, 0, 0]}
            args={[wallThickness, height, wallHeight]}
            color='purple'
            transparent={true}
          />
          {dice.renderDice && dice.instances}
        </Physics>
      </Suspense>
    </>
  )
}

export default DiceTray
