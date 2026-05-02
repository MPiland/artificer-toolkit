import type { Meta, StoryObj } from '@storybook/react-vite'
import { AuthoredListPage } from '#components/AuthoredList'
import {
  buildVehicleListFilters,
  mapVehicleListToAuthoredItems,
  summarizeVehicleList,
  vehicleListAttributeColumns,
  vehicleListSortOptions
} from '#app/data/vehicles/vehicleListMapper'
import { vehicleListFixture } from '../vehicle.fixtures'

const meta = {
  title: 'Domains/Vehicles/List',
  component: AuthoredListPage,
  parameters: {
    docs: {
      description: {
        component: 'Vehicle list state coverage using the shared authored-domain list pattern, category filters, draft rows, and locked-master permissions.'
      }
    }
  },
  args: {
    title: 'Vehicles',
    summary: summarizeVehicleList(vehicleListFixture),
    createLabel: 'Create Vehicle',
    items: mapVehicleListToAuthoredItems(vehicleListFixture),
    filters: buildVehicleListFilters(vehicleListFixture),
    attributeColumns: vehicleListAttributeColumns,
    sortOptions: vehicleListSortOptions
  }
} satisfies Meta<typeof AuthoredListPage>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const LockedMasterRows: Story = {
  args: {
    items: mapVehicleListToAuthoredItems({
      ...vehicleListFixture,
      items: vehicleListFixture.items.filter((item) => item.provenance.kind === 'MASTER')
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
    error: 'The vehicle list could not be loaded. Try again in a moment.'
  }
}
