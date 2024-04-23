import parse from 'html-react-parser'
import { Fragment } from 'react'
import { selectSubclassById } from './classApiSlice'
import { useLocation } from 'react-router-dom'
import Spinner from '../../components/Spinner/Spinner'
import { useSelector } from 'react-redux'
import Detail from '../../components/Detail/Detail'
import { sprinkles } from '../../css/sprinkles.css'

const Class = () => {
  const location: any = useLocation()

  const handlePreReq = (parentItem: any, childItem: any) => {
    const parentLevel = parentItem.levelAvailable.split(', ')
    const childLevel = childItem.levelAvailable
    const childReq = childItem.attribute?.some((attributeItem: any) => attributeItem.name === 'hasRequirements')
    const childReqsText = []

    if (childLevel !== parentLevel[0]) {
      childReqsText.push(`Class level ${childLevel}`)
    }

    if (childReq) {
      const childReqOption = childItem.requirement
      if (childReqOption && childReqOption.option?.length > 0) {
        if (childReqOption.skillProficiency && childReqOption.skillProficiency?.skill?.length > 0) {
          childReqsText.push(
            `Skill(s) Proficiency: ${childReqOption.skillProficiency?.skill.map(
              (skillItem: any, skillIndex: number) => {
                const skillName = skillItem.value
                if (
                  childReqOption.skillProficiency?.skill?.length > 1 &&
                  skillIndex !== childReqOption.skillProficiency?.skill?.length - 1
                ) {
                  return `${skillName}, `
                } else {
                  return `${skillName}`
                }
              }
            )}`
          )
        }
        if (childReqOption.abilityScore && childReqOption.abilityScore?.ability?.length > 0) {
          childReqsText.push(
            `Ability Score: ${childReqOption.abilityScore?.ability.map((abilityItem: any, abilityIndex: number) => {
              const abilityName = abilityItem.value
              if (
                childReqOption.abilityScore?.ability?.length > 1 &&
                abilityIndex !== childReqOption.abilityScore?.ability?.length - 1
              ) {
                return `(${childReqOption.abilityScore?.score}) ${abilityName}, `
              } else {
                return `(${childReqOption.abilityScore?.score}) ${abilityName}`
              }
            })}`
          )
        }
        if (childReqOption.spellKnown && childReqOption.spellKnown?.spell?.length > 0) {
          childReqsText.push(
            `Spell(s) Known: ${childReqOption.spellKnown?.spell.map((spellItem: any, spellIndex: number) => {
              const spellName = spellItem.value
              if (
                childReqOption.abilityScore?.ability?.length > 1 &&
                spellIndex !== childReqOption.abilityScore?.ability?.length - 1
              ) {
                return `${spellName}, `
              } else {
                return `${spellName}`
              }
            })}`
          )
        }
        if (childReqOption.featureKnown && childReqOption.featureKnown?.feature?.length > 0) {
          let featureText = ''
          childReqOption.featureKnown?.feature?.map((reqFeatureItem: any, reqFeatureIndex: number) => {
            featureText += `${reqFeatureItem.value}`
            const featureLength = childReqOption.featureKnown?.feature.length
            const classFeature = uClass.feature.find(
              (classFeatureItem: any) => reqFeatureItem._id === classFeatureItem._id
            )
            if (childReqOption.featureKnown?.option?.length > 0) {
              childReqOption.featureKnown?.option?.map((reqOptionItem: any, reqOptionIndex: any) => {
                const optionLength = childReqOption.featureKnown?.option?.length
                const classFeatureOption = classFeature.option?.find(
                  (classFeatureOptionItem: any) => classFeatureOptionItem._id === reqOptionItem._id
                )
                if (classFeatureOption) {
                  if (featureLength > 1 && reqOptionIndex !== optionLength - 1) {
                    featureText += `: ${reqOptionItem.value}, `
                  } else {
                    featureText += `: ${reqOptionItem.value}`
                  }
                }
              })
            } else {
              if (featureLength > 1 && reqFeatureIndex !== featureLength - 1) {
                featureText += '; '
              }
            }
          })
          childReqsText.push(featureText)
        }
      }
    }
    if (childReqsText?.length > 0) {
      let reqText = 'Prerequisite(s) - '
      childReqsText.map((reqItem: any, reqIndex: number) => {
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

  const uClass = location.state.item

  const subclass: any = useSelector((state) => selectSubclassById(state, location.state.item.id))

  const scrollToElement = (e: MouseEvent, id: string) => {
    const element = document.getElementById(`${id}`)
    e.preventDefault()
    element &&
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
  }

  let resourceShown = false

  const sidebarList =
    uClass?.category?.name === 'base' ? (
      <>
        {uClass?.detail?.length > 0 &&
          uClass.detail.map((detailItem: any, detailIndex: number) => (
            <li
              key={detailIndex}
              onClick={(e: any) => {
                scrollToElement(e, detailItem.name)
              }}
            >
              <a href='/'>{detailItem?.value}</a>
            </li>
          ))}
        {uClass.subclass && (
          <li
            onClick={(e: any) => {
              scrollToElement(e, uClass.subclass.name)
            }}
          >
            <a href='/'>{uClass.subclass.value}</a>
          </li>
        )}
        {subclass.length > 0 &&
          subclass.map((subclassItem: any, subclassIndex: number) => (
            <li key={subclassIndex}>
              <a
                href='/'
                onClick={(e: any) => {
                  scrollToElement(e, subclassItem.name)
                }}
              >
                {subclassItem.value}
              </a>
            </li>
          ))}
      </>
    ) : (
      <>
        {uClass.feature?.length > 0 &&
          uClass.feature.map((featureItem: any, featureIndex: number) => (
            <li key={featureIndex}>
              <a
                href='/'
                className='sidebar-link'
                onClick={(e: any) => {
                  scrollToElement(e, featureItem.name)
                }}
              >
                {featureItem.value}
              </a>
            </li>
          ))}
      </>
    )

  return !uClass ? (
    <Spinner />
  ) : (
    <Detail sidebar={{ list: sidebarList }} footerSpacing='end'>
      <div id='quote'>
        <em>{uClass?.desc && parse(uClass.desc)}</em>
      </div>
      {uClass.category?.name === 'base' ? (
        <>
          {uClass.detail &&
            uClass.detail?.length > 0 &&
            uClass.detail.map((detailItem: any, detailIndex: number) => (
              <section id={`${detailItem.name}`} key={detailIndex}>
                <strong>
                  <h2>{detailItem.value}</h2>
                </strong>
                <hr />
                {detailItem.desc && parse(detailItem.desc)}
                {detailIndex === uClass.detail.length - 1 &&
                  uClass.feature?.length > 0 &&
                  uClass.feature.map((featureItem: any, featureIndex: number) => {
                    const featureLevelArray = featureItem.levelAvailable.split(', ')
                    const featureLevel = featureLevelArray[0]
                    return (
                      <Fragment key={featureIndex}>
                        {uClass.resource &&
                          Number(featureLevel) >= uClass.resource?.levelAvailable &&
                          !resourceShown && (
                            <Fragment>
                              <h3>
                                <strong>{uClass.resource?.value}</strong>
                              </h3>
                              {uClass.resource?.desc && parse(uClass.resource?.desc)}
                              {(resourceShown = true)}
                            </Fragment>
                          )}
                        <h3>
                          <strong>{featureItem.value}</strong>
                        </h3>
                        {featureItem.desc && parse(featureItem.desc)}
                        {featureItem.option?.length > 0 &&
                          featureItem.option.map((optionItem: any, optionIndex: number) => (
                            <Fragment key={optionIndex}>
                              <h4>
                                <strong>{optionItem.value}</strong>
                              </h4>
                              {handlePreReq(featureItem, optionItem) && (
                                <p>
                                  <em className={sprinkles({ mb: 'size-3' })}>
                                    <u>{handlePreReq(featureItem, optionItem)}</u>
                                  </em>
                                </p>
                              )}
                              {optionItem.desc && parse(optionItem.desc)}
                            </Fragment>
                          ))}
                      </Fragment>
                    )
                  })}
              </section>
            ))}
          {uClass.subclass && uClass.subclass?.name && (
            <section id={`${uClass.subclass.name}`}>
              <h2>
                <strong>{uClass.subclass.value}</strong>
              </h2>
              <hr />
              {uClass.subclass?.desc && parse(uClass.subclass.desc)}
            </section>
          )}
          {subclass.length > 0 && (
            <>
              {subclass.map((subclassItem: any, subClassIndex: number) => {
                let subclassResourceShown = false
                return (
                  <section id={`${subclassItem.name}`} key={subClassIndex}>
                    <h2>
                      <strong>{subclassItem.value}</strong>
                    </h2>
                    <hr />
                    {subclassItem.desc && parse(subclassItem.desc)}
                    {subclassItem.feature?.length > 0 &&
                      subclassItem.feature.map((featureItem: any, featureIndex: number) => {
                        const featureLevelArray = featureItem.levelAvailable.split(', ')
                        const featureLevel = featureLevelArray[0]
                        return (
                          <Fragment key={featureIndex}>
                            {subclassItem.resource &&
                              Number(featureLevel) >= subclassItem.resource?.levelAvailable &&
                              !subclassResourceShown && (
                                <Fragment>
                                  <h3>
                                    <strong>{subclassItem.resource?.value}</strong>
                                  </h3>
                                  {subclassItem.resource?.desc && parse(subclassItem.resource?.desc)}
                                  {(subclassResourceShown = true)}
                                </Fragment>
                              )}
                            <h3>
                              <strong>{featureItem.value}</strong>
                            </h3>
                            {featureItem.desc && parse(featureItem.desc)}
                            {featureItem.option?.length > 0 &&
                              featureItem.option.map((optionItem: any, optionIndex: number) => (
                                <Fragment key={optionIndex}>
                                  <h4>
                                    <strong>{optionItem.value}</strong>
                                  </h4>
                                  {handlePreReq(featureItem, optionItem) && (
                                    <p>
                                      <em className={sprinkles({ mb: 'size-3' })}>
                                        <u>{handlePreReq(featureItem, optionItem)}</u>
                                      </em>
                                    </p>
                                  )}
                                  {optionItem.desc && parse(optionItem.desc)}
                                </Fragment>
                              ))}
                          </Fragment>
                        )
                      })}
                    {subClassIndex !== subclass.length - 1 && <hr />}
                  </section>
                )
              })}
            </>
          )}
        </>
      ) : (
        <>
          {uClass.feature?.length > 0 &&
            uClass.feature.map((featureItem: any, featureIndex: number) => {
              const featureLevelArray = featureItem.levelAvailable.split(', ')
              const featureLevel = featureLevelArray[0]
              return (
                <Fragment key={featureIndex}>
                  {uClass.resource && Number(featureLevel) >= uClass.resource?.levelAvailable && !resourceShown && (
                    <Fragment>
                      <h3>
                        <strong>{uClass.resource?.value}</strong>
                      </h3>
                      {uClass.resource?.desc && parse(uClass.resource?.desc)}
                      {(resourceShown = true)}
                    </Fragment>
                  )}
                  <h3>
                    <strong>{featureItem.value}</strong>
                  </h3>
                  {featureItem.desc && parse(featureItem.desc)}
                  {featureItem.option?.length > 0 &&
                    featureItem.option.map((optionItem: any, optionIndex: number) => (
                      <Fragment key={optionIndex}>
                        <h4>
                          <strong>{optionItem.value}</strong>
                        </h4>
                        {handlePreReq(featureItem, optionItem) && (
                          <p>
                            <em className={sprinkles({ mb: 'size-3' })}>
                              <u>{handlePreReq(featureItem, optionItem)}</u>
                            </em>
                          </p>
                        )}
                        {optionItem.desc && parse(optionItem.desc)}
                      </Fragment>
                    ))}
                </Fragment>
              )
            })}
        </>
      )}
    </Detail>
  )
}

export default Class
