// أنواع الاستيراد الخاصة بـ electron-vite / vite (أصول وملفات نصية)
declare module '*.png?asset' {
  const path: string
  export default path
}

declare module '*.svg?raw' {
  const content: string
  export default content
}
