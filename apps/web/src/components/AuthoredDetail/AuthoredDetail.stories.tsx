import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  AuthoredDetailItemList,
  AuthoredDetailLayout,
  AuthoredDetailProse
} from './AuthoredDetail'
import { storyCanvas } from './AuthoredDetail.css'

const meta = {
  title: 'Platform/Authored Detail/AuthoredDetailLayout',
  component: AuthoredDetailLayout,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className={storyCanvas}>
        <Story />
      </div>
    )
  ],
  parameters: {
    docs: {
      description: {
        component:
          'Reader-first detail page shell for authored content. It borrows information architecture patterns from tabletop reference pages without copying their visual language.'
      }
    }
  },
  args: {
    eyebrow: 'Race',
    title: 'Sea Elf',
    description: 'A clean read surface for table reference, draft preview, and locked master content.',
    status: ['Draft Preview', 'Homebrew'],
    facts: [
      { label: 'Category', value: 'Subrace' },
      { label: 'Parent', value: 'Parent race selected' },
      { label: 'Features', value: '2 features' },
      { label: 'Details', value: '3 details' }
    ],
    notice: {
      tone: 'draft',
      title: 'Draft preview',
      body: 'You are previewing unsaved draft changes. The active race remains unchanged until activation.'
    },
    sections: [
      {
        id: 'description',
        title: 'Description',
        content: <AuthoredDetailProse html='<p>Sea elves move through reef cities and moonlit kelp forests with equal grace.</p>' />
      },
      {
        id: 'features',
        title: 'Features',
        content: (
          <AuthoredDetailItemList
            empty='No features have been added.'
            items={[
              {
                id: 'child-of-the-sea',
                title: 'Child of the Sea',
                description: '<p>You have a swimming speed and can breathe air and water.</p>'
              },
              {
                id: 'friend-of-the-sea',
                title: 'Friend of the Sea',
                description: '<p>You can communicate simple ideas with beasts that have an innate swimming speed.</p>'
              }
            ]}
          />
        )
      }
    ]
  }
} satisfies Meta<typeof AuthoredDetailLayout>

export default meta

type Story = StoryObj<typeof meta>

export const DraftPreview: Story = {}

export const LockedMaster: Story = {
  args: {
    actions: [
      { label: 'Create New', tone: 'secondary', onClick: () => undefined },
      { label: 'Duplicate', tone: 'secondary', onClick: () => undefined }
    ],
    notice: undefined,
    status: ['SRD', 'Active']
  }
}

export const InvalidDraftFallback: Story = {
  args: {
    notice: {
      tone: 'warning',
      title: 'Invalid draft found',
      body: 'The active race is shown because the saved draft no longer matches the current schema.'
    },
    status: ['SRD', 'Active']
  }
}

export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1'
    }
  }
}
