import { useState } from 'react'
import { FormContext, FeatureStepName } from '../../../utils/types'
import FeatureList from './FeatureList'
import FeatureContent from './FeatureContent'
import SectionContent from './SectionContent'

interface FeatureProps {
  context: FormContext
}

const Feature = ({ context }: FeatureProps) => {
  const [featureStepName, setFeatureStepName] = useState<FeatureStepName>(context === 'feat' ? 'FeatureContent' : '')

  return (
    <>
      {featureStepName === '' ? (
        <FeatureList {...commonProps} {...featureProps} />
      ) : (
        <>
          <h2 className={sprinkles({ mb: 'size-2', px: 'size-4' })}>
            {featureState.value != null &&
              featureState.value !== '' &&
              `${
                stepName === 'Ancestry'
                  ? 'Ancestry'
                  : featureContext === 'OptionContent'
                  ? 'Option'
                  : featureContext === 'OptionFeatureContent'
                  ? 'Sub-Feature'
                  : 'Feature'
              } (${featureContext !== '' ? optionState.value : featureState.value}${
                featureContext === 'OptionFeatureContent'
                  ? subFeatureState.value
                    ? ` - ${subFeatureState.value}`
                    : ` - Sub-Feature ${subFeatureIndex + 1}`
                  : ''
              })`}
          </h2>
          {featureStepName === 'FeatureContent' ? (
            context === 'feat' ? (
              <FeatureContent
                formState={formState}
                context={{ type: formType, title: context }}
                setSectionName={setSectionName}
                setFeatureStepName={setFeatureStepName}
                featureContext={featureContext}
                setFeatureContext={setFeatureContext}
                featureState={formState}
                setFeatureState={setFormState}
                setSectionState={setSectionState}
                setOldSectionState={setOldSectionState}
                setSectionIndex={setSectionIndex}
                stepName={stepName}
              />
            ) : featureContext === 'OptionFeatureContent' ? (
              <FeatureContent
                formState={formState}
                context={{ type: formType, title: context }}
                setSectionName={setSectionName}
                setFeatureStepName={setFeatureStepName}
                featureContext={featureContext}
                setFeatureContext={setFeatureContext}
                featureState={subFeatureState}
                setFeatureState={setSubFeatureState}
                setSubFeatureState={setSubFeatureState}
                setOldSubFeatureState={setOldSubFeatureState}
                setSubFeatureIndex={setSubFeatureIndex}
                setSectionState={setSectionState}
                setOldSectionState={setOldSectionState}
                setSectionIndex={setSectionIndex}
                stepName={stepName}
              />
            ) : featureContext === 'OptionContent' ? (
              <FeatureContent
                formState={formState}
                context={{ type: formType, title: context }}
                setSectionName={setSectionName}
                setFeatureStepName={setFeatureStepName}
                featureContext={featureContext}
                setFeatureContext={setFeatureContext}
                featureState={optionState}
                setFeatureState={setOptionState}
                setOptionState={setOptionState}
                setOldOptionState={setOldOptionState}
                setOptionIndex={setOptionIndex}
                setSectionState={setSectionState}
                setOldSectionState={setOldSectionState}
                setSectionIndex={setSectionIndex}
                setSubFeatureState={setSubFeatureState}
                setOldSubFeatureState={setOldSubFeatureState}
                setSubFeatureIndex={setSubFeatureIndex}
                stepName={stepName}
              />
            ) : (
              <FeatureContent
                formState={formState}
                context={{ type: formType, title: context }}
                setSectionName={setSectionName}
                setFeatureStepName={setFeatureStepName}
                featureContext={featureContext}
                setFeatureContext={setFeatureContext}
                featureState={featureState}
                setFeatureState={setFeatureState}
                setOptionState={setOptionState}
                setOldOptionState={setOldOptionState}
                setOptionIndex={setOptionIndex}
                setSectionState={setSectionState}
                setOldSectionState={setOldSectionState}
                setSectionIndex={setSectionIndex}
                stepName={stepName}
              />
            )
          ) : (
            featureStepName === 'SectionContent' &&
            (featureContext === 'OptionFeatureContent' ? (
              <SectionContent
                formState={formState}
                sectionName={sectionName}
                featureState={subFeatureState}
                setSectionState={setSectionState}
                sectionState={sectionState}
                context={{ type: formType, title: context }}
              />
            ) : featureContext === 'OptionContent' ? (
              <SectionContent
                formState={formState}
                sectionName={sectionName}
                featureState={optionState}
                setSectionState={setSectionState}
                sectionState={sectionState}
                context={{ type: formType, title: context }}
              />
            ) : (
              <SectionContent
                formState={formState}
                sectionName={sectionName}
                featureState={featureState}
                setSectionState={setSectionState}
                sectionState={sectionState}
                context={{ type: formType, title: context }}
              />
            ))
          )}
        </>
      )}
    </>
  )
}

export default Feature
