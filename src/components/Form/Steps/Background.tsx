import { use } from 'react'
import { FormContext } from '../FormContext'
import Collapsible from '@/components/Collapsible'
import CharacterCurrency from '../Substeps/Character/Equipment/CharacterCurrency'
import Dropdown from '@/components/Dropdown'
import { option_dropdown } from '../Character.css'
import parse from 'html-react-parser'
import CharacterEquipment from '../Substeps/Character/Equipment/CharacterEquipment'
import CharacterFeature from '../Substeps/Character/Features/CharacterFeature'
import { useBackgroundData } from '@/hooks'
import type { OnChange, Character } from '@/types'
import { Grid } from '@mantine/core'

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
        <Grid.Col justify='center'>
          <Dropdown
            name='background'
            label='Background'
            options={backgrounds}
            className={option_dropdown}
            onChange={{ updateField, removeField }}
            value={data?.background}
          />
        </Grid.Col>
        {background && (
          <>
            {background?.desc && (
              <Grid.Col>
                <Collapsible>
                  <Collapsible.Trigger title='Description' />
                  <Collapsible.Content>{background?.desc && parse(background?.desc)}</Collapsible.Content>
                </Collapsible>
              </Grid.Col>
            )}
            {features
              ?.filter((feature) => feature.backgroundId === background?.id)
              ?.map((feature, fIndex) => (
                <CharacterFeature feature={feature} key={fIndex} backgroundId={background?.id} />
              ))}
            <Grid.Col>
              <Collapsible>
                <Collapsible.Trigger title='Starting Equipment' />
                <Collapsible.Content>
                  <Grid>
                    <CharacterEquipment dataSource={background} />
                  </Grid>
                </Collapsible.Content>
              </Collapsible>
            </Grid.Col>
            <CharacterCurrency />
          </>
        )}
      </Grid>
    </>
  )
}

export default BackgroundStep
