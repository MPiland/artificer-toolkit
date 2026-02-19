import { useCallback, useEffect, useLayoutEffect, useMemo } from 'react'
import { useOptimizedSelector, useTypedFormStore } from '@store'
import type { FormDataType, Step } from '@types'
import { useRouter } from '@tanstack/react-router'

// config type
interface UseDomainFormConfig<TInput extends FormDataType, TSource> {
  action: string
  source: TSource | null | undefined
  routeId?: string
  createInitial: (args: { action: string, source: TSource | null | undefined }) => TInput
  buildSteps: (data: TInput) => Step[]
  submit: (data: TInput) => Promise<unknown>
}

// hook
export function useDomainForm<TInput extends FormDataType, TSource>(
  config: UseDomainFormConfig<TInput, TSource>
) {
  const store = useTypedFormStore<TInput>()
  const router = useRouter()

  const {
    current,
    steps,
    setSteps,
    setCurrent,
    stepIndex,
    registerForm,
    formSubmit
  } = useOptimizedSelector(store, (state) => ({
    current: state.current,
    steps: state.meta.steps,
    setSteps: state.setSteps,
    setCurrent: state.setCurrent,
    stepIndex: state.meta.stepIndex,
    registerForm: state.registerForm,
    formSubmit: state.formSubmit
  }))

  const { action, source, createInitial, buildSteps, routeId, submit } = config

  const data = useMemo(
    () => createInitial({ action, source }),
    [action, source, createInitial]
  )

  const handleSubmit = useCallback(async () => {
    if (!current) return
    await submit(current)

    if (routeId) {
      router.invalidate({
        filter: (match) => match.routeId === routeId
      })
    }
  }, [
    current, routeId, submit, router
  ])

  useLayoutEffect(() => {
    if (!current && data) {
      setCurrent(data)
    }
  }, [current, data, setCurrent])

  const domainSteps = useMemo(
    () => buildSteps(data),
    [buildSteps, data]
  )

  useLayoutEffect(() => {
    if (!steps?.length) {
      setSteps(domainSteps)
      return
    }

    const sameLength = steps.length === domainSteps.length
    const sameIds = sameLength && steps.every((s, i) => s.id === domainSteps[i]?.id)

    if (!sameIds) {
      setSteps(domainSteps)
    }
  }, [steps, domainSteps, setSteps])

  useEffect(() => {
    if (!formSubmit) {
      registerForm(handleSubmit)
    }
  }, [formSubmit, registerForm, handleSubmit])

  return {
    current,
    steps,
    stepIndex,
    data
  }
}
