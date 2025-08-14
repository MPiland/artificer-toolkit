import { createFileRoute } from '@tanstack/react-router'
import Equipments from '~/pages/equipment/Equipments'
import { fetchAllEquipment } from '~/apis'
import Loading from '~/components/Loading/Loading'
import { Modal } from '@mantine/core'

export const Route = createFileRoute('/_protected/equipment/')({
  beforeLoad: () => {
    return { form: { type: 'equipment' } }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(fetchAllEquipment(context.systemPref)),
  pendingComponent: () => (
    <Modal withCloseButton={false} opened onClose={() => {}} centered size='auto'>
      <Loading />
    </Modal>
  ),
  component: Equipments,
})
