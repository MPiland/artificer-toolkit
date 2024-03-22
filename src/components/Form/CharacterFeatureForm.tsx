import parse from 'html-react-parser'
import { Fragment } from 'react'
import { getSectionNames } from '../../utils/formUtils'
import { ReducerActionType } from '../../utils/types'
import Dropdown from '../Dropdown/Dropdown'
import ScrollArea from '../ScrollArea/ScrollArea'
import { get } from 'lodash'
import { sprinkles } from '../../css/sprinkles.css'
import {
  feature_card,
  feature_card_body,
  feature_card_header,
} from './Form.css'

interface CharacterFeatureFormProps {
  item: any
  setFormState: (arg: ReducerActionType) => void
  formState: any
}

const CharacterFeatureForm = ({
  formState,
  item,
  setFormState,
}: CharacterFeatureFormProps) => {
  const sectionNames = getSectionNames()

  const handleOptionSelect = (
    reducer: ReducerActionType,
    stateName: string
  ) => {
    const optionArray = get(item, stateName)

    const targetValue = optionArray.find(
      (optionItem: any) => optionItem._id === reducer.target.value._id
    )

    setFormState({
      target: { name: reducer.target.name, value: targetValue },
    })
  }

  return (
    <ScrollArea scrollDirection='vertical'>
      {item.ancestry?.option?.length > 0 && (
        <div className={feature_card}>
          <div className={feature_card_header}>
            <h2>{item.ancestry.value}</h2>
          </div>
          <div className={feature_card_body}>
            {item.ancestry.desc && parse(item.ancestry.desc)}
            <Dropdown
              name='ancestry'
              className={sprinkles({ mx: 'size-15', width: 'auto' })}
              label='Ancestry Option'
              options={item.ancestry.option}
              onChange={(target) =>
                handleOptionSelect(target, 'ancestry.option')
              }
              value={formState.ancestry}
            />
            {formState?.ancestry && (
              <div
                className={sprinkles({
                  mt: 'size-3',
                  mx: 'size-15',
                  width: 'auto',
                })}
              >
                <strong>
                  {formState.ancestry.desc && parse(formState.ancestry.desc)}
                </strong>
              </div>
            )}
          </div>
        </div>
      )}
      {item.feature?.length > 0 &&
        item.feature.map((featureItem: any, featureIndex: number) => (
          <div key={featureIndex} className={feature_card}>
            <div className={feature_card_header}>
              <h3>{featureItem.value}</h3>
            </div>
            <div className={feature_card_body}>
              {featureItem.desc && parse(featureItem.desc)}
            </div>
            {sectionNames.map(
              (sectionName: string, sectionNameIndex: number) => (
                <Fragment key={sectionNameIndex}>
                  {featureItem[sectionName]?.length > 0 &&
                    featureItem[sectionName].map(
                      (sectionItem: any, sectionItemIndex: number) => {
                        const providesOptions = sectionItem.attribute?.some(
                          (attributeItem: any) =>
                            attributeItem.name === 'providesOptions'
                        )
                        if (providesOptions) {
                          for (let i = 0; i < sectionItem.selectionCount; i++) {
                            return <div>{sectionName}</div>
                          }
                        }
                      }
                    )}
                </Fragment>
              )
            )}
          </div>
        ))}
    </ScrollArea>
  )
}

export default CharacterFeatureForm
