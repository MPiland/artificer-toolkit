import { useFieldContext } from '@/components/Form'
import Accordion, { type AccordionProps } from '@/components/Accordion'

type AccordionFieldProps = Omit<AccordionProps, 'dataArray' | 'onChange'>

const AccordionField = ({ ...props }: AccordionFieldProps) => {
  const { state, name, handleChange } = useFieldContext<unknown[]>()

  const onChange = (dataArray: unknown[]) => {
    handleChange(dataArray)
  }

  return (
    <Accordion dataArray={state.value || []} name={name} onChange={(dataArray) => onChange(dataArray)} {...props} />
  )
}

export default AccordionField
