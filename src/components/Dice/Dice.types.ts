import type { Vector3Tuple } from '@react-three/rapier'

export type Point = { x: number; y: number; z: number }

export interface DiceProps {
  die: DieType
  position?: Vector3Tuple
  linearVelocity?: Vector3Tuple
  rotation?: Vector3Tuple
  gravityScale?: number
  friction?: number
  restitution?: number
  id: string
}

export type DieType = 4 | 6 | 8 | 10 | 12 | 20 | 100
export type KeepType = 'kh' | 'kl' | null
export type DropType = 'dh' | 'dl' | null
export type RerollType = 'r' | 'ro' | null
export type RerollCondition = '>' | '<' | '===' | null

export type DiceResult = {
  die: number
  value: number
  id?: string | null
}

export type DiceConfig = {
  quantity: number
  die: DieType
  rerollType?: RerollType
  rerollCondition?: RerollCondition
  rerollValue?: number
  keepType?: KeepType
  keepCount?: number
  dropType?: DropType
  dropCount?: number
}

export type DiceRolls = {
  score: number | null
  ability: unknown
  rolling: boolean
  rolled: DiceResult[]
  kept?: DiceResult[] | null
  applied: boolean
}
