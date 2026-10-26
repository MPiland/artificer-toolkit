import type {
  CreatureAuthoringInputDto,
  CreatureAuthoredDto
} from '@artificer-toolkit/schema/subjects/creature'
import { defaultAbilityScores } from '@artificer-toolkit/rules-runtime/systemAbilities'
import { defaultSize } from '@artificer-toolkit/rules-runtime/systemSizes'
import { CREATURE_CATEGORY_CODE } from '@artificer-toolkit/shared/core'

type CreatureStringFormValue = {
  value: string
}

type CreatureNpcProfileFormValues = Omit<
  NonNullable<CreatureAuthoringInputDto['npcProfile']>,
  'bonds' | 'flaws' | 'ideals' | 'personalityTraits'
> & {
  bonds?: CreatureStringFormValue[]
  flaws?: CreatureStringFormValue[]
  ideals?: CreatureStringFormValue[]
  personalityTraits?: CreatureStringFormValue[]
}

export type CreatureFormValues = Omit<
  CreatureAuthoringInputDto,
  'tags' | 'logisticsNotes' | 'npcProfile'
> & {
  tags?: CreatureStringFormValue[]
  logisticsNotes?: CreatureStringFormValue[]
  npcProfile?: CreatureNpcProfileFormValues
}

interface CreateEmptyCreatureInput {
  systemId: string
}

export function createEmptyCreature({ systemId }: CreateEmptyCreatureInput): CreatureFormValues {
  return {
    id: crypto.randomUUID(),
    label: '',
    description: '',
    quote: '',
    status: 'DRAFT',
    category: CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: '',
    size: systemId ? defaultSize(systemId) : '',
    systemId,
    tags: [],
    abilityScores: systemId ? defaultAbilityScores(systemId) : {},
    naturalArmorBonus: 0,
    hitPoints: 1,
    speeds: [],
    senses: [],
    damageVulnerabilities: [],
    damageResistances: [],
    damageImmunities: [],
    qualifiedDamageDefenses: [],
    conditionImmunities: [],
    details: [],
    features: [],
    equipmentLoadout: [],
    proficiencies: []
  }
}

export function normalizeCreatureForSubmit(
  creature: CreatureFormValues
): CreatureAuthoringInputDto {
  return {
    ...creature,
    label: creature.label.trim(),
    description: creature.description ?? '',
    quote: creature.quote ?? '',
    status: creature.status,
    tags: normalizeStringFormValues(creature.tags),
    logisticsNotes: normalizeStringFormValues(creature.logisticsNotes),
    npcProfile: creature.npcProfile
      ? {
          ...creature.npcProfile,
          bonds: normalizeStringFormValues(creature.npcProfile.bonds),
          flaws: normalizeStringFormValues(creature.npcProfile.flaws),
          ideals: normalizeStringFormValues(creature.npcProfile.ideals),
          personalityTraits: normalizeStringFormValues(creature.npcProfile.personalityTraits)
        }
      : undefined
  }
}

export function toCreatureFormValues(
  creature: CreatureAuthoringInputDto | CreatureAuthoredDto | CreatureFormValues
): CreatureFormValues {
  return {
    ...creature,
    description: creature.description ?? '',
    quote: creature.quote ?? '',
    tags: toStringFormValues(creature.tags),
    abilityScores: creature.abilityScores ?? defaultAbilityScores(creature.systemId),
    logisticsNotes: toStringFormValues(creature.logisticsNotes),
    npcProfile: creature.npcProfile
      ? {
          ...creature.npcProfile,
          bonds: toStringFormValues(creature.npcProfile.bonds),
          flaws: toStringFormValues(creature.npcProfile.flaws),
          ideals: toStringFormValues(creature.npcProfile.ideals),
          personalityTraits: toStringFormValues(creature.npcProfile.personalityTraits)
        }
      : undefined
  }
}

function normalizeStringFormValues(values: CreatureStringFormValue[] | undefined): string[] {
  return (values ?? []).map(({ value }) => value.trim()).filter((value) => value.length > 0)
}

function toStringFormValues(
  values: string[] | CreatureStringFormValue[] | undefined
): CreatureStringFormValue[] {
  return (values ?? []).map((value) =>
    typeof value === 'string' ? { value } : { value: value.value }
  )
}
