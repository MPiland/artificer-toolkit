import { createFileRoute } from '@tanstack/react-router'
import EquipmentForm from '../../../pages/equipment/EquipmentForm'

export const Route = createFileRoute('/equipment/$action/$_equipmentId')({
  component: EquipmentForm,
})
