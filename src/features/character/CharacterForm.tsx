import Form from '../../components/Form/Form'
import { useLocation, useParams } from 'react-router-dom'
import { FormContext, Step } from '../../utils/types'
import {
  useAddNewCharacterMutation,
  useUpdateCharacterMutation,
  selectCharacterById,
  useGetCharactersQuery,
} from './charactersApiSlice'

const CharacterForm = () => {
  const { context } = useParams()
  const location = useLocation()

  const { character } = useGetCharactersQuery(undefined, {
    selectFromResult: ({ data }) => ({
      character: data && selectCharacterById(data, location.state?.data?._id),
    }),
  })

  const steps: Step[] = [
    'Details',
    'Race',
    'Class',
    'Abilities',
    'Equipment',
    'Background',
  ]

  return (
    <Form
      context={{ type: context, title: 'character' } as FormContext}
      steps={steps}
      item={character}
      location={location}
      useUpdateItem={useUpdateCharacterMutation}
      useAddNewItem={useAddNewCharacterMutation}
    />
  )
}
export default CharacterForm
