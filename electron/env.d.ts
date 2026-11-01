// متغيرات الـ .env اللي electron-vite بيحقنها في كود الـ backend وقت الـ build
interface ImportMetaEnv {
  readonly MAIN_VITE_DB_FILE_NAME?: string
  readonly MAIN_VITE_APP_NAME?: string
  readonly MAIN_VITE_APP_NAME_AR?: string
  readonly MAIN_VITE_SPLASH_DURATION_MS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
