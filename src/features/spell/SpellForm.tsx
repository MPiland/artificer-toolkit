import Form from '../../components/Form/Form'
import { useLocation, useParams } from 'react-router-dom'
import {
  useAddNewSpellMutation,
  useUpdateSpellMutation,
  useGetSpellsQuery,
  selectSpellById,
} from './spellApiSlice'
import { FormContext, Step } from '../../utils/types'

const SpellForm = () => {
  const { context } = useParams()
  const location = useLocation()

  const { spell } = useGetSpellsQuery(undefined, {
    selectFromResult: ({ data }) => ({
      spell: data && selectSpellById(data, location.state?.data?._id),
    }),
  })

  const steps: Step[] = ['Details', 'Attributes']

  return (
    <Form
      context={{ type: context, title: 'spell' } as FormContext}
      steps={steps}
      item={spell}
      location={location}
      useAddNewItem={useAddNewSpellMutation}
      useUpdateItem={useUpdateSpellMutation}
    />
  )
}
export default SpellForm
