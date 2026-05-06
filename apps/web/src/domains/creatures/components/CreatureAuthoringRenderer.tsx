import { createAuthoringFormRenderer } from '#forms'
import {
  createEmptyCreature,
  toCreatureFormValues
} from '../creatureAuthoring.utils'

const creatureRendererDefaults = toCreatureFormValues(createEmptyCreature({ systemId: '' }))

export const CreatureAuthoringRenderer = createAuthoringFormRenderer({
  defaultValues: creatureRendererDefaults
})
