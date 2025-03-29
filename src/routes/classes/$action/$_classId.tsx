import { createFileRoute } from '@tanstack/react-router'
import ClassForm from '../../../pages/classes/ClassForm'

export const Route = createFileRoute('/classes/$action/$_classId')({
  component: ClassForm,
})
