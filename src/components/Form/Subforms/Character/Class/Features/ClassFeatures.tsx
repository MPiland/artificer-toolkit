import { use } from 'react'
import { UpdateState } from '../../../../../../types/form'
import Collapse from '../../../../../Collapse/Collapse'
import Dropdown from '../../../../../Dropdown/Dropdown'
import { feature_card_header, option_dropdown } from '../../../../Character.css'
import parse from 'html-react-parser'
import { Character, Class } from '../../../../../../../amplify/gql/types'
import { Categories } from '../../../../../../types/enums'
import { FormContext } from '../../../../FormContext'
import Grid from '../../../../../Grid/Grid'
import ClassFeature from './ClassFeature'
import { FactoryFeature } from '../../../../../../hooks/useGetFeatures'

const ClassFeatures = ({
  fullClass,
  subclass,
  subclasses,
}: {
  fullClass: Class
  subclass: Class
  subclasses: Class[]
}) => {
  const { features, updateFormData, formData } = use(FormContext) as {
    features: FactoryFeature[]
    updateFormData: (state: UpdateState<Character>) => void
    formData: Character
  }

  const classIndex = formData.classes.findIndex((c) => c.id === fullClass.id)

  const uClass = formData.classes[classIndex]

  return (
    <>
      <Grid.Item>
        <Grid>
          {features
            .filter((feature) => Number(feature.level) <= Number(uClass.level) && feature.classId === uClass.id)
            .sort((a, b) => Number(a.level) - Number(b.level))
            .map((feature, fIndex) => {
              return (
                <ClassFeature
                  fullClass={fullClass}
                  feature={feature}
                  subclass={subclass}
                  subclasses={subclasses}
                  key={fIndex}
                />
              )
            })}
        </Grid>
      </Grid.Item>
      <Grid.Item>
        <hr />
      </Grid.Item>
      <Grid.Item>
        <Collapse style='borderless'>
          <Collapse.Header title='Features Available at Higher Levels' />
          <Collapse.Body>
            <Grid>
              {features
                .filter((feature) => feature.level > uClass.level && feature.classId === uClass.id)
                .sort((a, b) => Number(a.level) - Number(b.level))
                .map((feature, fIndex) => {
                  const fullFeature = fullClass.features.find((featureItem) => featureItem.id === feature.id)
                  return (
                    <Grid.Item key={feature.id && fIndex}>
                      <Collapse>
                        <Collapse.Header
                          title={`(${feature.level}) ${fullFeature.label}`}
                          className={feature_card_header}
                        />
                        <Collapse.Body>
                          <Grid>
                            {fullFeature.category === Categories.subclass &&
                              fullFeature?.detail &&
                              parse(fullFeature?.detail)}
                            {fullFeature.desc && parse(fullFeature.desc)}
                            {fullFeature.category === Categories.subclass && (
                              <>
                                <Grid.Item>
                                  <Dropdown
                                    name={`classes.${classIndex}.subclass.id`}
                                    className={option_dropdown}
                                    label={'Subclass Option'}
                                    options={subclasses}
                                    onChange={updateFormData}
                                    value={uClass?.subclass?.id}
                                  />
                                </Grid.Item>
                                {subclass?.subtypes?.length > 0 && (
                                  <Grid.Item>
                                    <Dropdown
                                      name={`classes.${classIndex}.subclass.subtype`}
                                      className={option_dropdown}
                                      label={'Subtype Option'}
                                      options={subclass?.subtypes}
                                      onChange={updateFormData}
                                      value={uClass?.subclass?.subtype}
                                    />
                                  </Grid.Item>
                                )}
                              </>
                            )}
                          </Grid>
                        </Collapse.Body>
                      </Collapse>
                    </Grid.Item>
                  )
                })}
            </Grid>
          </Collapse.Body>
        </Collapse>
      </Grid.Item>
    </>
  )
}

export default ClassFeatures
