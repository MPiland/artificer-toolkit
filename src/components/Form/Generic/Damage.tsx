import { useEffect, useMemo } from 'react'
import Row from '../../Row/Row'
import Dropdown from '../../Dropdown/Dropdown'
import Input from '../../Input/Input'
import Collapse from '../../Collapse/Collapse'
import { sprinkles } from '../../../css/sprinkles.css'
import { useGetSystemQuery } from '../../../features/systems/systemsApi'
import { Attributes, EquipmentCategories, EquipmentProperties } from '../../../types/enums'
import { DamageEnum, Equipment, Spell } from '../../../../amplify/API'
import { FeatureDataType, UpdateState } from '../../../types/form'

const Damage = ({
  formData,
  updateFormData,
}: {
  formData: Spell | Equipment | FeatureDataType
  updateFormData: (state: UpdateState<Spell | Equipment | FeatureDataType>) => void
}) => {
  const { data: system } = useGetSystemQuery()

  // Set Damage types for spells, weapons, items
  const damageTypes = useMemo(() => {
    let types: ('primary' | 'secondary' | 'bonus' | 'versatile')[] = ['primary'] // Create a copy of damageTypes array

    // Handle secondary
    if (formData?.damage?.attributes?.some((attribute) => attribute === Attributes.secondaryDamage)) {
      if (!types.includes('secondary')) {
        types.push('secondary')
      }
    } else if (types.includes('secondary')) {
      types = types.filter((type) => type !== 'secondary')
    }

    // Handle bonus damage
    if (formData?.damage?.attributes?.some((attribute) => attribute === Attributes.bonusDamage)) {
      if (!types.includes('bonus')) {
        types.push('bonus')
      }
    } else if (types.includes('bonus')) {
      types = types.filter((type) => type !== 'bonus')
    }

    if (
      formData.__typename === 'Equipment' &&
      formData?.properties?.some((property) => property === EquipmentProperties.versatile)
    ) {
      if (!types.includes('versatile')) {
        types.push('versatile')
      }
    } else if (types.includes('versatile')) {
      types = types.filter((type) => type !== 'versatile')
    }
    return types
  }, [formData])

  // Add/remove Die Per Level table
  useEffect(() => {
    const dicePerLevel =
      formData?.damage?.primary.attribute === Attributes.dicePerLevel ||
      formData?.damage?.secondary?.attribute === Attributes.dicePerLevel ||
      formData?.damage?.bonus?.attribute === Attributes.dicePerLevel

    if (dicePerLevel && !formData?.damage?.dicePerLevel) {
      updateFormData({
        type: 'add',
        path: `damage.dicePerLevel`,
      })
    }
    if (!dicePerLevel && formData?.damage?.dicePerLevel) {
      updateFormData({
        type: 'remove',
        path: `damage.dicePerLevel`,
      })
    }
  }, [updateFormData, formData?.damage])

  // Add/remove Set Per Level table
  useEffect(() => {
    const setPerLevel =
      formData?.damage?.primary?.attribute === Attributes.setPerLevel ||
      formData?.damage?.secondary?.attribute === Attributes.setPerLevel ||
      formData?.damage?.bonus?.attribute === Attributes.setPerLevel

    if (setPerLevel && !formData?.damage?.setPerLevel) {
      updateFormData({
        type: 'add',
        path: `damage.setPerLevel`,
      })
    }
    if (!setPerLevel && formData?.damage?.setPerLevel) {
      updateFormData({
        type: 'remove',
        path: `damage.setPerLevel`,
      })
    }
  }, [updateFormData, formData?.damage])

  // Remove Damage formData
  useEffect(() => {
    if (
      formData?.damage?.secondary &&
      !formData?.damage?.attributes?.some((attribute) => attribute === Attributes.secondaryDamage)
    ) {
      updateFormData({ type: 'remove', path: 'damage.secondary' })
    }
    if (
      formData?.damage?.bonus &&
      !formData?.damage?.attributes?.some((attribute) => attribute === Attributes.bonusDamage)
    ) {
      updateFormData({ type: 'remove', path: 'damage.bonus' })
    }
    if (
      (formData.__typename !== 'Equipment' && formData?.damage?.versatile) ||
      (formData.__typename === 'Equipment' &&
        formData.properties.some((property) => property !== EquipmentProperties.versatile))
    ) {
      updateFormData({ type: 'remove', path: 'damage.versatile' })
    }
  }, [updateFormData, formData])

  return (
    ((formData.__typename === 'Equipment' &&
      ((formData.category === EquipmentCategories.weapon &&
        !formData?.properties?.some((property: any) => property === EquipmentProperties.special)) ||
        formData?.properties?.some((property: any) => property === EquipmentProperties.improvisedWeapon))) ||
      formData?.attributes?.some((attribute: any) => attribute === Attributes.doesDamage)) && (
      <>
        <Row className={sprinkles({ mb: 'space-3' })}>
          <Dropdown<typeof formData>
            multiSelect={true}
            name={`damage.attributes`}
            label={`Damage Attributes`}
            value={formData?.damage?.attributes}
            options={system.attributes.filter((attribute) =>
              formData.__typename === 'Equipment'
                ? attribute?.damage.includes(DamageEnum.equipment)
                : attribute?.damage.includes(DamageEnum.all)
            )}
            onChange={updateFormData}
          />
        </Row>
        {damageTypes.map((type, index) => {
          return (
            <Row key={index}>
              {type !== 'versatile' && (
                <>
                  <Dropdown<typeof formData>
                    name={`damage.${type}.attribute`}
                    label={`${type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'} Dmg. Attribute`}
                    value={formData?.damage?.[type]?.attribute}
                    options={system.attributes.filter((attribute) =>
                      formData.__typename !== 'Spell'
                        ? formData.__typename === 'Equipment'
                          ? attribute?.damage.includes(DamageEnum.equipment)
                          : attribute?.damage.includes(DamageEnum.all)
                        : attribute.spells
                    )}
                    onChange={updateFormData}
                  />
                  <Dropdown<typeof formData>
                    name={`damage.${type}.id`}
                    label={`${type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'} Dmg. Type`}
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
                </>
              )}
              {formData?.damage?.[type]?.attribute !== Attributes.dicePerLevel &&
                formData?.damage?.[type]?.attribute !== Attributes.setPerLevel &&
                (formData?.damage?.[type]?.attribute === Attributes.setAmount ? (
                  <Input<typeof formData>
                    name={`damage.${type}.setAmount`}
                    value={formData?.damage?.[type]?.setAmount}
                    label={`Set ${type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'} Value`}
                    onChange={updateFormData}
                    required={true}
                    validation='num'
                    errorMsg={'Must contain only numbers'}
                  />
                ) : formData?.damage?.[type]?.attribute === Attributes.ability ||
                  formData?.damage?.[type]?.attribute === Attributes.spellcastingAbility ||
                  formData?.damage?.[type]?.attribute === Attributes.proficiency ? (
                  <>
                    {formData?.damage?.[type]?.attribute === Attributes.ability && (
                      <Dropdown<typeof formData>
                        name={`damage.${type}.ability`}
                        label={`${type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'} Ability`}
                        value={formData?.damage?.[type]?.ability}
                        options={system.abilities}
                        required={true}
                        onChange={updateFormData}
                      />
                    )}
                    <Input<typeof formData>
                      name={`damage.${type}.minAmount`}
                      value={formData?.damage?.[type]?.minAmount}
                      label={`${type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'} Min. Value`}
                      onChange={updateFormData}
                      validation='num'
                      errorMsg={'Must contain only numbers'}
                    />
                    <Input<typeof formData>
                      name={`damage.${type}.maxAmount`}
                      value={formData?.damage?.[type]?.maxAmount}
                      label={`${type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'} Max Value`}
                      onChange={updateFormData}
                      validation='num'
                      errorMsg={'Must contain only numbers'}
                    />
                    <Input<typeof formData>
                      name={`damage.${type}.multiplier`}
                      value={formData?.damage?.[type]?.multiplier}
                      label={`${type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'} Dmg. Multiplier`}
                      onChange={updateFormData}
                      validation='num'
                      errorMsg={'Must contain only numbers'}
                    />
                  </>
                ) : formData?.damage?.[type]?.attribute === Attributes.damagePool ? (
                  <>
                    <Dropdown<typeof formData>
                      name={`damage.${type}.pool.attribute`}
                      label={`${
                        type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'
                      } Dmg. Pool Attribute`}
                      value={formData?.damage?.[type]?.pool?.attribute}
                      options={system.attributes.filter((attribute) => attribute?.damage.includes(DamageEnum.pool))}
                      required={true}
                      onChange={updateFormData}
                    />
                    {formData?.damage?.[type]?.pool?.attribute === Attributes.level ||
                    formData?.damage?.[type]?.pool?.attribute === Attributes.ability ||
                    formData?.damage?.[type]?.pool.attribute === Attributes.spellcastingAbility ||
                    formData?.damage?.[type]?.pool.attribute === Attributes.proficiency ? (
                      <>
                        {(formData?.damage?.[type]?.pool?.attribute === Attributes.ability ||
                          formData?.damage?.[type]?.pool.attribute === Attributes.spellcastingAbility) && (
                          <>
                            {formData?.damage?.[type]?.pool?.attribute === Attributes.ability && (
                              <Dropdown<typeof formData>
                                name={`damage.${type}.pool.ability`}
                                label='Pool Abilty'
                                value={formData?.damage?.[type]?.pool?.ability}
                                options={system.abilities}
                                required={true}
                                onChange={updateFormData}
                              />
                            )}
                            <Input<typeof formData>
                              name={`damage.${type}.pool.minAmount`}
                              value={formData?.damage?.[type]?.pool?.minAmount}
                              label={`${
                                type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'
                              } Dmg. Min. Value`}
                              onChange={updateFormData}
                              validation='num'
                              errorMsg={'Must contain only numbers'}
                            />
                          </>
                        )}
                        <Input<typeof formData>
                          name={`damage.${type}.pool.maxAmount`}
                          value={formData?.damage?.[type].pool?.maxAmount}
                          label={`${
                            type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'
                          } Dmg. Max Value`}
                          onChange={updateFormData}
                          validation='num'
                          errorMsg={'Must contain only numbers'}
                        />
                        <Input<typeof formData>
                          name={`damage.${type}.pool.multiplier`}
                          value={formData?.damage?.[type]?.pool?.multiplier}
                          label={`${
                            type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'
                          } Dmg. Multiplier`}
                          onChange={updateFormData}
                          validation='num'
                          errorMsg={'Must contain only numbers'}
                        />
                      </>
                    ) : (
                      formData?.damage?.[type]?.pool?.attribute === Attributes.setAmount && (
                        <Input<typeof formData>
                          name={`damage.${type}.pool.setAmount`}
                          value={formData?.damage?.[type]?.pool?.setAmount}
                          label='Pool Total'
                          onChange={updateFormData}
                          validation='num'
                          required={true}
                          errorMsg={'Must contain only numbers'}
                        />
                      )
                    )}
                  </>
                ) : (
                  <>
                    <Input<typeof formData>
                      name={`damage.${type}.dieCount`}
                      value={formData?.damage?.[type]?.dieCount}
                      label={`${type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'} Dice Count`}
                      onChange={updateFormData}
                      required={type === 'primary' ? true : false}
                      validation='num'
                      errorMsg={'Must contain only numbers'}
                    />
                    <Input<typeof formData>
                      name={`damage.${type}.dieValue`}
                      label={`${type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'} Dice Value`}
                      value={formData?.damage?.[type]?.dieValue}
                      validation='die'
                      required={type === 'primary' ? true : false}
                      onChange={updateFormData}
                    />
                  </>
                ))}
            </Row>
          )
        })}
        {(formData?.damage?.primary?.attribute === Attributes.dicePerLevel ||
          formData?.damage?.secondary?.attribute === Attributes.dicePerLevel ||
          formData?.damage?.bonus?.attribute === Attributes.dicePerLevel) && (
          <Collapse>
            <Collapse.Header title={`Damage Die By Level`} />
            <Collapse.Body>
              <Row spacing='spaceBetween' cellSize='auto'>
                <span>Level</span>
                <span>Die Count</span>
                <span>Die Value</span>
              </Row>
              {formData?.damage.dicePerLevel?.map((setLevel, index) => (
                <Row key={index} spacing='spaceBetween' cellSize='auto'>
                  <Input
                    name={`damage.dicePerLevel.${index}.level`}
                    value={setLevel.level}
                    validation='num'
                    errorMsg='Please enter a whole number'
                    onChange={updateFormData}
                    required={true}
                  />
                  <Input
                    name={`damage.dicePerLevel.${index}.dieCount`}
                    value={setLevel.dieCount}
                    validation='num'
                    errorMsg='Please enter a whole number'
                    onChange={updateFormData}
                    required={true}
                  />
                  <Input
                    name={`damage.dicePerLevel.${index}.dieValue`}
                    value={setLevel.dieValue}
                    validation='num'
                    errorMsg='Please enter a valid die value'
                    onChange={updateFormData}
                    required={true}
                  />
                </Row>
              ))}
            </Collapse.Body>
          </Collapse>
        )}
        {(formData?.damage?.primary?.attribute === Attributes.setPerLevel ||
          formData?.damage?.secondary?.attribute === Attributes.setPerLevel ||
          formData?.damage?.bonus?.attribute === Attributes.setPerLevel) && (
          <Collapse>
            <Collapse.Header title={`Set By Level`} />
            <Collapse.Body>
              <Row spacing='spaceBetween' cellSize='auto'>
                <span>Level</span>
                <span>Amount</span>
              </Row>
              {formData?.damage?.setPerLevel?.map((setLevel, index) => (
                <Row key={index} spacing='spaceBetween' cellSize='auto'>
                  <Input
                    name={`damage.setPerLevel.${index}.level`}
                    value={setLevel.level}
                    validation='num'
                    errorMsg='Please enter a whole number'
                    onChange={updateFormData}
                    required={true}
                  />
                  <Input
                    name={`damage.setPerLevel.${index}.amount`}
                    value={setLevel.amount}
                    validation='num'
                    errorMsg='Please enter a whole number'
                    onChange={updateFormData}
                    required={true}
                  />
                </Row>
              ))}
            </Collapse.Body>
          </Collapse>
        )}
      </>
    )
  )
}

export default Damage
