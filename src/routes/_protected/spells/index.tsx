import { createFileRoute } from '@tanstack/react-router'
import Spells from '@/pages/spells/Spells'
import { fetchSpells } from '@/apis/spells.api'
import Loading from '@/components/Loading/Loading'
import { Modal } from '@mantine/core'

export const Route = createFileRoute('/_protected/spells/')({
  beforeLoad: () => {
    return { form: { type: 'spells' } }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(fetchSpells(context.systemPref)),
  pendingComponent: () => (
    <Modal withCloseButton={false}  opened onClose={() => {}} centered size='auto'>
      <Loading />
    </Modal>
  ),
  component: Spells,
})
