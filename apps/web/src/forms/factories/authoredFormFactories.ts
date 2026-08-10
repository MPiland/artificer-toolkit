import { createElement } from 'react'
import type { AuthoredDraftDto, EquipmentResponseDto } from '@artificer-toolkit/schema/api/content'
import type { AuthoredContentProvenanceDto } from '@artificer-toolkit/schema/api/common'
import type { SystemResponseDto } from '@artificer-toolkit/schema/api/systems'
import {
  backgroundAuthoringInputDtoSchema,
  BackgroundAuthoringInputDto,
  BackgroundAuthoredDto
} from '@artificer-toolkit/schema/subjects/background'
import {
  classAuthoringInputDtoSchema,
  ClassAuthoringInputDto,
  ClassAuthoredDto
} from '@artificer-toolkit/schema/subjects/class'
import {
  creatureAuthoringInputDtoSchema,
  CreatureAuthoringInputDto,
  CreatureAuthoredDto
} from '@artificer-toolkit/schema/subjects/creature'
import {
  equipmentAuthoringInputDtoSchema,
  EquipmentAuthoringInputDto,
  EquipmentAuthoredDto
} from '@artificer-toolkit/schema/subjects/equipment'
import {
  featAuthoringInputDtoSchema,
  FeatAuthoringInputDto,
  FeatAuthoredDto
} from '@artificer-toolkit/schema/subjects/feat'
import type {
  RaceAuthoringInputDto,
  RaceAuthoredDto
} from '@artificer-toolkit/schema/subjects/race'
import { raceAuthoringInputDtoSchema } from '@artificer-toolkit/schema/subjects/race'
import {
  spellAuthoringInputDtoSchema,
  SpellAuthoringInputDto,
  SpellAuthoredDto
} from '@artificer-toolkit/schema/subjects/spell'
import {
  vehicleAuthoringInputDtoSchema,
  VehicleAuthoringInputDto,
  VehicleAuthoredDto
} from '@artificer-toolkit/schema/subjects/vehicle'
import { api } from '#app/lib/api'
import { queryKeys as globalQueryKeys } from '#app/lib/queryKeys'
import {
  createEmptyBackground,
  normalizeBackgroundForSubmit,
  resolveCreateBackgroundSystemId
} from '../../domains/backgrounds/backgroundAuthoring.utils'
import {
  createEmptyClass,
  normalizeClassForSubmit,
  resolveCreateClassSystemId,
  toClassFormValues,
  type ClassFormValues
} from '../../domains/classes/classAuthoring.utils'
import {
  createEmptyCreature,
  normalizeCreatureForSubmit,
  resolveCreateCreatureSystemId,
  toCreatureFormValues,
  type CreatureFormValues
} from '../../domains/creatures/creatureAuthoring.utils'
import {
  createEmptyEquipment,
  normalizeEquipmentForSubmit,
  resolveCreateEquipmentSystemId,
  toEquipmentFormValues,
  type EquipmentFormValues
} from '../../domains/equipment/equipmentAuthoring.utils'
import {
  createEmptyFeat,
  normalizeFeatForSubmit,
  resolveCreateFeatSystemId
} from '../../domains/feats/featAuthoring.utils'
import {
  createEmptyRace,
  normalizeRaceForSubmit,
  resolveCreateRaceSystemId,
  toRaceFormValues,
  type RaceFormValues
} from '../../domains/races/raceAuthoring.utils'
import {
  createEmptySpell,
  normalizeSpellForSubmit
} from '../../domains/spells/spellAuthoring.utils'
import {
  createEmptyVehicle,
  normalizeVehicleForSubmit,
  resolveCreateVehicleSystemId,
  toVehicleFormValues,
  type VehicleFormValues
} from '../../domains/vehicles/vehicleAuthoring.utils'
import type {
  AuthoredFormDomain,
  AuthoredFormFactory,
  AuthoredFormFactoryBase
} from './authoredFormFactories.types'
import { createAuthoredSession, type AuthoredSessionConfig } from './authoredFormSessionFactory'
import { authoredFormActionFactories } from '../actions/authoredFormActionFactories'
import { EquipmentParentPreview } from '../previews/EquipmentParentPreview'
import { renderEquipmentPreview } from '../previews/equipmentParentPreview.utils'
import { isObjectValue } from '../utils/valueGuards'

export type AuthoredFormSystemCreateData = {
  system?: SystemResponseDto | null
  systems: readonly { id: string }[]
}

export type AuthoredFormEditResponse<TAuthored extends object> = {
  item?: TAuthored | null
  permissions?: {
    canCopy: boolean
    canDelete: boolean
    canEdit: boolean
  }
  provenance?: AuthoredContentProvenanceDto
}

export type AuthoredFormEditData<TAuthored extends object> = {
  draft?: AuthoredDraftDto | null
  response?: AuthoredFormEditResponse<TAuthored> | null
  subjectId: string
  system?: SystemResponseDto | null
}

type EquipmentFormEditData = AuthoredFormEditData<EquipmentAuthoredDto> & {
  parentResponse?: EquipmentResponseDto | null
}

type EquipmentFormContext = {
  parentEquipment?: EquipmentAuthoredDto
}

type AuthoredFormDomainDataByDomain = {
  background: {
    create: AuthoredFormSystemCreateData
    edit: AuthoredFormEditData<BackgroundAuthoredDto>
  }
  class: {
    create: AuthoredFormSystemCreateData
    edit: AuthoredFormEditData<ClassAuthoredDto>
  }
  creature: {
    create: AuthoredFormSystemCreateData
    edit: AuthoredFormEditData<CreatureAuthoredDto>
  }
  equipment: {
    create: AuthoredFormSystemCreateData
    edit: EquipmentFormEditData
  }
  feat: {
    create: AuthoredFormSystemCreateData
    edit: AuthoredFormEditData<FeatAuthoredDto>
  }
  race: {
    create: AuthoredFormSystemCreateData
    edit: AuthoredFormEditData<RaceAuthoredDto>
  }
  spell: {
    create: AuthoredFormSystemCreateData
    edit: AuthoredFormEditData<SpellAuthoredDto>
  }
  vehicle: {
    create: AuthoredFormSystemCreateData
    edit: AuthoredFormEditData<VehicleAuthoredDto>
  }
}

export type AuthoredFormDomainRegistration =
  | {
      [Domain in AuthoredFormDomain]: {
        data: AuthoredFormDomainDataByDomain[Domain]['create']
        domain: Domain
        mode: 'create'
      }
    }[AuthoredFormDomain]
  | {
      [Domain in AuthoredFormDomain]: {
        data: AuthoredFormDomainDataByDomain[Domain]['edit']
        domain: Domain
        mode: 'edit' | 'view'
      }
    }[AuthoredFormDomain]

const backgroundFormFactory = {
  ...createFormFactoryBase({
    domain: 'background',
    subjectKindLabel: 'Background'
  }),
  createEmptyValues: createEmptyBackground,
  createSession: (input) => createAuthoredSession(input, backgroundSessionConfig),
  normalizeForSubmit: normalizeBackgroundForSubmit,
  resolveCreateSystemId: resolveCreateBackgroundSystemId,
  toFormValues: normalizeBackgroundForSubmit
} satisfies AuthoredFormFactory<
  BackgroundAuthoringInputDto,
  BackgroundAuthoringInputDto,
  BackgroundAuthoredDto
>

const classFormFactory = {
  ...createFormFactoryBase({
    domain: 'class',
    subjectKindLabel: 'Class'
  }),
  createEmptyValues: createEmptyClass,
  createSession: (input) => createAuthoredSession(input, classSessionConfig),
  normalizeForSubmit: normalizeClassForSubmit,
  resolveCreateSystemId: resolveCreateClassSystemId,
  toFormValues: toClassFormValues
} satisfies AuthoredFormFactory<ClassFormValues, ClassAuthoringInputDto, ClassAuthoredDto>

const creatureFormFactory = {
  ...createFormFactoryBase({
    domain: 'creature',
    subjectKindLabel: 'Creature'
  }),
  createEmptyValues: createEmptyCreature,
  createSession: (input) => createAuthoredSession(input, creatureSessionConfig),
  normalizeForSubmit: normalizeCreatureForSubmit,
  resolveCreateSystemId: resolveCreateCreatureSystemId,
  toFormValues: toCreatureFormValues
} satisfies AuthoredFormFactory<CreatureFormValues, CreatureAuthoringInputDto, CreatureAuthoredDto>

const equipmentFormFactory = {
  ...createFormFactoryBase({
    domain: 'equipment',
    subjectKindLabel: 'Equipment'
  }),
  createEmptyValues: createEmptyEquipment,
  createSession: (input) => createAuthoredSession(input, equipmentSessionConfig),
  normalizeForSubmit: normalizeEquipmentForSubmit,
  resolveCreateSystemId: resolveCreateEquipmentSystemId,
  toFormValues: toEquipmentFormValues
} satisfies AuthoredFormFactory<
  EquipmentFormValues,
  EquipmentAuthoringInputDto,
  EquipmentAuthoredDto
>

const featFormFactory = {
  ...createFormFactoryBase({
    domain: 'feat',
    subjectKindLabel: 'Feat'
  }),
  createEmptyValues: createEmptyFeat,
  createSession: (input) => createAuthoredSession(input, featSessionConfig),
  normalizeForSubmit: normalizeFeatForSubmit,
  resolveCreateSystemId: resolveCreateFeatSystemId,
  toFormValues: normalizeFeatForSubmit
} satisfies AuthoredFormFactory<FeatAuthoringInputDto, FeatAuthoringInputDto, FeatAuthoredDto>

const raceFormFactory = {
  ...createFormFactoryBase({
    domain: 'race',
    subjectKindLabel: 'Race'
  }),
  createEmptyValues: createEmptyRace,
  createSession: (input) => createAuthoredSession(input, raceSessionConfig),
  normalizeForSubmit: normalizeRaceForSubmit,
  resolveCreateSystemId: resolveCreateRaceSystemId,
  toFormValues: toRaceFormValues
} satisfies AuthoredFormFactory<RaceFormValues, RaceAuthoringInputDto, RaceAuthoredDto>

const spellFormFactory = {
  ...createFormFactoryBase({
    domain: 'spell',
    subjectKindLabel: 'Spell'
  }),
  createEmptyValues: createEmptySpell,
  createSession: (input) => createAuthoredSession(input, spellSessionConfig),
  normalizeForSubmit: normalizeSpellForSubmit,
  resolveCreateSystemId: (systems) => systems[0]?.id ?? null,
  toFormValues: (spell: SpellAuthoringInputDto | SpellAuthoredDto) => spell
} satisfies AuthoredFormFactory<
  SpellAuthoringInputDto | SpellAuthoredDto,
  SpellAuthoringInputDto,
  SpellAuthoredDto
>

const vehicleFormFactory = {
  ...createFormFactoryBase({
    domain: 'vehicle',
    subjectKindLabel: 'Vehicle'
  }),
  createEmptyValues: createEmptyVehicle,
  createSession: (input) => createAuthoredSession(input, vehicleSessionConfig),
  normalizeForSubmit: normalizeVehicleForSubmit,
  resolveCreateSystemId: resolveCreateVehicleSystemId,
  toFormValues: toVehicleFormValues
} satisfies AuthoredFormFactory<VehicleFormValues, VehicleAuthoringInputDto, VehicleAuthoredDto>

export const authoredFormFactories = {
  background: backgroundFormFactory,
  class: classFormFactory,
  creature: creatureFormFactory,
  equipment: equipmentFormFactory,
  feat: featFormFactory,
  race: raceFormFactory,
  spell: spellFormFactory,
  vehicle: vehicleFormFactory
} satisfies Record<AuthoredFormDomain, AuthoredFormFactoryBase>

function createFormFactoryBase({
  domain,
  subjectKindLabel
}: {
  domain: AuthoredFormDomain
  subjectKindLabel: string
}): AuthoredFormFactoryBase {
  return {
    domain,
    fallbackLabel: `Untitled ${subjectKindLabel}`,
    mapId: domain,
    subjectKindLabel
  }
}

const backgroundSessionConfig = {
  actionFactory: authoredFormActionFactories.background,
  createEmptyValues: createEmptyBackground,
  domain: 'background',
  getCreateSystems: (data) => data.systems,
  normalizeForSubmit: (values) => normalizeBackgroundForSubmit(values),
  operations: {
    activate: api.content.backgrounds.activate,
    deleteActive: api.content.backgrounds.deleteActive,
    discardDraft: api.content.backgrounds.discardDraft,
    duplicate: api.content.backgrounds.duplicate,
    saveDraft: api.content.backgrounds.saveDraft
  },
  queryKeys: globalQueryKeys.content.backgrounds,
  resolveCreateSystemId: (systems) => resolveCreateBackgroundSystemId(systems),
  schema: backgroundAuthoringInputDtoSchema,
  subjectKindLabel: 'Background',
  toCreateData: toSystemCreateData,
  toEditData,
  toFormValues: (record) => normalizeBackgroundForSubmit(record)
} satisfies AuthoredSessionConfig<
  BackgroundAuthoringInputDto,
  BackgroundAuthoringInputDto,
  BackgroundAuthoredDto,
  AuthoredFormSystemCreateData,
  AuthoredFormEditData<BackgroundAuthoredDto>
>

const classSessionConfig = {
  actionFactory: authoredFormActionFactories.class,
  createEmptyValues: createEmptyClass,
  domain: 'class',
  getCreateSystems: (data) => data.systems,
  normalizeForSubmit: (values) => normalizeClassForSubmit(values),
  operations: {
    activate: api.content.classes.activate,
    deleteActive: api.content.classes.deleteActive,
    discardDraft: api.content.classes.discardDraft,
    duplicate: api.content.classes.duplicate,
    saveDraft: api.content.classes.saveDraft
  },
  queryKeys: globalQueryKeys.content.classes,
  resolveCreateSystemId: (systems) => resolveCreateClassSystemId(systems),
  schema: classAuthoringInputDtoSchema,
  subjectKindLabel: 'Class',
  toCreateData: toSystemCreateData,
  toEditData,
  toFormValues: (record) => toClassFormValues(record)
} satisfies AuthoredSessionConfig<
  ClassFormValues,
  ClassAuthoringInputDto,
  ClassAuthoredDto,
  AuthoredFormSystemCreateData,
  AuthoredFormEditData<ClassAuthoredDto>
>

const creatureSessionConfig = {
  actionFactory: authoredFormActionFactories.creature,
  createEmptyValues: createEmptyCreature,
  domain: 'creature',
  getCreateSystems: (data) => data.systems,
  normalizeForSubmit: (values) => normalizeCreatureForSubmit(values),
  operations: {
    activate: api.content.creatures.activate,
    deleteActive: api.content.creatures.deleteActive,
    discardDraft: api.content.creatures.discardDraft,
    duplicate: api.content.creatures.duplicate,
    saveDraft: api.content.creatures.saveDraft
  },
  queryKeys: globalQueryKeys.content.creatures,
  resolveCreateSystemId: (systems) => resolveCreateCreatureSystemId(systems),
  schema: creatureAuthoringInputDtoSchema,
  subjectKindLabel: 'Creature',
  toCreateData: toSystemCreateData,
  toEditData,
  toFormValues: (record) => toCreatureFormValues(record)
} satisfies AuthoredSessionConfig<
  CreatureFormValues,
  CreatureAuthoringInputDto,
  CreatureAuthoredDto,
  AuthoredFormSystemCreateData,
  AuthoredFormEditData<CreatureAuthoredDto>
>

const equipmentSessionConfig = {
  actionFactory: authoredFormActionFactories.equipment,
  createEmptyValues: createEmptyEquipment,
  domain: 'equipment',
  getCreateContext: () => ({}),
  getCreateSystems: (data) => data.systems,
  getEditContext: (data) => ({ parentEquipment: data.parentResponse?.item ?? undefined }),
  normalizeForSubmit: (values) => normalizeEquipmentForSubmit(values),
  operations: {
    activate: api.content.equipment.activate,
    deleteActive: api.content.equipment.deleteActive,
    discardDraft: api.content.equipment.discardDraft,
    duplicate: api.content.equipment.duplicate,
    saveDraft: api.content.equipment.saveDraft
  },
  queryKeys: globalQueryKeys.content.equipment,
  resolveCreateSystemId: (systems) => resolveCreateEquipmentSystemId(systems),
  renderPreview: (previewContext, context) => {
    const parentEquipment = context.parentEquipment
    const selectedParentId =
      previewContext.values.category === 'VARIANT'
        ? previewContext.values.parentEquipmentId
        : undefined

    if (selectedParentId && selectedParentId !== parentEquipment?.id) {
      return createElement(EquipmentParentPreview, {
        context: previewContext,
        parentEquipmentId: selectedParentId
      })
    }

    return renderEquipmentPreview(previewContext, parentEquipment)
  },
  schema: equipmentAuthoringInputDtoSchema,
  subjectKindLabel: 'Equipment',
  toCreateData: toSystemCreateData,
  toEditData,
  toFormValues: (record) => toEquipmentFormValues(record)
} satisfies AuthoredSessionConfig<
  EquipmentFormValues,
  EquipmentAuthoringInputDto,
  EquipmentAuthoredDto,
  AuthoredFormSystemCreateData,
  EquipmentFormEditData,
  EquipmentFormContext
>

const featSessionConfig = {
  actionFactory: authoredFormActionFactories.feat,
  createEmptyValues: createEmptyFeat,
  domain: 'feat',
  getCreateSystems: (data) => data.systems,
  normalizeForSubmit: (values) => normalizeFeatForSubmit(values),
  operations: {
    activate: api.content.feats.activate,
    deleteActive: api.content.feats.deleteActive,
    discardDraft: api.content.feats.discardDraft,
    duplicate: api.content.feats.duplicate,
    saveDraft: api.content.feats.saveDraft
  },
  queryKeys: globalQueryKeys.content.feats,
  resolveCreateSystemId: (systems) => resolveCreateFeatSystemId(systems),
  schema: featAuthoringInputDtoSchema,
  subjectKindLabel: 'Feat',
  toCreateData: toSystemCreateData,
  toEditData,
  toFormValues: (record) => normalizeFeatForSubmit(record)
} satisfies AuthoredSessionConfig<
  FeatAuthoringInputDto,
  FeatAuthoringInputDto,
  FeatAuthoredDto,
  AuthoredFormSystemCreateData,
  AuthoredFormEditData<FeatAuthoredDto>
>

const raceSessionConfig = {
  actionFactory: authoredFormActionFactories.race,
  createEmptyValues: createEmptyRace,
  domain: 'race',
  getCreateSystems: (data) => data.systems,
  normalizeForSubmit: (values) => normalizeRaceForSubmit(values),
  operations: {
    activate: api.content.races.activate,
    deleteActive: api.content.races.deleteActive,
    discardDraft: api.content.races.discardDraft,
    duplicate: api.content.races.duplicate,
    saveDraft: api.content.races.saveDraft
  },
  queryKeys: globalQueryKeys.content.races,
  resolveCreateSystemId: (systems) => resolveCreateRaceSystemId(systems),
  schema: raceAuthoringInputDtoSchema,
  subjectKindLabel: 'Race',
  toCreateData: toSystemCreateData,
  toEditData,
  toFormValues: (record) => toRaceFormValues(record)
} satisfies AuthoredSessionConfig<
  RaceFormValues,
  RaceAuthoringInputDto,
  RaceAuthoredDto,
  AuthoredFormSystemCreateData,
  AuthoredFormEditData<RaceAuthoredDto>
>

const spellSessionConfig = {
  actionFactory: authoredFormActionFactories.spell,
  createEmptyValues: ({ systemId }, context) =>
    createEmptySpell({ magicSchoolId: context.magicSchoolId, systemId }),
  domain: 'spell',
  getCreateContext: getSpellFormContext,
  getCreateSystems: (data) => data.systems,
  getEditContext: getSpellFormContext,
  normalizeForSubmit: (values, context) => normalizeSpellForSubmit(values, context.magicSchoolId),
  operations: {
    activate: api.content.spells.activate,
    deleteActive: api.content.spells.deleteActive,
    discardDraft: api.content.spells.discardDraft,
    duplicate: api.content.spells.duplicate,
    saveDraft: api.content.spells.saveDraft
  },
  queryKeys: globalQueryKeys.content.spells,
  resolveCreateSystemId: (systems) => systems[0]?.id ?? null,
  schema: spellAuthoringInputDtoSchema,
  subjectKindLabel: 'Spell',
  toCreateData: toSystemCreateData,
  toEditData,
  toFormValues: (record, context) => ({
    ...record,
    magicSchoolId: record.magicSchoolId || context.magicSchoolId || ''
  })
} satisfies AuthoredSessionConfig<
  SpellAuthoringInputDto | SpellAuthoredDto,
  SpellAuthoringInputDto,
  SpellAuthoredDto,
  AuthoredFormSystemCreateData,
  AuthoredFormEditData<SpellAuthoredDto>,
  SpellFormContext
>

const vehicleSessionConfig = {
  actionFactory: authoredFormActionFactories.vehicle,
  createEmptyValues: createEmptyVehicle,
  domain: 'vehicle',
  getCreateSystems: (data) => data.systems,
  normalizeForSubmit: (values) => normalizeVehicleForSubmit(values),
  operations: {
    activate: api.content.vehicles.activate,
    deleteActive: api.content.vehicles.deleteActive,
    discardDraft: api.content.vehicles.discardDraft,
    duplicate: api.content.vehicles.duplicate,
    saveDraft: api.content.vehicles.saveDraft
  },
  queryKeys: globalQueryKeys.content.vehicles,
  resolveCreateSystemId: (systems) => resolveCreateVehicleSystemId(systems),
  schema: vehicleAuthoringInputDtoSchema,
  subjectKindLabel: 'Vehicle',
  toCreateData: toSystemCreateData,
  toEditData,
  toFormValues: (record) => toVehicleFormValues(record)
} satisfies AuthoredSessionConfig<
  VehicleFormValues,
  VehicleAuthoringInputDto,
  VehicleAuthoredDto,
  AuthoredFormSystemCreateData,
  AuthoredFormEditData<VehicleAuthoredDto>
>

function toSystemCreateData(data: unknown): AuthoredFormSystemCreateData {
  if (isObjectValue(data) && Array.isArray(data.systems)) {
    return {
      system: isSystemResponse(data.system) ? data.system : null,
      systems: data.systems as readonly { id: string }[]
    }
  }

  return { systems: [] }
}

function toEditData<TAuthored extends object>(data: unknown): AuthoredFormEditData<TAuthored> {
  if (isObjectValue(data) && typeof data.subjectId === 'string') {
    return data as AuthoredFormEditData<TAuthored>
  }

  return {
    draft: null,
    response: null,
    subjectId: ''
  }
}

type SpellFormContext = {
  magicSchoolId: string
}

function getSpellFormContext(data: { system?: SystemResponseDto | null }): SpellFormContext {
  return {
    magicSchoolId: data.system?.magicSchools[0]?.id ?? ''
  }
}

function isSystemResponse(value: unknown): value is SystemResponseDto {
  return value === null || isObjectValue(value)
}
