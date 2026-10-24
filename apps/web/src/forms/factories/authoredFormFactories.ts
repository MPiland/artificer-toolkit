import { createElement } from 'react'
import type { EquipmentResponseDto } from '@artificer-toolkit/schema/api/content'
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
import { createAuthoredOperations } from '#app/data/authoredOperations'
import { queryKeys as globalQueryKeys } from '#app/lib/queryKeys'
import {
  createEmptyBackground,
  normalizeBackgroundForSubmit
} from '../../domains/backgrounds/backgroundAuthoring.utils'
import {
  createEmptyClass,
  normalizeClassForSubmit,
  toClassFormValues,
  type ClassFormValues
} from '../../domains/classes/classAuthoring.utils'
import {
  createEmptyCreature,
  normalizeCreatureForSubmit,
  toCreatureFormValues,
  type CreatureFormValues
} from '../../domains/creatures/creatureAuthoring.utils'
import {
  createEmptyEquipment,
  normalizeEquipmentForSubmit,
  toEquipmentFormValues,
  type EquipmentFormValues
} from '../../domains/equipment/equipmentAuthoring.utils'
import { createEmptyFeat, normalizeFeatForSubmit } from '../../domains/feats/featAuthoring.utils'
import {
  createEmptyRace,
  normalizeRaceForSubmit,
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
  toVehicleFormValues,
  type VehicleFormValues
} from '../../domains/vehicles/vehicleAuthoring.utils'
import type { AuthoredFormDomain } from './authoredFormFactories.types'
import {
  defineAuthoredForm,
  noAuthoredFormContext,
  type AuthoredFormCreateData,
  type AuthoredFormEditData
} from './authoredFormSessionFactory'
import { EquipmentParentPreview } from '../previews/EquipmentParentPreview'
import { renderEquipmentPreview } from '../previews/equipmentParentPreview.utils'

type EquipmentFormEditData = AuthoredFormEditData<EquipmentAuthoredDto> & {
  parentResponse?: EquipmentResponseDto | null
}

type EquipmentFormContext = {
  parentEquipment?: EquipmentAuthoredDto
}

type SpellFormContext = {
  magicSchoolId: string
}

type AuthoredFormDomainDataByDomain = {
  background: { edit: AuthoredFormEditData<BackgroundAuthoredDto> }
  class: { edit: AuthoredFormEditData<ClassAuthoredDto> }
  creature: { edit: AuthoredFormEditData<CreatureAuthoredDto> }
  equipment: { edit: EquipmentFormEditData }
  feat: { edit: AuthoredFormEditData<FeatAuthoredDto> }
  race: { edit: AuthoredFormEditData<RaceAuthoredDto> }
  spell: { edit: AuthoredFormEditData<SpellAuthoredDto> }
  vehicle: { edit: AuthoredFormEditData<VehicleAuthoredDto> }
}

export type AuthoredFormDomainRegistration =
  | {
      [Domain in AuthoredFormDomain]: {
        data: AuthoredFormCreateData
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

function getSpellFormContext(data: Pick<AuthoredFormCreateData, 'system'>): SpellFormContext {
  return {
    magicSchoolId: data.system?.magicSchools[0]?.id ?? ''
  }
}

export const authoredFormFactories = {
  background: defineAuthoredForm<
    BackgroundAuthoringInputDto,
    BackgroundAuthoringInputDto,
    BackgroundAuthoredDto
  >({
    context: noAuthoredFormContext,
    createEmptyValues: createEmptyBackground,
    createOperations: (client) => createAuthoredOperations('BACKGROUND', client),
    domain: 'background',
    normalizeForSubmit: normalizeBackgroundForSubmit,
    queryKeys: globalQueryKeys.content.backgrounds,
    schema: backgroundAuthoringInputDtoSchema,
    toFormValues: normalizeBackgroundForSubmit
  }),
  class: defineAuthoredForm<ClassFormValues, ClassAuthoringInputDto, ClassAuthoredDto>({
    context: noAuthoredFormContext,
    createEmptyValues: createEmptyClass,
    createOperations: (client) => createAuthoredOperations('CLASS', client),
    domain: 'class',
    normalizeForSubmit: normalizeClassForSubmit,
    queryKeys: globalQueryKeys.content.classes,
    schema: classAuthoringInputDtoSchema,
    toFormValues: toClassFormValues
  }),
  creature: defineAuthoredForm<CreatureFormValues, CreatureAuthoringInputDto, CreatureAuthoredDto>({
    context: noAuthoredFormContext,
    createEmptyValues: createEmptyCreature,
    createOperations: (client) => createAuthoredOperations('CREATURE', client),
    domain: 'creature',
    normalizeForSubmit: normalizeCreatureForSubmit,
    queryKeys: globalQueryKeys.content.creatures,
    schema: creatureAuthoringInputDtoSchema,
    toFormValues: toCreatureFormValues
  }),
  equipment: defineAuthoredForm<
    EquipmentFormValues,
    EquipmentAuthoringInputDto,
    EquipmentAuthoredDto,
    EquipmentFormEditData,
    EquipmentFormContext
  >({
    context: {
      fromCreate: () => ({}),
      fromEdit: (data) => ({ parentEquipment: data.parentResponse?.item ?? undefined })
    },
    createEmptyValues: createEmptyEquipment,
    createOperations: (client) => createAuthoredOperations('EQUIPMENT', client),
    domain: 'equipment',
    normalizeForSubmit: normalizeEquipmentForSubmit,
    queryKeys: globalQueryKeys.content.equipment,
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
    toFormValues: toEquipmentFormValues
  }),
  feat: defineAuthoredForm<FeatAuthoringInputDto, FeatAuthoringInputDto, FeatAuthoredDto>({
    context: noAuthoredFormContext,
    createEmptyValues: createEmptyFeat,
    createOperations: (client) => createAuthoredOperations('FEAT', client),
    domain: 'feat',
    normalizeForSubmit: normalizeFeatForSubmit,
    queryKeys: globalQueryKeys.content.feats,
    schema: featAuthoringInputDtoSchema,
    toFormValues: normalizeFeatForSubmit
  }),
  race: defineAuthoredForm<RaceFormValues, RaceAuthoringInputDto, RaceAuthoredDto>({
    context: noAuthoredFormContext,
    createEmptyValues: createEmptyRace,
    createOperations: (client) => createAuthoredOperations('RACE', client),
    domain: 'race',
    normalizeForSubmit: normalizeRaceForSubmit,
    queryKeys: globalQueryKeys.content.races,
    schema: raceAuthoringInputDtoSchema,
    toFormValues: toRaceFormValues
  }),
  spell: defineAuthoredForm<
    SpellAuthoringInputDto | SpellAuthoredDto,
    SpellAuthoringInputDto,
    SpellAuthoredDto,
    AuthoredFormEditData<SpellAuthoredDto>,
    SpellFormContext
  >({
    context: { fromCreate: getSpellFormContext, fromEdit: getSpellFormContext },
    createEmptyValues: ({ systemId }, context) =>
      createEmptySpell({ magicSchoolId: context.magicSchoolId, systemId }),
    createOperations: (client) => createAuthoredOperations('SPELL', client),
    domain: 'spell',
    normalizeForSubmit: (values, context) => normalizeSpellForSubmit(values, context.magicSchoolId),
    queryKeys: globalQueryKeys.content.spells,
    schema: spellAuthoringInputDtoSchema,
    toFormValues: (record, context) => ({
      ...record,
      magicSchoolId: record.magicSchoolId || context.magicSchoolId || ''
    })
  }),
  vehicle: defineAuthoredForm<VehicleFormValues, VehicleAuthoringInputDto, VehicleAuthoredDto>({
    context: noAuthoredFormContext,
    createEmptyValues: createEmptyVehicle,
    createOperations: (client) => createAuthoredOperations('VEHICLE', client),
    domain: 'vehicle',
    normalizeForSubmit: normalizeVehicleForSubmit,
    queryKeys: globalQueryKeys.content.vehicles,
    schema: vehicleAuthoringInputDtoSchema,
    toFormValues: toVehicleFormValues
  })
} satisfies Record<AuthoredFormDomain, { domain: AuthoredFormDomain }>
