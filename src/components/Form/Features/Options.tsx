import { useFeature } from '../../../hooks/UseFeature'
import { useForm } from '../../../hooks/UseForm'
import Base from './Base'

const Options = () => {
  const { context, steps, stepIndex } = useForm()
  const { optionState, setOptionState, sectionNames } = useFeature()

  const filteredSectionNames = sectionNames.filter(
    (sectionName) => sectionName !== 'options' && context.title !== 'classes' && sectionName !== 'ancestry'
  )

  return (
    <Base
      state={optionState}
      setState={setOptionState}
      valueLabel={steps[stepIndex].id === 'ancestry' ? 'ancestry Feature' : 'Option'}
      filteredSectionNames={filteredSectionNames}
    />
  )
}

export default Options
