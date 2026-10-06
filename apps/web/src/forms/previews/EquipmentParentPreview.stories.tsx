import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect } from 'storybook/test'
import {
  authoredRouteStoryEquipmentParentResponse,
  authoredRouteStoryRecords,
  authoredRouteStorySystem
} from '#domains/authoredRouteStory.fixtures'
import { toEquipmentFormValues } from '#domains/equipment/equipmentAuthoring.utils'
import { getEquipment } from '#app/data/equipment/queries'
import { EquipmentParentPreview } from './EquipmentParentPreview'

const parentEquipment = authoredRouteStoryEquipmentParentResponse.item
if (!parentEquipment) throw new Error('Expected the equipment parent fixture.')

const queryClient = new QueryClient()
queryClient.setQueryDefaults(getEquipment(parentEquipment.id).queryKey, {
  queryFn: async () => authoredRouteStoryEquipmentParentResponse
})
queryClient.setQueryData(
  getEquipment(parentEquipment.id).queryKey,
  authoredRouteStoryEquipmentParentResponse
)

const meta = {
  title: 'Forms/Previews/EquipmentParentPreview',
  component: EquipmentParentPreview,
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    )
  ],
  args: {
    context: {
      domain: 'equipment',
      label: authoredRouteStoryRecords.equipment.label,
      statusLabel: 'Draft',
      system: authoredRouteStorySystem,
      values: toEquipmentFormValues(authoredRouteStoryRecords.equipment)
    },
    parentEquipmentId: parentEquipment.id
  }
} satisfies Meta<typeof EquipmentParentPreview>

export default meta

type Story = StoryObj<typeof meta>

export const ResolvedVariantEconomy: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Weight')).toBeInTheDocument()
    await expect(canvas.getByText('2 lb.')).toBeInTheDocument()
    await expect(canvas.getByText('Value')).toBeInTheDocument()
    await expect(canvas.getByText('10 gp')).toBeInTheDocument()
  }
}
