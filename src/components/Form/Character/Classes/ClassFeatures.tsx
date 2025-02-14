import { Fragment, use } from 'react'
import { SectionDataType, SectionName, UpdateState } from '../../../../types/form'
import Collapse from '../../../Collapse/Collapse'
import Dropdown from '../../../Dropdown/Dropdown'
import { feature_card_header, option_dropdown } from '../Character.css'
import parse from 'html-react-parser'
import { sprinkles } from '../../../../css/sprinkles.css'
import { useListClassesQuery } from '../../../../features/classes/classesApi'
import { Character, CharacterClass, Class } from '../../../../../amplify/gql/types'
import { Attributes, Categories } from '../../../../types/enums'
import { FeatureContext } from '../../Features/FeatureContext'
import useGetSections from '../../../../hooks/useGetSectionState'
import { FormContext } from '../../FormContext'

const ClassFeature = ({
  uClass,
  fullClass,
  classIndex,
  formData,
  updateFormData,
}: {
  uClass: CharacterClass
  fullClass: Class
  classIndex: number
  formData: Character
  updateFormData: (state: UpdateState<Character>) => void
}) => {
  const { sectionSteps } = use(FeatureContext)
  const { features } = use(FormContext)
  const { data: classes } = useListClassesQuery()

  const { getSectionOptions, getFeatureOptions } = useGetSections({ formData })

  const subclasses = classes.filter((sClass) => sClass.parentClass === uClass.id)
  const subclass = subclasses.find((sSubclass) => uClass?.subclass?.id === sSubclass.id)

  return (
    <>
      {features
        .filter((feature) => Number(feature.level) <= Number(uClass.level) && feature.classId === uClass.id)
        .sort((a, b) => Number(a.level) - Number(b.level))
        .map((feature, fIndex) => {
          const fullFeature = fullClass.features.find((featureItem) => featureItem.id === feature.id)
          return (
            <Collapse key={fIndex}>
              <Collapse.Header title={`(${feature.level}) ${fullFeature.label}`} className={feature_card_header} />
              <Collapse.Body>
                {fullFeature.category === Categories.subclass && fullFeature?.detail && parse(fullFeature?.detail)}
                {fullFeature.desc && parse(fullFeature.desc)}
                {fullFeature.category === Categories.subclass && (
                  <>
                    <Dropdown
                      name={`classes.${classIndex}.subclass.id`}
                      className={option_dropdown}
                      label={'Subclass Option'}
                      options={subclasses}
                      onChange={updateFormData}
                      value={uClass?.subclass?.id}
                    />
                    {subclass?.subtypes?.length > 0 && (
                      <Dropdown
                        name={`classes.${classIndex}.subclass.subtype`}
                        className={option_dropdown}
                        label={'Subtype Option'}
                        options={subclass?.subtypes}
                        onChange={updateFormData}
                        value={uClass?.subclass?.subtype}
                      />
                    )}
                  </>
                )}
                {!(fullFeature?.options?.length > 0)
                  ? // If feature doesn't have options, then check for sections
                    sectionSteps.map(
                      (sectionStep: Exclude<SectionName, 'ancestries' | 'options' | 'subfeatures'>, nameIndex) => (
                        <Fragment key={nameIndex}>
                          {fullFeature[sectionStep]?.length > 0 &&
                            fullFeature[sectionStep].map((section) => {
                              if (section?.attributes?.some((attribute) => attribute === Attributes.providesOptions)) {
                                // Check if selectionCount exists and is greater than 0
                                const selectionCount = section?.selectionCount || 1

                                // Repeat Dropdown component based on selectionCount
                                const dropdowns = Array.from({ length: selectionCount }, (_, index) => {
                                  const optionIndex = index & fIndex & classIndex

                                  const { options, label, path, exist } = getSectionOptions({
                                    section,
                                    sectionStep,
                                    optionIndex,
                                  })

                                  return (
                                    <Dropdown
                                      key={index}
                                      name={path}
                                      className={option_dropdown}
                                      label={`${label} Option`}
                                      options={options}
                                      onChange={() =>
                                        updateFormData({
                                          type: 'update',
                                          path: path,
                                          value: {
                                            option: exist,
                                            classId: uClass.id,
                                            optionIndex: optionIndex,
                                            featureId: fullFeature.id,
                                          },
                                        })
                                      }
                                      value={exist}
                                    />
                                  )
                                })

                                return dropdowns
                              }
                            })}
                        </Fragment>
                      )
                    )
                  : (() => {
                      // If feature.options does have a length, provide the options for that
                      const selectionCount = fullFeature?.selectionCount || 1

                      const dropdowns = Array.from({ length: selectionCount }, (_, index) => {
                        const optionIndex = index & fIndex & classIndex

                        const { path, exist } = getFeatureOptions({
                          options: fullFeature.options,
                          optionIndex,
                        })

                        return (
                          <div className={option_dropdown} key={index}>
                            <Dropdown
                              name={path}
                              label={`${fullFeature.label} Option`}
                              options={fullFeature.options.map((option) => ({
                                label: option.label,
                                value: option.value,
                                id: option.id,
                              }))}
                              onChange={() =>
                                updateFormData({
                                  type: 'update',
                                  path: path,
                                  value: {
                                    option: exist.id,
                                    classId: uClass.id,
                                    optionIndex: optionIndex,
                                    id: fullFeature.id,
                                  },
                                })
                              }
                              value={exist.id}
                            />
                            {exist?.desc && parse(exist.desc)}
                          </div>
                        )
                      })

                      return dropdowns
                    })()}
                {(() => {
                  if (fullFeature && fullFeature.options) {
                    const option = fullFeature.options.find((fOption) =>
                      formData.features.some((sFeature) => sFeature.option === fOption.id)
                    )
                    return (
                      <div className={sprinkles({ mb: 'space-3' })}>
                        {fullFeature.desc && <div>{parse(fullFeature.desc)}</div>}
                        {sectionSteps.map(
                          (sectionStep: Exclude<SectionName, 'ancestries' | 'subfeatures' | 'options'>, nameIndex) => {
                            return (
                              <Fragment key={nameIndex}>
                                {option[sectionStep]?.length > 0 &&
                                  option[sectionStep].map((section: SectionDataType) => {
                                    if (
                                      section.attributes?.some((attribute) => attribute === Attributes.providesOptions)
                                    ) {
                                      // Check if selectionCount exists and is greater than 0
                                      const selectionCount = section?.selectionCount || 1

                                      // Repeat Dropdown component based on selectionCount
                                      const dropdowns = Array.from({ length: selectionCount }, (_, index) => {
                                        const optionIndex = index & fIndex & classIndex

                                        const { options, label, path, exist } = getSectionOptions({
                                          section,
                                          sectionStep,
                                          optionIndex,
                                        })

                                        return (
                                          <div className={option_dropdown} key={index}>
                                            <Dropdown
                                              name={path}
                                              label={`${label} Option`}
                                              options={options}
                                              onChange={updateFormData}
                                              value={exist}
                                            />
                                          </div>
                                        )
                                      })

                                      return dropdowns
                                    }
                                  })}
                              </Fragment>
                            )
                          }
                        )}
                      </div>
                    )
                  }
                })()}
              </Collapse.Body>
            </Collapse>
          )
        })}
      <hr className={sprinkles({ mb: 'space-3' })} />
      <Collapse style='borderless'>
        <Collapse.Header title='Features Available at Higher Levels' />
        <Collapse.Body>
          {features
            .filter((feature) => feature.level > uClass.level && feature.classId === uClass.id)
            .sort((a, b) => Number(a.level) - Number(b.level))
            .map((feature, fIndex) => {
              const fullFeature = fullClass.features.find((featureItem) => featureItem.id === feature.id)
              return (
                <Collapse key={fIndex}>
                  <Collapse.Header title={`(${feature.level}) ${fullFeature.label}`} className={feature_card_header} />
                  <Collapse.Body>
                    {fullFeature.category === Categories.subclass && fullFeature?.detail && parse(fullFeature?.detail)}
                    {fullFeature.desc && parse(fullFeature.desc)}
                    {fullFeature.category === Categories.subclass && (
                      <>
                        <Dropdown
                          name={`classes.${classIndex}.subclass.id`}
                          className={option_dropdown}
                          label={'Subclass Option'}
                          options={subclasses}
                          onChange={updateFormData}
                          value={uClass?.subclass?.id}
                        />
                        {subclass?.subtypes?.length > 0 && (
                          <Dropdown
                            name={`classes.${classIndex}.subclass.subtype`}
                            className={option_dropdown}
                            label={'Subtype Option'}
                            options={subclass?.subtypes}
                            onChange={updateFormData}
                            value={uClass?.subclass?.subtype}
                          />
                        )}
                      </>
                    )}
                  </Collapse.Body>
                </Collapse>
              )
            })}
        </Collapse.Body>
      </Collapse>
    </>
  )
}

export default ClassFeature
