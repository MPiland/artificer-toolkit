import { useEffect, useMemo, useLayoutEffect, useCallback } from 'react'
import { useAddNewSpellMutation, useUpdateSpellMutation } from '@/apis/spells.api'
import { Route } from '@/routes/_protected/spells/$action/$_spellId'
import { useSpellData, useSystemPref } from '@/hooks'
import { SpellInputSchema } from '@/schemas'
import { v4 as uuidv4 } from 'uuid'
import Form, { SpellAttributes, SpellDetails, useAppForm } from '@/components/Form'
import { useTypedFormStore } from '@/store'
import type { SpellInput } from '@/types'
import { convertTypenameToKindInput } from '@/utils'

const SpellForm = () => {
  const { _spellId: spellId, action } = Route.useParams()
  const {
    spells: { findSpell },
  } = useSpellData()
  const [systemPref] = useSystemPref()

  const spellData = findSpell(spellId)

  const store = useTypedFormStore<SpellInput>()

  const current = store((state) => state.current)
  const steps = store((state) => state.steps)
  const setSteps = store((state) => state.setSteps)
  const setCurrent = store((state) => state.setCurrent)
  const stepIndex = store((state) => state.stepIndex)
  const registerForm = store((state) => state.registerForm)
  const formReset = store((state) => state.formReset)

  const createDataObject = useCallback(() => {
    if (spellData) {
      const spellInput = convertTypenameToKindInput(spellData)
      if (spellInput) {
        if (action === 'new') {
          return SpellInputSchema.parse({
            ...spellInput,
            id: uuidv4(),
            label: '',
            masterId: undefined,
            systemId: systemPref,
          })
        } else {
          return SpellInputSchema.parse({ ...spellInput })
        }
      }
    }
    return SpellInputSchema.parse({
      __kind: 'SpellInput',
      id: uuidv4(),
      systemId: systemPref,
      label: '',
    })
  }, [action, systemPref, spellData])

  const data = useMemo(() => createDataObject(), [createDataObject])

  useLayoutEffect(() => {
    if (current === null) {
      setCurrent(data as SpellInput)
    }
  }, [current, data, setCurrent])

  const form = useAppForm({
    defaultValues: data,
  })

  const spellSteps = useMemo(
    () => [
      { id: 'details', label: 'Details', fieldValidation: {}, defaultValues: {} },
      { id: 'attributes', label: 'Attributes', fieldValidation: {}, defaultValues: {} },
    ],
    []
  )

  useLayoutEffect(() => {
    if (!steps.every((step) => spellSteps.some((s) => s.id === step.id)) || !steps?.length) {
      setSteps(spellSteps)
    }
  }, [steps, spellSteps, setSteps])

  useEffect(() => {
    if (!formReset) {
      registerForm(form.reset)
    }
  }, [formReset, registerForm, form.reset])

  const stepComponentMap = {
    details: <SpellDetails form={form} />,
    attributes: <SpellAttributes form={form} />,
  }

  return (
    <Form useAddNewItemMutation={useAddNewSpellMutation} useUpdateItemMutation={useUpdateSpellMutation}>
      {stepComponentMap[steps[stepIndex].id as keyof typeof stepComponentMap] || null}
    </Form>
  )
}

export default SpellForm
