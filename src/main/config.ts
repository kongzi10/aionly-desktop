import path from 'node:path'

import { isDev, isWin } from '@main/constant'
import { APP_NAME } from '@shared/config/constant'
import { app } from 'electron'

// Isolate userData per flavor so cn (AiiOnly) and global (AiOnly) can coexist
app.setPath('userData', path.join(app.getPath('appData'), APP_NAME))

if (isDev) {
  app.setPath('userData', app.getPath('userData') + 'Dev')
}

export const titleBarOverlayDark = {
  height: 42,
  color: isWin ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0)',
  symbolColor: '#fff'
}

export const titleBarOverlayLight = {
  height: 42,
  color: 'rgba(255,255,255,0)',
  symbolColor: '#000'
}

global.MARKETAPI_CLIENT_SECRET = import.meta.env.MAIN_VITE_MARKETAPI_CLIENT_SECRET
