import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { EffectDto } from '@artificer-toolkit/schema'
import { EffectEditor } from './EffectEditor'
import { createDefaultEffect } from './effectEditor.utils'

const references = {
  damageTypes: [
    { value: 'fire', label: 'Fire' },
    { value: 'cold', label: 'Cold' }
  ],
  conditionTypes: [
    { value: 'blinded', label: 'Blinded' },
    { value: 'restrained', label: 'Restrained' }
  ],
  creatures: [{ value: 'sprite', label: 'Sprite' }]
}

function EffectEditorStory({ readOnly = false }: { readOnly?: boolean }) {
  const [effects, setEffects] = useState<EffectDto[]>([createDefaultEffect(1)])

  return (
    <EffectEditor
      effects={effects}
      onEffectsChange={setEffects}
      references={references}
      readOnly={readOnly}
    />
  )
}

const meta = {
  title: 'Components/EffectEditor',
  component: EffectEditor,
  parameters: {
    docs: {
      description: {
        component: 'Reusable full-screen modal editor for engine-backed effects. Domains own their summary sections and pass reference data; this component owns invocation, paths, and outcomes.'
      }
    }
  }
} satisfies Meta<typeof EffectEditor>

export default meta

type Story = StoryObj<typeof meta>

export const Editable: Story = {
  args: {
    effects: [],
    onEffectsChange: () => undefined,
    references
  },
  render: () => <EffectEditorStory />
}

export const Readonly: Story = {
  args: {
    effects: [],
    onEffectsChange: () => undefined,
    references,
    readOnly: true
  },
  render: () => <EffectEditorStory readOnly />
}
