import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppForm } from '../app-form/AppForm'
import type { AuthoredFormSession } from '../factories/authoredFormFactories.types'

const EMPTY_FORM_VALUES: object = {}

export type AuthoredForm = ReturnType<typeof useAuthoredFormInstance>['form']

/**
 * The authored session's one TanStack form. Its values, flags and field meta live only here; the
 * provider and chrome read them through store selectors.
 */
export function useAuthoredFormInstance({
  activateValues,
  clearValidationIssues,
  saveDraftValues,
  session
}: {
  activateValues: (values: object) => Promise<void>
  clearValidationIssues: (fieldName: string) => void
  saveDraftValues: (values: object) => Promise<boolean | void>
  session: Pick<AuthoredFormSession, 'initialValues' | 'key'> | undefined
}) {
  const [defaultValuesState, setDefaultValuesState] = useState<{ key?: string; values: object }>({
    key: undefined,
    values: EMPTY_FORM_VALUES
  })
  if (defaultValuesState.key !== session?.key) {
    setDefaultValuesState({
      key: session?.key,
      values: session?.initialValues ?? EMPTY_FORM_VALUES
    })
  }
  const form = useAppForm({
    defaultValues: defaultValuesState.values,
    listeners: {
      onChange: ({ fieldApi }) => clearValidationIssues(fieldApi.name)
    },
    onSubmit: async ({ value }) => {
      if (!session) return
      await activateValues(value)
    }
  })
  // The form is created with the mounted session's values; only a later session resets it, so the
  // reset never discards edits children made while mounting.
  const resetSessionKeyRef = useRef(session?.key)
  useEffect(() => {
    if (!session || resetSessionKeyRef.current === session.key) return
    resetSessionKeyRef.current = session.key
    form.reset(session.initialValues)
  }, [form, session])

  const resetForm = useCallback(
    () => form.reset(session?.initialValues ?? EMPTY_FORM_VALUES),
    [form, session]
  )
  const saveDraft = useCallback(async () => {
    if (!session) return
    const submittedValues = form.state.values
    if (isBlankLabel(submittedValues)) {
      form.setFieldMeta('label', (meta) => ({
        ...meta,
        errorMap: { ...meta.errorMap, onSubmit: 'Name is required.' }
      }))
      return
    }
    const submittedSnapshot = JSON.stringify(submittedValues)
    const saved = await saveDraftValues(submittedValues)
    if (saved && JSON.stringify(form.state.values) === submittedSnapshot) {
      setDefaultValuesState({ key: session.key, values: submittedValues })
      form.reset(submittedValues)
    }
  }, [form, saveDraftValues, session])

  return { form, resetForm, saveDraft }
}

function isBlankLabel(values: object): boolean {
  return 'label' in values && typeof values.label === 'string' && !values.label.trim()
}
