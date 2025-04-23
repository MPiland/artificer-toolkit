import { createFileRoute } from '@tanstack/react-router'
import ClassForm from '@/pages/classes/ClassForm'
import { fetchClass } from '@/apis/classesApi'

export const Route = createFileRoute('/_protected/classes/$action/$_classId')({
  beforeLoad: () => {
    return { form: { type: 'classes' } }
  },
  loader: async ({ params, context }) => {
    const { _classId: classId_classId } = params
    if (classId_classId) {
      return context.queryClient.ensureQueryData(fetchClass(classId_classId))
    }
  },
  component: ClassForm,
})
