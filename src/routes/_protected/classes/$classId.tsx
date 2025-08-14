import { createFileRoute } from '@tanstack/react-router'
import Class from '~/pages/classes/Class'
import { fetchClass } from '~/apis'
import Loading from '~/components/Loading/Loading'
import { Modal } from '@mantine/core'

export const Route = createFileRoute('/_protected/classes/$classId')({
  beforeLoad: () => {
    return { form: { type: 'classes' } }
  },
  loader: ({ context, params }) => context.queryClient.ensureQueryData(fetchClass(params.classId)),
  pendingComponent: () => (
    <Modal withCloseButton={false} opened onClose={() => {}} centered size='auto'>
      <Loading />
    </Modal>
  ),
  component: Class,
})
