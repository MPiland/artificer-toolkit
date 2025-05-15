import { use, useMemo } from 'react'
import Modal, { ModalContext, type AddSectionModalProps } from '@/components/Modal'
import { FeatureContext } from '@/components/Form'
import Button from '@/components/Button'

const AddSection = () => {
  const { modalProps, hideModal } = use(ModalContext)
  const { sectionSteps } = use(FeatureContext)

  const { featureData, onAddSection } = modalProps as AddSectionModalProps

  const sectionStepOptions = useMemo(
    () => (featureData.__typename === 'FeatureOption' ? sectionSteps : ([...sectionSteps, 'options'] as const)),
    [featureData.__typename, sectionSteps]
  )

  return (
    <Modal.Dialogue size='xs'>
      <Modal.Header title='Add a section' onClose={hideModal} />
      <Modal.Content>
        {sectionStepOptions.map((sectionStep) => (
          <Button
            key={sectionStep}
            onClick={() => {
              onAddSection(sectionStep)
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
