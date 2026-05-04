import { createAuthoringFormRenderer } from '#forms'
import {
  createEmptyCreature,
  toCreatureFormValues
} from '../creatureAuthoring.utils'

const creatureRendererDefaults = toCreatureFormValues(createEmptyCreature({ systemId: '', userId: '' }))

export const CreatureAuthoringRenderer = createAuthoringFormRenderer({
  defaultValues: creatureRendererDefaults
})
