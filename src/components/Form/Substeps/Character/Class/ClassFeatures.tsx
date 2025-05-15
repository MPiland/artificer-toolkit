import { use } from 'react'
import Collapsible from '@/components/Collapsible'
import { feature_card_header } from '../../../Character.css'
import parse from 'html-react-parser'
import { CharacterClass, Class } from '@/types'
import { Categories } from '@/enums'
import { FormContext } from '../../../FormContext'
import { Grid } from '@mantine/core'
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
      <Grid.Col>
        <Grid>
          {features
            .filter((feature) => Number(feature.level) <= Number(uClass.level) && feature.classId === uClass.id)
            .sort((a, b) => Number(a.level) - Number(b.level))
            .map((feature, fIndex) => {
              return <ClassFeature uClass={uClass} classIndex={classIndex} feature={feature} key={fIndex} />
            })}
        </Grid>
      </Grid.Col>
      <Grid.Col>
        <hr />
      </Grid.Col>
      <Grid.Col>
        <Collapsible>
          <Collapsible.Trigger title='Features Available at Higher Levels' />
          <Collapsible.Content>
            <Grid>
              {features
                .filter((feature) => feature?.level && feature?.level > uClass.level && feature.classId === uClass.id)
                .sort((a, b) => Number(a.level) - Number(b.level))
                .map((feature, fIndex) => {
                  const fullFeature = fullClass?.features?.find((featureItem) => featureItem.id === feature.id)
                  if (fullFeature) {
                    return (
                      <Grid.Col key={feature.id && fIndex}>
                        <Collapsible>
                          <Collapsible.Trigger
                            title={`(${feature.level}) ${fullFeature.label}`}
                            className={feature_card_header}
                          />
                          <Collapsible.Content>
                            <Grid>
                              {fullFeature.category === Categories.SUBCLASS &&
                                fullFeature?.detail &&
                                parse(fullFeature?.detail)}
                              {fullFeature.desc && parse(fullFeature.desc)}
                            </Grid>
                          </Collapsible.Content>
                        </Collapsible>
                      </Grid.Col>
                    )
                  }
                })}
            </Grid>
          </Collapsible.Content>
        </Collapsible>
      </Grid.Col>
    </>
  )
}

export default ClassFeatures
