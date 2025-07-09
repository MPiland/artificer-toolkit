import { use, useMemo } from 'react'
import Modal, { ModalContext, type AddSectionModalProps } from '@/components/Modal'
import { SECTION_STEPS } from '@/components/Form'
import { Button } from '@mantine/core'

const AddSection = () => {
  const { modalProps, hideModal } = use(ModalContext)

  const { __kind, onAddSection } = modalProps as AddSectionModalProps

  const sectionStepOptions = useMemo(
    () => (__kind === 'FeatureOptionInput' ? SECTION_STEPS : ([...SECTION_STEPS, 'options'] as const)),
    [__kind]
  )

  return (
    <Modal.Dialogue size='xs'>
      <Modal.Header title='Add a section' onClose={hideModal} />
      <Modal.Content>
        {sectionStepOptions.map((sectionStep) => (
          <Button
            key={sectionStep}
            onClick={() => {
              onAddSection(sectionStep, __kind)
              hideModal()
            }}
          >
            {sectionStep}
          </Button>
        ))}
      </Modal.Content>
    </Modal.Dialogue>
  )
}
export default AddSection
