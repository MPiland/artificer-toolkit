import { createFileRoute } from '@tanstack/react-router'
import BackgroundForm from '../../../pages/backgrounds/BackgroundForm'

export const Route = createFileRoute('/backgrounds/$action/$_backgroundId')({
  component: BackgroundForm,
})
