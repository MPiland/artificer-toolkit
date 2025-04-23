import { createFileRoute } from '@tanstack/react-router'
import Equipments from '@/pages/equipment/Equipments'
import { fetchAllEquipment } from '@/apis/equipmentApi'
import Loading from '@/components/Loading/Loading'

export const Route = createFileRoute('/_protected/equipment/')({
  beforeLoad: () => {
    return { form: { type: 'equipment' } }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(fetchAllEquipment(context.systemPref)),
  pendingComponent: Loading,
  component: Equipments,
})
