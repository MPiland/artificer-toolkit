import { createFileRoute } from '@tanstack/react-router'
import Equipment from '../../../domains/equipment/Equipment'
import Loading from '~components/Loading/Loading'
import { Modal } from '@mantine/core'
import { fetchSingleEquipment } from '~apis'

export const Route = createFileRoute('/_authed/equipment/$equipmentId')({
  beforeLoad: () => {
    return { form: { type: 'equipment' } }
  },
  loader: ({ context, params }) => context.queryClient.ensureQueryData(fetchSingleEquipment(params.equipmentId)),
  pendingComponent: () => (
    <Modal withCloseButton={false} opened onClose={() => {}} centered size='auto'>
      <Loading />
    </Modal>
  ),
  component: Equipment,
})
