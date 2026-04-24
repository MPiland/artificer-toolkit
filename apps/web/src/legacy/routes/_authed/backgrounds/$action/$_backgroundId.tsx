import { createFileRoute } from '@tanstack/react-router'
import BackgroundForm from '../../../../domains/backgrounds/form/BackgroundForm'
import { getBackgroundFn } from '@server/domains/backgroundFns'
import Loading from '@components/Loading/Loading'
import { Modal } from '@mantine/core'

export const Route = createFileRoute('/_authed/backgrounds/$action/$_backgroundId')({
  beforeLoad: () => {
    return { form: { type: 'backgrounds' } }
  },
  loader: async ({ params }) => ({
    background: await getBackgroundFn({ data: params._backgroundId })
  }),
  pendingComponent: () => (
    <Modal withCloseButton={false} opened onClose={() => {}} centered size="auto">
      <Loading />
    </Modal>
  ),
  component: BackgroundForm
})
