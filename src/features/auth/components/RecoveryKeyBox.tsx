/** مفتاح الاسترجاع بخط واضح (LTR) علشان يتكتب على ورقة من غير لبس */
export function RecoveryKeyBox({ recoveryKey }: { recoveryKey: string }) {
  return (
    <div dir="ltr" className="select-all rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center font-mono text-[15px] font-bold tracking-normal text-slate-800">
      {recoveryKey}
    </div>
  )
}
