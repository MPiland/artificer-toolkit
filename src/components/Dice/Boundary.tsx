import { RigidBody, Vector3Tuple } from '@react-three/rapier'

interface Props {
  color?: string
  position?: Vector3Tuple
  rotation?: Vector3Tuple
  args?: [
    width?: number | undefined,
    height?: number | undefined,
    widthSegments?: number | undefined,
    heightSegments?: number | undefined
  ]
  transparent: boolean
}

const Boundary = ({ color, position, rotation, args, transparent, ...props }: Props) => {
  return (
    <RigidBody type='fixed' restitution={0} {...props} position={position} rotation={rotation}>
      <mesh receiveShadow>
        <boxGeometry attach='geometry' args={args} />
        <meshPhongMaterial attach='material' color={color} transparent={transparent} opacity={0} />
      </mesh>
    </RigidBody>
  )
}

export default Boundary
