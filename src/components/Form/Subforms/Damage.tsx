import { useEffect, useMemo } from 'react'
import Dropdown from '../../Dropdown/Dropdown'
import Input from '../../Input/Input'
import Collapse from '../../Collapse/Collapse'
import { useGetSystemQuery } from '../../../apis/systemsApi'
import { Attributes } from '../../../types/enums'
import { DamageEnum, Equipment, Spell, SpellEnum } from '../../../../amplify/gql/types'
import { FeatureDataType, UpdateState } from '../../../types/form'
import Button from '../../Button/Button'
import { row_button } from '../Form.css'
import { TbPlus, TbX } from 'react-icons/tb'
import { useEnumChecks } from '../../../hooks/useEnumChecks'
import { startCase } from 'lodash'
import Grid from '../../Grid/Grid'

const Damage = ({
  formData,
  updateFormData,
}: {
  formData: Spell | Equipment | FeatureDataType
  updateFormData: (state: UpdateState<Spell | Equipment | FeatureDataType>) => void
}) => {
  const { data: system } = useGetSystemQuery()
  const { doesDamage } = useEnumChecks({ data: formData })
  const { secondaryDamage, bonusDamage, isVersatile } = useEnumChecks({
    data: formData?.damage ? formData?.damage : undefined,
  })

  // Set Damage types for spells, weapons, items
  const damageTypes = useMemo(() => {
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

    if (formData.__typename === 'Equipment' && isVersatile) {
      if (!types.includes('versatile')) {
        types.push('versatile')
      }
    } else if (types.includes('versatile')) {
      types = types.filter((type) => type !== 'versatile')
    }
    return types
  }, [formData, bonusDamage, secondaryDamage, isVersatile])

  // Add primary damage if doesn't exist
  useEffect(() => {
    if (doesDamage && !formData?.damage?.primary) {
      updateFormData({
        type: 'update',
        path: 'damage.primary',
        value: {},
      })
    }
  }, [doesDamage, formData?.damage?.primary, updateFormData])

  // Add/remove Die Per Level table
  useEffect(() => {
    const diePerLevel = {
      primary: formData?.damage?.primary?.attribute === Attributes.diePerLevel,
      secondary: formData?.damage?.secondary?.attribute === Attributes.diePerLevel,
      bonus: formData?.damage?.bonus?.attribute === Attributes.diePerLevel,
    }
    // Potential damage properties
    const keys = ['primary', 'secondary', 'bonus'] as const
    type DamageKey = (typeof keys)[number]
    keys.forEach((key: DamageKey) => {
      if (
        diePerLevel[key] &&
        !formData?.damage?.diePerLevel?.some((level) => level?.[key] != null) &&
        formData?.damage?.[key]
      ) {
        updateFormData({
          type: 'add',
          path: `damage.diePerLevel.0.${key}`,
        })
      }
      if (!diePerLevel[key] && formData?.damage?.diePerLevel?.find((level) => level?.[key]) != null) {
        console.log({ key: diePerLevel })
        const diePerLevelArray = formData?.damage?.diePerLevel?.map((level) => {
          const levelObject = { ...level }
          delete levelObject[key]
          return levelObject
        })
        updateFormData({
          type: 'update',
          path: `damage.diePerLevel`,
          value: diePerLevelArray,
        })
      }
    })
  }, [updateFormData, formData?.damage])

  // Add/remove Set Per Level table
  useEffect(() => {
    const setPerLevel = {
      primary: formData?.damage?.primary?.attribute === Attributes.setPerLevel,
      secondary: formData?.damage?.secondary?.attribute === Attributes.setPerLevel,
      bonus: formData?.damage?.bonus?.attribute === Attributes.setPerLevel,
    }
    // Potential damage properties
    const keys = ['primary', 'secondary', 'bonus'] as const
    type DamageKey = (typeof keys)[number]
    keys.forEach((key: DamageKey) => {
      if (
        setPerLevel[key] &&
        !formData?.damage?.setPerLevel?.some((level) => level?.[key] != null) &&
        formData?.damage?.[key]
      ) {
        updateFormData({
          type: 'add',
          path: `damage.setPerLevel.0.${key}`,
        })
      }
      if (!setPerLevel[key] && formData?.damage?.setPerLevel?.find((level) => level?.[key]) != null) {
        const setPerLevelArray = formData?.damage?.setPerLevel?.map((level) => {
          const levelObject = { ...level }
          delete levelObject[key]
          return levelObject
        })
        updateFormData({
          type: 'update',
          path: `damage.setPerLevel`,
          value: setPerLevelArray,
        })
      }
    })
  }, [updateFormData, formData?.damage])

  // Remove Damage formData
  useEffect(() => {
    if (formData?.damage?.secondary && !secondaryDamage) {
      console.log({ secondaryDamage })
      updateFormData({ type: 'remove', path: 'damage.secondary' })
    }
    if (formData?.damage?.bonus && !bonusDamage) {
      updateFormData({ type: 'remove', path: 'damage.bonus' })
    }
    if (
      (formData.__typename !== 'Equipment' && formData?.damage?.versatile) ||
      (formData.__typename === 'Equipment' && !isVersatile)
    ) {
      updateFormData({ type: 'update', path: 'damage.versatile', value: null })
    }
  }, [updateFormData, formData, bonusDamage, secondaryDamage, isVersatile])

  return (
    <>
      <Grid.Item colSpan={2}>
        <Dropdown
          multiSelect={true}
          name={`damage.attributes`}
          label={`Damage Attributes`}
          value={formData?.damage?.attributes}
          options={system.attributes.filter((attribute) =>
            formData.__typename !== 'Spell' ?
              attribute?.damage?.length && formData.__typename === 'Equipment' ?
                attribute?.damage?.includes(DamageEnum.equipment)
              : attribute?.damage?.includes(DamageEnum.all)
            : attribute?.spells?.length && attribute.spells.includes(SpellEnum.damage)
          )}
          onChange={updateFormData}
        />
      </Grid.Item>
      {damageTypes.map((type, index) => {
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
                      value={formData?.damage?.[type]?.attribute}
                      options={system.attributes.filter((attribute) =>
                        attribute?.damage?.length && formData.__typename === 'Equipment' ?
                          attribute?.damage?.includes(DamageEnum.equipment)
                        : attribute?.damage?.includes(DamageEnum.main)
                      )}
                      onChange={updateFormData}
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
                      value={formData?.damage?.[type]?.id}
                      options={[
                        ...system.damageTypes,
                        {
                          id: 'matchWeapon',
                          value: 'matchWeapon',
                          label: 'Match Weapon',
                        },
                      ]}
                      required={true}
                      onChange={updateFormData}
                    />
                  </Grid.Item>
                </>
              )}
              {formData?.damage?.[type]?.attribute !== Attributes.diePerLevel &&
                formData?.damage?.[type]?.attribute !== Attributes.setPerLevel &&
                (formData?.damage?.[type]?.attribute === Attributes.setAmount ?
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                    <Input
                      name={`damage.${type}.setAmount`}
                      value={formData?.damage?.[type]?.setAmount}
                      label={`Set ${
                        type === 'primary' ? 'Main'
                        : type === 'secondary' ? 'Sec.'
                        : 'Bonus'
                      } Value`}
                      onChange={updateFormData}
                      required={true}
                      validation='num'
                      errorMsg={'Must contain only numbers'}
                    />
                  </Grid.Item>
                : (
                  formData?.damage?.[type]?.attribute === Attributes.ability ||
                  formData?.damage?.[type]?.attribute === Attributes.spellcastingAbility ||
                  formData?.damage?.[type]?.attribute === Attributes.proficiency
                ) ?
                  <>
                    {formData?.damage?.[type]?.attribute === Attributes.ability && (
                      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                        <Dropdown
                          name={`damage.${type}.ability`}
                          label={`${
                            type === 'primary' ? 'Main'
                            : type === 'secondary' ? 'Sec.'
                            : 'Bonus'
                          } Ability`}
                          value={formData?.damage?.[type]?.ability}
                          options={system.abilities}
                          required={true}
                          onChange={updateFormData}
                        />
                      </Grid.Item>
                    )}
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Input
                        name={`damage.${type}.minAmount`}
                        value={formData?.damage?.[type]?.minAmount}
                        label={`${
                          type === 'primary' ? 'Main'
                          : type === 'secondary' ? 'Sec.'
                          : 'Bonus'
                        } Min. Value`}
                        onChange={updateFormData}
                        validation='num'
                        errorMsg={'Must contain only numbers'}
                      />
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Input
                        name={`damage.${type}.maxAmount`}
                        value={formData?.damage?.[type]?.maxAmount}
                        label={`${
                          type === 'primary' ? 'Main'
                          : type === 'secondary' ? 'Sec.'
                          : 'Bonus'
                        } Max Value`}
                        onChange={updateFormData}
                        validation='num'
                        errorMsg={'Must contain only numbers'}
                      />
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Input
                        name={`damage.${type}.multiplier`}
                        value={formData?.damage?.[type]?.multiplier}
                        label={`${
                          type === 'primary' ? 'Main'
                          : type === 'secondary' ? 'Sec.'
                          : 'Bonus'
                        } Dmg. Multiplier`}
                        onChange={updateFormData}
                        validation='num'
                        errorMsg={'Must contain only numbers'}
                      />
                    </Grid.Item>
                  </>
                : formData?.damage?.[type]?.attribute === Attributes.damagePool ?
                  <>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        name={`damage.${type}.pool.attribute`}
                        label={`${
                          type === 'primary' ? 'Main'
                          : type === 'secondary' ? 'Sec.'
                          : 'Bonus'
                        } Dmg. Pool Attribute`}
                        value={formData?.damage?.[type]?.pool?.attribute}
                        options={system.attributes.filter(
                          (attribute) => attribute?.damage?.length && attribute?.damage.includes(DamageEnum.pool)
                        )}
                        required={true}
                        onChange={updateFormData}
                      />
                    </Grid.Item>
                    {(
                      formData?.damage?.[type]?.pool?.attribute === Attributes.level ||
                      formData?.damage?.[type]?.pool?.attribute === Attributes.ability ||
                      formData?.damage?.[type]?.pool?.attribute === Attributes.spellcastingAbility ||
                      formData?.damage?.[type]?.pool?.attribute === Attributes.proficiency
                    ) ?
                      <>
                        {(formData?.damage?.[type]?.pool?.attribute === Attributes.ability ||
                          formData?.damage?.[type]?.pool.attribute === Attributes.spellcastingAbility) && (
                          <>
                            {formData?.damage?.[type]?.pool?.attribute === Attributes.ability && (
                              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                                <Dropdown
                                  name={`damage.${type}.pool.ability`}
                                  label='Pool Abilty'
                                  value={formData?.damage?.[type]?.pool?.ability}
                                  options={system.abilities}
                                  required={true}
                                  onChange={updateFormData}
                                />
                              </Grid.Item>
                            )}
                            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                              <Input
                                name={`damage.${type}.pool.minAmount`}
                                value={formData?.damage?.[type]?.pool?.minAmount}
                                label={`${
                                  type === 'primary' ? 'Main'
                                  : type === 'secondary' ? 'Sec.'
                                  : 'Bonus'
                                } Dmg. Min. Value`}
                                onChange={updateFormData}
                                validation='num'
                                errorMsg={'Must contain only numbers'}
                              />
                            </Grid.Item>
                          </>
                        )}
                        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                          <Input
                            name={`damage.${type}.pool.maxAmount`}
                            value={formData?.damage?.[type].pool?.maxAmount}
                            label={`${
                              type === 'primary' ? 'Main'
                              : type === 'secondary' ? 'Sec.'
                              : 'Bonus'
                            } Dmg. Max Value`}
                            onChange={updateFormData}
                            validation='num'
                            errorMsg={'Must contain only numbers'}
                          />
                        </Grid.Item>
                        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                          <Input
                            name={`damage.${type}.pool.multiplier`}
                            value={formData?.damage?.[type]?.pool?.multiplier}
                            label={`${
                              type === 'primary' ? 'Main'
                              : type === 'secondary' ? 'Sec.'
                              : 'Bonus'
                            } Dmg. Multiplier`}
                            onChange={updateFormData}
                            validation='num'
                            errorMsg={'Must contain only numbers'}
                          />
                        </Grid.Item>
                      </>
                    : formData?.damage?.[type]?.pool?.attribute === Attributes.setAmount && (
                        <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                          <Input
                            name={`damage.${type}.pool.setAmount`}
                            value={formData?.damage?.[type]?.pool?.setAmount}
                            label='Pool Total'
                            onChange={updateFormData}
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
                        value={formData?.damage?.[type]?.dieConfig}
                        label={`${
                          type === 'primary' ? 'Main'
                          : type === 'secondary' ? 'Sec.'
                          : 'Bonus'
                        } Dice Config`}
                        onChange={updateFormData}
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
      {(formData?.damage?.primary?.attribute === Attributes.diePerLevel ||
        formData?.damage?.secondary?.attribute === Attributes.diePerLevel ||
        formData?.damage?.bonus?.attribute === Attributes.diePerLevel) && (
        <Grid.Item>
          <Collapse>
            <Collapse.Header title={`Damage Die By Level`} />
            <Collapse.Body>
              <Grid>
                <Grid.Item>
                  <Grid>
                    <Grid.Item colSpan={'auto'}>Level</Grid.Item>
                    {damageTypes.map((type) => {
                      if (formData?.damage?.[type]?.attribute === Attributes.diePerLevel) {
                        return <Grid.Item key={type} colSpan={'auto'}>{`${startCase(type)} Die Roll`}</Grid.Item>
                      }
                    })}
                    <Grid.Item colSpan={'auto'}>Remove Row</Grid.Item>
                    <Grid.Item colSpan={'auto'}>Add Row</Grid.Item>
                  </Grid>
                </Grid.Item>
                {formData?.damage.diePerLevel?.map((setLevel, index) => (
                  <Grid.Item key={index}>
                    <Grid>
                      <Grid.Item colSpan={'auto'}>
                        <Input
                          name={`damage.diePerLevel.${index}.level`}
                          value={setLevel.level}
                          validation='num'
                          errorMsg='Please enter a whole number'
                          onChange={updateFormData}
                          required={true}
                        />
                      </Grid.Item>
                      {damageTypes.map((type) => {
                        if (type !== 'versatile' && formData?.damage?.[type]?.attribute === Attributes.diePerLevel) {
                          return (
                            <Grid.Item key={type} colSpan={'auto'}>
                              <Input
                                name={`damage.diePerLevel.${index}.${type}.dieConfig`}
                                value={setLevel?.[type]?.dieConfig}
                                validation='die'
                                errorMsg='Please enter a valid die value'
                                onChange={updateFormData}
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
                          onClick={() =>
                            updateFormData({
                              type: 'remove',
                              path: `damage.diePerLevel.${index}`,
                            })
                          }
                        >
                          <TbX />
                        </Button>
                      </Grid.Item>
                      <Grid.Item colSpan={'auto'}>
                        <Button
                          style='unstyled'
                          className={row_button}
                          onClick={() =>
                            updateFormData({
                              type: 'add',
                              path: 'damage.diePerLevel',
                            })
                          }
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
      {(formData?.damage?.primary?.attribute === Attributes.setPerLevel ||
        formData?.damage?.secondary?.attribute === Attributes.setPerLevel ||
        formData?.damage?.bonus?.attribute === Attributes.setPerLevel) && (
        <Grid.Item>
          <Collapse>
            <Collapse.Header title={`Damage Die By Level`} />
            <Collapse.Body>
              <Grid>
                <Grid.Item>
                  <Grid>
                    <Grid.Item colSpan={'auto'}>Level</Grid.Item>
                    {damageTypes.map((type) => {
                      if (formData?.damage?.[type]?.attribute === Attributes.setPerLevel) {
                        return <Grid.Item colSpan={'auto'} key={type}>{`${startCase(type)} Die Roll`}</Grid.Item>
                      }
                    })}
                    <Grid.Item colSpan={'auto'}>Remove Row</Grid.Item>
                    <Grid.Item colSpan={'auto'}>Add Row</Grid.Item>
                  </Grid>
                </Grid.Item>
                {formData?.damage.setPerLevel?.map((setLevel, index) => (
                  <Grid.Item key={index}>
                    <Grid>
                      <Grid.Item colSpan={'auto'}>
                        <Input
                          name={`damage.setPerLevel.${index}.level`}
                          value={setLevel.level}
                          validation='num'
                          errorMsg='Please enter a whole number'
                          onChange={updateFormData}
                          required={true}
                        />
                      </Grid.Item>
                      {damageTypes.map((type) => {
                        if (type !== 'versatile' && formData?.damage?.[type]?.attribute === Attributes.setPerLevel) {
                          return (
                            <Grid.Item key={type} colSpan={'auto'}>
                              <Input
                                name={`damage.setPerLevel.${index}.${type}`}
                                value={setLevel?.[type]}
                                validation='num'
                                errorMsg='Please enter a whole number'
                                onChange={updateFormData}
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
                          onClick={() =>
                            updateFormData({
                              type: 'remove',
                              path: `damage.setPerLevel.${index}`,
                            })
                          }
                        >
                          <TbX />
                        </Button>
                      </Grid.Item>
                      <Grid.Item colSpan={'auto'}>
                        <Button
                          style='unstyled'
                          className={row_button}
                          onClick={() =>
                            updateFormData({
                              type: 'add',
                              path: 'damage.setPerLevel',
                            })
                          }
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
