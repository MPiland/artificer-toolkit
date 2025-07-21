import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query'
import { useRouteContext } from '@tanstack/react-router'
import { createArrayWithMethods } from '@/utils'
import { fetchFeatureModifier, fetchFeatureModifiers } from '@/apis/featureModifiers.api'
import { fetchFeatureSense, fetchFeatureSenses } from '@/apis/featureSenses.api'
import { fetchFeatureSpell, fetchFeatureSpells } from '@/apis/featureSpells.api'
import { fetchFeatureExpertise, fetchFeatureExpertises } from '@/apis/featureExpertise.api'
import { fetchFeatureProficiencies, fetchFeatureProficiency } from '@/apis/featureProficiencies.api'
import { fetchFeatureFeats, fetchFeatureFeat } from '@/apis/featureFeats.api'

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
  const {
    data: { featureFeats },
  } = suspenseQuery(fetchFeatureFeats(systemPref))
  return {
    featureModifiers: createArrayWithMethods(featureModifiers, {
      findFeatureModifier: (id?: string | null) => {
        if (!id) return null
        return suspenseQuery(fetchFeatureModifier(id)).data
      },
      findFeatureModifiers: (ids?: string[] | null) => {
        if (!ids || !ids.length) return null
        const result = suspenseQueries({
          queries: ids.map((id) => fetchFeatureModifiers(id)),
          combine: (results) => results.map((result) => result.data),
        })
        return result.flatMap((data) => data.featureModifiers)
      },
    }),
    featureSenses: createArrayWithMethods(featureSenses, {
      findFeatureSense: (id?: string | null) => {
        if (!id) return null
        return suspenseQuery(fetchFeatureSense(id)).data
      },
      findFeatureSenses: (ids?: string[] | null) => {
        if (!ids || !ids.length) return null
        const result = suspenseQueries({
          queries: ids.map((id) => fetchFeatureSenses(id)),
          combine: (results) => results.map((result) => result.data),
        })
        return result.flatMap((data) => data.featureSenses)
      },
    }),
    featureSpells: createArrayWithMethods(featureSpells, {
      findFeatureSpell: (id?: string | null) => {
        if (!id) return null
        return suspenseQuery(fetchFeatureSpell(id)).data
      },
      findFeatureSpells: (ids?: string[] | null) => {
        if (!ids || !ids.length) return null
        const result = suspenseQueries({
          queries: ids.map((id) => fetchFeatureSpells(id)),
          combine: (results) => results.map((result) => result.data),
        })
        return result.flatMap((data) => data.featureSpells)
      },
    }),
    featureExpertise: createArrayWithMethods(featureExpertises, {
      findFeatureExpertise: (id?: string | null) => {
        if (!id) return null
        return suspenseQuery(fetchFeatureExpertise(id)).data
      },
      findFeatureExpertises: (ids?: string[] | null) => {
        if (!ids || !ids.length) return null
        const result = suspenseQueries({
          queries: ids.map((id) => fetchFeatureExpertises(id)),
          combine: (results) => results.map((result) => result.data),
        })
        return result.flatMap((data) => data.featureExpertises)
      },
    }),
    featureProficiencies: createArrayWithMethods(featureProficiencies, {
      findFeatureProficiency: (id?: string | null) => {
        if (!id) return null
        const data = suspenseQuery(fetchFeatureProficiency(id)).data
        return data
      },
      findFeatureProficiencies: (ids?: string[] | null) => {
        if (!ids || !ids.length) return null
        const result = suspenseQueries({
          queries: ids.map((id) => fetchFeatureProficiencies(id)),
          combine: (results) => results.map((result) => result.data),
        })
        return result.flatMap((data) => data.featureProficiencies)
      },
    }),
    featureFeats: createArrayWithMethods(featureFeats, {
      findFeatureFeat: (id?: string | null) => {
        if (!id) return null
        return suspenseQuery(fetchFeatureFeat(id)).data
      },
      findFeatureFeats: (ids?: string[] | null) => {
        if (!ids || !ids.length) return null
        const result = suspenseQueries({
          queries: ids.map((id) => fetchFeatureFeats(id)),
          combine: (results) => results.map((result) => result.data),
        })
        return result.flatMap((data) => data.featureFeats)
      },
    }),
  }
}
export default useSectionData
