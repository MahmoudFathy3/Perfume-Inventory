/** حسابات الفترات الزمنية للرسوم والمقارنة */
const DAY = 86400000
const asDate = (s: string) => new Date(`${s}T00:00:00Z`)
const fmt = (d: Date) => d.toISOString().slice(0, 10)

/** قايمة الفترات (أيام، أو شهور لو الفترة طويلة) علشان الرسم ما يبقاش فيه ثغرات */
export function buildPeriods(start: string | null, end: string | null): { mode: 'day' | 'month'; periods: string[] } {
  if (!start || !end) return { mode: 'day', periods: [] }
  const days = Math.round((asDate(end).getTime() - asDate(start).getTime()) / DAY)
  const periods: string[] = []
  if (days <= 62) {
    for (let t = asDate(start).getTime(); t <= asDate(end).getTime(); t += DAY) periods.push(fmt(new Date(t)))
    return { mode: 'day', periods }
  }
  const last = end.slice(0, 7)
  let y = Number(start.slice(0, 4))
  let m = Number(start.slice(5, 7))
  for (;;) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    periods.push(key)
    if (key >= last) break
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return { mode: 'month', periods }
}

/** الفترة السابقة بنفس الطول (للمقارنة): بتتحسب لما from و to يكونوا متحددين */
export function previousRange(from: string | null, to: string | null): { from: string; to: string } | null {
  if (!from || !to) return null
  const days = Math.round((asDate(to).getTime() - asDate(from).getTime()) / DAY) + 1
  const prevTo = new Date(asDate(from).getTime() - DAY)
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * DAY)
  return { from: fmt(prevFrom), to: fmt(prevTo) }
}
