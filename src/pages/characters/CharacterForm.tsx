import { z } from 'zod/v4'
import { useEffect, useState, useMemo } from 'react'
import type { CharacterInput } from '@/types'
import { useAddCharacter, useUpdateCharacter } from '@/apis/characters.api'
import { Route } from '@/routes/_protected/characters/$action/$_characterId'
import { useCharacterData } from '@/hooks'
import { CharacterInputSchema } from '@/schemas'
import { v4 as uuidv4 } from 'uuid'
import { useFormStore } from '@/store'
import Form, {
  CharacterDetails,
  Background,
  Abilities,
  CharacterEquipment,
  RaceFeatures,
  RaceSelection,
  Classes,
  ClassSelection,
} from '@/components/Form'
import { isEqual } from 'lodash'

const CharacterForm = () => {
  const { _characterId: characterId, action } = Route.useParams()
  const {
    characters: { findCharacter },
  } = useCharacterData()
  const character = findCharacter(characterId)
  const formStore = useFormStore()

  const data: z.input<typeof CharacterInputSchema> = useMemo(
    () =>
      character ?
        action === 'new' ?
          CharacterInputSchema.parse({
            ...character,
            id: uuidv4(),
            label: '',
            masterId: undefined,
          })
        : CharacterInputSchema.parse(character)
      : CharacterInputSchema.parse({
          __kind: 'CharacterInput',
          id: uuidv4(),
        }),
    [character, action]
  )

  const [steps] = useState([
    { id: 'details', label: 'Details' },
    { id: 'race', label: 'Race' },
    { id: 'class', label: 'Class' },
    { id: 'abilities', label: 'Abilities' },
    { id: 'background', label: 'Background' },
    { id: 'equipment', label: 'Equipment' },
  ])

  useEffect(() => {
    formStore.setCurrent(data as CharacterInput)
  }, [formStore, data])

  useEffect(() => {
    if (!isEqual(formStore.steps, steps)) formStore.setSteps(steps)
  }, [formStore, steps])

  const stepComponentMap = {
    details: <CharacterDetails />,
    race: (formStore.current as CharacterInput)?.race && !formStore.changeRace ? <RaceFeatures /> : <RaceSelection />,
    class:
      !(formStore.current as CharacterInput)?.classes?.length || formStore.addClass ? <ClassSelection /> : <Classes />,
    abilities: <Abilities />,
    background: <Background />,
    equipment: <CharacterEquipment />,
  }

  return (
    <Form useUpdateItemMutation={useUpdateCharacter} useAddNewItemMutation={useAddCharacter}>
      {stepComponentMap[formStore.steps[formStore.stepIndex].id as keyof typeof stepComponentMap] || null}
    </Form>
  )
}

export default CharacterForm
