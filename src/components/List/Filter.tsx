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
              name='damage.primary.type'
              label='Primary Damage Type'
              options={[].concat(
                items?.map(
                  (item: DropdownOption) => item.damage?.primary?.type
                ),
                items?.map(
                  (item: DropdownOption) => item.damage?.secondary?.type
                )
              )}
              value={listFilter?.damage?.primary?.type}
              onChange={setListFilter}
            />
            <Dropdown
              multiSelect={true}
              name='damage.secondary.type'
              label='Secondary Damage Type'
              options={[].concat(
                items?.map(
                  (item: DropdownOption) => item.damage?.primary?.type
                ),
                items?.map(
                  (item: DropdownOption) => item.damage?.secondary?.type
                )
              )}
              value={listFilter?.damage?.secondary?.type}
              onChange={setListFilter}
            />
            <Dropdown
              multiSelect={true}
              name='condition.type'
              label='Condition Type'
              options={items?.flatMap((item: DropdownOption) => {
                if (item.condition && Array.isArray(item.condition.type)) {
                  return item.condition.type
                } else {
                  return []
                }
              })}
              value={listFilter?.condition?.type}
              onChange={setListFilter}
            />
            <Dropdown
              multiSelect={true}
              name='saveAbility.type'
              label='DC Ability'
              options={items?.map(
                (item: DropdownOption) => item.saveAbility?.type
              )}
              value={listFilter?.saveAbility?.type}
              onChange={setListFilter}
            />
            <Dropdown
              multiSelect={true}
              name='action.type'
              label='Casting Time'
              options={items?.map((item: DropdownOption) => item.action?.type)}
              value={listFilter?.action?.type}
              onChange={setListFilter}
            />
            <Dropdown
              multiSelect={true}
              name='duration.type'
              label='Duration'
              options={items?.map(
                (item: DropdownOption) => item.duration?.type
              )}
              value={listFilter?.duration?.type}
              onChange={setListFilter}
            />
            <Dropdown
              multiSelect={true}
              name='range.type'
              label='Range'
              options={items?.map((item: DropdownOption) => item.range?.type)}
              value={listFilter?.range?.type}
              onChange={setListFilter}
            />
            <Dropdown
              multiSelect={true}
              name='shape.type'
              label='Shape'
              options={items?.map((item: DropdownOption) => item.shape?.type)}
              value={listFilter?.shape?.type}
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
              name='property.type'
              label='Item Property'
              options={
                items?.flatMap(
                  (item: any) => item.property?.type
                ) as DropdownOption[]
              }
              value={listFilter?.property?.type}
              onChange={setListFilter}
            />
            <Dropdown
              multiSelect={true}
              name='damage.type'
              label='Damage Type'
              options={items?.flatMap(
                (item: any) => item.damage?.primary?.type
              )}
              value={listFilter?.damage?.type}
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
