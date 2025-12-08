import { Grid } from '@mantine/core'
import Collapsible from '~components/Collapse'
import parse from 'html-react-parser'
import type { CharacterFeatureInput, CharacterInput } from '~types'
import { card_header, FeatureSections, FeatureOptions } from '~components/Form'
import { useOptimizedSelector, useTypedFormStore } from '~store'
import { useFormField } from '~hooks'
import { useListFeatures, useGetFeature } from '~apis'

const CharacterFeatures = ({
  classId,
  raceId,
  backgroundId,
  ancestryId,
}: {
  classId?: string | undefined
  raceId?: string | undefined
  backgroundId?: string | undefined
  ancestryId?: string | undefined
}) => {
  const store = useTypedFormStore<CharacterInput>()

  const { AppField } = useFormField({ store })

  const { currentFeatures } = useOptimizedSelector(store, (state) => ({ currentFeatures: state.current?.features }))

  const {
    data: { features: featuresData },
  } = useListFeatures()

  const FeatureItem = ({ charFeature }: { charFeature: CharacterFeatureInput }) => {
    const { data: feature } = useGetFeature(charFeature.id)
    const existFeatureIndex = currentFeatures?.findIndex(
      (f) => f?.id === charFeature?.id && f?.level === charFeature?.level
    )

    const featureIndex = existFeatureIndex && existFeatureIndex > -1 ? existFeatureIndex : currentFeatures?.length || 0

    const headerTitle = `${charFeature?.level && `(${charFeature?.level}) `}${featuresData.find((f) => f?.id === charFeature?.id)?.label || `Feature (${featureIndex})`}`

    const option = feature?.options?.find((oId) => charFeature?.options?.find((o) => o.id === oId.id))

    return (
      feature && (
        <Grid.Col>
          <Collapsible
            props={{
              trigger: {
                title: headerTitle,
                className: card_header,
              },
            }}
          >
            <Grid>
              {!feature?.options?.length ?
                <FeatureSections
                  featureId={feature?.id}
                  classId={classId}
                  raceId={raceId}
                  backgroundId={backgroundId}
                  ancestryId={ancestryId}
                />
              : <FeatureOptions featureId={feature?.id} />}
              {option && (
                <>
                  <Grid.Col>{option?.desc && <div>{parse(option.desc)}</div>}</Grid.Col>
                  <FeatureSections
                    featureId={feature?.id}
                    classId={classId}
                    raceId={raceId}
                    backgroundId={backgroundId}
                    optionId={option.id}
                    ancestryId={ancestryId}
                  />
                </>
              )}
            </Grid>
          </Collapsible>
        </Grid.Col>
      )
    )
  }

  return (
    <AppField name='features' mode='array'>
      {(featureArray) =>
        featureArray.state.value?.length &&
        featureArray.state.value
          .filter((f) => {
            if (ancestryId && f?.ancestryId != null) {
              return f?.ancestryId === ancestryId
            }
            if (raceId && f?.raceId != null) {
              return f?.raceId === raceId
            }
            if (backgroundId && f?.backgroundId != null) {
              return f?.backgroundId === backgroundId
            }
            if (classId && f?.classId != null) {
              return f?.classId === classId
            }
            return true
          })
          .map((f, i) => <FeatureItem charFeature={f} key={`character-feature-${i}`} />)
      }
    </AppField>
  )
}
export default CharacterFeatures
