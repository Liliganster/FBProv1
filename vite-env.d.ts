/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_GOOGLE_MAPS_API_KEY: string
  readonly VITE_GOOGLE_CALENDAR_CLIENT_ID: string
  readonly VITE_GOOGLE_PICKER_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Build-time injected constants (via Vite define)
declare const __BUILD_TIME__: string | undefined;
declare const __COMMIT_HASH__: string | undefined;
