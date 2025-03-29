import { createFileRoute } from '@tanstack/react-router'
import Class from '../../pages/classes/Class'

export const Route = createFileRoute('/classes/$classId')({
  component: Class,
})
