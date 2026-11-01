/// <reference types="vite/client" />

// متغيرات ملف .env اللي بتوصل للواجهة (لازم تبدأ بـ RENDERER_VITE_)
interface ImportMetaEnv {
  readonly RENDERER_VITE_CURRENCY?: string
  readonly RENDERER_VITE_DEFAULT_LANGUAGE?: string
}
