import Dropdown from '../../Dropdown/Dropdown'
import Input from '../../Input/Input'
import Row from '../../Row/Row'
import RichTextEditor from '../../RichTextEditor/RichTextEditor'
import { useGetSystemQuery } from '../../../features/systems/systemsApi'
import { useListClassesQuery } from '../../../features/classes/classesApi'
import { startCase } from 'lodash'
import Button from '../../Button/Button'
import Accordion from '../../Accordion/Accordion'
import { sprinkles } from '../../../css/sprinkles.css'
import { use } from 'react'
import { FormContext } from '../FormContext'
import Divider from '../../Divider/Divider'
import { Categories, EquipmentCategories, EquipmentProperties, SpellRequirements } from '../../../types/enums'
import { useListRacesQuery } from '../../../features/races/racesApi'
import Grid from '../../Grid/Grid'

const Details = () => {
  const { formData, updateFormData } = use(FormContext)

  const { data: system } = useGetSystemQuery()
  const { data: classes } = useListClassesQuery()
  const { data: races } = useListRacesQuery()

  console.log({ formData })

  return (
    <Grid>
      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
        <Input<typeof formData>
          name='label'
          label='Name'
          autoComplete='off'
          value={formData?.label}
          required={true}
          onChange={updateFormData}
          autoFocus={true}
          errorMsg='Name must not be blank'
        />
      </Grid.Item>
      {formData.__typename === 'Character' && (
        <>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown<typeof formData>
              name='advancement'
              label='Advancement Type'
              value={formData?.advancement}
              options={system.characters.advancementMethods}
              required={true}
              onChange={updateFormData}
            />
          </Grid.Item>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown<typeof formData>
              name='hitpoint'
              label='Hit Point Type'
              value={formData?.hitpoint}
              options={system.characters.hitpointCalcMethods}
              required={true}
              onChange={updateFormData}
            />
          </Grid.Item>
        </>
      )}
      {(formData.__typename === 'Race' || formData.__typename === 'Class' || formData.__typename === 'Equipment') && (
        <>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown<typeof formData>
              name='category'
              label={`${startCase(formData.__typename)} Category`}
              value={formData?.category}
              options={
                formData.__typename !== 'Equipment'
                  ? system?.categories?.filter(
                      (category) =>
                        (formData.__typename === 'Race' && category.races) ||
                        (formData.__typename === 'Class' && category.classes)
                    )
                  : system.equipment.categories
              }
              required={true}
              onChange={updateFormData}
            />
          </Grid.Item>
          {formData.__typename === 'Race' && formData.category === Categories.base && (
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown<typeof formData>
                name='playable'
                label='Playable'
                value={formData?.playable}
                options={[
                  {
                    value: 'true',
                    label: 'Yes',
                    id: 'yes',
                  },
                  {
                    value: 'false',
                    label: 'No',
                    id: 'no',
                  },
                ]}
                required={true}
                onChange={updateFormData}
              />
            </Grid.Item>
          )}
          {formData.__typename === 'Equipment' && (
            <>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown<typeof formData>
                  name='properties'
                  multiSelect={true}
                  label='Properties'
                  value={formData?.properties}
                  options={
                    system.equipment.categories.find((category) => category.id === formData.category)?.properties
                  }
                  onChange={updateFormData}
                />
              </Grid.Item>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown<typeof formData>
                  name='rarity'
                  label='Rarity'
                  value={formData?.rarity}
                  options={system.equipment.rarities}
                  required={true}
                  onChange={updateFormData}
                />
              </Grid.Item>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Input<typeof formData>
                  validation='cur'
                  name='cost.amount'
                  autoComplete='off'
                  label='Cost'
                  required={true}
                  errorMsg='Must contain only decimal amounts'
                  value={formData?.cost?.amount}
                  onChange={updateFormData}
                />
              </Grid.Item>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown<typeof formData>
                  name='cost.currency'
                  label='Currency'
                  value={formData?.cost?.currency}
                  options={system.currencies}
                  required={true}
                  onChange={updateFormData}
                />
              </Grid.Item>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Input<typeof formData>
                  validation='cur'
                  name='weight.amount'
                  errorMsg='Must contain only numbers'
                  label='Item Weight'
                  autoComplete='off'
                  value={formData?.weight?.amount}
                  onChange={updateFormData}
                />
              </Grid.Item>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown<typeof formData>
                  name='weight.unit'
                  label='UoM'
                  value={formData?.weight?.unit}
                  options={Object.values(system.rules.measurements.imperial).flatMap(
                    (rule) => Array.isArray(rule) && rule
                  )}
                  onChange={updateFormData}
                />
              </Grid.Item>
            </>
          )}
        </>
      )}
      {formData.__typename === 'Class' && (
        <>
          {formData.category === Categories.subclass ? (
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown<typeof formData>
                name='parentClass'
                label='Parent Class'
                value={formData?.parentClass}
                options={classes?.filter((uClass) => uClass.category !== Categories.subclass)}
                required={true}
                onChange={updateFormData}
              />
            </Grid.Item>
          ) : (
            <>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Input<typeof formData>
                  name='hitpoint.dieConfig'
                  autoComplete='off'
                  label='HP Die Value'
                  required={true}
                  value={formData?.hitpoint?.dieConfig}
                  validation='die'
                  errorMsg='Must contain whole numbers only'
                  onChange={updateFormData}
                />
              </Grid.Item>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown<typeof formData>
                  name='hitpoint.ability'
                  label='HP Modifier Ability'
                  value={formData?.hitpoint?.ability}
                  options={system.abilities}
                  required={true}
                  onChange={updateFormData}
                />
              </Grid.Item>
            </>
          )}
        </>
      )}
      {formData.__typename === 'Race' &&
        (formData.category === Categories.subrace || formData.category === Categories.variant) && (
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown<typeof formData>
              multiSelect={true}
              name='lineages'
              label='Race Lineage'
              value={formData?.lineages}
              options={races}
              required={true}
              onChange={updateFormData}
            />
          </Grid.Item>
        )}
      {formData.__typename === 'Equipment' &&
        (((formData.category === EquipmentCategories.waterVehicle || formData.category === EquipmentCategories.mount ? (
          <>
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Input<typeof formData>
                validation={'cur'}
                name='speed.amount'
                errorMsg='Must contain only numbers'
                label='Item Speed'
                autoComplete='off'
                required={true}
                value={formData?.speed?.amount}
                onChange={updateFormData}
              />
            </Grid.Item>
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Dropdown<typeof formData>
                name='speed.unit'
                label='UoM'
                value={formData?.speed?.unit}
                options={Object.values(system.rules.measurements.imperial).flatMap(
                  (rule) => Array.isArray(rule) && rule
                )}
                onChange={updateFormData}
              />
            </Grid.Item>
          </>
        ) : (
          (formData.category === EquipmentCategories.weapon || formData.category === EquipmentCategories.armor) && (
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Input<typeof formData>
                validation={'num'}
                name='rank'
                errorMsg='Must contain only numbers'
                label='Item Rank'
                autoComplete='off'
                value={formData?.rank}
                onChange={updateFormData}
              />
            </Grid.Item>
          )
        )) &&
          formData.properties?.some((property) => property === EquipmentProperties.container)) ||
          (formData.category === EquipmentCategories.mount && (
            <>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Input<typeof formData>
                  validation={'cur'}
                  name='capacity.amount'
                  errorMsg='Must contain only numbers'
                  label='Capacity Amount'
                  autoComplete='off'
                  value={formData?.capacity?.amount}
                  onChange={updateFormData}
                />
              </Grid.Item>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown<typeof formData>
                  name='capacity.unit'
                  label='UoM'
                  value={formData?.capacity?.unit}
                  options={Object.values(system.rules.measurements.imperial).flatMap(
                    (rule) => Array.isArray(rule) && rule
                  )}
                  onChange={updateFormData}
                />
              </Grid.Item>
            </>
          )))}
      {formData.__typename === 'Equipment' &&
        (formData.category === EquipmentProperties.thrown || formData.category === EquipmentProperties.ranged) && (
          <>
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Input<typeof formData>
                validation='num'
                name='range.minRange'
                errorMsg='Must contain only numbers'
                label='Min Range'
                value={formData?.range?.minRange}
                required={true}
                onChange={updateFormData}
              />
            </Grid.Item>
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Input<typeof formData>
                validation='num'
                name='range.maxRange'
                errorMsg='Must contain only numbers'
                label='Max Range'
                value={formData?.range?.maxRange}
                required={true}
                onChange={updateFormData}
              />
            </Grid.Item>
          </>
        )}
      {formData.__typename === 'Equipment' && (
        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
          <Input<typeof formData>
            validation='num'
            name='quantity'
            errorMsg='Must contain only numbers'
            label='Quantity'
            autoComplete='off'
            value={formData?.quantity}
            onChange={updateFormData}
          />
        </Grid.Item>
      )}
      {formData.__typename === 'Spell' && (
        <>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Input<typeof formData>
              validation='num'
              name='level'
              errorMsg='Must contain only numbers'
              label='Level'
              required={true}
              value={formData?.level}
              onChange={updateFormData}
            />
          </Grid.Item>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown<typeof formData>
              name='school'
              label='School'
              value={formData?.school}
              options={system.spells.schools}
              required={true}
              onChange={updateFormData}
            />
          </Grid.Item>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown<typeof formData>
              name='requirements'
              multiSelect={true}
              label='Requirements'
              value={formData?.requirements}
              options={system.spells.requirements}
              required={true}
              onChange={updateFormData}
            />
          </Grid.Item>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown<typeof formData>
              name='classes'
              multiSelect={true}
              label='Class(es)'
              value={formData?.classes}
              options={classes.map((uClass) => ({
                value: uClass.value,
                id: uClass.id,
                label: uClass.label,
              }))}
              required={true}
              onChange={updateFormData}
            />
          </Grid.Item>
          {formData?.requirements?.some((requirement) => requirement === SpellRequirements.material) && (
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Input<typeof formData>
                name='materialDesc'
                label='Material Desc.'
                required={true}
                value={formData?.materialDesc}
                onChange={updateFormData}
              />
            </Grid.Item>
          )}
        </>
      )}
      {formData.__typename === 'Class' && formData.category === Categories.base && (
        <Grid.Item>
          <Divider label='Starting Gold' />
          <Grid className={sprinkles({ mb: 'space-3' })}>
            <Grid.Item colSpan={'auto'}>
              <Input<typeof formData>
                name='startingGold.dieConfig'
                label='Dice Configuration'
                required={true}
                validation='die'
                errorMsg='Please enter a whole number'
                value={formData?.startingGold?.dieConfig}
                onChange={updateFormData}
              />
            </Grid.Item>
            <Grid.Item colSpan={'auto'}>
              <Input<typeof formData>
                name='startingGold.multiplier'
                label='Multiplier'
                required={true}
                validation='num'
                errorMsg='Please enter a whole number'
                value={formData?.startingGold?.multiplier || 1}
                onChange={updateFormData}
              />
            </Grid.Item>
            <Grid.Item colSpan={'auto'}>
              <Dropdown<typeof formData>
                name='startingGold.currency'
                label='Currency'
                value={formData?.startingGold?.currency}
                options={system.currencies}
                required={true}
                onChange={updateFormData}
              />
            </Grid.Item>
          </Grid>
        </Grid.Item>
      )}
      {formData.__typename === 'Equipment' && (
        <Grid.Item>
          <RichTextEditor<typeof formData>
            name={'quote'}
            className={sprinkles({ mb: 'space-3' })}
            value={formData?.quote}
            label={'Quote'}
            onChange={updateFormData}
          />
        </Grid.Item>
      )}
      {(formData.__typename === 'Character' ||
        formData.__typename === 'Spell' ||
        formData.__typename === 'Equipment') && (
        <Grid.Item>
          <RichTextEditor<typeof formData>
            name='desc'
            className={sprinkles({ mb: 'space-3' })}
            value={formData?.desc}
            label='Description'
            onChange={updateFormData}
          />
        </Grid.Item>
      )}
      {(formData.__typename === 'Race' || formData.__typename === 'Class' || formData.__typename === 'Background') && (
        <>
          <Grid.Item colSpan={2} className={sprinkles({ alignContent: 'flex-end' })}>
            <Button
              type='button'
              color='main'
              onClick={() => {
                updateFormData({
                  type: 'add',
                  path: 'details',
                })
              }}
            >
              Add Detail
            </Button>
          </Grid.Item>
          {formData?.details != null && (
            <Grid.Item>
              <Accordion<typeof formData> dataArray={formData.details} onChange={updateFormData} name='details'>
                {formData?.details.map((detail, index) => (
                  <Accordion.Wrapper key={index} itemId={String(index)}>
                    <Accordion.Header
                      handleRemove={() =>
                        updateFormData<typeof formData>({
                          type: 'remove',
                          path: `details.${index}`,
                        })
                      }
                    >
                      {detail.label != null && detail.label !== '' ? detail.label : `Detail ${index + 1}`}
                    </Accordion.Header>
                    <Accordion.Content>
                      <Row className={sprinkles({ mb: 'space-3' })}>
                        <Input<typeof formData>
                          name={`details.${index}.label`}
                          autoComplete='off'
                          label='Detail Name'
                          value={detail.label}
                          onChange={updateFormData}
                        />
                      </Row>
                      <RichTextEditor<typeof formData>
                        name={`details.${index}.desc`}
                        value={detail.desc}
                        label={'Section Description'}
                        onChange={updateFormData}
                      />
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
