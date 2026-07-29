import {
  buildBackgroundRouteParams,
  buildClassRouteParams,
  buildCreatureRouteParams,
  buildEquipmentRouteParams,
  buildFeatRouteParams,
  buildRaceRouteParams,
  buildSpellRouteParams,
  buildVehicleRouteParams
} from '#app/routing/authoredRouteParams'
import type { AuthoredFormDomain } from '../factories/authoredFormFactories.types'
import type {
  AuthoringActionMessages,
  AuthoringRouteParamBuilder
} from './authoringActionBuilders.types'

export type AuthoredFormActionFactory = {
  activatePath: string
  buildRouteParams: AuthoringRouteParamBuilder
  editPath: string
  listPath: string
  messages: AuthoringActionMessages
  subjectKindLabel: string
}

export const authoredFormActionFactories = {
  background: createActionFactory({
    buildRouteParams: buildBackgroundRouteParams,
    activatePath: '/backgrounds/$backgroundPublicId/$backgroundSlug',
    editPath: '/backgrounds/$backgroundPublicId/$backgroundSlug/edit',
    label: 'Background',
    listPath: '/backgrounds'
  }),
  class: createActionFactory({
    buildRouteParams: buildClassRouteParams,
    activatePath: '/classes/$classPublicId/$classSlug',
    editPath: '/classes/$classPublicId/$classSlug/edit',
    label: 'Class',
    listPath: '/classes'
  }),
  creature: createActionFactory({
    buildRouteParams: buildCreatureRouteParams,
    activatePath: '/creatures/$creaturePublicId/$creatureSlug',
    editPath: '/creatures/$creaturePublicId/$creatureSlug/edit',
    label: 'Creature',
    listPath: '/creatures'
  }),
  equipment: createActionFactory({
    buildRouteParams: buildEquipmentRouteParams,
    activatePath: '/equipment/$equipmentPublicId/$equipmentSlug',
    editPath: '/equipment/$equipmentPublicId/$equipmentSlug/edit',
    label: 'Equipment',
    listPath: '/equipment'
  }),
  feat: createActionFactory({
    buildRouteParams: buildFeatRouteParams,
    activatePath: '/feats/$featPublicId/$featSlug',
    editPath: '/feats/$featPublicId/$featSlug/edit',
    label: 'Feat',
    listPath: '/feats'
  }),
  race: createActionFactory({
    buildRouteParams: buildRaceRouteParams,
    activatePath: '/races/$racePublicId/$raceSlug',
    editPath: '/races/$racePublicId/$raceSlug/edit',
    label: 'Race',
    listPath: '/races'
  }),
  spell: createActionFactory({
    buildRouteParams: buildSpellRouteParams,
    activatePath: '/spells/$spellPublicId/$spellSlug',
    editPath: '/spells/$spellPublicId/$spellSlug/edit',
    label: 'Spell',
    listPath: '/spells'
  }),
  vehicle: createActionFactory({
    buildRouteParams: buildVehicleRouteParams,
    activatePath: '/vehicles/$vehiclePublicId/$vehicleSlug',
    editPath: '/vehicles/$vehiclePublicId/$vehicleSlug/edit',
    label: 'Vehicle',
    listPath: '/vehicles'
  })
} satisfies Record<AuthoredFormDomain, AuthoredFormActionFactory>

function createActionFactory({
  buildRouteParams,
  activatePath,
  editPath,
  label,
  listPath
}: {
  buildRouteParams: AuthoringRouteParamBuilder
  activatePath: string
  editPath: string
  label: string
  listPath: string
}): AuthoredFormActionFactory {
  const lowerLabel = label.toLowerCase()

  return {
    activatePath,
    buildRouteParams,
    editPath,
    listPath,
    messages: {
      activateError: `Could not activate that ${lowerLabel} yet.`,
      activateSuccess: `${label} activated.`,
      copyError: `Could not duplicate that ${lowerLabel} yet.`,
      copySuccess: `${label} duplicated as an owned draft.`,
      discardDraftError: `Could not discard that draft yet.`,
      discardDraftSuccess: `Stale ${lowerLabel} draft discarded.`,
      saveDraftError: `Could not save that draft yet.`,
      saveDraftSuccess: `${label} draft saved.`
    },
    subjectKindLabel: label
  }
}
