import { useEffect, useMemo, useCallback, useLayoutEffect } from 'react'
import type { CharacterInput } from '@/types'
import { useAddCharacter, useUpdateCharacter } from '@/apis/characters.api'
import { Route } from '@/routes/_protected/characters/$action/$_characterId'
import { useCharacterData, useSystemPref } from '@/hooks'
import { CharacterInputSchema } from '@/schemas'
import { v4 as uuidv4 } from 'uuid'
import Form, {
  CharacterDetails,
  Background,
  Abilities,
  CharacterEquipment,
  RaceFeatures,
  RaceSelection,
  Classes,
  ClassSelection,
  useAppForm,
} from '@/components/Form'
import { useTypedFormStore } from '@/store'
import { convertTypenameToKindInput } from '@/utils'

const CharacterForm = () => {
  const { _characterId: characterId, action } = Route.useParams()
  const {
    characters: { findCharacter },
  } = useCharacterData()
  const [systemPref] = useSystemPref()

  const characterData = findCharacter(characterId)

  const store = useTypedFormStore<CharacterInput>()

  const current = store((state) => state.current)
  const steps = store((state) => state.steps)
  const setSteps = store((state) => state.setSteps)
  const setCurrent = store((state) => state.setCurrent)
  const stepIndex = store((state) => state.stepIndex)
  const registerForm = store((state) => state.registerForm)
  const formReset = store((state) => state.formReset)
  const addClass = store((state) => state.addClass)
  const changeRace = store((state) => state.changeRace)

  const createDataObject = useCallback(() => {
    if (characterData) {
      const characterInput = convertTypenameToKindInput(characterData)
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

  const data = useMemo(() => createDataObject(), [createDataObject])

  useLayoutEffect(() => {
    if (current === null) {
      setCurrent(data as CharacterInput)
    }
  }, [current, data, setCurrent])

  const form = useAppForm({
    defaultValues: data,
  })

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
    if (!formReset) {
      registerForm(form.reset)
    }
  }, [formReset, registerForm, form.reset])

  const stepComponentMap = {
    details: <CharacterDetails form={form} />,
    race: (current as CharacterInput)?.race && !changeRace ? <RaceFeatures form={form} /> : <RaceSelection form={form} />,
    class: !(current as CharacterInput)?.classes?.length || addClass ? <ClassSelection form={form} /> : <Classes form={form} />,
    abilities: <Abilities form={form} />,
    background: <Background form={form} />,
    equipment: <CharacterEquipment form={form} />,
  }

  return (
    <Form useUpdateItemMutation={useUpdateCharacter} useAddNewItemMutation={useAddCharacter}>
      {stepComponentMap[steps[stepIndex].id as keyof typeof stepComponentMap] || null}
    </Form>
  )
}

export default CharacterForm
