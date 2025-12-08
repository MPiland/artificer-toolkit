import { createFileRoute } from '@tanstack/react-router'
import Loading from '~components/Loading/Loading'
import { Modal } from '@mantine/core'
import { fetchFeat } from '~apis'
import Feat from '../../../domains/feats/Feat'

export const Route = createFileRoute('/_authed/feats/$featId')({
  beforeLoad: () => {
    return { form: { type: 'feats' } }
  },
  loader: ({ context, params }) => context.queryClient.ensureQueryData(fetchFeat(params.featId)),
  pendingComponent: () => (
    <Modal withCloseButton={false} opened onClose={() => {}} centered size='auto'>
      <Loading />
    </Modal>
  ),
  component: Feat,
})
