import {
  Button,
  Group,
  NumberInput,
  Stack,
  TagsInput,
  TextInput,
  Textarea
} from '@mantine/core'
import type { ReactNode } from 'react'
import RichTextEditor from '#app/ui/primitives/RichTextEditor'
import { AppMultiSelect, AppSelect } from '#app/ui/primitives/Select'
import * as inputStyles from '#app/ui/primitives/Select/Select.css'
import { useFieldContext, useFormContext } from './AppForm.context'
import { getFieldError, toInputValue, type SelectOption } from '../utils/formUtils'

export type RuntimeFieldProps = {
  label?: string
  description?: string
  placeholder?: string
  required?: boolean
  readOnly?: boolean
}

export type RuntimeSelectFieldProps = RuntimeFieldProps & {
  data: SelectOption[]
}

const fieldClassNames = {
  label: inputStyles.label,
  description: inputStyles.description,
  input: inputStyles.input
}

const pillsFieldClassNames = {
  ...fieldClassNames,
  pill: inputStyles.pill,
  pillsList: inputStyles.pillsList,
  inputField: inputStyles.inputField
}

export function TextField({ label, description, placeholder, required, readOnly }: RuntimeFieldProps) {
  const field = useFieldContext<string>()

  return (
    <TextInput
      label={label}
      description={description}
      placeholder={placeholder}
      required={required}
      name={field.name}
      value={toInputValue(field.state.value)}
      error={getFieldError(field)}
      readOnly={readOnly}
      classNames={fieldClassNames}
      onBlur={field.handleBlur}
      onChange={(event) => {
        if (!readOnly) field.handleChange(event.currentTarget.value)
      }}
    />
  )
}

export function TextareaField({ label, description, placeholder, required, readOnly }: RuntimeFieldProps) {
  const field = useFieldContext<string>()

  return (
    <Textarea
      autosize
      minRows={4}
      label={label}
      description={description}
      placeholder={placeholder}
      required={required}
      name={field.name}
      value={toInputValue(field.state.value)}
      error={getFieldError(field)}
      readOnly={readOnly}
      classNames={fieldClassNames}
      onBlur={field.handleBlur}
      onChange={(event) => {
        if (!readOnly) field.handleChange(event.currentTarget.value)
      }}
    />
  )
}

export function NumberField({ label, description, placeholder, required, readOnly }: RuntimeFieldProps) {
  const field = useFieldContext<number | undefined>()

  return (
    <NumberInput
      label={label}
      description={description}
      placeholder={placeholder}
      required={required}
      name={field.name}
      value={field.state.value}
      error={getFieldError(field)}
      readOnly={readOnly}
      classNames={fieldClassNames}
      onBlur={field.handleBlur}
      onChange={(value) => {
        if (!readOnly) field.handleChange(typeof value === 'number' ? value : undefined)
      }}
    />
  )
}

export function SelectField({ label, description, placeholder, required, readOnly, data }: RuntimeSelectFieldProps) {
  const field = useFieldContext<string | undefined>()

  return (
    <AppSelect
      label={label}
      description={description}
      placeholder={placeholder}
      required={required}
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

export function MultiSelectField({ label, description, placeholder, required, readOnly, data }: RuntimeSelectFieldProps) {
  const field = useFieldContext<string[] | undefined>()

  return (
    <AppMultiSelect
      label={label}
      description={description}
      placeholder={placeholder}
      required={required}
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

export function TagsField({ label, description, placeholder, required, readOnly }: RuntimeFieldProps) {
  const field = useFieldContext<string[] | undefined>()

  return (
    <TagsInput
      label={label}
      description={description}
      placeholder={placeholder}
      required={required}
      name={field.name}
      value={field.state.value ?? []}
      error={getFieldError(field)}
      readOnly={readOnly}
      classNames={pillsFieldClassNames}
      onBlur={field.handleBlur}
      onChange={(value) => {
        if (!readOnly) field.handleChange(value)
      }}
    />
  )
}

export function RichTextField({ label, placeholder, required, readOnly }: RuntimeFieldProps) {
  const field = useFieldContext<string>()

  return (
    <RichTextEditor
      label={label}
      name={field.name}
      placeholder={placeholder}
      required={required}
      value={toInputValue(field.state.value)}
      readOnly={readOnly}
      onBlur={() => field.handleBlur()}
      onChange={(value) => {
        if (!readOnly) field.handleChange(value)
      }}
    />
  )
}

export function SubmitButton({ label = 'Save', disabled }: { label?: string, disabled?: boolean }) {
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

export function FormActions({ children }: { children: ReactNode }) {
  return <Group justify='flex-end'>{children}</Group>
}

export function FormStack({ children }: { children: ReactNode }) {
  return <Stack gap='md'>{children}</Stack>
}
