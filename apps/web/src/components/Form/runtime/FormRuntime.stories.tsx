import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button, Paper, Stack, Text } from '@mantine/core'
import type { NodeMap } from '@artificer-toolkit/shared/utils'
import { AuthoredFormRuntime, useAppForm } from '.'

type SpellFormFixture = {
  id: string
  label: string
  description: string
  level: number
  magicSchoolId: string
  attributes: string[]
  components: string[]
  materialDescription: string
  classIds: string[]
  effects: Array<Record<string, unknown>>
  notes: string[]
  nestedObject?: {
    summary?: string
  }
  richNotes: string
}

const defaultValues: SpellFormFixture = {
  id: 'spell-story',
  label: 'Ember Ward',
  description: '<p>A soft ring of protective heat surrounds the target.</p>',
  level: 2,
  magicSchoolId: 'abjuration',
  attributes: ['CONCENTRATION'],
  components: ['VERBAL', 'SOMATIC'],
  materialDescription: '',
  classIds: ['wizard'],
  effects: [],
  notes: ['Useful for playtest encounters'],
  nestedObject: {
    summary: 'A small nested editor preview.'
  },
  richNotes: '<p>Use this field for formatted longform notes.</p>'
}

const spellAttributeOptions = [
  { code: 'CONCENTRATION', label: 'Concentration' },
  { code: 'RITUAL', label: 'Ritual' }
] as const

const spellComponentOptions = [
  { code: 'VERBAL', label: 'Verbal' },
  { code: 'SOMATIC', label: 'Somatic' },
  { code: 'MATERIAL', label: 'Material' }
] as const

const magicSchoolOptions = [
  { code: 'abjuration', label: 'Abjuration' },
  { code: 'evocation', label: 'Evocation' }
] as const

const inlineOptions = [
  ...spellAttributeOptions.map((option) => ({ value: option.code, label: option.label })),
  ...spellComponentOptions.map((option) => ({ value: option.code, label: option.label })),
  { value: 'abjuration', label: 'Abjuration' },
  { value: 'evocation', label: 'Evocation' },
  { value: 'wizard', label: 'Wizard' },
  { value: 'cleric', label: 'Cleric' }
]

const storybookSpellNodeMap = {
  schemaVersion: 1,
  mapId: 'storybookSpell',
  nodes: {
    label: {
      kind: 'INPUT',
      type: 'TEXT',
      path: ['label'],
      label: 'Name',
      order: 1,
      section: { id: 'basics', label: 'Basics', order: 1 }
    },
    description: {
      kind: 'INPUT',
      type: 'RICH_TEXT',
      path: ['description'],
      label: 'Description',
      order: 2,
      section: { id: 'basics', label: 'Basics', order: 1 }
    },
    level: {
      kind: 'INPUT',
      type: 'NUMBER',
      path: ['level'],
      label: 'Level',
      order: 1,
      section: { id: 'casting', label: 'Casting', order: 2 }
    },
    magicSchoolId: {
      kind: 'INPUT',
      type: 'SELECT_SINGLE',
      path: ['magicSchoolId'],
      label: 'Magic School',
      source: { kind: 'INLINE', options: magicSchoolOptions },
      order: 2,
      section: { id: 'casting', label: 'Casting', order: 2 }
    },
    components: {
      kind: 'INPUT',
      type: 'SELECT_MULTI',
      path: ['components'],
      label: 'Components',
      source: { kind: 'INLINE', options: spellComponentOptions },
      order: 3,
      section: { id: 'casting', label: 'Casting', order: 2 }
    },
    attributes: {
      kind: 'INPUT',
      type: 'SELECT_MULTI',
      path: ['attributes'],
      label: 'Attributes',
      source: { kind: 'INLINE', options: spellAttributeOptions },
      order: 4,
      section: { id: 'casting', label: 'Casting', order: 2 }
    }
  }
} satisfies NodeMap<SpellFormFixture>

function RuntimePrimitiveDemo({ readOnly = false }: { readOnly?: boolean }) {
  const form = useAppForm({
    defaultValues,
    onSubmit: () => undefined
  })

  return (
    <form.AppForm>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          form.handleSubmit()
        }}
      >
        <form.FormStack>
          <form.AppField name='label'>
            {(field) => <field.TextField label='Name' readOnly={readOnly} />}
          </form.AppField>
          <form.AppField name='description'>
            {(field) => <field.TextareaField label='Description' readOnly={readOnly} />}
          </form.AppField>
          <form.AppField name='richNotes'>
            {(field) => <field.RichTextField label='Rich Text Notes' readOnly={readOnly} />}
          </form.AppField>
          <form.AppField name='level'>
            {(field) => <field.NumberField label='Level' readOnly={readOnly} />}
          </form.AppField>
          <form.AppField name='magicSchoolId'>
            {(field) => <field.SelectField label='Magic School' data={inlineOptions} readOnly={readOnly} />}
          </form.AppField>
          <form.AppField name='components'>
            {(field) => <field.MultiSelectField label='Components' data={inlineOptions} readOnly={readOnly} />}
          </form.AppField>
          <form.AppField name='notes'>
            {(field) => <field.TagsField label='Tags' readOnly={readOnly} />}
          </form.AppField>
          <form.FormActions>
            <form.SubmitButton disabled={readOnly} />
          </form.FormActions>
        </form.FormStack>
      </form>
    </form.AppForm>
  )
}

function RuntimeRendererDemo({ readOnly = false }: { readOnly?: boolean }) {
  const form = useAppForm({
    defaultValues,
    onSubmit: () => undefined
  })

  return (
    <form.AppForm>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          form.handleSubmit()
        }}
      >
        <AuthoredFormRuntime
          form={form}
          nodeMap={storybookSpellNodeMap}
          readOnly={readOnly}
          onCopy={() => undefined}
        />
      </form>
    </form.AppForm>
  )
}

function NestedObjectDemo() {
  const form = useAppForm({
    defaultValues,
    onSubmit: () => undefined
  })

  return (
    <form.AppForm>
      <Paper p='lg'>
        <Stack>
          <Text fw={600}>Nested Object</Text>
          <form.AppField name='nestedObject.summary'>
            {(field) => <field.TextField label='Nested summary' />}
          </form.AppField>
          <form.Subscribe selector={(state) => state.values.nestedObject?.summary}>
            {(summary) => <Text size='sm' c='dimmed'>{`Current summary: ${summary ?? ''}`}</Text>}
          </form.Subscribe>
        </Stack>
      </Paper>
    </form.AppForm>
  )
}

function NestedCollectionDemo() {
  const form = useAppForm({
    defaultValues,
    onSubmit: () => undefined
  })

  return (
    <form.AppForm>
      <Paper p='lg'>
        <Stack>
          <Text fw={600}>Nested Collection</Text>
          <form.AppField name='notes' mode='array'>
            {(field) => (
              <Stack>
                <Button onClick={() => field.pushValue(`Note ${field.state.value?.length ?? 0}`)}>
                  Add note
                </Button>
                {(field.state.value ?? []).map((note, index) => (
                  <Text key={`${note}-${index}`}>{note}</Text>
                ))}
              </Stack>
            )}
          </form.AppField>
        </Stack>
      </Paper>
    </form.AppForm>
  )
}

const meta = {
  title: 'Platform/Form Runtime',
  parameters: {
    docs: {
      description: {
        component: 'Shared Phase 9.5 authored-form runtime using TanStack Form, Mantine fields, sectioned node maps, and locked-master read-only behavior.'
      }
    }
  }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const FieldPrimitives: Story = {
  render: () => <RuntimePrimitiveDemo />
}

export const FieldPrimitivesReadonly: Story = {
  render: () => <RuntimePrimitiveDemo readOnly />
}

export const SectionedNodeMap: Story = {
  render: () => <RuntimeRendererDemo />
}

export const LockedMasterReadonly: Story = {
  render: () => <RuntimeRendererDemo readOnly />
}

export const NestedCollection: Story = {
  render: () => <NestedCollectionDemo />
}

export const NestedObject: Story = {
  render: () => <NestedObjectDemo />
}
