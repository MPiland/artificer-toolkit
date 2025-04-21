import { createFileRoute } from '@tanstack/react-router'
import Equipment from '../../../pages/equipment/Equipment'

export const Route = createFileRoute('/_protected/equipment/$equipmentId')({
  beforeLoad: () => {
    return { form: { type: 'equipment' } }
  },
  component: Equipment,
})
