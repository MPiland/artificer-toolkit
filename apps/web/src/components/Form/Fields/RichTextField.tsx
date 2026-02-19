import { useFieldContext } from './FieldContext'
import RichTextEditor, { type RichTextEditorProps } from '@components/RichTextEditor'

type RichTextFieldProps = Omit<RichTextEditorProps, 'value' | 'onChange' | 'name' | 'onBlur'>

const RichTextField = ({ label, placeholder }: RichTextFieldProps) => {
  const { state, name, handleChange, handleBlur } = useFieldContext<string>()
  return (
    <RichTextEditor
      label={label}
      value={state.value}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      name={name}
    />
  )
}

export default RichTextField
