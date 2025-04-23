import Dropdown from '../../Dropdown/Dropdown'
import Input from '../../Input/Input'
import RichTextEditor from '../../RichTextEditor/RichTextEditor'
import { startCase } from 'lodash'
import Button from '../../Button/Button'
import Accordion from '../../Accordion/Accordion'
import { sprinkles } from '../../../css/sprinkles.css'
import { use } from 'react'
import { FormContext } from '../FormContext'
import Divider from '../../Divider/Divider'
import { Categories, EquipmentCategories, EquipmentProperties, SpellRequirements } from '../../../types/enums'
import Grid from '../../Grid/Grid'
import useSystemData from '../../../hooks/useSystemData'
import useClassData from '../../../hooks/useClassData'
import useRaceData from '../../../hooks/useRaceData'
import type { FormDataType, OnChange } from '../../../types/types'

const Details = () => {
  const { formStore } = use(FormContext)

  const {
    data,
    updateField,
    removeField,
    addField,
  }: {
    data: FormDataType
    updateField: OnChange<FormDataType>['updateField']
    removeField: OnChange<FormDataType>['removeField']
    addField: OnChange<FormDataType>['addField']
  } = formStore

  const { categories, characters, equipment, currencies, rules, abilities, spells } = useSystemData()
  const { subclasses, classes } = useClassData()
  const { races } = useRaceData()

  return (
    <Grid>
      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
        <Input
          name='label'
          label='Name'
          autoComplete='off'
          value={data?.label}
          required={true}
          onChange={{ updateField }}
          autoFocus={true}
          errorMsg='Name must not be blank'
        />
      </Grid.Item>
      {data.__typename === 'Character' && (
        <>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name='advancement'
              label='Advancement Type'
              value={data?.advancement}
              options={characters.advancementMethods.all}
              required={true}
              onChange={{ updateField, removeField }}
            />
          </Grid.Item>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name='hitpoint.method'
              label='Hit Point Type'
              value={data?.hitpoint?.method}
              options={characters.hitpointCalcMethods.all}
              required={true}
              onChange={{ updateField, removeField }}
            />
          </Grid.Item>
        </>
      )}
      {(data.__typename === 'Race' || data.__typename === 'Class' || data.__typename === 'Equipment') && (
        <>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name='category'
              label={`${startCase(data.__typename)} Category`}
              value={data?.category}
              options={
                data.__typename !== 'Equipment' ?
                  categories.filter(
                    (category) =>
                      (data.__typename === 'Race' && category?.races) ||
                      (data.__typename === 'Class' && category?.classes)
                  )
                : equipment.categories.all
              }
              required={true}
              onChange={{ updateField, removeField }}
            />
          </Grid.Item>
          {data.__typename === 'Race' && data.category === Categories.base && (
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='playable'
                label='Playable'
                value={data?.playable}
                options={[
                  {
                    value: 'true',
                    label: 'Yes',
                    id: 'true',
                  },
                  {
                    value: 'false',
                    label: 'No',
                    id: 'false',
                  },
                ]}
                required={true}
                onChange={{ updateField, removeField }}
              />
            </Grid.Item>
          )}
          {data.__typename === 'Equipment' && (
            <>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  name='properties'
                  multiSelect={true}
                  label='Properties'
                  value={data?.properties}
                  options={equipment.properties.filterByCategory(data.category)}
                  onChange={{ updateField, removeField }}
                />
              </Grid.Item>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  name='rarity'
                  label='Rarity'
                  value={data?.rarity}
                  options={equipment.rarities}
                  required={true}
                  onChange={{ updateField, removeField }}
                />
              </Grid.Item>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Input
                  validation='cur'
                  name='cost.amount'
                  autoComplete='off'
                  label='Cost'
                  required={true}
                  errorMsg='Must contain only decimal amounts'
                  value={data?.cost?.amount}
                  onChange={{ updateField }}
                />
              </Grid.Item>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  name='cost.currency'
                  label='Currency'
                  value={data?.cost?.currency}
                  options={currencies}
                  required={true}
                  onChange={{ updateField, removeField }}
                />
              </Grid.Item>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Input
                  validation='cur'
                  name='weight.amount'
                  errorMsg='Must contain only numbers'
                  label='Item Weight'
                  autoComplete='off'
                  value={data?.weight?.amount}
                  onChange={{ updateField }}
                />
              </Grid.Item>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  name='weight.unit'
                  label='UoM'
                  value={data?.weight?.unit}
                  options={rules.measurements.imperial.weight}
                  onChange={{ updateField, removeField }}
                />
              </Grid.Item>
            </>
          )}
        </>
      )}
      {data.__typename === 'Class' && (
        <>
          {data.category === Categories.subclass ?
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='parentClass'
                label='Parent Class'
                value={data?.parentClass}
                options={subclasses}
                required={true}
                onChange={{ updateField, removeField }}
              />
            </Grid.Item>
          : <>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Input
                  name='hitpoint.dieConfig'
                  autoComplete='off'
                  label='HP Die Value'
                  required={true}
                  value={data?.hitpoint?.dieConfig}
                  validation='die'
                  errorMsg='Must contain whole numbers only'
                  onChange={{ updateField }}
                />
              </Grid.Item>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  name='hitpoint.ability'
                  label='HP Modifier Ability'
                  value={data?.hitpoint?.ability}
                  options={abilities.all}
                  required={true}
                  onChange={{ updateField, removeField }}
                />
              </Grid.Item>
            </>
          }
        </>
      )}
      {data.__typename === 'Race' && (data.category === Categories.subrace || data.category === Categories.variant) && (
        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
          <Dropdown
            multiSelect={true}
            name='lineages'
            label='Race Lineage'
            value={data?.lineages}
            options={races}
            required={true}
            onChange={{ updateField, removeField }}
          />
        </Grid.Item>
      )}
      {data.__typename === 'Equipment' &&
        (((data.category === EquipmentCategories.waterVehicle || data.category === EquipmentCategories.mount ?
          <>
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Input
                validation={'cur'}
                name='speed.amount'
                errorMsg='Must contain only numbers'
                label='Item Speed'
                autoComplete='off'
                required={true}
                value={data?.speed?.amount}
                onChange={{ updateField }}
              />
            </Grid.Item>
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown
                name='speed.unit'
                label='UoM'
                value={data?.speed?.unit}
                options={rules.measurements.imperial.length}
                onChange={{ updateField, removeField }}
              />
            </Grid.Item>
          </>
        : (data.category === EquipmentCategories.weapon || data.category === EquipmentCategories.armor) && (
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Input
                validation={'num'}
                name='rank'
                errorMsg='Must contain only numbers'
                label='Item Rank'
                autoComplete='off'
                value={data?.rank}
                onChange={{ updateField }}
              />
            </Grid.Item>
          )) &&
          data.properties?.some((property) => property === EquipmentProperties.container)) ||
          (data.category === EquipmentCategories.mount && (
            <>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Input
                  validation={'cur'}
                  name='capacity.amount'
                  errorMsg='Must contain only numbers'
                  label='Capacity Amount'
                  autoComplete='off'
                  value={data?.capacity?.amount}
                  onChange={{ updateField }}
                />
              </Grid.Item>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  name='capacity.unit'
                  label='UoM'
                  value={data?.capacity?.unit}
                  options={[...rules.measurements.imperial.volume, ...rules.measurements.imperial.weight]}
                  onChange={{ updateField, removeField }}
                />
              </Grid.Item>
            </>
          )))}
      {data.__typename === 'Equipment' &&
        (data.category === EquipmentProperties.thrown || data.category === EquipmentProperties.ranged) && (
          <>
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Input
                validation='num'
                name='range.minRange'
                errorMsg='Must contain only numbers'
                label='Min Range'
                value={data?.range?.minRange}
                required={true}
                onChange={{ updateField }}
              />
            </Grid.Item>
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Input
                validation='num'
                name='range.maxRange'
                errorMsg='Must contain only numbers'
                label='Max Range'
                value={data?.range?.maxRange}
                required={true}
                onChange={{ updateField }}
              />
            </Grid.Item>
          </>
        )}
      {data.__typename === 'Equipment' && (
        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
          <Input
            validation='num'
            name='quantity'
            errorMsg='Must contain only numbers'
            label='Quantity'
            autoComplete='off'
            value={data?.quantity}
            onChange={{ updateField }}
          />
        </Grid.Item>
      )}
      {data.__typename === 'Spell' && (
        <>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Input
              validation='num'
              name='level'
              errorMsg='Must contain only numbers'
              label='Level'
              required={true}
              value={data?.level}
              onChange={{ updateField }}
            />
          </Grid.Item>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name='school'
              label='School'
              value={data?.school}
              options={spells.schools}
              required={true}
              onChange={{ updateField, removeField }}
            />
          </Grid.Item>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name='requirements'
              multiSelect={true}
              label='Requirements'
              value={data?.requirements}
              options={spells.requirements}
              required={true}
              onChange={{ updateField, removeField }}
            />
          </Grid.Item>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name='classes'
              multiSelect={true}
              label='Class(es)'
              value={data?.classes}
              options={classes}
              required={true}
              onChange={{ updateField, removeField }}
            />
          </Grid.Item>
          {data?.requirements?.some((requirement) => requirement === SpellRequirements.material) && (
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Input
                name='materialDesc'
                label='Material Desc.'
                required={true}
                value={data?.materialDesc}
                onChange={{ updateField }}
              />
            </Grid.Item>
          )}
        </>
      )}
      {data.__typename === 'Class' && data.category === Categories.base && (
        <Grid.Item>
          <Divider label='Starting Gold' />
          <Grid className={sprinkles({ mb: 'space-3' })}>
            <Grid.Item colSpan={'auto'}>
              <Input
                name='startingGold.dieConfig'
                label='Dice Configuration'
                required={true}
                validation='die'
                errorMsg='Please enter a whole number'
                value={data?.startingGold?.dieConfig}
                onChange={{ updateField }}
              />
            </Grid.Item>
            <Grid.Item colSpan={'auto'}>
              <Input
                name='startingGold.multiplier'
                label='Multiplier'
                required={true}
                validation='num'
                errorMsg='Please enter a whole number'
                value={data?.startingGold?.multiplier}
                onChange={{ updateField }}
              />
            </Grid.Item>
            <Grid.Item colSpan={'auto'}>
              <Dropdown
                name='startingGold.currency'
                label='Currency'
                value={data?.startingGold?.currency}
                options={currencies}
                required={true}
                onChange={{ updateField, removeField }}
              />
            </Grid.Item>
          </Grid>
        </Grid.Item>
      )}
      {data.__typename === 'Equipment' && (
        <Grid.Item>
          <RichTextEditor
            name={'quote'}
            className={sprinkles({ mb: 'space-3' })}
            value={data?.quote}
            label={'Quote'}
            onChange={{ updateField }}
          />
        </Grid.Item>
      )}
      {(data.__typename === 'Character' || data.__typename === 'Spell' || data.__typename === 'Equipment') && (
        <Grid.Item>
          <RichTextEditor
            name='desc'
            className={sprinkles({ mb: 'space-3' })}
            value={data?.desc}
            label='Description'
            onChange={{ updateField }}
          />
        </Grid.Item>
      )}
      {(data.__typename === 'Race' || data.__typename === 'Class' || data.__typename === 'Background') && (
        <>
          <Grid.Item colSpan={2} className={sprinkles({ alignContent: 'flex-end' })}>
            <Button
              type='button'
              color='main'
              onClick={() => {
                addField({
                  path: 'details',
                })
              }}
            >
              Add Detail
            </Button>
          </Grid.Item>
          {data?.details != null && (
            <Grid.Item>
              <Accordion dataArray={data.details} onChange={{ updateField }} name='details'>
                {data?.details.map((detail, index) => (
                  <Accordion.Wrapper key={index} itemId={String(index)}>
                    <Accordion.Header
                      handleRemove={() =>
                        removeField({
                          path: `details.${index}`,
                        })
                      }
                    >
                      {detail.label != null && detail.label !== '' ? detail.label : `Detail ${index + 1}`}
                    </Accordion.Header>
                    <Accordion.Content>
                      <Grid>
                        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                          <Input
                            name={`details.${index}.label`}
                            autoComplete='off'
                            label='Detail Name'
                            value={detail.label}
                            onChange={{ updateField }}
                          />
                        </Grid.Item>
                        <Grid.Item>
                          <RichTextEditor
                            name={`details.${index}.desc`}
                            value={detail.desc}
                            label={'Section Description'}
                            onChange={{ updateField }}
                          />
                        </Grid.Item>
                      </Grid>
                    </Accordion.Content>
                  </Accordion.Wrapper>
                ))}
              </Accordion>
            </Grid.Item>
          )}
        </>
      )}
    </Grid>
  )
}

export default Details
