import clsx from 'clsx'

interface SegmentedProps<T extends string> {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  /** true: الاختيارات بتتوزع على عرض المساحة كلها بالتساوي */
  fill?: boolean
}

/** اختيار من 2-3 اختيارات (قطاعي / جملة مثلًا) */
export function Segmented<T extends string>({ value, options, onChange, fill = false }: SegmentedProps<T>) {
  return (
    <div className={clsx('rounded-full bg-slate-100 p-[3px]', fill ? 'flex w-full' : 'inline-flex self-start')}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={clsx('rounded-full px-5 py-1.5 transition', fill && 'flex-1', o.value === value ? 'bg-primary-600 font-bold text-white' : 'text-slate-500 hover:text-slate-800')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
