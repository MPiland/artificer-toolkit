import { Character } from '../../../../../../amplify/gql/types'
import { UpdateState } from '../../../../../types/form'
import { use } from 'react'
import { FormContext } from '../../../FormContext'
import Collapse from '../../../../Collapse/Collapse'
import Grid from '../../../../Grid/Grid'
import { useListBackgroundsQuery } from '../../../../../apis/backgroundsApi'
import CharacterCurrency from '../../../Subforms/Character/CharacterEquipment/CharacterCurrency'
import Dropdown from '../../../../Dropdown/Dropdown'
import { option_dropdown } from '../../../Character.css'
import parse from 'html-react-parser'
import CharacterEquipment from '../../../Subforms/Character/CharacterEquipment/CharacterEquipment'
import { FactoryFeature } from '../../../../../hooks/useGetFeatures'
import CharacterFeature from '../../../Subforms/Character/Features/CharacterFeature'

const Background = () => {
  const { formData, updateFormData, features } = use(FormContext) as {
    formData: Character
    updateFormData: (state: UpdateState<Character>) => void
    features: FactoryFeature[]
  }

  const { data: backgrounds } = useListBackgroundsQuery()

  const background = backgrounds.find((b) => b.id === formData?.background)

  return (
    <>
      <Grid>
        <Grid.Item justify='center'>
          <Dropdown
            name='background'
            label='Background'
            options={backgrounds}
            className={option_dropdown}
            onChange={updateFormData}
            value={formData?.background}
          />
        </Grid.Item>
        {background && (
          <>
            {background?.desc && (
              <Grid.Item>
                <Collapse>
                  <Collapse.Header title='Description' />
                  <Collapse.Body>{background?.desc && parse(background?.desc)}</Collapse.Body>
                </Collapse>
              </Grid.Item>
            )}
            {features
              ?.filter((feature) => feature.backgroundId === background?.id)
              ?.map((feature, fIndex) => (
                <CharacterFeature feature={feature} key={fIndex} backgroundId={background?.id} />
              ))}
            <Grid.Item>
              <Collapse>
                <Collapse.Header title='Starting Equipment' />
                <Collapse.Body>
                  <Grid>
                    <CharacterEquipment dataSource={background} />
                  </Grid>
                </Collapse.Body>
              </Collapse>
            </Grid.Item>
            <CharacterCurrency />
          </>
        )}
      </Grid>
    </>
  )
}

export default Background
