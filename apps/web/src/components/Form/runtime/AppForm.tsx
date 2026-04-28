import {
  Button,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  TagsInput,
  TextInput,
  Textarea
} from '@mantine/core'
import { createFormHook, createFormHookContexts } from '@tanstack/react-form'
import type { ReactNode } from 'react'
import RichTextEditor from '#components/RichTextEditor'
import { getFieldError, toInputValue, type SelectOption } from './formUtils'

export const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts()

export type RuntimeFieldProps = {
  label?: string
  description?: string
  placeholder?: string
  readOnly?: boolean
}

export type RuntimeSelectFieldProps = RuntimeFieldProps & {
  data: SelectOption[]
}

function TextField({ label, description, placeholder, readOnly }: RuntimeFieldProps) {
  const field = useFieldContext<string>()

  return (
    <TextInput
      label={label}
      description={description}
      placeholder={placeholder}
      name={field.name}
      value={toInputValue(field.state.value)}
      error={getFieldError(field)}
      readOnly={readOnly}
      onBlur={field.handleBlur}
      onChange={(event) => {
        if (!readOnly) field.handleChange(event.currentTarget.value)
      }}
    />
  )
}

function TextareaField({ label, description, placeholder, readOnly }: RuntimeFieldProps) {
  const field = useFieldContext<string>()

  return (
    <Textarea
      autosize
      minRows={4}
      label={label}
      description={description}
      placeholder={placeholder}
      name={field.name}
      value={toInputValue(field.state.value)}
      error={getFieldError(field)}
      readOnly={readOnly}
      onBlur={field.handleBlur}
      onChange={(event) => {
        if (!readOnly) field.handleChange(event.currentTarget.value)
      }}
    />
  )
}

function NumberField({ label, description, placeholder, readOnly }: RuntimeFieldProps) {
  const field = useFieldContext<number | undefined>()

  return (
    <NumberInput
      label={label}
      description={description}
      placeholder={placeholder}
      name={field.name}
      value={field.state.value}
      error={getFieldError(field)}
      readOnly={readOnly}
      onBlur={field.handleBlur}
      onChange={(value) => {
        if (!readOnly) field.handleChange(typeof value === 'number' ? value : undefined)
      }}
    />
  )
}

function SelectField({ label, description, placeholder, readOnly, data }: RuntimeSelectFieldProps) {
  const field = useFieldContext<string | undefined>()

  return (
    <Select
      label={label}
      description={description}
      placeholder={placeholder}
      data={data}
      name={field.name}
      value={field.state.value ?? null}
      error={getFieldError(field)}
      readOnly={readOnly}
      disabled={readOnly}
      onBlur={field.handleBlur}
      onChange={(value) => {
        if (!readOnly) field.handleChange(value ?? undefined)
      }}
    />
  )
}

function MultiSelectField({ label, description, placeholder, readOnly, data }: RuntimeSelectFieldProps) {
  const field = useFieldContext<string[] | undefined>()

  return (
    <MultiSelect
      label={label}
      description={description}
      placeholder={placeholder}
      data={data}
      name={field.name}
      value={field.state.value ?? []}
      error={getFieldError(field)}
      readOnly={readOnly}
      disabled={readOnly}
      onBlur={field.handleBlur}
      onChange={(value) => {
        if (!readOnly) field.handleChange(value)
      }}
    />
  )
}

function TagsField({ label, description, placeholder, readOnly }: RuntimeFieldProps) {
  const field = useFieldContext<string[] | undefined>()

  return (
    <TagsInput
      label={label}
      description={description}
      placeholder={placeholder}
      name={field.name}
      value={field.state.value ?? []}
      error={getFieldError(field)}
      readOnly={readOnly}
      onBlur={field.handleBlur}
      onChange={(value) => {
        if (!readOnly) field.handleChange(value)
      }}
    />
  )
}

function RichTextField({ label, placeholder, readOnly }: RuntimeFieldProps) {
  const field = useFieldContext<string>()

  return (
    <RichTextEditor
      label={label}
      name={field.name}
      placeholder={placeholder}
      value={toInputValue(field.state.value)}
      onBlur={() => field.handleBlur()}
      onChange={(value) => {
        if (!readOnly) field.handleChange(value)
      }}
    />
  )
}

function SubmitButton({ label = 'Save', disabled }: { label?: string, disabled?: boolean }) {
  const form = useFormContext()

  return (
    <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
      {([canSubmit, isSubmitting]) => (
        <Button type='submit' disabled={disabled || !canSubmit} loading={isSubmitting}>
          {label}
        </Button>
      )}
    </form.Subscribe>
  )
}

function FormActions({ children }: { children: ReactNode }) {
  return <Group justify='flex-end'>{children}</Group>
}

function FormStack({ children }: { children: ReactNode }) {
  return <Stack gap='md'>{children}</Stack>
}

export const {
  useAppForm,
  withForm,
  withFieldGroup,
  useTypedAppFormContext
} = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    TextField,
    TextareaField,
    NumberField,
    SelectField,
    MultiSelectField,
    TagsField,
    RichTextField
  },
  formComponents: {
    SubmitButton,
    FormActions,
    FormStack
  }
})
