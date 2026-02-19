import { createFileRoute } from '@tanstack/react-router'
import Backgrounds from '../../../domains/backgrounds/Backgrounds'
import Loading from '@components/Loading/Loading'
import { Modal } from '@mantine/core'
import { getBackgroundList } from '@data/backgrounds'

export const Route = createFileRoute('/_authed/backgrounds/')({
  beforeLoad: () => {
    return { form: { type: 'backgrounds' } }
  },
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData(getBackgroundList())
  },
  pendingComponent: () => (
    <Modal withCloseButton={false} opened onClose={() => {}} centered size="auto">
      <Loading />
    </Modal>
  ),
  component: Backgrounds
})
