import { createFileRoute } from '@tanstack/react-router'
import Class from '../../../pages/classes/Class'
import { fetchClass } from '../../../apis/classesApi'
import Loading from '../../../components/Loading/Loading'

export const Route = createFileRoute('/_protected/classes/$classId')({
  beforeLoad: () => {
    return { form: { type: 'classes' } }
  },
  loader: ({ context, params }) => context.queryClient.ensureQueryData(fetchClass(params.classId)),
  pendingComponent: Loading,
  component: Class,
})
