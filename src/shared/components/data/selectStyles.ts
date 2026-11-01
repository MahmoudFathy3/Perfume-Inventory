import type { GroupBase, StylesConfig } from 'react-select'

/** شكل موحّد لكل القوايم المنسدلة اللي فيها بحث (المنتج، والصنف، والعميل) */
export function createSelectStyles<Option>(): StylesConfig<Option, false, GroupBase<Option>> {
  return {
    control: (base, state) => ({
      ...base,
      minHeight: 42,
      borderRadius: 12,
      borderColor: state.isFocused ? '#0d9488' : '#e2e8f0',
      boxShadow: state.isFocused ? '0 0 0 3px rgba(13, 148, 136, .18)' : 'none',
      '&:hover': { borderColor: '#0d9488' }
    }),
    option: (base, state) => ({
      ...base,
      cursor: 'pointer',
      backgroundColor: state.isSelected ? '#0d9488' : state.isFocused ? '#ccfbf1' : '#fff',
      color: state.isSelected ? '#fff' : '#0f172a'
    }),
    menu: (base) => ({ ...base, borderRadius: 12, overflow: 'hidden', boxShadow: '0 10px 30px rgba(15, 23, 42, .18)' }),
    menuPortal: (base) => ({ ...base, zIndex: 1000 }),
    placeholder: (base) => ({ ...base, color: '#94a3b8' })
  }
}
