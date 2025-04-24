import { use } from 'react'
import Collapse from '@/components/Collapse'
import { feature_card_header } from '../../../Character.css'
import parse from 'html-react-parser'
import { CharacterClass, Class } from '@/types'
import { Categories } from '@/enums'
import { FormContext } from '../../../FormContext'
import Grid from '@/components/Grid'
import ClassFeature from '../Features/CharacterFeature'
import { FactoryFeature } from '@/hooks'

const ClassFeatures = ({
  uClass,
  fullClass,
  classIndex,
}: {
  uClass: CharacterClass
  fullClass: Class
  classIndex: number
}) => {
  const { features } = use(FormContext) as {
    features: FactoryFeature[]
  }

  return (
    <>
      <Grid.Item>
        <Grid>
          {features
            .filter((feature) => Number(feature.level) <= Number(uClass.level) && feature.classId === uClass.id)
            .sort((a, b) => Number(a.level) - Number(b.level))
            .map((feature, fIndex) => {
              return <ClassFeature uClass={uClass} classIndex={classIndex} feature={feature} key={fIndex} />
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
                .filter((feature) => feature?.level && feature?.level > uClass.level && feature.classId === uClass.id)
                .sort((a, b) => Number(a.level) - Number(b.level))
                .map((feature, fIndex) => {
                  const fullFeature = fullClass?.features?.find((featureItem) => featureItem.id === feature.id)
                  if (fullFeature) {
                    return (
                      <Grid.Item key={feature.id && fIndex}>
                        <Collapse>
                          <Collapse.Header
                            title={`(${feature.level}) ${fullFeature.label}`}
                            className={feature_card_header}
                          />
                          <Collapse.Body>
                            <Grid>
                              {fullFeature.category === Categories.SUBCLASS &&
                                fullFeature?.detail &&
                                parse(fullFeature?.detail)}
                              {fullFeature.desc && parse(fullFeature.desc)}
                            </Grid>
                          </Collapse.Body>
                        </Collapse>
                      </Grid.Item>
                    )
                  }
                })}
            </Grid>
          </Collapse.Body>
        </Collapse>
      </Grid.Item>
    </>
  )
}

export default ClassFeatures
