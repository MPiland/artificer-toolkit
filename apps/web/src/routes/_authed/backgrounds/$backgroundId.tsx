import { createFileRoute } from '@tanstack/react-router'
import Background from '../../../domains/backgrounds/Background'
import Loading from '@components/Loading/Loading'
import { Modal } from '@mantine/core'
import { getBackgroundFn } from '@server/domains/backgroundFns'

export const Route = createFileRoute('/_authed/backgrounds/$backgroundId')({
  beforeLoad: () => {
    return { form: { type: 'backgrounds' } }
  },
  loader: async ({ params }) => ({
    background: await getBackgroundFn({ data: params.backgroundId })
  }),
  pendingComponent: () => (
    <Modal withCloseButton={false} opened onClose={() => {}} centered size="auto">
      <Loading />
    </Modal>
  ),
  component: Background
})
