import { createFileRoute } from '@tanstack/react-router'
import Background from '../../../domains/backgrounds/Background'
import { fetchBackground } from '~apis'
import Loading from '~components/Loading/Loading'
import { Modal } from '@mantine/core'

export const Route = createFileRoute('/_authed/backgrounds/$backgroundId')({
  beforeLoad: () => {
    return { form: { type: 'backgrounds' } }
  },
  loader: ({ context, params }) => context.queryClient.ensureQueryData(fetchBackground(params.backgroundId)),
  pendingComponent: () => (
    <Modal withCloseButton={false} opened onClose={() => {}} centered size='auto'>
      <Loading />
    </Modal>
  ),
  component: Background,
})
