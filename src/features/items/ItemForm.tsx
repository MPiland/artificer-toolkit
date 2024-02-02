import { useReducer, FC } from 'react'
import formReducer from '../../hooks/useReducer'
import DetailForm from '../../components/Form/DetailForm'
import Form from '../../components/Form/Form'

interface ItemFormProps {
  context: 'create' | 'edit'
}

const ItemForm: FC<ItemFormProps> = ({ context }) => {
  const [state, setState] = useReducer(formReducer, {})

  const onSubmit = () => {
    alert('Successful Account Creation')
  }

  const formSteps = [
    {
      name: 'Details',
      content: (
        <DetailForm
          state={state}
          setState={setState}
          context={{ type: context, title: 'item' }}
          key={1}
        />
      ),
    },
  ]

  return (
    <Form
      context={{ type: context, title: 'item' }}
      onSubmit={onSubmit}
      formSteps={formSteps}
    />
  )
}
export default ItemForm
