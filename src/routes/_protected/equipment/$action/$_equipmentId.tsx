import { createFileRoute } from '@tanstack/react-router'
import EquipmentForm from '@/pages/equipment/EquipmentForm'
import { fetchSingleEquipment } from '@/apis/equipment.api'
import Loading from '@/components/Loading/Loading'
import { Modal } from '@mantine/core'

export const Route = createFileRoute('/_protected/equipment/$action/$_equipmentId')({
  beforeLoad: () => {
    return { form: { type: 'equipment' } }
  },
  loader: async ({ params, context }) => {
    const { _equipmentId: equipmentId } = params
    if (equipmentId) {
      return context.queryClient.ensureQueryData(fetchSingleEquipment(equipmentId))
    }
  },
  pendingComponent: () => (
    <Modal withCloseButton={false}  opened onClose={() => {}} centered size='auto'>
      <Loading />
    </Modal>
  ),
  component: EquipmentForm,
})
