import { APP_PROTOCOL } from '@shared/config/constant'

export const DEFAULT_TEMPERATURE = 1.0
export const DEFAULT_CONTEXTCOUNT = 5
export const DEFAULT_MAX_TOKENS = 4096
export const SYSTEM_PROMPT_THRESHOLD = 128
export const DEFAULT_KNOWLEDGE_DOCUMENT_COUNT = 6
export const DEFAULT_KNOWLEDGE_THRESHOLD = 0.0
export const DEFAULT_WEBSEARCH_RAG_DOCUMENT_COUNT = 1
export const DEFAULT_STREAM_OPTIONS_INCLUDE_USAGE = true
export const LATEST_PRIVACY_POLICY_VERSION = '20260531'

// Max tool calls validation constants
export const MIN_TOOL_CALLS = 1
export const MAX_TOOL_CALLS = 100

export const platform = window.electron?.process?.platform
export const isMac = platform === 'darwin'
export const isWin = platform === 'win32' || platform === 'win64'
export const isLinux = platform === 'linux'
export const isDev = window.electron?.process?.env?.NODE_ENV === 'development'
export const isProd = window.electron?.process?.env?.NODE_ENV === 'production'

export const SILICON_CLIENT_ID = 'SFaJLLq0y6CAMoyDm81aMu'
export const PPIO_CLIENT_ID = '37d0828c96b34936a600b62c'
export const PPIO_APP_SECRET = import.meta.env.RENDERER_VITE_PPIO_APP_SECRET || ''
export const TOKENFLUX_HOST = 'https://tokenflux.ai'

// Messages loading configuration
export const INITIAL_MESSAGES_COUNT = 20
export const LOAD_MORE_COUNT = 20

export const DEFAULT_COLOR_PRIMARY = '#1677ff'
export const THEME_COLOR_PRESETS = [
  DEFAULT_COLOR_PRIMARY,
  '#FF5470', // Coral Pink
  '#14B8A6', // Teal
  '#6366F1', // Indigo
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#3B82F6', // Blue
  '#F59E0B', // Amber
  '#6D28D9', // Violet
  '#0EA5E9', // Sky Blue
  '#0284C7' // Light Blue
]

export const MAX_CONTEXT_COUNT = 100
export const UNLIMITED_CONTEXT_COUNT = 100000

export const MAX_COLLAPSED_CODE_HEIGHT = 350

// 例：VITE_API_URL=https://www.aionly.com/api -> https://www.aionly.com
export const SCAN_LOGIN_HOST =
  String(import.meta.env.VITE_API_URL || '')
    .replace(/\/+$/, '')
    .replace(/\/api$/, '') || `https://www.${APP_PROTOCOL}.com`

// 扫码登录二维码内容
export const getScanLoginUrl = (ticket: string) => `${SCAN_LOGIN_HOST}/scanLogin?ticket=${encodeURIComponent(ticket)}`
