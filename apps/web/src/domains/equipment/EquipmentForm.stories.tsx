import type { Meta, StoryObj } from '@storybook/react-vite'
import { AuthoredFormPageFrame, authoredFormStoryCanvas } from '#components/Form/AuthoredFormPageFrame'
import { EquipmentForm } from './EquipmentForm'
import {
  equipmentRuntimeFixture,
  masterEquipmentResponseFixture,
  ownedEquipmentFixture,
  ownedEquipmentResponseFixture,
  ownedVariantEquipmentFixture,
  ownedVariantEquipmentResponseFixture
} from './equipment.fixtures'
import * as styles from './equipmentAuthoring.css'

const references = {
  systemId: 'dnd-5e-srd',
  damageTypes: [],
  conditionTypes: [],
  creatures: []
}

const meta = {
  title: 'Domains/Equipment/Form',
  component: EquipmentForm,
  parameters: {
    docs: {
      description: {
        component: 'Phase 9.10 Equipment authoring form using base item and variant flows, shared authored form layout, node-runtime options, draft sidecar behavior, and locked-master copy affordances.'
      }
    }
  },
  decorators: [
    (Story) => (
      <div className={authoredFormStoryCanvas}>
        <AuthoredFormPageFrame contentClassName={styles.contentWide}>
          <Story />
        </AuthoredFormPageFrame>
      </div>
    )
  ]
} satisfies Meta<typeof EquipmentForm>

export default meta

type Story = StoryObj<typeof meta>

export const CreateBaseEquipment: Story = {
  args: {
    mode: 'create',
    systemId: 'dnd-5e-srd',
    userId: 'user-1',
    references,
    initialEquipment: {
      ...ownedEquipmentFixture,
      id: 'new-equipment',
      label: '',
      quote: '',
      description: '',
      contains: [],
      features: []
    },
    resolveRuntime: false,
    runtimeModel: equipmentRuntimeFixture,
    onSubmit: async () => undefined
  }
}

export const EditBaseEquipment: Story = {
  args: {
    mode: 'edit',
    systemId: ownedEquipmentFixture.systemId,
    userId: 'user-1',
    references,
    response: ownedEquipmentResponseFixture,
    resolveRuntime: false,
    runtimeModel: equipmentRuntimeFixture,
    onSubmit: async () => undefined
  }
}

export const EditVariantEquipment: Story = {
  args: {
    mode: 'edit',
    systemId: ownedVariantEquipmentFixture.systemId,
    userId: 'user-1',
    references,
    response: ownedVariantEquipmentResponseFixture,
    resolveRuntime: false,
    runtimeModel: equipmentRuntimeFixture,
    onSubmit: async () => undefined
  }
}

export const LockedMasterReadonly: Story = {
  args: {
    mode: 'view',
    systemId: masterEquipmentResponseFixture.item.systemId,
    userId: 'user-1',
    references,
    response: masterEquipmentResponseFixture,
    resolveRuntime: false,
    runtimeModel: equipmentRuntimeFixture,
    onSubmit: async () => undefined,
    onCopy: () => undefined
  }
}
