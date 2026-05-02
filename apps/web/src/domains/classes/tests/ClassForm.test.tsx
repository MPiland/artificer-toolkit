import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  AuthoringFormLayout,
  AuthoringFormProvider,
  clearResolvedNodeFormPaths,
  useAppForm,
  useAuthoringFormRegistration
} from '#forms'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import {
  createClassRuntimeFixture,
  classRuntimeFixture,
  masterSubclassResponseFixture,
  ownedClassResponseFixture
} from '../class.fixtures'
import {
  toClassFormValues,
  type ClassFormValues
} from '../classAuthoring.utils'
import { ClassAuthoringRenderer } from '../components/ClassAuthoringRenderer'

describe('ClassAuthoringRenderer', () => {
  it('renders class authoring from resolved steps', async () => {
    const user = userEvent.setup()

    renderClassAuthoringHarness({
      classRecord: toClassFormValues(ownedClassResponseFixture.item),
      readOnly: false
    })

    expect(screen.getByRole('heading', { level: 2, name: /basics/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /class details/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByRole('heading', { level: 2, name: /class details/i })).toBeInTheDocument()
  })

  it('renders locked subclasses as read-only with duplicate affordance', () => {
    renderClassAuthoringHarness({
      canCopy: true,
      classRecord: toClassFormValues(masterSubclassResponseFixture.item),
      readOnly: true
    })

    expect(screen.getByText(/locked for direct editing/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /duplicate to edit/i })).toBeEnabled()
    expect(screen.getByRole('textbox', { name: /category/i })).toHaveAttribute('readonly')
  })

  it('marks parent class as required when subclass fields are visible', () => {
    renderClassAuthoringHarness({
      classRecord: {
        ...toClassFormValues(masterSubclassResponseFixture.item),
        parentClassId: undefined
      },
      readOnly: false,
      runtimeModel: createClassRuntimeFixture('SUBCLASS')
    })

    expect(screen.getByRole('textbox', { name: /parent class/i })).toBeRequired()
  })
})

function renderClassAuthoringHarness({
  canCopy = false,
  classRecord,
  readOnly,
  runtimeModel = classRuntimeFixture
}: {
  canCopy?: boolean
  classRecord: ClassFormValues
  readOnly: boolean
  runtimeModel?: typeof classRuntimeFixture
}) {
  return renderWithAppProviders(
    <AuthoringFormProvider>
      <ClassAuthoringTestHarness
        canCopy={canCopy}
        classRecord={classRecord}
        readOnly={readOnly}
        runtimeModel={runtimeModel}
      />
    </AuthoringFormProvider>
  )
}

function ClassAuthoringTestHarness({
  canCopy,
  classRecord,
  readOnly,
  runtimeModel
}: {
  canCopy: boolean
  classRecord: ClassFormValues
  readOnly: boolean
  runtimeModel: typeof classRuntimeFixture
}) {
  const form = useAppForm({
    defaultValues: classRecord,
    onSubmit: async () => undefined
  })

  useAuthoringFormRegistration({
    activateLabel: 'Activate Class',
    canCopy,
    mapId: 'class',
    mode: readOnly ? 'view' : 'edit',
    providedModel: runtimeModel,
    readOnly,
    resolveModel: false,
    subjectKindLabel: 'Class',
    subjectLabel: classRecord.label || 'Untitled Class',
    systemId: classRecord.systemId
  }, {
    onActivate: () => form.handleSubmit(),
    onClearPaths: (paths) => clearResolvedNodeFormPaths(form, paths),
    onCopy: () => undefined
  })

  return (
    <form.AppForm>
      <AuthoringFormLayout>
        <ClassAuthoringRenderer form={form} />
      </AuthoringFormLayout>
    </form.AppForm>
  )
}
