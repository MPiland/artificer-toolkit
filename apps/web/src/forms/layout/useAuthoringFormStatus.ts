import { useSelector } from '@tanstack/react-form'
import { hasVisibleStepChanges } from '../rendering/FormRenderer.utils'
import {
  useAuthoringFormStore,
  useAuthoringNavigation,
  useAuthoringSession,
  type AuthoringFormStatus
} from './AuthoringFormContext'

/**
 * The submit, finalize, reset and saving flags. Each one is a narrow store selector, so a
 * keystroke re-renders a reader only when a flag flips.
 */
export function useAuthoringFormStatus(): AuthoringFormStatus {
  const { form, hostedStatus, isMutating } = useAuthoringFormStore()
  const { activeStep, isComplete } = useAuthoringNavigation()
  const { readOnly } = useAuthoringSession()
  const canSubmit = useSelector(form.store, (state) => state.canSubmit)
  const hasChanges = useSelector(form.store, (state) => state.isDirty)
  const isSubmitting = useSelector(form.store, (state) => state.isSubmitting)
  const hasStepChanges = useSelector(form.store, (state) =>
    hasVisibleStepChanges(form, activeStep?.sections ?? [], undefined, state.fieldMeta)
  )
  if (hostedStatus) return hostedStatus

  return {
    canFinalize: canSubmit && isComplete,
    canResetForm: hasChanges && !readOnly,
    canResetStep: activeStep !== undefined && !readOnly,
    canSubmit,
    hasChanges,
    hasStepChanges,
    isSubmitting: isSubmitting || isMutating
  }
}
