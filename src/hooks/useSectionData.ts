import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query'
import { useRouteContext } from '@tanstack/react-router'
import { createArrayWithMethods } from '@/utils'
import { fetchFeatureModifier, fetchFeatureModifiers } from '@/apis/featureModifiers'
import { fetchFeatureSense, fetchFeatureSenses } from '@/apis/featureSenses.api'
import { fetchFeatureSpell, fetchFeatureSpells } from '@/apis/featureSpells.api'
import { fetchFeatureExpertise, fetchFeatureExpertises } from '@/apis/featureExpertise.api'
import { fetchFeatureProficiencies, fetchFeatureProficiency } from '@/apis/featureProficiencies.api'

const useSectionData = () => {
  const suspenseQuery = useSuspenseQuery
  const suspenseQueries = useSuspenseQueries
  const { systemPref } = useRouteContext({ from: '__root__' })
  const {
    data: { featureModifiers },
  } = suspenseQuery(fetchFeatureModifiers(systemPref))
  const {
    data: { featureSenses },
  } = suspenseQuery(fetchFeatureSenses(systemPref))
  const {
    data: { featureSpells },
  } = suspenseQuery(fetchFeatureSpells(systemPref))
  const {
    data: { featureExpertises },
  } = suspenseQuery(fetchFeatureExpertises(systemPref))
  const {
    data: { featureProficiencies },
  } = suspenseQuery(fetchFeatureProficiencies(systemPref))
  return {
    featureModifiers: createArrayWithMethods(featureModifiers, {
      findFeature: (id?: string | null) => {
        if (!id) return null
        return suspenseQuery(fetchFeatureModifier(id)).data
      },
      findFeatureModifier: (ids?: string[] | null) => {
        if (!ids || !ids.length) return null
        return suspenseQueries({
          queries: ids.map((id) => fetchFeatureModifier(id)),
          combine: (results) => results.map((result) => result.data),
        })
      },
    }),
    featureSenses: createArrayWithMethods(featureSenses, {
      findFeatureSense: (id?: string | null) => {
        if (!id) return null
        return suspenseQuery(fetchFeatureSense(id)).data
      },
      findFeatureSenses: (ids?: string[] | null) => {
        if (!ids || !ids.length) return null
        return suspenseQueries({
          queries: ids.map((id) => fetchFeatureSense(id)),
          combine: (results) => results.map((result) => result.data),
        })
      },
    }),
    featureSpells: createArrayWithMethods(featureSpells, {
      findFeatureSpell: (id?: string | null) => {
        if (!id) return null
        return suspenseQuery(fetchFeatureSpell(id)).data
      },
      findFeatureSpells: (ids?: string[] | null) => {
        if (!ids || !ids.length) return null
        return suspenseQueries({
          queries: ids.map((id) => fetchFeatureSpells(id)),
          combine: (results) => results.map((result) => result.data),
        })
      },
    }),
    featureExpertise: createArrayWithMethods(featureExpertises, {
      findFeatureExpertise: (id?: string | null) => {
        if (!id) return null
        return suspenseQuery(fetchFeatureExpertise(id)).data
      },
      findFeatureExpertises: (ids?: string[] | null) => {
        if (!ids || !ids.length) return null
        return suspenseQueries({
          queries: ids.map((id) => fetchFeatureExpertises(id)),
          combine: (results) => results.map((result) => result.data),
        })
      },
    }),
    featureProficiencies: createArrayWithMethods(featureProficiencies, {
      findFeatureProficiency: (id?: string | null) => {
        if (!id) return null
        return suspenseQuery(fetchFeatureProficiency(id)).data
      },
      findFeatureProficiencies: (ids?: string[] | null) => {
        if (!ids || !ids.length) return null
        return suspenseQueries({
          queries: ids.map((id) => fetchFeatureProficiencies(id)),
          combine: (results) => results.map((result) => result.data),
        })
      },
    }),
  }
}
export default useSectionData
