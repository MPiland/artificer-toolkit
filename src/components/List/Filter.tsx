import Collapse from '../Collapse/Collapse'
import Grid from '../Grid/Grid'
import Dropdown from '../Dropdown/Dropdown'
import Input from '../Input/Input'
import { useMediaQuery } from 'usehooks-ts'
import { DropdownOption, ReducerActionType } from '../../utils/types'
import { startCase } from 'lodash'

interface FilterProps {
  context: string
  items: any
  listFilter: any
  setListFilter: (arg: ReducerActionType) => void
}

const Filter = ({ context, items, listFilter, setListFilter }: FilterProps) => {
  const sm = useMediaQuery('screen and (max-width: 567px)')

  return (
    <Collapse title={'Filters'} startOpened={!sm}>
      <Grid>
        <Input
          name='value'
          label={`${startCase(context)} Name`}
          autoComplete='off'
          value={listFilter?.value}
          onChange={setListFilter}
        />
        {context === 'spell' && (
          <>
            <Dropdown
              multiSelect={true}
              name='level'
              label='Level'
              options={items?.map((item: DropdownOption) => ({
                value: item?.level,
                name: null,
                id: null,
              }))}
              value={listFilter?.level}
              onChange={setListFilter}
            />
            <Dropdown
              multiSelect={true}
              name='classes'
              label='Classes'
              options={items?.flatMap((item: DropdownOption) => {
                if (item.classes && Array.isArray(item.classes)) {
                  return item.classes
                } else {
                  return []
                }
              })}
              value={listFilter?.classes}
              onChange={setListFilter}
            />
            <Dropdown
              multiSelect={true}
              name='school'
              label='Spell School'
              options={items?.map((item: DropdownOption) => item.school)}
              value={listFilter?.school}
              onChange={setListFilter}
            />
            <Dropdown
              multiSelect={true}
              name='damage.damageType'
              label='Damage Type'
              options={items?.map((item: DropdownOption) => {
                if (item.damage && Array.isArray(item.damage.damageType)) {
                  return item.damage.damageType
                } else {
                  return []
                }
              })}
              value={listFilter?.damage?.damageType}
              onChange={setListFilter}
            />
            <Dropdown
              multiSelect={true}
              name='condition'
              label='Condition Type'
              options={items?.flatMap((item: DropdownOption) => {
                if (item.condition && Array.isArray(item.condition)) {
                  return item.condition
                } else {
                  return []
                }
              })}
              value={listFilter?.damage?.damageType}
              onChange={setListFilter}
            />
            <Dropdown
              multiSelect={true}
              name='saveAbility.ability'
              label='DC Ability'
              options={items?.map((item: DropdownOption) => {
                if (
                  item.saveAbility?.ability &&
                  Array.isArray(item.saveAbility?.ability)
                ) {
                  return item.saveAbility?.ability
                } else {
                  return []
                }
              })}
              value={listFilter?.damage?.damageType}
              onChange={setListFilter}
            />
            <Dropdown
              multiSelect={true}
              name='action.actionType'
              label='Casting Time'
              options={items?.map(
                (item: DropdownOption) => item.action?.actionType
              )}
              value={listFilter?.action?.actionType}
              onChange={setListFilter}
            />
            <Dropdown
              multiSelect={true}
              name='action.actionType'
              label='Casting Time'
              options={items?.map(
                (item: DropdownOption) => item.action?.actionType
              )}
              value={listFilter?.action?.actionType}
              onChange={setListFilter}
            />
            <Dropdown
              multiSelect={true}
              name='duration.durationType'
              label='Duration'
              options={items?.map(
                (item: DropdownOption) => item.duration?.durationType
              )}
              value={listFilter?.duration?.durationType}
              onChange={setListFilter}
            />
            <Dropdown
              multiSelect={true}
              name='range.rangeType'
              label='Range'
              options={items?.map(
                (item: DropdownOption) => item.range?.rangeType
              )}
              value={listFilter?.range?.rangeType}
              onChange={setListFilter}
            />
            <Dropdown
              multiSelect={true}
              name='shape.shapeType'
              label='Shape'
              options={items?.map(
                (item: DropdownOption) => item.shape?.shapeType
              )}
              value={listFilter?.shape?.shapeType}
              onChange={setListFilter}
            />
          </>
        )}
        {context === 'item' && (
          <>
            <Dropdown
              multiSelect={true}
              name='category'
              label='Item Category'
              placeholder='Select...'
              options={
                items?.map((item: any) => item.category) as DropdownOption[]
              }
              value={listFilter?.category}
              onChange={setListFilter}
            />
            <Dropdown
              multiSelect={true}
              name='property'
              label='Item Property'
              options={
                items?.flatMap((item: any) => {
                  if (item.property && Array.isArray(item.property)) {
                    return item.property
                  } else {
                    return []
                  }
                }) as DropdownOption[]
              }
              value={listFilter?.property}
              onChange={setListFilter}
            />
            <Dropdown
              multiSelect={true}
              name='damage.damageType'
              label='Damage Type'
              options={
                items?.flatMap((item: any) => {
                  if (item.damage && Array.isArray(item.damage.damageType)) {
                    return item.damage.damageType
                  } else {
                    return []
                  }
                }) as DropdownOption[]
              }
              value={listFilter?.damage?.damageType}
              onChange={setListFilter}
            />
            <Dropdown
              multiSelect={true}
              name='armorClass'
              label='AC'
              options={
                items?.map((item: any) => ({
                  value: item.armorClass,
                })) as DropdownOption[]
              }
              value={listFilter.armorClass}
              onChange={setListFilter}
            />
          </>
        )}
      </Grid>
    </Collapse>
  )
}

export default Filter
