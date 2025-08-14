import { createFileRoute } from '@tanstack/react-router'
import ClassForm from '~/pages/classes/ClassForm'
import { fetchClass } from '~/apis'
import Loading from '~/components/Loading/Loading'
import { Modal } from '@mantine/core'

export const Route = createFileRoute('/_protected/classes/$action/$_classId')({
  beforeLoad: () => {
    return { form: { type: 'classes' } }
  },
  loader: async ({ params, context }) => {
    const { _classId } = params
    if (_classId) {
      return context.queryClient.ensureQueryData(fetchClass(_classId))
    }
  },
  pendingComponent: () => (
    <Modal withCloseButton={false} opened onClose={() => {}} centered size='auto'>
      <Loading />
    </Modal>
  ),
  component: ClassForm,
})
