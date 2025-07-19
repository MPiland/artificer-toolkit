import { createFileRoute } from '@tanstack/react-router'
import Feats from '@/pages/feats/Feats'
import { fetchFeats } from '@/apis/feats.api'
import Loading from '@/components/Loading/Loading'
import { Modal } from '@mantine/core'

export const Route = createFileRoute('/_protected/feats/')({
  beforeLoad: () => {
    return { form: { type: 'feats' } }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(fetchFeats(context.systemPref)),
  pendingComponent: () => (
    <Modal withCloseButton={false}  opened onClose={() => {}} centered size='auto'>
      <Loading />
    </Modal>
  ),
  component: Feats,
})
