import {
  Button,
  TextInput,
  type ButtonProps,
  type TextInputProps,
  Alert,
  Checkbox,
  type CheckboxProps,
  type AlertProps,
  type PasswordInputProps,
  PasswordInput,
} from '@mantine/core'
import { Info } from 'lucide-react'
import type { DropdownProps, DropdownOption } from '@/components/Dropdown'
import Dropdown from '@/components/Dropdown'
import { useFormContext, useFieldContext } from './utils/factory'
import RichTextEditor, { type RichTextEditorProps } from '@/components/RichTextEditor'
import Accordion, { type AccordionProps } from '@/components/Accordion'

type SubscribeSubmitProps = {
  label: string
} & Omit<ButtonProps, 'loading' | 'disabled' | 'type'>

export const SubscribeSubmit = ({ label, ...props }: SubscribeSubmitProps) => {
  const { Subscribe } = useFormContext()

  return (
    <Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
      {([canSubmit, isSubmitting]) => (
        <Button loading={isSubmitting} disabled={!canSubmit} type='submit' {...props}>
          {label}
        </Button>
      )}
    </Subscribe>
  )
}

type SubscribeButtonProps = {
  label: string
} & Omit<ButtonProps, 'loading' | 'disabled'>

export const SubscribeButton = ({ label, ...props }: SubscribeButtonProps) => {
  const { Subscribe } = useFormContext()

  return (
    <Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
      {([canSubmit, isSubmitting]) => (
        <Button loading={isSubmitting} disabled={!canSubmit} {...props}>
          {label}
        </Button>
      )}
    </Subscribe>
  )
}

type SubscribeAlertProps = AlertProps

export const SubscribeAlert = ({ ...props }: SubscribeAlertProps) => {
  const { Subscribe } = useFormContext()

  return (
    <Subscribe selector={(state) => [state.errorMap]}>
      {([errorMap]) => {
        let errorMessage = ''
        if (errorMap?.onSubmit?.form?.message) {
          errorMessage = errorMap.onSubmit.form.message
        } else if (errorMap?.onSubmit?.message) {
          errorMessage = errorMap.onSubmit.message
        }
        return (
          errorMessage && (
            <Alert {...props} icon={<Info />}>
              {errorMessage}
            </Alert>
          )
        )
      }}
    </Subscribe>
  )
}

type DropdownFieldProps = {
  label: string
  placeholder?: string
  options: DropdownOption[]
} & Omit<DropdownProps, 'label' | 'value' | 'onChange' | 'error' | 'name'>

export const DropdownField = ({ label, placeholder, options, ...props }: DropdownFieldProps) => {
  // The `Field` infers that it should have a `value` type of `string`
  const { state, name, handleChange } = useFieldContext<string | string[] | undefined | null>()
  return (
    <Dropdown
      label={label}
      name={name}
      value={state.value}
      onChange={handleChange}
      placeholder={placeholder}
      options={options}
      {...props}
    />
  )
}

type TextFieldProps = {
  label?: string
  placeholder?: string
} & Omit<TextInputProps, 'label' | 'value' | 'onChange' | 'error' | 'name'>

export const TextField = ({ label, placeholder, ...props }: TextFieldProps) => {
  // The `Field` infers that it should have a `value` type of `string`
  const field = useFieldContext<string | number>()
  return (
    <TextInput
      label={label}
      placeholder={placeholder || ''}
      name={field.name}
      value={field.state.value}
      onChange={(e) => field.handleChange(e.target.value)}
      error={!field.state.meta.isValid && field.state.meta.errors.join(', ')}
      {...props}
    />
  )
}

type PasswordFieldProps = {
  label: string
} & Omit<PasswordInputProps, 'label' | 'value' | 'onChange' | 'error' | 'name'>

export const PasswordField = ({ label, ...props }: PasswordFieldProps) => {
  // The `Field` infers that it should have a `value` type of `string`
  const { state, name, handleChange } = useFieldContext<string>()
  return (
    <PasswordInput
      label={label}
      placeholder='Password...'
      name={name}
      value={state.value}
      onChange={(e) => handleChange(e.target.value)}
      error={!state.meta.isValid && state.meta.errors.join(', ')}
      {...props}
    />
  )
}

type CheckboxFieldProps = {
  label: string
} & Omit<CheckboxProps, 'label' | 'value' | 'onChange' | 'name'>

export const CheckboxField = ({ label, ...props }: CheckboxFieldProps) => {
  // The `Field` infers that it should have a `value` type of `string`
  const { state, handleChange, handleBlur } = useFieldContext<boolean>()
  return (
    <Checkbox
      label={label}
      checked={state.value}
      onChange={(e) => handleChange(e.target.checked)}
      onBlur={handleBlur}
      {...props}
    />
  )
}

type RichTextEditorFieldProps = Omit<RichTextEditorProps, 'value' | 'onChange'>

export const RichTextEditorField = ({ label, placeholder }: RichTextEditorFieldProps) => {
  const { state, handleChange } = useFieldContext<string>()
  return <RichTextEditor label={label} value={state.value} onChange={handleChange} placeholder={placeholder} />
}

type AccordionFieldProps = Omit<AccordionProps, 'dataArray' | 'onChange'>

export const AccordionField = ({ ...props }: AccordionFieldProps) => {
  const { state, name, handleChange } = useFieldContext<unknown[]>()

  const onChange = (dataArray: unknown[]) => {
    handleChange(dataArray)
  }

  return (
    <Accordion dataArray={state.value || []} name={name} onChange={(dataArray) => onChange(dataArray)} {...props} />
  )
}