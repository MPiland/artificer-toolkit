import type { NodeRuntimeNodeDto } from '@artificer-toolkit/schema'
import { createAuthoringFormRenderer } from '#forms'
import {
  createDefaultAbilityScores,
  createEmptyAction,
  createEmptyCompanionProfile,
  createEmptyCreature,
  createEmptyDetail,
  createEmptyFeature,
  createEmptyLairProfile,
  createEmptyLegendaryProfile,
  createEmptyMountProfile,
  createEmptyNpcProfile,
  createEmptyProficiency,
  createEmptySpeed,
  toCreatureFormValues
} from '../creatureAuthoring.utils'

const creatureRendererDefaults = toCreatureFormValues(createEmptyCreature({ systemId: '', userId: '' }))
const creatureGroupRendererDefaults: Record<string, unknown> = createEmptyDetail(1)

export const CreatureAuthoringRenderer = createAuthoringFormRenderer({
  defaultValues: creatureRendererDefaults,
  groupDefaultValues: creatureGroupRendererDefaults,
  createArrayItem: createCreatureArrayItem,
  createObjectItem: createCreatureObjectItem
})

function createCreatureArrayItem(node: NodeRuntimeNodeDto, currentLength: number): Record<string, unknown> {
  const [rootPath] = node.path
  const order = currentLength + 1

  if (rootPath === 'actions' || rootPath === 'bonusActions' || rootPath === 'lairActions' || rootPath === 'reactions') {
    return createEmptyAction()
  }

  if (rootPath === 'details') return createEmptyDetail(order)
  if (rootPath === 'features') return createEmptyFeature(order)
  if (rootPath === 'logisticsNotes' || rootPath === 'regionalEffects') return { value: '' }
  if (rootPath === 'proficiencies') return createEmptyProficiency()
  if (rootPath === 'senses' || rootPath === 'tags') return { value: '' }
  if (rootPath === 'speeds') return createEmptySpeed()
  if (rootPath === 'bonds' || rootPath === 'flaws' || rootPath === 'ideals' || rootPath === 'personalityTraits') return { value: '' }

  return {
    id: crypto.randomUUID(),
    order
  }
}

function createCreatureObjectItem(node: NodeRuntimeNodeDto): Record<string, unknown> {
  const [rootPath] = node.path

  if (rootPath === 'abilityScores') return createDefaultAbilityScores()
  if (rootPath === 'carryingCapacity') return { amount: 0, unit: 'POUNDS' }
  if (rootPath === 'companionProfile') return createEmptyCompanionProfile()
  if (rootPath === 'cost') return { amount: 0, currencyId: '' }
  if (rootPath === 'lairProfile') return createEmptyLairProfile()
  if (rootPath === 'legendaryProfile') return createEmptyLegendaryProfile()
  if (rootPath === 'mountProfile') return createEmptyMountProfile()
  if (rootPath === 'npcProfile') return createEmptyNpcProfile()

  return {}
}
