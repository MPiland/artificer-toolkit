import { Suspense } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { shortsword } from '@artificer-toolkit/source-data/srd/equipment/shortsword.js'
import { shortswordPlus1 } from '@artificer-toolkit/source-data/srd/equipment/shortsword-plus-1.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { expect } from 'storybook/test'
import { getEquipment } from '#app/data/equipment/queries'
import { getSystem } from '#app/data/systems/queries'
import { toEquipmentFormValues } from '#domains/equipment/equipmentAuthoring.utils'
import { EquipmentParentPreview } from './EquipmentParentPreview'

function ShortswordPlus1Preview() {
  const { data: system } = useSuspenseQuery(getSystem(srdSystemRecord.id))
  const { data: variant } = useSuspenseQuery(getEquipment(shortswordPlus1.id))
  if (!variant || !variant.item) throw new Error('The seeded deployment has no Shortsword +1.')
  return (
    <EquipmentParentPreview
      context={{
        domain: 'equipment',
        label: shortswordPlus1.label,
        statusLabel: 'Draft',
        system,
        values: toEquipmentFormValues(variant.item)
      }}
      parentEquipmentId={shortsword.id}
    />
  )
}

// The seeded SRD Shortsword +1 variant inheriting its weight and value from the seeded SRD Shortsword, which the
// preview reads from the deployment as the story account (D218, D221).
const meta = {
  title: 'Forms/Previews/EquipmentParentPreview',
  component: ShortswordPlus1Preview,
  decorators: [
    (Story) => (
      <Suspense fallback={null}>
        <Story />
      </Suspense>
    )
  ]
} satisfies Meta<typeof ShortswordPlus1Preview>

export default meta

type Story = StoryObj<typeof meta>

export const ResolvedVariantEconomy: Story = {
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText('Weight', undefined, { timeout: 15_000 })
    ).toBeInTheDocument()
    await expect(await canvas.findByText('2 lb.')).toBeInTheDocument()
    await expect(canvas.getByText('Value')).toBeInTheDocument()
    await expect(canvas.getByText('10 gp')).toBeInTheDocument()
  }
}
