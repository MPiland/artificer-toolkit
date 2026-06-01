import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { AuthoredListPage } from '#components/AuthoredList'
import {
  buildEquipmentListFilters,
  equipmentListAttributeColumns,
  equipmentListSortOptions,
  mapEquipmentListToAuthoredItems,
  summarizeEquipmentList
} from '#app/data/equipment/equipmentListMapper'
import { equipmentListResponseFixture } from '../equipment.fixtures'

const meta = {
  title: 'Domains/Equipment/List',
  component: AuthoredListPage,
  parameters: {
    docs: {
      description: {
        component: 'Equipment list state coverage using the shared authored-domain list pattern, category filters, draft rows, and locked-master permissions.'
      }
    }
  },
  args: {
    title: 'Equipment',
    summary: summarizeEquipmentList(equipmentListResponseFixture),
    createLabel: 'Create Equipment',
    items: mapEquipmentListToAuthoredItems(equipmentListResponseFixture),
    filters: buildEquipmentListFilters(equipmentListResponseFixture),
    attributeColumns: equipmentListAttributeColumns,
    sortOptions: equipmentListSortOptions
  }
} satisfies Meta<typeof AuthoredListPage>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const BaseEquipment: Story = {
  args: {
    items: mapEquipmentListToAuthoredItems({
      ...equipmentListResponseFixture,
      items: equipmentListResponseFixture.items.filter((item) => item.category !== 'VARIANT')
    })
  }
}

export const Variants: Story = {
  args: {
    items: mapEquipmentListToAuthoredItems({
      ...equipmentListResponseFixture,
      items: equipmentListResponseFixture.items.filter((item) => item.category === 'VARIANT')
    })
  }
}

export const LockedMasterRows: Story = {
  args: {
    items: mapEquipmentListToAuthoredItems({
      ...equipmentListResponseFixture,
      items: equipmentListResponseFixture.items.filter((item) => item.provenance.kind === 'MASTER')
    })
  }
}

export const Empty: Story = {
  args: {
    items: []
  }
}

export const Loading: Story = {
  args: {
    loading: true
  }
}

export const Error: Story = {
  args: {
    error: 'The equipment list could not be loaded. Try again in a moment.'
  }
}
