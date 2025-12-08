import { useEffect, useMemo, useLayoutEffect, useCallback } from 'react'
import type { CharacterInput } from '~types'
import { useGetCharacter, useAddCharacter, useUpdateCharacter } from '~apis'
import { Route } from '~routes/_authed/characters/$action/$_characterId'
import { useSystemPref } from '~hooks'
import { CharacterInputSchema } from '~schemas'
import { v4 as uuidv4 } from 'uuid'
import Form, {
  CharacterDetails,
  Background,
  Abilities,
  CharacterEquipment,
  CharacterRace,
  RaceSelection,
  CharacterClasses,
  ClassSelection,
} from '~components/Form'
import { useOptimizedSelector, useTypedFormStore } from '~store'
import { convertTypenameToKindInput } from '~utils'

const CharacterForm = () => {
  const { _characterId: characterId, action } = Route.useParams()
  const characterData = useGetCharacter(characterId)
  const [systemPref] = useSystemPref()

  const { mutateAsync: addCharacter } = useAddCharacter()
  const { mutateAsync: updateCharacter } = useUpdateCharacter()

  const store = useTypedFormStore<CharacterInput>()

  const { current, steps, setSteps, setCurrent, stepIndex, registerForm, formSubmit, addClass, changeRace } = useOptimizedSelector(
    store,
    (state) => ({
      current: state.current,
      steps: state.meta.steps,
      setSteps: state.setSteps,
      setCurrent: state.setCurrent,
      stepIndex: state.meta.stepIndex,
      registerForm: state.registerForm,
      formSubmit: state.formSubmit,
      addClass: state.meta.addClass,
      changeRace: state.meta.changeRace,
    })
  )

  const data = useMemo(() => {
    if (characterData) {
      const characterInput = convertTypenameToKindInput(characterData) as CharacterInput
      if (characterInput) {
        if (action === 'new') {
          return CharacterInputSchema.parse({
            ...characterInput,
            id: uuidv4(),
            label: '',
            masterId: undefined,
            systemId: systemPref,
          })
        } else {
          return CharacterInputSchema.parse({ ...characterInput })
        }
      }
    }
    return CharacterInputSchema.parse({
      __kind: 'CharacterInput',
      id: uuidv4(),
      systemId: systemPref,
      label: '',
    })
  }, [action, systemPref, characterData])

  const handleSubmit = useCallback(async () => {
    if (action === 'new') {
      try {
        const result = await addCharacter(data)
        console.log({ result })
      } catch (err) {
        console.error({ err })
      }
    } else {
      try {
        const result = await updateCharacter(data)
        console.log({ result })
      } catch (err) {
        console.error({ err })
      }
    }
  }, [action, addCharacter, updateCharacter, data])

  useLayoutEffect(() => {
    if (current === null) {
      setCurrent(data)
    }
  }, [current, data, setCurrent])

  const characterSteps = useMemo(
    () => [
      { id: 'details', label: 'Details' },
      { id: 'race', label: 'Race' },
      { id: 'class', label: 'Class' },
      { id: 'abilities', label: 'Abilities' },
      { id: 'background', label: 'Background' },
      { id: 'equipment', label: 'Equipment' },
    ],
    []
  )

  useLayoutEffect(() => {
    if (!steps.every((step) => characterSteps.some((s) => s.id === step.id)) || !steps?.length) {
      setSteps(characterSteps)
    }
  }, [steps, characterSteps, setSteps])

  useEffect(() => {
    if (!formSubmit) {
      registerForm(handleSubmit)
    }
  }, [formSubmit, handleSubmit, registerForm])

  const stepComponentMap = {
    details: <CharacterDetails />,
    race: (current as CharacterInput)?.race && !changeRace ? <CharacterRace /> : <RaceSelection />,
    class: !(current as CharacterInput)?.classes?.length || addClass ? <ClassSelection /> : <CharacterClasses />,
    abilities: <Abilities />,
    background: <Background />,
    equipment: <CharacterEquipment />,
  }

  return <Form>{stepComponentMap[steps[stepIndex].id as keyof typeof stepComponentMap] || null}</Form>
}

export default CharacterForm
