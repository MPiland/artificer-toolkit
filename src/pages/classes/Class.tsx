import parse from 'html-react-parser'
import { Fragment } from 'react'
import Detail from '~/components/Detail'
import { sprinkles } from '~/css/sprinkles.css'
import type { Feature, FeatureOption } from '~/types'
import { Attributes, Categories, Prerequisites } from '~/enums'
import { Route } from '~/routes/_protected/classes/$classId'
import {
  queryClient,
  useGetClass,
  useListClasses,
  fetchClass,
  useListFeatures,
  useListSpells,
  useListFeatureOptions,
} from '~/apis'
import { useSystemData } from '~/hooks'
import { useSuspenseQueries } from '@tanstack/react-query'

const Class = () => {
  const classId = Route.useParams({ select: (r) => r.classId })

  const {
    data: { classes, metaData },
  } = useListClasses()

  const {
    data: { features },
  } = useListFeatures()

  const {
    data: { spells },
  } = useListSpells()

  const {
    data: { featureOptions },
  } = useListFeatureOptions()

  const { data: uClass } = useGetClass(classId)

  const {
    system: { abilities, skills },
  } = useSystemData()

  const subclassIds = classes
    .filter((c) =>
      metaData.categories?.some(
        (cat) =>
          cat.id === Categories.SUBCLASS &&
          cat.classIds?.includes(c.id) &&
          metaData.parentClasses?.some((pc) => pc.id === uClass?.id && pc.classIds?.includes(c.id))
      )
    )
    .map((c) => c.id)

  const { data: subclasses } = useSuspenseQueries({
    queries: subclassIds.map((id) => ({
      queryKey: ['class', id],
      queryFn: () => queryClient.fetchQuery(fetchClass(id)),
    })),
    combine: (result) => ({
      data: result.map((r) => r.data),
    }),
  })

  const handlePreReq = (parentItem: Feature, childItem: FeatureOption) => {
    const parentLevel = parentItem?.levelAvailable?.split(', ')
    const childLevel = childItem.levelAvailable
    const childReq = childItem.attributes?.some((attribute) => attribute === Attributes.PREREQUISITES)
    const childReqsText: string[] = []

    if (childLevel !== parentLevel?.[0]) {
      childReqsText.push(`Class level ${childLevel}`)
    }

    if (childReq) {
      const childReqOption = childItem.prerequisites
      if (childReqOption && childReqOption.options?.length) {
        if (childReqOption.skillProficiencies && childReqOption.skillProficiencies?.length > 0) {
          childReqsText.push(
            `Skill(s) Proficiency: ${childReqOption.skillProficiencies?.map((s, i) => {
              const skill = skills.find((skill) => skill.id === s)
              if (skill) {
                if (
                  childReqOption.skillProficiencies?.length &&
                  childReqOption.skillProficiencies?.length > 1 &&
                  i !== childReqOption.skillProficiencies?.length - 1
                ) {
                  return `${skill.label}, `
                } else {
                  return `${skill.label}`
                }
              }
            })}`
          )
        }
        if (childReqOption.abilityScore && childReqOption.abilityScore?.abilities?.length) {
          childReqsText.push(
            `Ability Score: ${childReqOption.abilityScore?.abilities.map((a, i) => {
              const ability = abilities.find((ability) => ability.id === a)
              if (ability) {
                if (
                  childReqOption.abilityScore?.abilities &&
                  childReqOption.abilityScore?.abilities?.length > 1 &&
                  i !== childReqOption.abilityScore?.abilities?.length - 1
                ) {
                  return `(${childReqOption.abilityScore?.score}) ${ability.label}, `
                } else {
                  return `(${childReqOption.abilityScore?.score}) ${ability.label}`
                }
              }
            })}`
          )
        }
        if (childReqOption.spellsObtained && childReqOption.spellsObtained?.length > 0) {
          childReqsText.push(
            `Spell(s) Known: ${childReqOption.spellsObtained?.map((s, i) => {
              const spell = spells.find((spell) => spell.id === s)
              if (spell) {
                if (
                  childReqOption.spellsObtained?.length &&
                  childReqOption.spellsObtained?.length > 1 &&
                  i !== childReqOption.spellsObtained?.length - 1
                ) {
                  return `${spell.label}, `
                } else {
                  return `${spell.label}`
                }
              }
            })}`
          )
        }
        if (childReqOption.featuresObtained && childReqOption.featuresObtained?.length > 0) {
          let featureText = ''
          childReqOption.featuresObtained?.map((f, i) => {
            const feature = features.find((fData) => fData.id === f)
            if (feature) {
              featureText += `${feature.label}`
              const featureLength = childReqOption.featuresObtained?.length
              if (childReqOption.optionsObtained?.length && childReqOption.optionsObtained?.length > 0) {
                childReqOption.optionsObtained?.map((o, oI) => {
                  const optionLength = childReqOption.optionsObtained?.length
                  const option = featureOptions.find((oData) => oData.id === o)
                  if (option) {
                    if (featureLength && optionLength && featureLength > 1 && oI !== optionLength - 1) {
                      featureText += `: ${option.label}, `
                    } else {
                      featureText += `: ${option.label}`
                    }
                  }
                })
              } else {
                if (featureLength && featureLength > 1 && i !== featureLength - 1) {
                  featureText += '; '
                }
              }
            }
          })
          childReqsText.push(featureText)
        }
      }
    }
    if (childReqsText?.length > 0) {
      let reqText = 'Prerequisite(s) - '
      childReqsText.map((reqItem, reqIndex) => {
        if (childReqsText.length > 1 && reqIndex !== childReqsText.length - 1) {
          reqText += `${reqItem} / `
        } else {
          reqText += `${reqItem}`
        }
      })
      return reqText
    } else {
      return null
    }
  }

  let resourceShown = false

  return (
    <Detail footerSpacing='flex-end' item={uClass!}>
      <div id='quote'>
        <em>{uClass?.desc && parse(uClass?.desc)}</em>
      </div>
      {uClass?.category === Categories.BASE ?
        <>
          {uClass?.details &&
            uClass?.details?.length &&
            uClass?.details.map((detail, index) => (
              <Fragment key={index}>
                <h1>{detail?.label}</h1>
                <hr
                  className={sprinkles({
                    width: 'size-full',
                  })}
                />
                {detail?.desc && parse(detail.desc)}
                {uClass?.details?.length &&
                  index === uClass?.details?.length - 1 &&
                  uClass?.features?.length &&
                  uClass?.features.map((feature, fI) => {
                    const featureLevelArray = feature?.levelAvailable?.split(', ')
                    if (featureLevelArray) {
                      const featureLevel = featureLevelArray[0]
                      return (
                        <Fragment key={`${fI}-feature`}>
                          {uClass?.resource &&
                            uClass?.resource?.levelAvailable &&
                            Number(featureLevel) >= uClass?.resource?.levelAvailable &&
                            !resourceShown && (
                              <Fragment>
                                <h2>{uClass?.resource?.label}</h2>
                                {uClass?.resource?.desc && parse(uClass?.resource?.desc)}
                                {(resourceShown = true)}
                              </Fragment>
                            )}
                          <h2>
                            <u>{feature?.label}</u>
                          </h2>
                          {feature?.desc && parse(feature.desc)}
                          {feature?.options?.length &&
                            feature.options.map((option, oI) => {
                              return (
                                <Fragment key={`${oI}-feature-option`}>
                                  <h3>{option?.label}</h3>
                                  {feature.attributes?.some((attribute) => attribute === Attributes.PREREQUISITES) &&
                                    feature?.prerequisites?.options?.some(
                                      (reqId) =>
                                        reqId === Prerequisites.ABILITY_SCORE ||
                                        reqId === Prerequisites.SKILL_PROFICIENCY ||
                                        reqId === Prerequisites.SPELLS_OBTAINED ||
                                        reqId === Prerequisites.FEATURES_OBTAINED
                                    ) &&
                                    option && (
                                      <p>
                                        <em className={sprinkles({ mb: 'space-3' })}>
                                          <u>{handlePreReq(feature, option)}</u>
                                        </em>
                                      </p>
                                    )}
                                  {option?.desc && parse(option.desc)}
                                </Fragment>
                              )
                            })}
                        </Fragment>
                      )
                    }
                  })}
              </Fragment>
            ))}
          {uClass?.features
            ?.filter((feature) => {
              return feature?.category === Categories.SUBCLASS
            })
            .map((feature, fi) => {
              const detail = feature?.detail
              return (
                <div key={`${fi}-sub-feature`} id={`${feature?.label}`}>
                  <h1>{feature?.label}</h1>
                  <hr
                    className={sprinkles({
                      width: 'size-full',
                    })}
                  />
                  {detail && parse(detail)}
                </div>
              )
            })}
          {subclasses?.length && (
            <>
              {subclasses.map((subclass, index) => {
                let subclassResourceShown = false
                if (subclass) {
                  return (
                    <Fragment key={index}>
                      <h2>{subclass.label}</h2>

                      <hr
                        className={sprinkles({
                          width: 'size-full',
                        })}
                      />
                      {subclass.desc && parse(subclass.desc)}
                      {subclass?.features?.length &&
                        subclass.features.map((feature, fI) => {
                          const featureLevelArray = feature?.levelAvailable?.split(', ')
                          const featureLevel = featureLevelArray?.[0]
                          return (
                            <Fragment key={`${fI}-subclass-feature`}>
                              {subclass.resource &&
                                subclass?.resource?.levelAvailable &&
                                Number(featureLevel) >= subclass?.resource?.levelAvailable &&
                                !subclassResourceShown && (
                                  <Fragment>
                                    <h2>{subclass.resource?.label}</h2>
                                    {subclass.resource?.desc && parse(subclass.resource?.desc)}
                                    {(subclassResourceShown = true)}
                                  </Fragment>
                                )}
                              <h2>
                                <u>{feature?.label}</u>
                              </h2>
                              {feature?.desc && parse(feature.desc)}
                              {feature?.options?.length &&
                                feature?.options.map((option, oI) => {
                                  return (
                                    <Fragment key={`${oI}-subclass-feature-option}`}>
                                      <h3>{option?.label}</h3>
                                      {feature.attributes?.some(
                                        (attribute) => attribute === Attributes.PREREQUISITES
                                      ) &&
                                        feature?.prerequisites?.options?.some(
                                          (reqId) =>
                                            reqId === Prerequisites.ABILITY_SCORE ||
                                            reqId === Prerequisites.SKILL_PROFICIENCY ||
                                            reqId === Prerequisites.SPELLS_OBTAINED ||
                                            reqId === Prerequisites.FEATURES_OBTAINED
                                        ) &&
                                        option && (
                                          <p>
                                            <em className={sprinkles({ mb: 'space-3' })}>
                                              <u>{handlePreReq(feature, option)}</u>
                                            </em>
                                          </p>
                                        )}
                                      {option?.desc && parse(option.desc)}
                                    </Fragment>
                                  )
                                })}
                            </Fragment>
                          )
                        })}
                      {index !== subclasses.length - 1 && (
                        <hr
                          className={sprinkles({
                            width: 'size-full',
                          })}
                        />
                      )}
                    </Fragment>
                  )
                }
              })}
            </>
          )}
        </>
      : <>
          {uClass?.features?.length &&
            uClass?.features.map((feature, fI) => {
              const featureLevelArray = feature?.levelAvailable?.split(', ')
              if (featureLevelArray) {
                const featureLevel = featureLevelArray[0] || 0
                return (
                  <Fragment key={`${fI}-subclass-feature`}>
                    {uClass?.resource?.levelAvailable &&
                      uClass?.resource &&
                      Number(featureLevel) >= uClass?.resource?.levelAvailable &&
                      !resourceShown && (
                        <Fragment>
                          <h2>{uClass?.resource?.label}</h2>
                          {uClass?.resource?.desc && parse(uClass?.resource?.desc)}
                          {(resourceShown = true)}
                        </Fragment>
                      )}
                    <h2>{feature?.label}</h2>
                    {feature?.desc && parse(feature.desc)}
                    {feature?.options?.length &&
                      feature.options.map((option, oI) => {
                        return (
                          <Fragment key={`${oI}-subclass-feature-option`}>
                            <h3>{option?.label}</h3>
                            {feature.attributes?.some((attribute) => attribute === Attributes.PREREQUISITES) &&
                              feature?.prerequisites?.options?.some(
                                (reqId) =>
                                  reqId === Prerequisites.ABILITY_SCORE ||
                                  reqId === Prerequisites.SKILL_PROFICIENCY ||
                                  reqId === Prerequisites.SPELLS_OBTAINED ||
                                  reqId === Prerequisites.FEATURES_OBTAINED
                              ) &&
                              option && (
                                <p>
                                  <em className={sprinkles({ mb: 'space-3' })}>
                                    <u>{handlePreReq(feature, option)}</u>
                                  </em>
                                </p>
                              )}
                            {option?.desc && parse(option.desc)}
                          </Fragment>
                        )
                      })}
                  </Fragment>
                )
              }
            })}
        </>
      }
    </Detail>
  )
}

export default Class
