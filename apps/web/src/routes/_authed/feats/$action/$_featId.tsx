import { createFileRoute } from '@tanstack/react-router'
import FeatForm from '../../../../domains/feats/FeatForm'
import { fetchFeat } from '~apis'
import Loading from '~components/Loading/Loading'
import { Modal } from '@mantine/core'

export const Route = createFileRoute('/_authed/feats/$action/$_featId')({
  beforeLoad: () => {
    return { form: { type: 'feats' } }
  },
  loader: async ({ params, context }) => {
    const { _featId: featId } = params
    if (featId) {
      return context.queryClient.ensureQueryData(fetchFeat(featId))
    }
  },
  pendingComponent: () => (
    <Modal withCloseButton={false} opened onClose={() => {}} centered size='auto'>
      <Loading />
    </Modal>
  ),
  component: FeatForm,
})
