import { createFileRoute } from '@tanstack/react-router'
import Classes from '@/pages/classes/Classes'
import { fetchClasses } from '@/apis/classes.api'
import Loading from '@/components/Loading/Loading'
import { Modal } from '@mantine/core'

export const Route = createFileRoute('/_protected/classes/')({
  beforeLoad: () => {
    return { form: { type: 'classes' } }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(fetchClasses(context.systemPref)),
  pendingComponent: () => (
    <Modal withCloseButton={false}  opened onClose={() => {}} centered size='auto'>
      <Loading />
    </Modal>
  ),
  component: Classes,
})
