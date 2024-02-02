import { useReducer, FC } from 'react'
import formReducer from '../../hooks/useReducer'
import DetailForm from '../../components/Form/DetailForm'
import Form from '../../components/Form/Form'

interface ClassFormProps {
  context: 'create' | 'edit'
}

const ClassForm: FC<ClassFormProps> = ({ context }) => {
  const [state, setState] = useReducer(formReducer, {})

  const onSubmit = () => {
    alert('Successful Account Creation')
  }

  const steps = [
    {
      name: 'Details',
      content: (
        <DetailForm
          state={state}
          setState={setState}
          context={{ type: context, title: 'class' }}
          key={1}
        />
      ),
    },
  ]

  return (
    <Form
      context={{ type: context, title: 'class' }}
      onSubmit={onSubmit}
      steps={steps}
    />
  )
}
export default ClassForm
