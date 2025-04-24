import type { RollConfig, Point, DiceConfig, DieType } from './Dice.types'
import type { Vector3Tuple } from '@react-three/rapier'
import type { Vector } from 'three/examples/jsm/Addons.js'
import type { Vector4Like } from 'three'

export const diceNormalsMap: Record<DieType, Array<{ normal: number[]; value: number }>> = {
  4: [], // D4 uses a different calculation method
  6: [
    { normal: [0, 0, 1], value: 1 }, // Top face
    { normal: [0, 1, 0], value: 3 }, // Front face
    { normal: [1, 0, 0], value: 5 }, // Right face
    { normal: [-1, 0, 0], value: 2 }, // Left face
    { normal: [0, -1, 0], value: 4 }, // Back face
    { normal: [0, 0, -1], value: 6 }, // Bottom face
  ],
  8: [
    { normal: [2.28130119239722e-8, -1.03597722045378e-5, 1], value: 1 },
    { normal: [-0.816496729850769, 0.471400797367095, 0.333338171243667], value: 4 },
    { normal: [-0.816496491432189, -0.471401154994964, -0.333338350057601], value: 3 },
    { normal: [7.2022167785235e-8, -0.942812502384185, 0.333323419094085], value: 2 },
    { normal: [0.8164963722229, 0.471401184797287, 0.333338469266891], value: 6 },
    { normal: [-1.15042091408668e-7, 0.94281256198883, -0.333323448896408], value: 7 },
    { normal: [1.93003430126736e-7, 1.03768770713941e-5, -1], value: 8 },
    { normal: [0.816496551036834, -0.471401154994964, -0.333338350057601], value: 5 },
  ],
  10: [
    { normal: [0.437134623527526, -0.899395883083343, 0.000552834128029644], value: 4 },
    { normal: [0.707298755645752, -0.343545466661453, -0.61782282590866], value: 0 },
    { normal: [-7.7919715124608e-8, -1.10268665594048e-5, -1], value: 8 },
    { normal: [-0.707298815250396, -0.343545049428939, -0.617822885513305], value: 2 },
    { normal: [-0.437134623527526, -0.899395883083343, 0.00055268924916163], value: 6 },
    { normal: [0.437134832143783, 0.899395823478698, -0.000552548852283507], value: 3 },
    { normal: [0.707298517227172, 0.343545615673065, 0.617823004722595], value: 7 },
    { normal: [-3.62138763421171e-8, 1.10122355181374e-5, 1], value: 1 },
    { normal: [-0.707298815250396, 0.343545347452163, 0.617822766304016], value: 9 },
    { normal: [-0.437134504318237, 0.899396002292633, -0.000552673358470201], value: 5 },
  ],
  12: [
    { normal: [1.65957381170755e-8, -0.894290745258331, -0.447486490011215], value: 10 },
    { normal: [-0.850650787353515, -0.276256829500198, -0.447297871112823], value: 11 },
    { normal: [-0.525730788707733, -0.723743379116058, 0.446992844343185], value: 6 },
    { normal: [-5.40824316885846e-7, 0.000305070861941203, -0.99999988079071], value: 12 },
    { normal: [-0.85065084695816, 0.276256918907165, 0.447297751903533], value: 5 },
    { normal: [0.525731146335601, -0.723743081092834, 0.446992993354797], value: 4 },
    { normal: [0.850650906562805, -0.276256591081619, -0.447297841310501], value: 8 },
    { normal: [1.98814348095766e-7, -0.000305040855892002, 1], value: 1 },
    { normal: [-0.525731325149536, 0.723743021488189, -0.446992725133895], value: 9 },
    { normal: [0.525731027126312, 0.723743200302124, -0.44699278473854], value: 7 },
    { normal: [0.85065084695816, 0.276256799697876, 0.447297751903533], value: 2 },
    { normal: [-1.550610591039e-7, 0.894290626049041, 0.447486519813537], value: 3 },
  ],
  20: [
    { normal: [-0.333373129367828, 0.57734203338623, 0.745344579219818], value: 13 },
    { normal: [-0.745371520519256, 0.577318429946899, -0.333353817462921], value: 4 },
    { normal: [0.745325446128845, 0.577382147312164, 0.33334657549858], value: 15 },
    { normal: [0.333327621221542, 0.577359080314636, -0.745351731777191], value: 2 },
    { normal: [-0.333326697349548, -0.577358841896057, 0.745352327823638], value: 19 },
    { normal: [-0.74532550573349, -0.577382147312164, -0.333346337080001], value: 6 },
    { normal: [0.745371222496032, -0.577318668365478, 0.333353847265243], value: 17 },
    { normal: [0.33337315917015, -0.577341854572296, -0.745344638824462], value: 8 },
    { normal: [-0.872699856758117, 0.3567895591259, 0.333310931921005], value: 11 },
    { normal: [-0.87267130613327, -0.356855303049087, 0.333315372467041], value: 9 },
    { normal: [0.872671127319335, 0.356855243444442, -0.333315819501876], value: 12 },
    { normal: [0.872699975967407, -0.356789231300354, -0.33331099152565], value: 10 },
    { normal: [0.127277016639709, 0.934179544448852, 0.333330482244491], value: 5 },
    { normal: [-0.127351760864257, 0.93416541814804, -0.333341181278228], value: 18 },
    { normal: [0.127351611852645, -0.934165477752685, 0.333341658115386], value: 3 },
    { normal: [-0.127276718616485, -0.934179544448852, -0.333330690860748], value: 16 },
    { normal: [-2.26881456910632e-5, 6.8170347731211e-6, 1], value: 1 },
    { normal: [0.666649520397186, 3.12229676637798e-5, 0.745371401309967], value: 7 },
    { normal: [-0.666649281978607, -3.15012512146495e-5, -0.745371580123901], value: 14 },
    { normal: [2.22839680645847e-5, -7.0385385697591e-6, -1], value: 20 },
  ],
  100: [
    { normal: [0.437134653329849, -0.899395883083343, 0.000552878831513226], value: 60 },
    { normal: [0.707298636436462, -0.343545317649841, -0.61782306432724], value: 40 },
    { normal: [1.14215595203859e-7, -1.09581396827707e-5, -1], value: 80 },
    { normal: [-0.707299053668975, -0.343545585870742, -0.617822468280792], value: 20 },
    { normal: [-0.437134474515914, -0.899396061897277, 0.000552686513401567], value: 0 },
    { normal: [0.437134623527526, 0.899395883083343, -0.0005526656168513], value: 90 },
    { normal: [0.707298696041107, 0.343545496463775, 0.617822885513305], value: 70 },
    { normal: [4.38636753585797e-8, 1.09584361780434e-5, 1], value: 10 },
    { normal: [-0.707298636436462, 0.343545317649841, 0.61782294511795], value: 50 },
    { normal: [-0.437134593725204, 0.899395883083343, -0.000552652694750577], value: 30 },
  ],
}

export const applyRotationMatrix = (vector: number[], matrix: number[]) => {
  const [x, y, z] = vector
  return [
    x * matrix[0] + y * matrix[1] + z * matrix[2],
    x * matrix[3] + y * matrix[4] + z * matrix[5],
    x * matrix[6] + y * matrix[7] + z * matrix[8],
  ]
}

export const dot = (v1: number[], v2: number[]) => v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]

export const quaternionToMatrix = (q: { x: number; y: number; z: number; w: number }): number[] => {
  const { x, y, z, w } = q
  const xx = x * x
  const xy = x * y
  const xz = x * z
  const xw = x * w
  const yy = y * y
  const yz = y * z
  const yw = y * w
  const zz = z * z
  const zw = z * w

  return [
    1 - 2 * (yy + zz),
    2 * (xy - zw),
    2 * (xz + yw),
    2 * (xy + zw),
    1 - 2 * (xx + zz),
    2 * (yz - xw),
    2 * (xz - yw),
    2 * (yz + xw),
    1 - 2 * (xx + yy),
  ]
}

export const calculateTopVertex = (position: Vector, rotation: Vector4Like): number => {
  // Define vertices of the tetrahedron relative to the dice's center
  const vertices: Vector3Tuple[] = [
    [0, 0, 1.6874], //1
    [-1.3777, -0.795644, -0.56258], // 2
    [0, 1.591, -0.56236], // 3
    [1.3778, -0.79539, -0.56249], // 4
  ]

  // Apply rotation to each vertex
  const rotatedVertices = vertices.map((vertex) => {
    const [x, y, z] = vertex
    // Apply rotation matrix
    const rotatedX =
      x * (1 - 2 * (rotation.y * rotation.y + rotation.z * rotation.z)) +
      y * 2 * (rotation.x * rotation.y - rotation.w * rotation.z) +
      z * 2 * (rotation.x * rotation.z + rotation.w * rotation.y)
    const rotatedY =
      x * 2 * (rotation.x * rotation.y + rotation.w * rotation.z) +
      y * (1 - 2 * (rotation.x * rotation.x + rotation.z * rotation.z)) +
      z * 2 * (rotation.y * rotation.z - rotation.w * rotation.x)
    const rotatedZ =
      x * 2 * (rotation.x * rotation.z - rotation.w * rotation.y) +
      y * 2 * (rotation.y * rotation.z + rotation.w * rotation.x) +
      z * (1 - 2 * (rotation.x * rotation.x + rotation.y * rotation.y))
    return [rotatedX + position.x, rotatedY + position.y, rotatedZ + position.z]
  })

  // Find the vertex with the maximum y-coordinate
  let maxIndex = 0
  let maxY = Number.NEGATIVE_INFINITY
  rotatedVertices.forEach((vertex, index) => {
    if (vertex[2] > maxY) {
      maxY = vertex[2]
      maxIndex = index
    }
  })

  return maxIndex // Return the index of the top vertex
}

export const mapVertexToNumber = (vertexIndex: number): number | undefined => {
  // Define mappings from vertex index to number for a standard d4 model
  const vertexToNumberMap: { [key: number]: number } = {
    0: 1, // Mapping for vertex 0
    1: 2, // Mapping for vertex 1
    2: 3, // Mapping for vertex 2
    3: 4, // Mapping for vertex 3
  }

  // Check if the vertexIndex exists in the map
  if (vertexIndex in vertexToNumberMap) {
    // Return the corresponding number for the given vertex index
    return vertexToNumberMap[vertexIndex]
  }

  // If the vertexIndex is not found in the map, return undefined or handle it accordingly
  return undefined
}

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
    /(?<quantity>\d+)?(?:d(?<die>\d+)?)?(?<keep>(?<keepType>(?:kl|kh))?(?<keepCount>\d+))?(?<drop>(?<dropType>(?:dl|dh))?(?<dropCount>\d+))?(?<reroll>(?<rerollType>(?:ro|r))?(?<rerollCondition>[<>])?(?<rerollValue>\d+)?)?/

  const match = rollString.match(rollRegex)

  return {
    quantity: (Number(match?.groups?.quantity) || 0) as DiceConfig['quantity'],
    die: (Number(match?.groups?.die) || 0) as DiceConfig['die'],
    keepType: (match?.groups?.keepType || null) as DiceConfig['keepType'],
    keepCount: (Number(match?.groups?.keepCount) || null) as DiceConfig['keepCount'],
    dropType: (match?.groups?.dropType || null) as DiceConfig['dropType'],
    dropCount: (Number(match?.groups?.dropCount) || null) as DiceConfig['dropCount'],
    rerollType: (match?.groups?.rerollType || null) as DiceConfig['rerollType'],
    rerollCondition: (match?.groups?.rerollCondition || null) as DiceConfig['rerollCondition'],
    rerollValue: (Number(match?.groups?.rerollValue) || null) as DiceConfig['rerollValue'],
  }
}
