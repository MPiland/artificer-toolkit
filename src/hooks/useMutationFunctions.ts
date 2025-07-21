import {
  useDeleteFeatureMutation,
  useAddNewFeatureMutation,
  useUpdateFeatureMutation,
} from '@/apis/features.api'
import {
  useDeleteFeatureOptionMutation,
  useAddNewFeatureOptionMutation,
  useUpdateFeatureOptionMutation,
} from '@/apis/featureOptions.api'
import {
  useDeleteFeatureExpertiseMutation,
  useAddNewFeatureExpertiseMutation,
  useUpdateFeatureExpertiseMutation,
} from '@/apis/featureExpertise.api'
import {
  useDeleteFeatureSenseMutation,
  useAddNewFeatureSenseMutation,
  useUpdateFeatureSenseMutation,
} from '@/apis/featureSenses.api'
import {
  useDeleteFeatureProficiencyMutation,
  useAddNewFeatureProficiencyMutation,
  useUpdateFeatureProficiencyMutation,
} from '@/apis/featureProficiencies.api'
import {
  useDeleteFeatureSpellMutation,
  useAddNewFeatureSpellMutation,
  useUpdateFeatureSpellMutation,
} from '@/apis/featureSpells.api'
import {
  useDeleteFeatureFeatMutation,
  useAddNewFeatureFeatMutation,
  useUpdateFeatureFeatMutation,
} from '@/apis/featureFeats.api'
import {
  useDeleteFeatureModifierMutation,
  useAddNewFeatureModifierMutation,
  useUpdateFeatureModifierMutation,
} from '@/apis/featureModifiers.api'
import {
  useDeleteAncestryOptionMutation,
  useAddNewAncestryOptionMutation,
  useUpdateAncestryOptionMutation,
} from '@/apis/ancestryOptions.api'

/**
 * Hook that returns all mutation functions organized by entity type.
 * Each entity has add, update, and delete functions available.
 */
export const useMutationFunctions = () => {
  // Feature mutations
  const { mutateAsync: deleteFeature } = useDeleteFeatureMutation()
  const { mutateAsync: addFeature } = useAddNewFeatureMutation()
  const { mutateAsync: updateFeature } = useUpdateFeatureMutation()

  // Ancestry option mutations
  const { mutateAsync: deleteAncestryOption } = useDeleteAncestryOptionMutation()
  const { mutateAsync: addAncestryOption } = useAddNewAncestryOptionMutation()
  const { mutateAsync: updateAncestryOption } = useUpdateAncestryOptionMutation()

  // Feature option mutations
  const { mutateAsync: deleteFeatureOption } = useDeleteFeatureOptionMutation()
  const { mutateAsync: addFeatureOption } = useAddNewFeatureOptionMutation()
  const { mutateAsync: updateFeatureOption } = useUpdateFeatureOptionMutation()

  // Feature expertise mutations
  const { mutateAsync: deleteFeatureExpertise } = useDeleteFeatureExpertiseMutation()
  const { mutateAsync: addFeatureExpertise } = useAddNewFeatureExpertiseMutation()
  const { mutateAsync: updateFeatureExpertise } = useUpdateFeatureExpertiseMutation()

  // Feature sense mutations
  const { mutateAsync: deleteFeatureSense } = useDeleteFeatureSenseMutation()
  const { mutateAsync: addFeatureSense } = useAddNewFeatureSenseMutation()
  const { mutateAsync: updateFeatureSense } = useUpdateFeatureSenseMutation()

  // Feature proficiency mutations
  const { mutateAsync: deleteFeatureProficiency } = useDeleteFeatureProficiencyMutation()
  const { mutateAsync: addFeatureProficiency } = useAddNewFeatureProficiencyMutation()
  const { mutateAsync: updateFeatureProficiency } = useUpdateFeatureProficiencyMutation()

  // Feature modifier mutations
  const { mutateAsync: deleteFeatureModifier } = useDeleteFeatureModifierMutation()
  const { mutateAsync: addFeatureModifier } = useAddNewFeatureModifierMutation()
  const { mutateAsync: updateFeatureModifier } = useUpdateFeatureModifierMutation()

  // Feature spell mutations
  const { mutateAsync: deleteFeatureSpell } = useDeleteFeatureSpellMutation()
  const { mutateAsync: addFeatureSpell } = useAddNewFeatureSpellMutation()
  const { mutateAsync: updateFeatureSpell } = useUpdateFeatureSpellMutation()

  // Feature feat mutations
  const { mutateAsync: deleteFeatureFeat } = useDeleteFeatureFeatMutation()
  const { mutateAsync: addFeatureFeat } = useAddNewFeatureFeatMutation()
  const { mutateAsync: updateFeatureFeat } = useUpdateFeatureFeatMutation()

  return {
    features: {
      add: addFeature,
      update: updateFeature,
      delete: deleteFeature,
    },
    ancestries: {
      add: addAncestryOption,
      update: updateAncestryOption,
      delete: deleteAncestryOption,
    },
    options: {
      add: addFeatureOption,
      update: updateFeatureOption,
      delete: deleteFeatureOption,
    },
    expertise: {
      add: addFeatureExpertise,
      update: updateFeatureExpertise,
      delete: deleteFeatureExpertise,
    },
    senses: {
      add: addFeatureSense,
      update: updateFeatureSense,
      delete: deleteFeatureSense,
    },
    proficiencies: {
      add: addFeatureProficiency,
      update: updateFeatureProficiency,
      delete: deleteFeatureProficiency,
    },
    modifiers: {
      add: addFeatureModifier,
      update: updateFeatureModifier,
      delete: deleteFeatureModifier,
    },
    spells: {
      add: addFeatureSpell,
      update: updateFeatureSpell,
      delete: deleteFeatureSpell,
    },
    feats: {
      add: addFeatureFeat,
      update: updateFeatureFeat,
      delete: deleteFeatureFeat,
    },
  }
}

export default useMutationFunctions
