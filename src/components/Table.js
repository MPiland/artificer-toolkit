import '../css/table.css'
import { get } from 'lodash'
import Input from './Input'
import TextEditor from './TextEditor'

const NUM_REGEX = /^[0-9\b]+$/

const Table = ({
  inputs,
  name,
  value,
  onChange,
  className,
  dynamic,
  headers,
  readOnly,
  clickable,
  onClick,
  rowSize,
}) => {
  const getValueFromState = (inputItem, valueItem) => {
    const processItem = (item, state) => {
      if (Array.isArray(item)) {
        return item
          .map((nestedItem) => processItem(nestedItem, state))
          .join(' ')
      } else {
        const value = get(state, item)
        return Array.isArray(value)
          ? value.map((nestedValue) => nestedValue.value).join(' / ')
          : value
      }
    }

    if (inputItem && inputItem.name) {
      const nameItems = Array.isArray(inputItem.name[0])
        ? inputItem.name
        : [inputItem.name]
      return nameItems
        .map((nameItem) => {
          const value = processItem(nameItem, valueItem)
          return value !== undefined ? value : null
        })
        .join(' / ')
    }

    return null
  }

  const content = (
    <>
      {headers && (
        <div className={`row align-items-center g-2 ${rowSize ?? ''}`}>
          {headers?.map((headerItem, headerIndex) => {
            return readOnly ? (
              <div
                className={`${headerItem.size ?? ''} ${
                  headerItem.className ?? ''
                }`}
                key={headerIndex}
              >
                {headerItem.name}
              </div>
            ) : (
              <Input
                size={headerItem.size ?? null}
                className={headerItem.className}
                key={headerIndex}
                name={headerItem.name}
                value={headerItem.name}
                readOnly={readOnly === true ? true : false}
                border={headerItem.border}
              />
            )
          })}
        </div>
      )}
      {value?.map((valueItem, itemIndex) => (
        <div
          key={itemIndex}
          className={`row align-items-center gx-2 gy-1 ${className ?? ''} ${
            clickable ? 'row-clickable' : ''
          } ${rowSize ?? ''}`}
          onClick={() => {
            onClick && onClick(valueItem)
          }}
        >
          {inputs?.map((inputItem, inputIndex) => {
            return readOnly ? (
              <div className={`${inputItem.size ?? ''}`} key={inputIndex}>
                {getValueFromState(inputItem, valueItem) !== null
                  ? getValueFromState(inputItem, valueItem)
                  : ''}
              </div>
            ) : !!inputItem.type && inputItem.type === 'text' ? (
              <TextEditor
                short={inputItem.short}
                size={inputItem.size}
                noMenuBar={true}
                placeholder={`${inputItem.value}`}
                name={`${name}.${itemIndex}.${inputItem.name}`}
                value={getValueFromState(inputItem, valueItem)}
                key={inputIndex}
                onChange={onChange}
              />
            ) : (
              <Input
                className={`${
                  inputItem.validation === true &&
                  valueItem[inputItem.name] &&
                  (NUM_REGEX.test(valueItem[inputItem.name])
                    ? 'is-valid'
                    : 'is-invalid')
                }`}
                size={inputItem.size ?? null}
                name={`${name}.${itemIndex}.${inputItem.name}`}
                label={inputItem.label ?? false}
                border={inputItem.border}
                key={inputIndex}
                placeholder={inputItem.value}
                invalidText={inputItem.invalid}
                value={
                  getValueFromState(inputItem, valueItem) !== null
                    ? getValueFromState(inputItem, valueItem)
                    : ''
                }
                onChange={(e) => onChange({ payload: { target: e } })}
                readOnly={readOnly === true ? true : false}
              />
            )
          })}
          {!!dynamic && (
            <>
              <div className='col-1'>
                <button
                  className='bi bi-plus-circle'
                  type='button'
                  name={`${name}`}
                  onClick={(e) => onChange({ type: 'added', payload: e })}
                />
              </div>
              <div className='col-1'>
                {itemIndex !== 0 && (
                  <button
                    className='bi bi-trash3'
                    type='button'
                    name={`${name}.${itemIndex}`}
                    onClick={(e) => onChange({ type: 'removed', payload: e })}
                  />
                )}
              </div>
            </>
          )}
        </div>
      ))}
    </>
  )

  return content
}
export default Table
