import { createFileRoute } from '@tanstack/react-router'
import Equipments from '../../pages/equipment/Equipments'

export const Route = createFileRoute('/equipment/')({
  component: Equipments,
})
