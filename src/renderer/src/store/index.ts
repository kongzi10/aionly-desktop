/**
 * @deprecated Scheduled for removal in v2.0.0
 * --------------------------------------------------------------------------
 * ⚠️ NOTICE: V2 DATA&UI REFACTORING (by 0xfullex)
 * --------------------------------------------------------------------------
 * STOP: Feature PRs affecting this file are currently BLOCKED.
 * Only critical bug fixes are accepted during this migration phase.
 *
 * This file is being refactored to v2 standards.
 * Any non-critical changes will conflict with the ongoing work.
 *
 * 🔗 Context & Status:
 * --------------------------------------------------------------------------
 */
import { loggerService } from '@logger'
import { combineReducers, configureStore } from '@reduxjs/toolkit'
import { getActiveProfileId, getReduxPersistKey } from '@renderer/services/ProfileStorageService'
import { IpcChannel } from '@shared/IpcChannel'
import { useDispatch, useSelector, useStore } from 'react-redux'
import { FLUSH, PAUSE, PERSIST, persistReducer, persistStore, PURGE, REGISTER, REHYDRATE } from 'redux-persist'
import storage from 'redux-persist/lib/storage'

import storeSyncService from '../services/StoreSyncService'
import assistants from './assistants'
import backup from './backup'
import codeTools from './codeTools'
import copilot from './copilot'
import inputToolsReducer from './inputTools'
import knowledge from './knowledge'
import llm from './llm'
import mcp from './mcp'
import memory from './memory'
import messageBlocksReducer from './messageBlock'
import migrate from './migrate'
import minapps from './minapps'
import newMessagesReducer from './newMessage'
import { setNotesPath } from './note'
import note from './note'
import nutstore from './nutstore'
import ocr from './ocr'
import openclaw from './openclaw'
import paintings from './paintings'
import { PROFILE_PERSIST_BLACKLIST, PROFILE_PERSIST_VERSION } from './persistence'
import preprocess from './preprocess'
import runtime from './runtime'
import selectionStore from './selectionStore'
import settings from './settings'
import shortcuts from './shortcuts'
import tabs from './tabs'
import toolPermissions from './toolPermissions'
import translate from './translate'
import { reloadProfileUserState } from './user'
import user from './user'
import websearch from './websearch'

const logger = loggerService.withContext('Store')
const rootReducer = combineReducers({
  assistants,
  backup,
  codeTools,
  nutstore,
  paintings,
  llm,
  settings,
  runtime,
  shortcuts,
  knowledge,
  minapps,
  websearch,
  mcp,
  memory,
  copilot,
  openclaw,
  selectionStore,
  tabs,
  preprocess,
  messages: newMessagesReducer,
  messageBlocks: messageBlocksReducer,
  inputTools: inputToolsReducer,
  translate,
  ocr,
  note,
  toolPermissions,
  user
})

/**
 * Configures the store sync service to synchronize specific state slices across all windows.
 * For detailed implementation, see @renderer/services/StoreSyncService.ts
 *
 * Usage:
 * - 'xxxx/' - Synchronizes the entire state slice
 * - 'xxxx/sliceName' - Synchronizes a specific slice within the state
 *
 * To listen for store changes in a window:
 * Call storeSyncService.subscribe() in the window's entryPoint.tsx
 */
storeSyncService.setOptions({
  syncList: ['assistants/', 'settings/', 'llm/', 'selectionStore/', 'note/']
})

function createStoreRuntime() {
  const persistKey = getActiveProfileId() ? getReduxPersistKey() : 'aionly:login'
  const persistedReducer = persistReducer(
    {
      key: persistKey,
      storage,
      version: PROFILE_PERSIST_VERSION,
      // Authentication is stored separately in profile-scoped localStorage.
      // Persisting the user slice as well can restore the previous account's token
      // after a profile switch and make the new account send stale credentials.
      blacklist: [...PROFILE_PERSIST_BLACKLIST],
      migrate
    },
    rootReducer
  )

  const nextStore = configureStore({
    // @ts-ignore store type is unknown
    reducer: persistedReducer as typeof rootReducer,
    middleware: (getDefaultMiddleware) => {
      return getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER]
        }
      }).concat(storeSyncService.createMiddleware())
    },
    devTools: true
  })
  nextStore.dispatch(reloadProfileUserState())

  let resolveRehydrated: (() => void) | undefined
  const rehydrated = new Promise<void>((resolve) => {
    resolveRehydrated = resolve
  })
  const nextPersistor = persistStore(nextStore, undefined, () => {
    // Rehydration may contain a legacy persisted user slice. Always make the
    // active profile's authentication storage the source of truth.
    nextStore.dispatch(reloadProfileUserState())
    notifyRendererReady(nextStore)
    resolveRehydrated?.()
  })
  return { store: nextStore, persistor: nextPersistor, rehydrated }
}

function notifyRendererReady(currentStore: ReturnType<typeof configureStore>): void {
  const state = currentStore.getState() as RootState
  // Only seed the notes path for an active profile; the login window would otherwise
  // capture the shared fallback directory into the persisted login state.
  if (getActiveProfileId() && !state.note.notesPath) {
    setTimeout(async () => {
      try {
        const info = await window.api.getAppInfo()
        currentStore.dispatch(setNotesPath(info.notesPath))
        logger.info('Initialized notes path on startup:', info.notesPath)
      } catch (error) {
        logger.error('Failed to initialize notes path on startup:', error as Error)
      }
    }, 0)
  }

  void window.electron?.ipcRenderer?.invoke(IpcChannel.ReduxStoreReady)
  void window.api.profile?.rendererReady?.()
  logger.info('Redux store ready, notified main process')
}

const initialRuntime = createStoreRuntime()
export let store = initialRuntime.store
export let persistor = initialRuntime.persistor

export function resetStore(): Promise<void> {
  const nextRuntime = createStoreRuntime()
  store = nextRuntime.store
  persistor = nextRuntime.persistor
  window.store = store
  return nextRuntime.rehydrated
}

export type RootState = ReturnType<typeof rootReducer>
export type AppDispatch = typeof store.dispatch

export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
export const useAppStore = useStore.withTypes<typeof store>()
window.store = store

export async function handleSaveData() {
  logger.info('Flushing redux persistor data')
  await persistor.flush()
  logger.info('Flushed redux persistor data')
}

export { store as default }
