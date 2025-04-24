import { use } from 'react'
import { FormContext } from '../FormContext'
import Collapse from '@/components/Collapse'
import Grid from '@/components/Grid'
import CharacterCurrency from '../Substeps/Character/Equipment/CharacterCurrency'
import Dropdown from '@/components/Dropdown'
import { option_dropdown } from '../Character.css'
import parse from 'html-react-parser'
import CharacterEquipment from '../Substeps/Character/Equipment/CharacterEquipment'
import CharacterFeature from '../Substeps/Character/Features/CharacterFeature'
import { useBackgroundData } from '@/hooks'
import type { OnChange, Character } from '@/types'

const BackgroundStep = () => {
  const { formStore, features } = use(FormContext)

  const { data, updateField, removeField } = formStore as {
    data: Character
    updateField: OnChange<Character>['updateField']
    removeField: OnChange<Character>['removeField']
  }

  const { backgrounds } = useBackgroundData()

  const background = backgrounds.findBackground(data?.background)

  return (
    <>
      <Grid>
        <Grid.Item justify='center'>
          <Dropdown
            name='background'
            label='Background'
            options={backgrounds}
            className={option_dropdown}
            onChange={{ updateField, removeField }}
            value={data?.background}
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

export default BackgroundStep
