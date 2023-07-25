import { camelCase } from 'lodash'
import Input from './Input'
import TextEditor from './TextEditor'

const NUM_REGEX = /^[0-9\b]+$/

const Table = ({ headers, name, state, onChange, className }) => {
  const content = state?.map((item, itemIndex) => (
    <div key={itemIndex} className={`row align-items-center g-2 ${className}`}>
      {headers.map((header) => {
        return (
          <div
            key={header.name}
            className={`col-md${header.size ? `-${header.size}` : ''} col-sm`}
          >
            {!!header.type && header.type === 'text' ? (
              <TextEditor
                className='shortDesc'
                noMenuBar={true}
                placeholder={`${header.name}`}
                name={`${name}.${itemIndex}.${camelCase(header.name)}`}
                onChange={onChange}
              />
            ) : (
              <Input
                className={`${
                  item[camelCase(header.name)] &&
                  (NUM_REGEX.test(item[camelCase(header.name)])
                    ? 'is-valid'
                    : 'is-invalid')
                }`}
                name={`${name}.${itemIndex}.${camelCase(header.name)}`}
                label={true}
                placeholder={`${header.name}`}
                onChange={onChange}
              />
            )}
          </div>
        )
      })}
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
    </div>
  ))

  return content
}
export default Table
