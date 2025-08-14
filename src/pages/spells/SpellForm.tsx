import { useMemo, useLayoutEffect, useEffect, useCallback } from 'react'
import { useGetSpell, useAddSpell, useUpdateSpell } from '~/apis'
import { Route } from '~/routes/_protected/spells/$action/$_spellId'
import { useSystemPref } from '~/hooks'
import { SpellInputSchema } from '~/schemas'
import { v4 as uuidv4 } from 'uuid'
import Form, { SpellAttributes, SpellDetails } from '~/components/Form'
import { useOptimizedSelector, useTypedFormStore } from '~/store'
import type { SpellInput } from '~/types'
import { convertTypenameToKindInput } from '~/utils'
const SpellForm = () => {
  const { _spellId: spellId, action } = Route.useParams()
  const [systemPref] = useSystemPref()

  const spellData = useGetSpell(spellId)
  const { mutateAsync: addSpell } = useAddSpell()
  const { mutateAsync: updateSpell } = useUpdateSpell()

  const store = useTypedFormStore<SpellInput>()
  const { current, steps, setSteps, setCurrent, stepIndex, formSubmit, registerForm } = useOptimizedSelector(
    store,
    (state) => ({
      current: state.current,
      steps: state.meta.steps,
      setSteps: state.setSteps,
      setCurrent: state.setCurrent,
      stepIndex: state.meta.stepIndex,
      registerForm: state.registerForm,
      formSubmit: state.formSubmit,
    })
  )

  const data = useMemo(() => {
    if (spellData) {
      const spellInput = convertTypenameToKindInput(spellData) as SpellInput
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

  const handleSubmit = useCallback(async () => {
    if (action === 'new') {
      try {
        const result = await addSpell(data)
        console.log({ result })
      } catch (err) {
        console.error({ err })
      }
    } else {
      try {
        const result = await updateSpell(data)
        console.log({ result })
      } catch (err) {
        console.error({ err })
      }
    }
  }, [action, addSpell, updateSpell, data])

  useLayoutEffect(() => {
    if (current === null) {
      setCurrent(data)
    }
  }, [current, data, setCurrent])

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
    if (!formSubmit) {
      registerForm(handleSubmit)
    }
  }, [formSubmit, handleSubmit, registerForm])

  const stepComponentMap = {
    details: <SpellDetails />,
    attributes: <SpellAttributes />,
  }

  return <Form>{stepComponentMap[steps[stepIndex].id as keyof typeof stepComponentMap] || null}</Form>
}

export default SpellForm
