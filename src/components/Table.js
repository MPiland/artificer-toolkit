import { camelCase } from 'lodash'

const NUM_REGEX = /^[0-9\b]+$/

const Table = ({ className, headers, name, state, onChange }) => {
  return (
    <table className={className}>
      <thead>
        <tr>
          {headers?.map((header) => (
            <th key={header.name} scope='col' className='text-center pb-0'>
              {header.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {state?.map((item, itemIndex) => (
          <tr key={itemIndex}>
            {headers.map((header) => (
              <td key={header.name} className='position-relative'>
                <input
                  className={`form-control ${
                    item[camelCase(header.name)] &&
                    (NUM_REGEX.test(item[camelCase(header.name)])
                      ? 'is-valid'
                      : 'is-invalid')
                  }`}
                  type='text'
                  name={`${name}.${itemIndex}.${camelCase(header.name)}`}
                  id={`${name}.${itemIndex}.${camelCase(header.name)}`}
                  value={item[camelCase(header.name)] ?? ''}
                  onChange={(e) => onChange({ payload: e })}
                />
                <div
                  id={`${name}.${itemIndex}.${camelCase(header.name)}`}
                  className='invalid-tooltip'
                >
                  Must contain only numbers
                </div>
              </td>
            ))}
            <td>
              <button
                className='bi bi-plus-circle'
                type='button'
                name={`${name}`}
                onClick={(e) => onChange({ type: 'added', payload: e })}
              ></button>
            </td>
            <td className='col-1'>
              {itemIndex !== 0 && (
                <button
                  className='bi bi-trash3'
                  type='button'
                  name={`${name}.${itemIndex}`}
                  onClick={(e) => onChange({ type: 'removed', payload: e })}
                />
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
export default Table
