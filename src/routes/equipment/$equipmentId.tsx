import { createFileRoute } from '@tanstack/react-router'
import Equipment from '../../pages/equipment/Equipment'

export const Route = createFileRoute('/equipment/$equipmentId')({
  component: Equipment,
})
