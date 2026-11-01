import { useEffect, useState } from 'react'

const KEY = 'sidebar.collapsed'
/** 1280 وأقل: القايمة بتصغر لأيقونات بس عشان المحتوى ياخد المساحة */
const COMPACT_QUERY = '(max-width: 1280px)'

function readSaved(): boolean | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === null ? null : v === '1'
  } catch {
    return null
  }
}

function save(value: boolean | null) {
  try {
    if (value === null) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, value ? '1' : '0')
  } catch {
    // مش مهم لو التخزين مش متاح
  }
}

/** القايمة بتصغر تلقائيًا حسب عرض الشاشة، والمستخدم يقدر يغيّرها بالزرار (واختياره بيتحفظ لحد ما الشاشة تعدّي الحد) */
export function useSidebarCollapsed() {
  const [auto, setAuto] = useState(() => window.matchMedia(COMPACT_QUERY).matches)
  const [manual, setManual] = useState(readSaved)

  useEffect(() => {
    const mq = window.matchMedia(COMPACT_QUERY)
    const onChange = (e: MediaQueryListEvent) => {
      setAuto(e.matches)
      setManual(null)
      save(null)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const collapsed = manual ?? auto
  const toggle = () => {
    setManual(!collapsed)
    save(!collapsed)
  }
  return { collapsed, toggle }
}
