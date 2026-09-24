import type { AuthoredSubjectKind } from '@artificer-toolkit/schema/projections/identity'
import {
  AUTHORING_SELECTION_KIND,
  GRANT_KIND,
  PROFICIENCY_KIND
} from '@artificer-toolkit/shared/core'
import {
  getCharacterChosenGrantSelectionIdentityKey,
  isSameCharacterProvenanceIdentity,
  type CharacterAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import { getCharacterChosenGrantOwners } from './builderEligibility.js'
import type { CharacterBuilderContext } from './builderTypes.js'
import {
  collectCharacterBuilderFeatures,
  collectGrantedFeaturesForCharacter
} from './characterBuilderSelections.js'

/** Authored targets are qualified by grant identity; System vocabulary is not an authored root. */
export function getCharacterAuthoredChoiceKinds(
  character: CharacterAuthored,
  context: Pick<CharacterBuilderContext, 'registry'>
): ReadonlyMap<string, AuthoredSubjectKind> {
  const {
    classSelections,
    selectedBackground,
    grantedFeatures: structuralFeatures
  } = collectGrantedFeaturesForCharacter(character, context.registry)
  const grantedFeatures = collectCharacterBuilderFeatures(
    character,
    context.registry,
    structuralFeatures
  )
  const owners = getCharacterChosenGrantOwners(
    character,
    classSelections,
    selectedBackground,
    grantedFeatures,
    context.registry.feats ?? []
  )
  const kinds = new Map<string, AuthoredSubjectKind>()
  for (const selection of character.intent.chosenGrantSelections ?? []) {
    const grant = owners
      .filter((owner) => isSameCharacterProvenanceIdentity(owner.source, selection.source))
      .flatMap((owner) => [
        ...(owner.grants.proficiencies ?? []),
        ...(owner.grants.spells ?? []),
        ...(owner.grants.feats ?? [])
      ])
      .find(
        (entry) =>
          entry.id === selection.grantId && entry.selectionKind === AUTHORING_SELECTION_KIND.CHOSEN
      )
    if (!grant) continue
    const kind =
      grant.grantKind === GRANT_KIND.SPELL_GRANT
        ? 'SPELL'
        : grant.grantKind === GRANT_KIND.FEAT_GRANT
          ? 'FEAT'
          : grant.grantKind === GRANT_KIND.PROFICIENCY_GRANT &&
              grant.proficiencyKind === PROFICIENCY_KIND.EQUIPMENT
            ? 'EQUIPMENT'
            : undefined
    if (kind) kinds.set(getCharacterChosenGrantSelectionIdentityKey(selection), kind)
  }
  return kinds
}
