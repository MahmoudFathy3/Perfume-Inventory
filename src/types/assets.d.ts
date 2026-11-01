// استيراد الصور من الكود (vite بيرجّع رابط الملف)
declare module '*.svg' {
  const src: string
  export default src
}
