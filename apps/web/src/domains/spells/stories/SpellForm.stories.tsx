import type {
  Meta,
  StoryObj } from '@storybook/react-vite'
import type { SpellResponseDto } from '@artificer-toolkit/schema/api/content'
import { authoringFormStoryCanvas, createDefaultEffect } from '#forms'
import { SpellForm } from '../components/SpellForm'
import { spellFixture, spellReferenceFixture } from '../spellAuthoring.fixtures'

const ownedResponse: NonNullable<SpellResponseDto> = {
  item: {
    ...spellFixture,
    effects: [createDefaultEffect(1)]
  },
  provenance: {
    kind: 'OWNED',
    ownerUserId: 'user-1'
  },
  permissions: {
    canView: true,
    canEdit: true,
    canCopy: true,
    canDelete: true
  }
}

const lockedResponse: NonNullable<SpellResponseDto> = {
  item: {
    ...spellFixture,
    id: 'spell-master-fire-lace',
    label: 'Master Fire Lace'
  },
  provenance: {
    kind: 'MASTER',
    ownerUserId: null
  },
  permissions: {
    canView: true,
    canEdit: false,
    canCopy: true,
    canDelete: false
  }
}

const meta = {
  title: 'Domains/Spells/Form',
  component: SpellForm,
  parameters: {
    docs: {
      description: {
        component: 'Phase 9.6 Spell authoring form using the shared TanStack Form runtime, REST DTO shape, section navigation, locked-master mode, and the engine-backed effect editor.'
      }
    }
  },
  decorators: [
    (Story) => (
      <div className={authoringFormStoryCanvas}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof SpellForm>

export default meta

type Story = StoryObj<typeof meta>

export const Create: Story = {
  args: {
    mode: 'create',
    userId: 'user-1',
    references: spellReferenceFixture,
    onSubmit: async () => undefined
  }
}

export const EditOwned: Story = {
  args: {
    mode: 'edit',
    userId: 'user-1',
    references: spellReferenceFixture,
    response: ownedResponse,
    onSubmit: async () => undefined
  }
}

export const LockedMasterReadonly: Story = {
  args: {
    mode: 'view',
    userId: 'user-1',
    references: spellReferenceFixture,
    response: lockedResponse,
    onSubmit: async () => undefined,
    onCopy: () => undefined
  }
}
