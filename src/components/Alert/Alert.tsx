import Modal from '../Modal/Modal'
import Group from '../Group/Group'
import Button from '../Button/Button'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { FormContext } from '../Form/FormContext'
import { use } from 'react'
import { FeatureContext } from '../Form/Features/FeatureContext'
import { Character } from '../../../amplify/gql/types'

const Alert = () => {
  const { alertType } = useParams() as { alertType: 'step' | 'forward' | 'back' | 'reset' }
  const { formData, updateFormData, isFirstStep, isLastStep, setStepIndex, stepIndex } = use(FormContext)

  const {
    featureStep,
    setFeatureStep,
    resetFeature,
    resetOption,
    resetSection,
    sectionStep,
    setSectionStep,
    resetAncestry,
  } = use(FeatureContext)

  const navigate = useNavigate()
  const location = useLocation()

  const message = location.state?.message
  const index = location.state?.index
  const dataSource: 'classEquipment' | 'backgroundEquipment' = location.state?.equipmentSource

  const reset = () => {
    if (sectionStep != null) {
      resetSection()
      setSectionStep(null)
    } else if (featureStep === 'option') {
      resetOption()
      setFeatureStep('feature')
    } else if (featureStep === 'ancestry') {
      resetFeature()
      setFeatureStep('ancestryOption')
    } else if (featureStep === 'ancestryOption') {
      resetAncestry()
      setFeatureStep(null)
    } else {
      resetFeature()
      setFeatureStep(null)
    }
  }

  const handleConfirmBack = () => {
    if (!isFirstStep) {
      if (featureStep != null) {
        reset()
        return navigate(-1)
      }
      setStepIndex(stepIndex - 1)
      return navigate(-1)
    }
  }

  const handleConfirmForward = () => {
    if (!isLastStep) {
      if (featureStep != null) {
        reset()
        return navigate(-1)
      }
      setStepIndex(stepIndex + 1)
      return navigate(-1)
    }
    return navigate(-1)
  }

  const handleConfirmStep = () => {
    if (featureStep != null) {
      reset()
    }
    setStepIndex(index)
    return navigate(-1)
  }

  const handleClick = () => {
    switch (alertType) {
      case 'step':
        handleConfirmStep()
        break
      case 'forward':
        handleConfirmForward()
        break
      case 'back':
        handleConfirmBack()
        break
      case 'reset': {
        const formDataCopy: Character = JSON.parse(JSON.stringify(formData))
        formDataCopy.equipment = []
        formDataCopy.currencyGroups = []
        if (dataSource === 'classEquipment') {
          formDataCopy.classEquipment = {
            ...formDataCopy.classEquipment,
            equipmentGroups: [],
            addedToCharacter: false,
            option: null,
            totalGold: 0,
          }
        }
        if (dataSource === 'backgroundEquipment') {
          formDataCopy.backgroundEquipment = {
            ...formDataCopy.backgroundEquipment,
            equipmentGroups: [],
            addedToCharacter: false,
          }
        }
        updateFormData({
          type: 'reset',
          value: formDataCopy,
        })
        navigate(-1)
        break
      }
      default:
        break
    }
  }

  const handleCancel = () => {
    navigate(-1)
  }

  return (
    <Modal handleCloseFn={() => handleCancel()}>
      <Modal.Dialogue>
        <Modal.Header title='Alert' />
        <Modal.Content>
          <span>{message}</span>
        </Modal.Content>
        <Modal.Footer>
          <Group directionVariant='row' justifyContentVariant='spaceBetween'>
            <Button color='main' onClick={handleCancel}>
              Cancel
            </Button>
            <Button color='danger' onClick={() => handleClick()}>
              Continue
            </Button>
          </Group>
        </Modal.Footer>
      </Modal.Dialogue>
    </Modal>
  )
}

export default Alert
