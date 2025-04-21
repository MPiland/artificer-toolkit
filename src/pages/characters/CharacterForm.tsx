import { useEffect, use } from 'react'
import Form from '../../components/Form/Form'
import { Step } from '../../types/form'
import { useAddCharacter, useUpdateCharacter } from '../../apis/charactersApi'
import { FormContext } from '../../components/Form/FormContext'
import { isEqual } from 'lodash'
import { Route } from '../../routes/_protected/characters/$action/$_characterId'
import useCharacterData from '../../hooks/useCharacterData'

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
    if (action === 'new' && character) {
      if (Object.keys(formStore.data).length === 0) {
        formStore.reinitState(character)
      }
    }
    if (action === 'edit' && character) {
      if (formStore.data?.id !== character.id) {
        formStore.reinitState(character)
      }
    }
  }, [stepsArray, steps, formStore, character, action])

  return <Form useUpdateItemMutation={useUpdateCharacter} useAddNewItemMutation={useAddCharacter} />
}

export default CharacterForm
