import { createFileRoute } from '@tanstack/react-router'
import ClassForm from '../../../../domains/classes/form/ClassForm'
import Loading from '@components/Loading/Loading'
import { Modal } from '@mantine/core'
import { getClassFn } from '@server/domains'

export const Route = createFileRoute('/_authed/classes/$action/$_classId')({
  beforeLoad: () => {
    return { form: { type: 'classes' } }
  },
  loader: async ({ params }) => ({
    class: await getClassFn({ data: params._classId })
  }),
  pendingComponent: () => (
    <Modal withCloseButton={false} opened onClose={() => {}} centered size="auto">
      <Loading />
    </Modal>
  ),
  component: ClassForm
})
