import { useEffect, use } from 'react'
import { Step, type CharacterInput } from '@/types'
import { useAddCharacter, useUpdateCharacter } from '@/apis/characters.api'
import Form, { FormContext } from '@/components/Form'
import { isEqual } from 'lodash'
import { Route } from '@/routes/_protected/characters/$action/$_characterId'
import { useCharacterData } from '@/hooks'
import { CharacterInputSchema } from '@/schemas'
import { v4 as uuidv4 } from 'uuid'

const CharacterForm = () => {
  const { _characterId: characterId, action } = Route.useParams()
  const {
    characters: { findCharacter },
  } = useCharacterData()
  const character = findCharacter(characterId)
  const { steps, formStore } = use(FormContext)

  const stepsArray = [
    { id: 'details', label: 'Details' },
    { id: 'race', label: 'Race' },
    { id: 'class', label: 'Class' },
    { id: 'abilities', label: 'Abilities' },
    { id: 'background', label: 'Background' },
    { id: 'equipment', label: 'Equipment' },
  ] satisfies Step[]

  useEffect(() => {
    if (!isEqual(steps, stepsArray)) {
      formStore.setSteps(stepsArray)
    }
    if (action === 'new') {
      let dataObj: CharacterInput
      if (character) {
        dataObj = CharacterInputSchema.parse({
          ...character,
          id: uuidv4(),
          label: '',
        })
      } else {
        dataObj = CharacterInputSchema.parse({
          __kind: 'CharacterInput',
          id: uuidv4(),
        })
      }
      formStore.reinitState(dataObj)
    }
    if (action === 'edit' && character) {
      const dataObj = CharacterInputSchema.parse(character)
      formStore.reinitState(dataObj)
    }
  }, [stepsArray, steps, formStore, character, action])

  return <Form useUpdateItemMutation={useUpdateCharacter} useAddNewItemMutation={useAddCharacter} />
}

export default CharacterForm
