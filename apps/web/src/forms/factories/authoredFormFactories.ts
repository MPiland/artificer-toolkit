import type { ReactNode } from 'react'
import type { z } from 'zod'
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
import { parseAuthoredDraftPayload } from '#app/data/authoredDrafts'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
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
  AuthoredFormPreviewContext,
  AuthoredFormDomain,
  AuthoredFormFactory,
  AuthoredFormFactoryBase,
  AuthoredFormSession,
  AuthoredFormSessionInput
} from './authoredFormFactories.types'
import { authoredFormActionFactories } from '../actions/authoredFormActionFactories'
import { authoredPreviewFactories } from '../previews/authoredPreviewFactories'

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
  parentEquipment: EquipmentAuthoredDto | null
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
  createSession: createBackgroundSession,
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
  createSession: createClassSession,
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
  createSession: createCreatureSession,
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
  createSession: createEquipmentSession,
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
  createSession: createFeatSession,
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
  createSession: createRaceSession,
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
  createSession: createSpellSession,
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
  createSession: createVehicleSession,
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
  queryKeys: queryKeys.content.backgrounds,
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
  queryKeys: queryKeys.content.classes,
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
  queryKeys: queryKeys.content.creatures,
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
  getCreateContext: () => ({ parentEquipment: null }),
  getCreateSystems: (data) => data.systems,
  getEditContext: (data) => ({ parentEquipment: data.parentResponse?.item ?? null }),
  normalizeForSubmit: (values) => normalizeEquipmentForSubmit(values),
  operations: {
    activate: api.content.equipment.activate,
    deleteActive: api.content.equipment.deleteActive,
    discardDraft: api.content.equipment.discardDraft,
    duplicate: api.content.equipment.duplicate,
    saveDraft: api.content.equipment.saveDraft
  },
  queryKeys: queryKeys.content.equipment,
  resolveCreateSystemId: (systems) => resolveCreateEquipmentSystemId(systems),
  renderPreview: (previewContext, context) => {
    const parentEquipment = context.parentEquipment
    const inheritedEconomy =
      parentEquipment &&
      previewContext.values.category === 'VARIANT' &&
      parentEquipment.category !== 'VARIANT' &&
      previewContext.values.parentEquipmentId === parentEquipment.id
        ? {
            cost: parentEquipment.cost,
            weight: parentEquipment.weight
          }
        : undefined

    return authoredPreviewFactories.equipment({
      ...previewContext,
      values: {
        ...previewContext.values,
        ...inheritedEconomy
      }
    })
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
  queryKeys: queryKeys.content.feats,
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
  queryKeys: queryKeys.content.races,
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
  queryKeys: queryKeys.content.spells,
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
  queryKeys: queryKeys.content.vehicles,
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

function createBackgroundSession(input: AuthoredFormSessionInput): AuthoredFormSession {
  return createAuthoredSession(input, backgroundSessionConfig)
}

function createClassSession(input: AuthoredFormSessionInput): AuthoredFormSession {
  return createAuthoredSession(input, classSessionConfig)
}

function createCreatureSession(input: AuthoredFormSessionInput): AuthoredFormSession {
  return createAuthoredSession(input, creatureSessionConfig)
}

function createEquipmentSession(input: AuthoredFormSessionInput): AuthoredFormSession {
  return createAuthoredSession(input, equipmentSessionConfig)
}

function createFeatSession(input: AuthoredFormSessionInput): AuthoredFormSession {
  return createAuthoredSession(input, featSessionConfig)
}

function createRaceSession(input: AuthoredFormSessionInput): AuthoredFormSession {
  return createAuthoredSession(input, raceSessionConfig)
}

function createSpellSession(input: AuthoredFormSessionInput): AuthoredFormSession {
  return createAuthoredSession(input, spellSessionConfig)
}

function createVehicleSession(input: AuthoredFormSessionInput): AuthoredFormSession {
  return createAuthoredSession(input, vehicleSessionConfig)
}

type AuthoredFormValuesBase = {
  label?: string | null
  systemId: string
}

type AuthoredFormSubmitBase = AuthoredFormValuesBase & {
  id: string
  label: string
}

type AuthoredFormQueryKeys = {
  all: () => readonly unknown[]
  detail: (id: string) => readonly unknown[]
  detailRoot: (id: string) => readonly unknown[]
  draft: (id: string) => readonly unknown[]
}

type AuthoredFormOperations<TSubmit extends object> = {
  activate: (payload: TSubmit) => ReturnType<AuthoredFormSession['operations']['activate']>
  deleteActive: (id: string) => Promise<unknown>
  discardDraft: (id: string) => Promise<unknown>
  duplicate: NonNullable<AuthoredFormSession['operations']['duplicate']>
  saveDraft: (payload: TSubmit) => ReturnType<AuthoredFormSession['operations']['saveDraft']>
}

type AuthoredSessionConfig<
  TValues extends AuthoredFormValuesBase,
  TSubmit extends AuthoredFormSubmitBase,
  TAuthored extends AuthoredFormValuesBase,
  TCreateData,
  TEditData extends AuthoredFormEditData<TAuthored>,
  TContext = undefined
> = {
  actionFactory: (typeof authoredFormActionFactories)[AuthoredFormDomain]
  createEmptyValues: (input: { systemId: string }, context: TContext) => TValues
  domain: AuthoredFormDomain
  getCreateContext?: (data: TCreateData) => TContext
  getCreateSystems: (data: TCreateData) => readonly { id: string }[]
  getEditContext?: (data: TEditData) => TContext
  normalizeForSubmit: (values: TValues, context: TContext) => TSubmit
  operations: AuthoredFormOperations<TSubmit>
  queryKeys: AuthoredFormQueryKeys
  renderPreview?: (
    context: AuthoredFormPreviewContext<TValues>,
    sessionContext: TContext
  ) => ReactNode
  resolveCreateSystemId: (systems: readonly { id: string }[], context: TContext) => string | null
  schema: z.ZodType<TSubmit>
  subjectKindLabel: string
  toCreateData: (data: unknown) => TCreateData
  toEditData: (data: unknown) => TEditData
  toFormValues: (record: TValues | TSubmit | TAuthored, context: TContext) => TValues
}

function createAuthoredSession<
  TValues extends AuthoredFormValuesBase,
  TSubmit extends AuthoredFormSubmitBase,
  TAuthored extends AuthoredFormValuesBase,
  TCreateData extends { system?: SystemResponseDto | null },
  TEditData extends AuthoredFormEditData<TAuthored>,
  TContext
>(
  { data, mode }: AuthoredFormSessionInput,
  config: AuthoredSessionConfig<TValues, TSubmit, TAuthored, TCreateData, TEditData, TContext>
): AuthoredFormSession {
  if (mode === 'create') {
    return createAuthoredCreateSession(data, config)
  }

  return createAuthoredEditSession(data, mode, config)
}

function createAuthoredCreateSession<
  TValues extends AuthoredFormValuesBase,
  TSubmit extends AuthoredFormSubmitBase,
  TAuthored extends AuthoredFormValuesBase,
  TCreateData extends { system?: SystemResponseDto | null },
  TEditData extends AuthoredFormEditData<TAuthored>,
  TContext
>(
  data: unknown,
  config: AuthoredSessionConfig<TValues, TSubmit, TAuthored, TCreateData, TEditData, TContext>
): AuthoredFormSession {
  const createData = config.toCreateData(data)
  const context = getCreateContext(config, createData)
  const systemId = config.resolveCreateSystemId(config.getCreateSystems(createData), context) ?? ''
  const initialValues = config.createEmptyValues({ systemId }, context)

  return createAuthoredSessionBase({
    config,
    context,
    canCopy: false,
    canDelete: false,
    canSaveDraft: Boolean(systemId),
    hasActiveDraft: false,
    hasInvalidDraft: false,
    initialValues,
    invalidDraftOnly: false,
    isDraft: false,
    key: `${config.actionFactory.subjectKindLabel.toLowerCase()}:create:${systemId || 'missing-system'}`,
    mode: 'create',
    notFound: false,
    provenanceKind: 'OWNED',
    readOnly: false,
    subjectLabel: initialValues.label || `Untitled ${config.actionFactory.subjectKindLabel}`,
    system: createData.system ?? null,
    systemId,
    systemRequired: !systemId
  })
}

function createAuthoredEditSession<
  TValues extends AuthoredFormValuesBase,
  TSubmit extends AuthoredFormSubmitBase,
  TAuthored extends AuthoredFormValuesBase,
  TCreateData extends { system?: SystemResponseDto | null },
  TEditData extends AuthoredFormEditData<TAuthored>,
  TContext
>(
  data: unknown,
  requestedMode: AuthoredFormSession['mode'],
  config: AuthoredSessionConfig<TValues, TSubmit, TAuthored, TCreateData, TEditData, TContext>
): AuthoredFormSession {
  const editData = config.toEditData(data)
  const context = getEditContext(config, editData)
  const parsedDraft = parseAuthoredDraftPayload(editData.draft ?? null, config.schema)
  const draftItem = parsedDraft.item
  const activeRecord = editData.response?.item ?? undefined
  const record = draftItem ?? activeRecord ?? null
  const initialValues = record
    ? config.toFormValues(record, context)
    : config.createEmptyValues(
        { systemId: activeRecord?.systemId ?? draftItem?.systemId ?? '' },
        context
      )
  const readOnly =
    requestedMode === 'view' ||
    Boolean(activeRecord && editData.response?.permissions?.canEdit === false)
  const canCopy = Boolean(editData.response?.permissions?.canCopy && editData.subjectId)
  const canDelete =
    !readOnly && Boolean(parsedDraft.draft || editData.response?.permissions?.canDelete)
  const invalidDraftOnly = !editData.response && parsedDraft.isInvalid
  const subjectKindLabel = config.actionFactory.subjectKindLabel

  return createAuthoredSessionBase({
    config,
    context,
    activeRecord,
    canCopy,
    canDelete,
    canSaveDraft: !readOnly,
    draft: parsedDraft.draft,
    hasActiveDraft: Boolean(parsedDraft.draft && activeRecord),
    hasInvalidDraft: Boolean(editData.draft && parsedDraft.isInvalid),
    initialValues,
    invalidDraftOnly,
    isDraft: Boolean(parsedDraft.draft),
    key: `${subjectKindLabel.toLowerCase()}:edit:${editData.subjectId}:${editData.draft?.updatedAt ?? editData.subjectId}:${
      draftItem ? 'draft' : 'active'
    }`,
    mode: readOnly ? 'view' : 'edit',
    notFound: !editData.response && !draftItem && !invalidDraftOnly,
    provenanceKind: editData.response?.provenance?.kind ?? (editData.draft ? 'OWNED' : null),
    readOnly,
    subjectId: editData.subjectId,
    subjectLabel: initialValues.label || `Untitled ${subjectKindLabel}`,
    system: editData.system ?? null,
    systemId: initialValues.systemId,
    systemRequired: false
  })
}

function createAuthoredSessionBase<
  TValues extends AuthoredFormValuesBase,
  TSubmit extends AuthoredFormSubmitBase,
  TAuthored extends AuthoredFormValuesBase,
  TCreateData,
  TEditData extends AuthoredFormEditData<TAuthored>,
  TContext
>({
  activeRecord,
  canCopy,
  canDelete,
  canSaveDraft,
  config,
  context,
  draft = null,
  hasActiveDraft,
  hasInvalidDraft,
  initialValues,
  invalidDraftOnly,
  isDraft,
  key,
  mode,
  notFound,
  provenanceKind,
  readOnly,
  subjectId,
  subjectLabel,
  system,
  systemId,
  systemRequired
}: {
  activeRecord?: TAuthored | null
  canCopy: boolean
  canDelete: boolean
  canSaveDraft: boolean
  config: AuthoredSessionConfig<TValues, TSubmit, TAuthored, TCreateData, TEditData, TContext>
  context: TContext
  draft?: AuthoredDraftDto | null
  hasActiveDraft: boolean
  hasInvalidDraft: boolean
  initialValues: TValues
  invalidDraftOnly: boolean
  isDraft: boolean
  key: string
  mode: AuthoredFormSession['mode']
  notFound: boolean
  provenanceKind: AuthoredFormSession['provenanceKind']
  readOnly: boolean
  subjectId?: string
  subjectLabel: ReactNode
  system?: SystemResponseDto | null
  systemId?: string
  systemRequired: boolean
}): AuthoredFormSession {
  const { actionFactory, domain, operations, queryKeys, subjectKindLabel } = config
  const renderPreview:
    | ((previewContext: AuthoredFormPreviewContext<TValues>, sessionContext: TContext) => ReactNode)
    | undefined = config.renderPreview ?? authoredPreviewFactories[domain]
  const sessionContext = context

  return {
    actionFactory,
    activeRecord,
    canCopy,
    canDelete,
    canSaveDraft,
    deleteConfig: {
      deleteActive: async (id) => {
        await operations.deleteActive(id)
      },
      deleteDraft: async (id) => {
        await operations.discardDraft(id)
      },
      detailSubjectQueryKey: queryKeys.detailRoot,
      domainQueryKey: queryKeys.all(),
      draftQueryKey: queryKeys.draft
    },
    domain,
    draft,
    fallbackLabel: `Untitled ${subjectKindLabel}`,
    hasActiveDraft,
    hasInvalidDraft,
    initialValues,
    invalidDraftOnly,
    isDraft,
    key,
    mapId: domain,
    mode,
    normalizeForSubmit: (values) => config.normalizeForSubmit(values as TValues, sessionContext),
    notFound,
    operations: {
      activate: (payload) => operations.activate(payload as TSubmit),
      duplicate: operations.duplicate,
      onActivateSuccess: async (queryClient, response) => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.all() })

        if (response?.item?.id) {
          queryClient.setQueryData(queryKeys.detail(response.item.id), response)
          await queryClient.invalidateQueries({ queryKey: queryKeys.draft(response.item.id) })
        }
      },
      onDiscardDraftSuccess: async (queryClient) => {
        if (!subjectId) return
        await queryClient.invalidateQueries({ queryKey: queryKeys.all() })
        await queryClient.invalidateQueries({ queryKey: queryKeys.draft(subjectId) })
      },
      onDuplicateSuccess: async (queryClient) => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.all() })
      },
      onSaveDraftSuccess: async (queryClient, savedDraft) => {
        if (!savedDraft.subjectId) return
        await queryClient.invalidateQueries({ queryKey: queryKeys.all() })
        await queryClient.invalidateQueries({ queryKey: queryKeys.draft(savedDraft.subjectId) })
      },
      saveDraft: (payload) => operations.saveDraft(payload as TSubmit),
      ...(subjectId ? { discardDraft: () => operations.discardDraft(subjectId) } : {})
    },
    provenanceKind,
    readOnly,
    renderPreview: renderPreview
      ? (previewContext) =>
          renderPreview(
            {
              ...previewContext,
              domain,
              system,
              values: previewContext.values as TValues
            },
            sessionContext
          )
      : undefined,
    subjectId,
    subjectKindLabel,
    subjectLabel,
    system,
    systemId,
    systemRequired
  }
}

function getCreateContext<
  TValues extends AuthoredFormValuesBase,
  TSubmit extends AuthoredFormSubmitBase,
  TAuthored extends AuthoredFormValuesBase,
  TCreateData,
  TEditData extends AuthoredFormEditData<TAuthored>,
  TContext
>(
  config: AuthoredSessionConfig<TValues, TSubmit, TAuthored, TCreateData, TEditData, TContext>,
  data: TCreateData
): TContext {
  return config.getCreateContext ? config.getCreateContext(data) : (undefined as TContext)
}

function getEditContext<
  TValues extends AuthoredFormValuesBase,
  TSubmit extends AuthoredFormSubmitBase,
  TAuthored extends AuthoredFormValuesBase,
  TCreateData,
  TEditData extends AuthoredFormEditData<TAuthored>,
  TContext
>(
  config: AuthoredSessionConfig<TValues, TSubmit, TAuthored, TCreateData, TEditData, TContext>,
  data: TEditData
): TContext {
  return config.getEditContext ? config.getEditContext(data) : (undefined as TContext)
}

function toSystemCreateData(data: unknown): AuthoredFormSystemCreateData {
  if (isRecord(data) && Array.isArray(data.systems)) {
    return {
      system: isSystemResponse(data.system) ? data.system : null,
      systems: data.systems as readonly { id: string }[]
    }
  }

  return { systems: [] }
}

function toEditData<TAuthored extends object>(data: unknown): AuthoredFormEditData<TAuthored> {
  if (isRecord(data) && typeof data.subjectId === 'string') {
    return data as AuthoredFormEditData<TAuthored>
  }

  return {
    draft: null,
    response: null,
    subjectId: ''
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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
  return value === null || isRecord(value)
}
