import Collapsible from '@/components/Collapsible'
import Dropdown from '@/components/Dropdown'
import Input from '@/components/Input'
import { Attributes } from '@/enums'
import { Grid } from '@mantine/core'
import { useSystemData } from '@/hooks'
import type { OnChange, Class } from '@/types'

const Multiclass = ({
  formStore: { data, updateField, removeField },
}: {
  formStore: {
    data: Class
    updateField: OnChange<Class>['updateField']
    removeField: OnChange<Class>['removeField']
  }
}) => {
  const { abilities } = useSystemData()

  return (
    <Grid.Col>
      <Collapsible defaultOpen={data.id == null}>
        <Collapsible.Trigger title={'Multiclass Ability Requirements'} />
        <Collapsible.Content>
          <Grid>
            {data?.attributes?.some((attribute) => attribute === Attributes.PRIMARY_ABILITY) && (
              <>
                <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                  <Dropdown
                    name='multiclass.primaryAbility.id'
                    label='Primary Ability'
                    value={data?.multiclass?.primaryAbility?.id}
                    options={abilities
                      .filter((ability) => ability.id !== data.multiclass?.secondaryAbility?.id)
                      .filter((ability) => ability.id !== data.multiclass?.optionalAbility?.id)}
                    required={true}
                    onChange={{ updateField, removeField }}
                  />
                </Grid.Col>
                <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                  <Input
                    name='multiclass.primaryAbility.minAmount'
                    autoComplete='off'
                    label='Primary Score'
                    required={true}
                    value={data?.multiclass?.primaryAbility?.minAmount}
                    validation='num'
                    errorMsg='Must contain whole numbers only'
                    onChange={{ updateField }}
                  />
                </Grid.Col>
              </>
            )}
            {data?.attributes?.some((attribute) => attribute === Attributes.SECONDARY_ABILITY) && (
              <>
                <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                  <Dropdown
                    name='multiclass.secondaryAbility.id'
                    label='Secondary Ability'
                    value={data?.multiclass?.secondaryAbility?.id}
                    options={abilities
                      .filter((ability) => ability.id !== data.multiclass?.primaryAbility?.id)
                      .filter((ability) => ability.id !== data.multiclass?.optionalAbility?.id)}
                    required={true}
                    onChange={{ updateField, removeField }}
                  />
                </Grid.Col>
                <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                  <Input
                    name='multiclass.secondaryAbility.minAmount'
                    autoComplete='off'
                    label='Secondary Score'
                    required={true}
                    value={data?.multiclass?.secondaryAbility?.minAmount}
                    validation='num'
                    errorMsg='Must contain whole numbers only'
                    onChange={{ updateField }}
                  />
                </Grid.Col>
              </>
            )}
            {data?.attributes?.some((attribute) => attribute === Attributes.OPTIONAL_ABILITY) && (
              <>
                <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                  <Dropdown
                    name='multiclass.optionalAbility.id'
                    label='Optional Ability'
                    value={data?.multiclass?.optionalAbility?.id}
                    options={abilities
                      .filter((ability) => ability.id !== data.multiclass?.primaryAbility?.id)
                      .filter((ability) => ability.id !== data.multiclass?.secondaryAbility?.id)}
                    required={true}
                    onChange={{ updateField, removeField }}
                  />
                </Grid.Col>
                <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                  <Input
                    name='multiclass.optionalAbility.minAmount'
                    autoComplete='off'
                    label='Optional Score'
                    required={true}
                    value={data?.multiclass?.optionalAbility?.minAmount}
                    validation='num'
                    errorMsg='Must contain whole numbers only'
                    onChange={{ updateField }}
                  />
                </Grid.Col>
              </>
            )}
          </Grid>
        </Collapsible.Content>
      </Collapsible>
    </Grid.Col>
  )
}

export default Multiclass
