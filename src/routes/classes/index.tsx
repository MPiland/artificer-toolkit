import { createFileRoute } from '@tanstack/react-router'
import Classes from '../../pages/classes/Classes'

export const Route = createFileRoute('/classes/')({
  component: Classes,
})