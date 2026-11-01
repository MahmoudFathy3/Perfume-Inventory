/** نقطة الاتصال الوحيدة بالـ backend. بترجع الداتا أو بترمي Error فيه كود الخطأ. */
export async function invoke<T = unknown>(channel: string, payload?: unknown): Promise<T> {
  const res = await window.api.invoke<T>(channel, payload)
  if (!res.ok) throw new Error(res.error)
  return res.data
}
