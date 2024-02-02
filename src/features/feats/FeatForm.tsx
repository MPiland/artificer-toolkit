import { useReducer, FC } from 'react'
import formReducer from '../../hooks/useReducer'
import DetailForm from '../../components/Form/DetailForm'
import Form from '../../components/Form/Form'

interface FeatFormProps {
  context: 'create' | 'edit'
}

const FeatForm: FC<FeatFormProps> = ({ context }) => {
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
          context={{ type: context, title: 'feat' }}
          key={1}
        />
      ),
    },
  ]

  return (
    <Form
      context={{ type: context, title: 'feat' }}
      onSubmit={onSubmit}
      formSteps={formSteps}
    />
  )
}
export default FeatForm
