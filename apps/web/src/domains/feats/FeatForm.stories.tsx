import type { Meta, StoryObj } from '@storybook/react-vite'
import { AuthoredFormPageFrame, authoredFormStoryCanvas } from '#components/Form/AuthoredFormPageFrame'
import { spellReferenceFixture } from '#domains/spells/spellAuthoring.fixtures'
import { FeatForm } from './FeatForm'
import {
  masterFeatResponseFixture,
  ownedFeatFixture,
  ownedFeatResponseFixture
} from './feat.fixtures'
import * as styles from './featAuthoring.css'

const meta = {
  title: 'Domains/Feats/Form',
  component: FeatForm,
  parameters: {
    docs: {
      description: {
        component: 'Phase 9.8 Feat authoring form using the shared authored form layout, reusable effect editor, locked-master mode, and node-runtime-backed nested editors.'
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
} satisfies Meta<typeof FeatForm>

export default meta

type Story = StoryObj<typeof meta>

export const Create: Story = {
  args: {
    mode: 'create',
    systemId: 'dnd-5e-srd',
    userId: 'user-1',
    references: spellReferenceFixture,
    initialFeat: {
      ...ownedFeatFixture,
      id: 'new-feat',
      label: '',
      description: '',
      detail: '',
      effects: [],
      features: []
    },
    resolveRuntime: false,
    onSubmit: async () => undefined
  }
}

export const EditOwned: Story = {
  args: {
    mode: 'edit',
    systemId: ownedFeatResponseFixture.item.systemId,
    userId: 'user-1',
    references: spellReferenceFixture,
    response: ownedFeatResponseFixture,
    resolveRuntime: false,
    onSubmit: async () => undefined
  }
}

export const LockedMasterReadonly: Story = {
  args: {
    mode: 'view',
    systemId: masterFeatResponseFixture.item.systemId,
    userId: 'user-1',
    references: spellReferenceFixture,
    response: masterFeatResponseFixture,
    resolveRuntime: false,
    onSubmit: async () => undefined,
    onCopy: () => undefined
  }
}
