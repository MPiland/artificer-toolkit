import { createFileRoute } from '@tanstack/react-router'
import Backgrounds from '~/pages/backgrounds/Backgrounds'
import { fetchBackgrounds } from '~/apis'
import Loading from '~/components/Loading/Loading'
import { Modal } from '@mantine/core'

export const Route = createFileRoute('/_protected/backgrounds/')({
  beforeLoad: () => {
    return { form: { type: 'backgrounds' } }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(fetchBackgrounds(context.systemPref)),
  pendingComponent: () => (
    <Modal withCloseButton={false} opened onClose={() => {}} centered size='auto'>
      <Loading />
    </Modal>
  ),
  component: Backgrounds,
})
