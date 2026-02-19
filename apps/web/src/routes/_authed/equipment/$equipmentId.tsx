import { createFileRoute } from '@tanstack/react-router'
import Equipment from '../../../domains/equipment/Equipment'
import Loading from '@components/Loading/Loading'
import { Modal } from '@mantine/core'
import { getEquipmentFn } from '@server/domains'

export const Route = createFileRoute('/_authed/equipment/$equipmentId') ({
  beforeLoad: () => {
    return { form: { type: 'equipment' } }
  },
  loader: async ({ params }) => ({
    equipment: await getEquipmentFn({ data: params.equipmentId })
  }),
  pendingComponent: () => (
    <Modal withCloseButton={false} opened onClose={() => {}} centered size="auto">
      <Loading />
    </Modal>
  ),
  component: Equipment
})
