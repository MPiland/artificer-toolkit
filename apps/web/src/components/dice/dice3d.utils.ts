import { Quaternion, Vector3, type BufferAttribute, type InterleavedBufferAttribute } from 'three'
import type { RollResultDto } from '@artificer-toolkit/schema/api/rolls'

export type VisualDie = {
  die: 4 | 6 | 8 | 10 | 12 | 20 | 100
  faceValue: number
  id: string
  kept: boolean
}

type MotionVector = { x: number; y: number; z: number }

export function isDieNearlyStill(linearVelocity: MotionVector, angularVelocity: MotionVector) {
  const linearSpeedSquared = linearVelocity.x ** 2 + linearVelocity.y ** 2 + linearVelocity.z ** 2
  const angularSpeedSquared =
    angularVelocity.x ** 2 + angularVelocity.y ** 2 + angularVelocity.z ** 2
  return linearSpeedSquared <= 0.36 && angularSpeedSquared <= 1
}

export function getScaledColliderVertices(
  position: BufferAttribute | InterleavedBufferAttribute,
  scale: number
) {
  const vertices = new Float32Array(position.count * 3)
  for (let index = 0; index < position.count; index += 1) {
    const offset = index * 3
    vertices[offset] = position.getX(index) * scale
    vertices[offset + 1] = position.getY(index) * scale
    vertices[offset + 2] = position.getZ(index) * scale
  }
  return vertices
}

const faceNormals = {
  6: [
    [[0, 0, 1], 1],
    [[0, 1, 0], 3],
    [[1, 0, 0], 5],
    [[-1, 0, 0], 2],
    [[0, -1, 0], 4],
    [[0, 0, -1], 6]
  ],
  8: [
    [[0, 0, 1], 1],
    [[-0.8165, 0.4714, 0.3333], 4],
    [[-0.8165, -0.4714, -0.3333], 3],
    [[0, -0.9428, 0.3333], 2],
    [[0.8165, 0.4714, 0.3333], 6],
    [[0, 0.9428, -0.3333], 7],
    [[0, 0, -1], 8],
    [[0.8165, -0.4714, -0.3333], 5]
  ],
  10: [
    [[0.4371, -0.8994, 0], 4],
    [[0.7073, -0.3435, -0.6178], 0],
    [[0, 0, -1], 8],
    [[-0.7073, -0.3435, -0.6178], 2],
    [[-0.4371, -0.8994, 0], 6],
    [[0.4371, 0.8994, 0], 3],
    [[0.7073, 0.3435, 0.6178], 7],
    [[0, 0, 1], 1],
    [[-0.7073, 0.3435, 0.6178], 9],
    [[-0.4371, 0.8994, 0], 5]
  ],
  12: [
    [[0, -0.8943, -0.4475], 10],
    [[-0.8507, -0.2763, -0.4473], 11],
    [[-0.5257, -0.7237, 0.447], 6],
    [[0, 0, -1], 12],
    [[-0.8507, 0.2763, 0.4473], 5],
    [[0.5257, -0.7237, 0.447], 4],
    [[0.8507, -0.2763, -0.4473], 8],
    [[0, 0, 1], 1],
    [[-0.5257, 0.7237, -0.447], 9],
    [[0.5257, 0.7237, -0.447], 7],
    [[0.8507, 0.2763, 0.4473], 2],
    [[0, 0.8943, 0.4475], 3]
  ],
  20: [
    [[-0.3334, 0.5773, 0.7453], 13],
    [[-0.7454, 0.5773, -0.3334], 4],
    [[0.7453, 0.5774, 0.3333], 15],
    [[0.3333, 0.5774, -0.7454], 2],
    [[-0.3333, -0.5774, 0.7454], 19],
    [[-0.7453, -0.5774, -0.3333], 6],
    [[0.7454, -0.5773, 0.3334], 17],
    [[0.3334, -0.5773, -0.7453], 8],
    [[-0.8727, 0.3568, 0.3333], 11],
    [[-0.8727, -0.3569, 0.3333], 9],
    [[0.8727, 0.3569, -0.3333], 12],
    [[0.8727, -0.3568, -0.3333], 10],
    [[0.1273, 0.9342, 0.3333], 5],
    [[-0.1274, 0.9342, -0.3333], 18],
    [[0.1274, -0.9342, 0.3333], 3],
    [[-0.1273, -0.9342, -0.3333], 16],
    [[0, 0, 1], 1],
    [[0.6666, 0, 0.7454], 7],
    [[-0.6666, 0, -0.7454], 14],
    [[0, 0, -1], 20]
  ],
  100: [
    [[0.4371, -0.8994, 0], 60],
    [[0.7073, -0.3435, -0.6178], 40],
    [[0, 0, -1], 80],
    [[-0.7073, -0.3435, -0.6178], 20],
    [[-0.4371, -0.8994, 0], 0],
    [[0.4371, 0.8994, 0], 90],
    [[0.7073, 0.3435, 0.6178], 70],
    [[0, 0, 1], 10],
    [[-0.7073, 0.3435, 0.6178], 50],
    [[-0.4371, 0.8994, 0], 30]
  ]
} satisfies Record<number, [number[], number][]>

const d4Vertices = [
  [0, 0, 1.6874],
  [-1.3777, -0.7956, -0.5626],
  [0, 1.591, -0.5624],
  [1.3778, -0.7954, -0.5625]
] as const

export function getTargetQuaternion(die: VisualDie['die'], faceValue: number) {
  const normal =
    die === 4
      ? d4Vertices[faceValue - 1]
      : faceNormals[die].find((entry) => entry[1] === faceValue)?.[0]
  if (!normal) throw new RangeError(`The d${die} model has no face for ${faceValue}.`)

  return new Quaternion().setFromUnitVectors(
    new Vector3(...normal).normalize(),
    new Vector3(0, 0, 1)
  )
}

type RollTermEvidence = RollResultDto['evidence']['terms'][number]

function isKeptRoll(term: RollTermEvidence, rollIndex: number) {
  return term.keptRollIndexes
    ? term.keptRollIndexes.includes(rollIndex)
    : term.keptRollIndex == null || term.keptRollIndex === rollIndex
}

function toVisualDice(
  term: RollTermEvidence,
  values: number[],
  getId: (rollIndex: number) => string,
  revealSelection = true
) {
  return values.flatMap<VisualDie>((value, rollIndex) => {
    const id = getId(rollIndex)
    const kept = revealSelection ? isKeptRoll(term, rollIndex) : true
    if (term.die !== 100) {
      return [
        {
          die: term.die,
          faceValue: term.die === 10 && value === 10 ? 0 : value,
          id,
          kept
        }
      ]
    }

    const percentile = value === 100 ? 0 : Math.floor(value / 10) * 10
    const ones = value === 100 ? 0 : value % 10
    return [
      { die: 100 as const, faceValue: percentile, id: `${id}:percentile`, kept },
      { die: 10 as const, faceValue: ones, id: `${id}:ones`, kept }
    ]
  })
}

export function getVisualDiceStages(roll: RollResultDto): VisualDie[][] {
  const stageCount = Math.max(
    1,
    ...roll.evidence.terms.flatMap(
      (term) => term.rollSequences?.map((sequence) => sequence.length) ?? [1]
    )
  )

  const playbackStages = Array.from({ length: stageCount }, (_, stageIndex) =>
    roll.evidence.terms.flatMap<VisualDie>((term, termIndex) => {
      if (!term.rollSequences) {
        return toVisualDice(
          term,
          term.rolls,
          (rollIndex) => `${roll.id}:${termIndex}:${rollIndex}`,
          false
        )
      }

      const attemptIndexes = term.rollSequences.map((sequence) =>
        Math.min(stageIndex, sequence.length - 1)
      )
      const values = term.rollSequences.map(
        (sequence, rollIndex) => sequence[attemptIndexes[rollIndex]] ?? sequence.at(-1)!
      )
      return toVisualDice(
        term,
        values,
        (rollIndex) => `${roll.id}:${termIndex}:${rollIndex}:attempt:${attemptIndexes[rollIndex]}`,
        false
      )
    })
  )

  const settledDice = roll.evidence.terms.flatMap<VisualDie>((term, termIndex) => {
    const sequences = term.rollSequences
    return toVisualDice(term, term.rolls, (rollIndex) => {
      const sequence = sequences?.[rollIndex]
      return sequence
        ? `${roll.id}:${termIndex}:${rollIndex}:attempt:${sequence.length - 1}`
        : `${roll.id}:${termIndex}:${rollIndex}`
    })
  })

  return [...playbackStages, settledDice]
}
