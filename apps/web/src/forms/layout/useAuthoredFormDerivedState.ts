import { useMemo } from 'react'
import { replaceEqualDeep } from '@tanstack/react-query'
import type { AuthoredValidationIssueDto } from '@artificer-toolkit/schema/api/content'
import { RESOLUTION_DEBOUNCE_MS, useDebouncedFormState } from '../hooks/useDebouncedFormState'
import { useAuthoringResolvedModel } from '../hooks/useAuthoringResolvedModel'
import { toResolvedNodeValues } from '../node-map/nodeFormUtils'
import type { AuthoringStepWarningMap, FieldMetaSnapshot } from '../validation/authoringProgress'
import { buildAuthoringNavigationTree } from './authoringNavigation'
import type { AuthoringFormNavigationState } from './AuthoringFormContext'
import type { AuthoredForm } from './useAuthoredFormInstance'

const EMPTY_NAVIGATION_STATE: AuthoringFormNavigationState = {
  isComplete: false,
  navigationTargets: [],
  navigationTree: undefined,
  progressSummary: undefined,
  stepStatuses: {},
  visibleSteps: []
}

/**
 * Resolves the authored form's node model and its step navigation from the form's debounced state.
 * Typing re-renders nothing here until the pause; unchanged parts of the navigation keep their
 * identity, so readers re-render only when a status, target or step actually changed.
 */
export function useAuthoredFormDerivedState({
  enabled,
  form,
  mapId,
  stepWarnings,
  systemId,
  validationIssues
}: {
  enabled: boolean
  form: AuthoredForm
  mapId: string | undefined
  stepWarnings: AuthoringStepWarningMap
  systemId: string | undefined
  validationIssues: readonly AuthoredValidationIssueDto[]
}) {
  const formState = useDebouncedFormState(form, RESOLUTION_DEBOUNCE_MS, enabled)
  const values = useMemo(() => toResolvedNodeValues(formState.values), [formState.values])
  const resolution = useAuthoringResolvedModel({
    mapId: mapId ?? 'pending',
    resolveModel: enabled && Boolean(mapId),
    systemId,
    values
  })
  const shareNavigationState = useMemo(() => {
    let previous = EMPTY_NAVIGATION_STATE
    return (next: AuthoringFormNavigationState) => (previous = replaceEqualDeep(previous, next))
  }, [])
  const navigation = useMemo(() => {
    if (!enabled || !mapId || !resolution.model) return EMPTY_NAVIGATION_STATE

    const tree = buildAuthoringNavigationTree({
      fieldMeta: formState.fieldMeta as Partial<Record<string, FieldMetaSnapshot>>,
      mapId,
      model: resolution.model,
      values,
      validationIssues,
      warnings: stepWarnings
    })

    return shareNavigationState({
      ...tree,
      isComplete:
        !resolution.error &&
        Object.values(tree.stepStatuses).every((status) => status === 'complete'),
      visibleSteps: resolution.steps
    })
  }, [
    enabled,
    formState.fieldMeta,
    mapId,
    resolution.error,
    resolution.model,
    resolution.steps,
    shareNavigationState,
    stepWarnings,
    validationIssues,
    values
  ])

  return { navigation, resolution }
}
