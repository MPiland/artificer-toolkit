import { Vector3Tuple } from '@react-three/rapier'
import { RollConfig, Point } from '../types/components'

export const generateRandomLinearVelocity = (width: number, height: number): Vector3Tuple => {
  const directionX = (Math.random() - 0.5) * width
  const directionY = (Math.random() - 0.5) * height

  const length = Math.sqrt(directionX ** 2 + directionY ** 2)
  const normalizedDirectionX = directionX / length
  const normalizedDirectionY = directionY / length

  const velocityMagnitude = 26
  const linearVelocityX = normalizedDirectionX * velocityMagnitude
  const linearVelocityY = normalizedDirectionY * velocityMagnitude

  return [linearVelocityX, linearVelocityY, -4]
}

export const generateRandomRotation = (): Vector3Tuple => {
  const rotationX = (Math.random() - 0.5) * 2
  const rotationY = (Math.random() - 0.5) * 2
  const rotationZ = (Math.random() - 0.5) * 2

  return [rotationX, rotationY, rotationZ]
}

export const generateRandomPointOnSphere = (radius: number, center: Point): Point => {
  const theta = Math.random() * 2 * Math.PI
  const phi = Math.acos(2 * Math.random() - 1)
  const x = center.x + radius * Math.sin(phi) * Math.cos(theta)
  const y = center.y + radius * Math.sin(phi) * Math.sin(theta)
  const z = center.z + radius * Math.cos(phi)
  return { x, y, z }
}

export const calculateDistance = (point1: Point, point2: Point): number => {
  const dx = point1.x - point2.x
  const dy = point1.y - point2.y
  const dz = point1.z - point2.z
  return Math.sqrt(dx ** 2 + dy ** 2 + dz ** 2)
}

export const generateRandomPoints = (numPoints: number, minDistance: number, center: Point): Point[] => {
  const points: Point[] = []
  while (points.length < numPoints) {
    const newPoint = generateRandomPointOnSphere(4, center)
    const validPoint = points.every((existingPoint) => calculateDistance(newPoint, existingPoint) >= minDistance)
    if (validPoint) points.push(newPoint)
  }
  return points
}

export const parseDiceRoll = (rollString: RollConfig) => {
  const rollRegex =
    /(?<numDice>\d*)d(?<dieType>\d+)?(?<keep>(?<keepType>(?:kl|kh))?(?<keepCount>\d+))?(?<drop>(?<dropType>(?:dl|dh))?(?<dropCount>\d+))?(?<reroll>(?<rerollType>(?:ro|r))?(?<rerollCondition>[<>])?(?<rerollValue>\d+)?)?/
  const match = rollString.match(rollRegex)
  if (!match) {
    console.log('No dice match')
  }

  const { numDice, dieType, keepType, keepCount, dropType, dropCount, rerollType, rerollCondition, rerollValue } =
    match?.groups as any

  return {
    numDice,
    dieType,
    keepType,
    keepCount,
    dropType,
    dropCount,
    rerollType,
    rerollCondition,
    rerollValue,
  }
}
