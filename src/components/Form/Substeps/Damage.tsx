import { useEffect, useMemo } from 'react'
import Dropdown from '@/components/Dropdown'
import Input from '@/components/Input'
import Collapse from '@/components/Collapse'
import { Attributes, Damages, Spells } from '@/enums'
import Button from '@/components/Button'
import { row_button } from '../Form.css'
import { TbPlus, TbX } from 'react-icons/tb'
import { useEnumChecks, useSystemData } from '@/hooks'
import { startCase } from 'lodash'
import Grid from '@/components/Grid'
import type { OnChange, Equipment, Spell, FeatureDataType } from '@/types'

const Damage = ({
  formStore: { data, updateField, removeField, addField },
}: {
  formStore: {
    data: Spell | Equipment | FeatureDataType
    updateField: OnChange<Spell | Equipment | FeatureDataType>['updateField']
    removeField: OnChange<Spell | Equipment | FeatureDataType>['removeField']
    addField: OnChange<Spell | Equipment | FeatureDataType>['addField']
  }
}) => {
  const { abilities, attributes, damageTypes } = useSystemData()

  const { doesDamage } = useEnumChecks({ data })
  const { secondaryDamage, bonusDamage, isVersatile } = useEnumChecks({
    data: data?.damage ? data?.damage : undefined,
  })

  // Set Damage types for spells, weapons, items
  const formDamageTypes = useMemo(() => {
    let types: ('primary' | 'secondary' | 'bonus' | 'versatile')[] = ['primary'] // Create a copy of damageTypes array

    // Handle secondary
    if (secondaryDamage) {
      if (!types.includes('secondary')) {
        types.push('secondary')
      }
    } else if (types.includes('secondary')) {
      types = types.filter((type) => type !== 'secondary')
    }

    // Handle bonus damage
    if (bonusDamage) {
      if (!types.includes('bonus')) {
        types.push('bonus')
      }
    } else if (types.includes('bonus')) {
      types = types.filter((type) => type !== 'bonus')
    }

    if (data.__typename === 'Equipment' && isVersatile) {
      if (!types.includes('versatile')) {
        types.push('versatile')
      }
    } else if (types.includes('versatile')) {
      types = types.filter((type) => type !== 'versatile')
    }
    return types
  }, [data, bonusDamage, secondaryDamage, isVersatile])

  // Add primary damage if doesn't exist
  useEffect(() => {
    if (doesDamage && !data?.damage?.primary) {
      updateField({
        path: 'damage.primary',
        value: {},
      })
    }
  }, [doesDamage, data?.damage?.primary, updateField])

  // Add/remove Die Per Level table
  useEffect(() => {
    const diePerLevel = {
      primary: data?.damage?.primary?.attribute === Attributes.DIE_PER_LEVEL,
      secondary: data?.damage?.secondary?.attribute === Attributes.DIE_PER_LEVEL,
      bonus: data?.damage?.bonus?.attribute === Attributes.DIE_PER_LEVEL,
    }
    // Potential damage properties
    const keys = ['primary', 'secondary', 'bonus'] as const
    type DamageKey = (typeof keys)[number]
    keys.forEach((key: DamageKey) => {
      if (
        diePerLevel[key] &&
        !data?.damage?.diePerLevel?.some((level) => level?.[key] != null) &&
        data?.damage?.[key]
      ) {
        addField({ path: `damage.diePerLevel.0.${key}` })
      }
      if (!diePerLevel[key] && data?.damage?.diePerLevel?.find((level) => level?.[key]) != null) {
        const diePerLevelArray = data?.damage?.diePerLevel?.map((level) => {
          const levelObject = { ...level }
          delete levelObject[key]
          return levelObject
        })
        updateField({
          path: `damage.diePerLevel`,
          value: diePerLevelArray,
        })
      }
    })
  }, [updateField, data?.damage, addField])

  // Add/remove Set Per Level table
  useEffect(() => {
    const setPerLevel = {
      primary: data?.damage?.primary?.attribute === Attributes.SET_PER_LEVEL,
      secondary: data?.damage?.secondary?.attribute === Attributes.SET_PER_LEVEL,
      bonus: data?.damage?.bonus?.attribute === Attributes.SET_PER_LEVEL,
    }
    // Potential damage properties
    const keys = ['primary', 'secondary', 'bonus'] as const
    type DamageKey = (typeof keys)[number]
    keys.forEach((key: DamageKey) => {
      if (
        setPerLevel[key] &&
        !data?.damage?.setPerLevel?.some((level) => level?.[key] != null) &&
        data?.damage?.[key]
      ) {
        addField({ path: `damage.setPerLevel.0.${key}` })
      }
      if (!setPerLevel[key] && data?.damage?.setPerLevel?.find((level) => level?.[key]) != null) {
        const setPerLevelArray = data?.damage?.setPerLevel?.map((level) => {
          const levelObject = { ...level }
          delete levelObject[key]
          return levelObject
        })
        addField({ path: `damage.setPerLevel`, value: setPerLevelArray })
      }
    })
  }, [addField, data?.damage])

  // Remove Damage data
  useEffect(() => {
    if (data?.damage?.secondary && !secondaryDamage) {
      removeField({ path: 'damage.secondary' })
    }
    if (data?.damage?.bonus && !bonusDamage) {
      removeField({ path: 'damage.bonus' })
    }
    if (
      (data.__typename !== 'Equipment' && data?.damage?.versatile) ||
      (data.__typename === 'Equipment' && !isVersatile)
    ) {
      updateField({ path: 'damage.versatile', value: null })
    }
  }, [updateField, removeField, data, bonusDamage, secondaryDamage, isVersatile])

  return (
    <>
      <Grid.Item colSpan={2}>
        <Dropdown
          multiSelect={true}
          name={`damage.attributes`}
          label={`Damage Attributes`}
          value={data?.damage?.attributes}
          options={attributes.filter((attribute) =>
            data.__typename !== 'Spell' ?
              attribute?.damage?.length && data.__typename === 'Equipment' ?
                attribute?.damage?.includes(Damages.EQUIPMENT)
              : attribute?.damage?.includes(Damages.ALL)
            : attribute?.spells?.length && attribute.spells.includes(Spells.DAMAGE)
          )}
          onChange={{ updateField, removeField }}
        />
      </Grid.Item>
      {formDamageTypes.map((type, index) => {
        return (
          <Grid.Item key={index}>
            <Grid>
              {type !== 'versatile' && (
                <>
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                    <Dropdown
                      name={`damage.${type}.attribute`}
                      label={`${
                        type === 'primary' ? 'Main'
                        : type === 'secondary' ? 'Sec.'
                        : 'Bonus'
                      } Dmg. Attribute`}
                      value={data?.damage?.[type]?.attribute}
                      options={attributes.filter((attribute) =>
                        attribute?.damage?.length && data.__typename === 'Equipment' ?
                          attribute?.damage?.includes(Damages.EQUIPMENT)
                        : attribute?.damage?.includes(Damages.MAIN)
                      )}
                      onChange={{ updateField, removeField }}
                    />
                  </Grid.Item>
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                    <Dropdown
                      name={`damage.${type}.id`}
                      label={`${
                        type === 'primary' ? 'Main'
                        : type === 'secondary' ? 'Sec.'
                        : 'Bonus'
                      } Dmg. Type`}
                      value={data?.damage?.[type]?.id}
                      options={[
                        ...damageTypes,
                        {
                          id: 'matchWeapon',
                          value: 'matchWeapon',
                          label: 'Match Weapon',
                        },
                      ]}
                      required={true}
                      onChange={{ updateField, removeField }}
                    />
                  </Grid.Item>
                </>
              )}
              {data?.damage?.[type]?.attribute !== Attributes.DIE_PER_LEVEL &&
                data?.damage?.[type]?.attribute !== Attributes.SET_PER_LEVEL &&
                (data?.damage?.[type]?.attribute === Attributes.SET_AMOUNT ?
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                    <Input
                      name={`damage.${type}.setAmount`}
                      value={data?.damage?.[type]?.setAmount}
                      label={`Set ${
                        type === 'primary' ? 'Main'
                        : type === 'secondary' ? 'Sec.'
                        : 'Bonus'
                      } Value`}
                      required={true}
                      validation='num'
                      errorMsg={'Must contain only numbers'}
                      onChange={{ updateField }}
                    />
                  </Grid.Item>
                : (
                  data?.damage?.[type]?.attribute === Attributes.ABILITY ||
                  data?.damage?.[type]?.attribute === Attributes.SPELLCASTING_ABILITY ||
                  data?.damage?.[type]?.attribute === Attributes.PROFICIENCY
                ) ?
                  <>
                    {data?.damage?.[type]?.attribute === Attributes.ABILITY && (
                      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                        <Dropdown
                          name={`damage.${type}.ability`}
                          label={`${
                            type === 'primary' ? 'Main'
                            : type === 'secondary' ? 'Sec.'
                            : 'Bonus'
                          } Ability`}
                          value={data?.damage?.[type]?.ability}
                          options={abilities}
                          required={true}
                          onChange={{ updateField, removeField }}
                        />
                      </Grid.Item>
                    )}
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Input
                        name={`damage.${type}.minAmount`}
                        value={data?.damage?.[type]?.minAmount}
                        label={`${
                          type === 'primary' ? 'Main'
                          : type === 'secondary' ? 'Sec.'
                          : 'Bonus'
                        } Min. Value`}
                        validation='num'
                        errorMsg={'Must contain only numbers'}
                        onChange={{ updateField }}
                      />
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Input
                        name={`damage.${type}.maxAmount`}
                        value={data?.damage?.[type]?.maxAmount}
                        label={`${
                          type === 'primary' ? 'Main'
                          : type === 'secondary' ? 'Sec.'
                          : 'Bonus'
                        } Max Value`}
                        validation='num'
                        errorMsg={'Must contain only numbers'}
                        onChange={{ updateField }}
                      />
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Input
                        name={`damage.${type}.multiplier`}
                        value={data?.damage?.[type]?.multiplier}
                        label={`${
                          type === 'primary' ? 'Main'
                          : type === 'secondary' ? 'Sec.'
                          : 'Bonus'
                        } Dmg. Multiplier`}
                        validation='num'
                        errorMsg={'Must contain only numbers'}
                        onChange={{ updateField }}
                      />
                    </Grid.Item>
                  </>
                : data?.damage?.[type]?.attribute === Attributes.DAMAGE_POOL ?
                  <>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        name={`damage.${type}.pool.attribute`}
                        label={`${
                          type === 'primary' ? 'Main'
                          : type === 'secondary' ? 'Sec.'
                          : 'Bonus'
                        } Dmg. Pool Attribute`}
                        value={data?.damage?.[type]?.pool?.attribute}
                        options={attributes.filter(
                          (attribute) => attribute?.damage?.length && attribute?.damage.includes(Damages.POOL)
                        )}
                        required={true}
                        onChange={{ updateField, removeField }}
                      />
                    </Grid.Item>
                    {(
                      data?.damage?.[type]?.pool?.attribute === Attributes.LEVEL ||
                      data?.damage?.[type]?.pool?.attribute === Attributes.ABILITY ||
                      data?.damage?.[type]?.pool?.attribute === Attributes.SPELLCASTING_ABILITY ||
                      data?.damage?.[type]?.pool?.attribute === Attributes.PROFICIENCY
                    ) ?
                      <>
                        {(data?.damage?.[type]?.pool?.attribute === Attributes.ABILITY ||
                          data?.damage?.[type]?.pool.attribute === Attributes.SPELLCASTING_ABILITY) && (
                          <>
                            {data?.damage?.[type]?.pool?.attribute === Attributes.ABILITY && (
                              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                                <Dropdown
                                  name={`damage.${type}.pool.ability`}
                                  label='Pool Abilty'
                                  value={data?.damage?.[type]?.pool?.ability}
                                  options={abilities}
                                  required={true}
                                  onChange={{ updateField, removeField }}
                                />
                              </Grid.Item>
                            )}
                            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                              <Input
                                name={`damage.${type}.pool.minAmount`}
                                value={data?.damage?.[type]?.pool?.minAmount}
                                label={`${
                                  type === 'primary' ? 'Main'
                                  : type === 'secondary' ? 'Sec.'
                                  : 'Bonus'
                                } Dmg. Min. Value`}
                                onChange={{ updateField }}
                                validation='num'
                                errorMsg={'Must contain only numbers'}
                              />
                            </Grid.Item>
                          </>
                        )}
                        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                          <Input
                            name={`damage.${type}.pool.maxAmount`}
                            value={data?.damage?.[type].pool?.maxAmount}
                            label={`${
                              type === 'primary' ? 'Main'
                              : type === 'secondary' ? 'Sec.'
                              : 'Bonus'
                            } Dmg. Max Value`}
                            onChange={{ updateField }}
                            validation='num'
                            errorMsg={'Must contain only numbers'}
                          />
                        </Grid.Item>
                        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                          <Input
                            name={`damage.${type}.pool.multiplier`}
                            value={data?.damage?.[type]?.pool?.multiplier}
                            label={`${
                              type === 'primary' ? 'Main'
                              : type === 'secondary' ? 'Sec.'
                              : 'Bonus'
                            } Dmg. Multiplier`}
                            onChange={{ updateField }}
                            validation='num'
                            errorMsg={'Must contain only numbers'}
                          />
                        </Grid.Item>
                      </>
                    : data?.damage?.[type]?.pool?.attribute === Attributes.SET_AMOUNT && (
                        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                          <Input
                            name={`damage.${type}.pool.setAmount`}
                            value={data?.damage?.[type]?.pool?.setAmount}
                            label='Pool Total'
                            onChange={{ updateField }}
                            validation='num'
                            required={true}
                            errorMsg={'Must contain only numbers'}
                          />
                        </Grid.Item>
                      )
                    }
                  </>
                : <>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Input
                        name={`damage.${type}.dieConfig`}
                        value={data?.damage?.[type]?.dieConfig}
                        label={`${
                          type === 'primary' ? 'Main'
                          : type === 'secondary' ? 'Sec.'
                          : 'Bonus'
                        } Dice Config`}
                        onChange={{ updateField }}
                        required={type === 'primary' ? true : false}
                        validation='die'
                        errorMsg={'Must contain only numbers'}
                      />
                    </Grid.Item>
                  </>)}
            </Grid>
          </Grid.Item>
        )
      })}
      {(data?.damage?.primary?.attribute === Attributes.DIE_PER_LEVEL ||
        data?.damage?.secondary?.attribute === Attributes.DIE_PER_LEVEL ||
        data?.damage?.bonus?.attribute === Attributes.DIE_PER_LEVEL) && (
        <Grid.Item>
          <Collapse>
            <Collapse.Header title={`Damage Die By Level`} />
            <Collapse.Body>
              <Grid>
                <Grid.Item>
                  <Grid>
                    <Grid.Item colSpan={'auto'}>Level</Grid.Item>
                    {formDamageTypes.map((type) => {
                      if (data?.damage?.[type]?.attribute === Attributes.DIE_PER_LEVEL) {
                        return <Grid.Item key={type} colSpan={'auto'}>{`${startCase(type)} Die Roll`}</Grid.Item>
                      }
                    })}
                    <Grid.Item colSpan={'auto'}>Remove Row</Grid.Item>
                    <Grid.Item colSpan={'auto'}>Add Row</Grid.Item>
                  </Grid>
                </Grid.Item>
                {data?.damage.diePerLevel?.map((setLevel, index) => (
                  <Grid.Item key={index}>
                    <Grid>
                      <Grid.Item colSpan={'auto'}>
                        <Input
                          name={`damage.diePerLevel.${index}.level`}
                          value={setLevel.level}
                          validation='num'
                          errorMsg='Please enter a whole number'
                          onChange={{ updateField }}
                          required={true}
                        />
                      </Grid.Item>
                      {formDamageTypes.map((type) => {
                        if (type !== 'versatile' && data?.damage?.[type]?.attribute === Attributes.DIE_PER_LEVEL) {
                          return (
                            <Grid.Item key={type} colSpan={'auto'}>
                              <Input
                                name={`damage.diePerLevel.${index}.${type}.dieConfig`}
                                value={setLevel?.[type]?.dieConfig}
                                validation='die'
                                errorMsg='Please enter a valid die value'
                                onChange={{ updateField }}
                                required={true}
                              />
                            </Grid.Item>
                          )
                        }
                      })}
                      <Grid.Item colSpan={'auto'}>
                        <Button
                          style='unstyled'
                          className={row_button}
                          onClick={() => removeField({ path: `damage.diePerLevel.${index}` })}
                        >
                          <TbX />
                        </Button>
                      </Grid.Item>
                      <Grid.Item colSpan={'auto'}>
                        <Button
                          style='unstyled'
                          className={row_button}
                          onClick={() => addField({ path: 'damage.diePerLevel' })}
                        >
                          <TbPlus />
                        </Button>
                      </Grid.Item>
                    </Grid>
                  </Grid.Item>
                ))}
              </Grid>
            </Collapse.Body>
          </Collapse>
        </Grid.Item>
      )}
      {(data?.damage?.primary?.attribute === Attributes.SET_PER_LEVEL ||
        data?.damage?.secondary?.attribute === Attributes.SET_PER_LEVEL ||
        data?.damage?.bonus?.attribute === Attributes.SET_PER_LEVEL) && (
        <Grid.Item>
          <Collapse>
            <Collapse.Header title={`Damage Die By Level`} />
            <Collapse.Body>
              <Grid>
                <Grid.Item>
                  <Grid>
                    <Grid.Item colSpan={'auto'}>Level</Grid.Item>
                    {formDamageTypes.map((type) => {
                      if (data?.damage?.[type]?.attribute === Attributes.SET_PER_LEVEL) {
                        return <Grid.Item colSpan={'auto'} key={type}>{`${startCase(type)} Die Roll`}</Grid.Item>
                      }
                    })}
                    <Grid.Item colSpan={'auto'}>Remove Row</Grid.Item>
                    <Grid.Item colSpan={'auto'}>Add Row</Grid.Item>
                  </Grid>
                </Grid.Item>
                {data?.damage.setPerLevel?.map((setLevel, index) => (
                  <Grid.Item key={index}>
                    <Grid>
                      <Grid.Item colSpan={'auto'}>
                        <Input
                          name={`damage.setPerLevel.${index}.level`}
                          value={setLevel.level}
                          validation='num'
                          errorMsg='Please enter a whole number'
                          onChange={{ updateField }}
                          required={true}
                        />
                      </Grid.Item>
                      {formDamageTypes.map((type) => {
                        if (type !== 'versatile' && data?.damage?.[type]?.attribute === Attributes.SET_PER_LEVEL) {
                          return (
                            <Grid.Item key={type} colSpan={'auto'}>
                              <Input
                                name={`damage.setPerLevel.${index}.${type}`}
                                value={setLevel?.[type]}
                                validation='num'
                                errorMsg='Please enter a whole number'
                                onChange={{ updateField }}
                                required={true}
                              />
                            </Grid.Item>
                          )
                        }
                      })}
                      <Grid.Item colSpan={'auto'}>
                        <Button
                          style='unstyled'
                          className={row_button}
                          onClick={() => removeField({ path: `damage.setPerLevel.${index}` })}
                        >
                          <TbX />
                        </Button>
                      </Grid.Item>
                      <Grid.Item colSpan={'auto'}>
                        <Button
                          style='unstyled'
                          className={row_button}
                          onClick={() => addField({ path: 'damage.setPerLevel' })}
                        >
                          <TbPlus />
                        </Button>
                      </Grid.Item>
                    </Grid>
                  </Grid.Item>
                ))}
              </Grid>
            </Collapse.Body>
          </Collapse>
        </Grid.Item>
      )}
    </>
  )
}

export default Damage
