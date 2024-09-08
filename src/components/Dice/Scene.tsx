import { Canvas } from '@react-three/fiber'
import { scene_overlay } from './Scene.css'
import DiceTray from './DiceTray'
import { useDice } from '../../hooks/UseDice'
import { useCallback, useEffect } from 'react'

const Scene = () => {
  const { resetState } = useDice()

  const handleClick = useCallback(() => {
    resetState()
  }, [resetState])

  useEffect(() => {
    window.addEventListener('click', handleClick)

    return () => {
      window.removeEventListener('click', handleClick)
    }
  }, [handleClick])

  return (
    <div className={scene_overlay}>
      <Canvas
        gl={{ alpha: true }}
        orthographic
        camera={{ position: [0, 0, 100], near: 0.01, far: 1000, zoom: 25 }}
        style={{ pointerEvents: 'none' }}
      >
        <DiceTray />
      </Canvas>
    </div>
  )
}

export default Scene
