import { useEffect, useMemo, useLayoutEffect, useCallback } from 'react'
import { useAddNewSpellMutation, useUpdateSpellMutation } from '@/apis/spells.api'
import { Route } from '@/routes/_protected/spells/$action/$_spellId'
import { useSpellData, useSystemPref } from '@/hooks'
import { SpellInputSchema } from '@/schemas'
import { v4 as uuidv4 } from 'uuid'
import Form, { SpellAttributes, SpellDetails, useAppForm } from '@/components/Form'
import { useFormStore } from '@/store'
import type { SpellInput } from '@/types'
import { convertTypenameToKindInput } from '@/utils'

const SpellForm = () => {
  const { _spellId: spellId, action } = Route.useParams()
  const {
    spells: { findSpell },
  } = useSpellData()
  const [systemPref] = useSystemPref()

  const spellData = findSpell(spellId)

  const current = useFormStore((state) => state.current)
  const steps = useFormStore((state) => state.steps)
  const setSteps = useFormStore((state) => state.setSteps)
  const setCurrent = useFormStore((state) => state.setCurrent)
  const stepIndex = useFormStore((state) => state.stepIndex)
  const registerForm = useFormStore((state) => state.registerForm)

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
    if (!steps[stepIndex].reset) {
      registerForm(form.reset)
    }
  }, [form.reset, steps, stepIndex, registerForm])

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
