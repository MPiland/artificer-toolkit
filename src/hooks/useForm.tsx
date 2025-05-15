import { createFormHookContexts, createFormHook } from '@tanstack/react-form'
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
const { fieldContext, useFieldContext, formContext, useFormContext } = createFormHookContexts()

type SubscribeSubmitProps = {
  label: string
} & Omit<ButtonProps, 'loading' | 'disabled' | 'type'>

const SubscribeSubmit = ({ label, ...props }: SubscribeSubmitProps) => {
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

const SubscribeButton = ({ label, ...props }: SubscribeButtonProps) => {
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

const SubscribeAlert = ({ ...props }: SubscribeAlertProps) => {
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
          errorMap?.onSubmit?.message && (
            <Alert {...props} icon={<Info />}>
              {errorMessage}
            </Alert>
          )
        )
      }}
    </Subscribe>
  )
}

type TextFieldProps = {
  label: string
  placeholder?: string
} & Omit<TextInputProps, 'label' | 'value' | 'onChange' | 'error' | 'name'>

const TextField = ({ label, placeholder, ...props }: TextFieldProps) => {
  // The `Field` infers that it should have a `value` type of `string`
  const { state, name, handleChange } = useFieldContext<string>()
  return (
    <TextInput
      label={label}
      placeholder={placeholder || ''}
      name={name}
      value={state.value}
      onChange={(e) => handleChange(e.target.value)}
      error={!state.meta.isValid && state.meta.errors.join(', ')}
      {...props}
    />
  )
}

type PasswordFieldProps = {
  label: string
} & Omit<PasswordInputProps, 'label' | 'value' | 'onChange' | 'error' | 'name'>

const PasswordField = ({ label, ...props }: PasswordFieldProps) => {
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

const CheckboxField = ({ label, ...props }: CheckboxFieldProps) => {
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

const useForm = () => {
  const { useAppForm, withForm } = createFormHook({
    fieldComponents: {
      TextField,
      PasswordField,
      CheckboxField,
    },
    formComponents: {
      SubscribeButton,
      SubscribeAlert,
      SubscribeSubmit,
    },
    fieldContext,
    formContext,
  })

  return { useAppForm, withForm, useFormContext, useFieldContext }
}

export default useForm
