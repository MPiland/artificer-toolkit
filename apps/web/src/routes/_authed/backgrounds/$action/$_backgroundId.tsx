import { createFileRoute } from '@tanstack/react-router'
import BackgroundForm from '../../../../domains/backgrounds/BackgroundForm'
import { fetchBackground } from '~apis'
import Loading from '~components/Loading/Loading'
import { Modal } from '@mantine/core'

export const Route = createFileRoute('/_authed/backgrounds/$action/$_backgroundId')({
  beforeLoad: () => {
    return { form: { type: 'backgrounds' } }
  },
  loader: async ({ params, context }) => {
    const { _backgroundId: backgroundId } = params
    if (backgroundId) {
      return context.queryClient.ensureQueryData(fetchBackground(backgroundId))
    }
  },
  pendingComponent: () => (
    <Modal withCloseButton={false} opened onClose={() => {}} centered size='auto'>
      <Loading />
    </Modal>
  ),
  component: BackgroundForm,
})
