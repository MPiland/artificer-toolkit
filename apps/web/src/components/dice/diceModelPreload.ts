import { useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { parseRollExpression } from '@artificer-toolkit/shared/rolls'

export function preloadDiceModels(expression: string) {
  const diceTypes = [...new Set(parseRollExpression(expression).terms.map((term) => term.die))]
  useLoader.preload(
    GLTFLoader,
    diceTypes.map((die) => `/models/d${die}.glb`)
  )
}
