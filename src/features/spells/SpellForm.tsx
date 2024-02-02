import { useReducer, FC } from 'react'
import formReducer from '../../hooks/useReducer'
import DetailForm from '../../components/Form/DetailForm'
import Form from '../../components/Form/Form'
import AttributeForm from '../../components/Form/AttributeForm'

interface SpellFormProps {
  context: 'create' | 'edit'
}

const SpellForm: FC<SpellFormProps> = ({ context }) => {
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
          context={{ type: context, title: 'spell' }}
          key={1}
        />
      ),
    },
    {
      name: 'Attributes',
      content: (
        <AttributeForm
          state={state}
          setState={setState}
          context={{ type: context, title: 'spell' }}
          key={2}
        />
      ),
    },
  ]

  return (
    <Form
      context={{ type: context, title: 'spell' }}
      onSubmit={onSubmit}
      steps={steps}
    />
  )
}
export default SpellForm
