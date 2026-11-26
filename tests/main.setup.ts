import { vi } from 'vitest'

// vitest 以 threads 池运行，测试处于 worker 线程；LoggerService 构造函数在非主线程会抛错。
// 强制 isMainThread=true（保留其余真实导出），使主进程日志单例可在测试中实例化。
vi.mock('worker_threads', async () => {
  const actual = await vi.importActual<typeof import('worker_threads')>('worker_threads')
  return { ...actual, isMainThread: true }
})

// Mock LoggerService globally for main process tests
vi.mock('@logger', async () => {
  const { MockMainLoggerService, mockMainLoggerService } = await import('./__mocks__/MainLoggerService')
  return {
    LoggerService: MockMainLoggerService,
    loggerService: mockMainLoggerService
  }
})

// Mock electron modules that are commonly used in main process
vi.mock('electron', () => {
  const mock = {
    app: {
      setPath: vi.fn(),
      getPath: vi.fn((key: string) => {
        switch (key) {
          case 'userData':
            return '/mock/userData'
          case 'temp':
            return '/mock/temp'
          case 'logs':
            return '/mock/logs'
          default:
            return '/mock/unknown'
        }
      }),
      getVersion: vi.fn(() => '1.0.0')
    },
    ipcMain: {
      handle: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
      removeHandler: vi.fn(),
      removeAllListeners: vi.fn()
    },
    BrowserWindow: vi.fn(),
    dialog: {
      showErrorBox: vi.fn(),
      showMessageBox: vi.fn(),
      showOpenDialog: vi.fn(),
      showSaveDialog: vi.fn()
    },
    shell: {
      openExternal: vi.fn(),
      showItemInFolder: vi.fn()
    },
    session: {
      defaultSession: {
        clearCache: vi.fn(),
        clearStorageData: vi.fn()
      }
    },
    webContents: {
      getAllWebContents: vi.fn(() => [])
    },
    systemPreferences: {
      getMediaAccessStatus: vi.fn(),
      askForMediaAccess: vi.fn()
    },
    nativeTheme: {
      themeSource: 'system',
      shouldUseDarkColors: false,
      on: vi.fn(),
      removeListener: vi.fn()
    },
    screen: {
      getPrimaryDisplay: vi.fn(),
      getAllDisplays: vi.fn()
    },
    Notification: vi.fn(),
    net: {
      fetch: vi.fn()
    }
  }

  return { __esModule: true, ...mock, default: mock }
})

// Mock Winston for LoggerService dependencies
vi.mock('winston', () => {
  const winstonMock = {
    createLogger: vi.fn(() => ({
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      level: 'info',
      on: vi.fn(),
      end: vi.fn()
    })),
    format: {
      combine: vi.fn(),
      splat: vi.fn(),
      timestamp: vi.fn(),
      errors: vi.fn(),
      json: vi.fn()
    },
    transports: {
      Console: vi.fn(),
      File: vi.fn()
    }
  }
  // LoggerService 以默认导入方式使用 winston（winston.createLogger 等），需同时提供 default 导出
  return { ...winstonMock, default: winstonMock }
})

// Mock winston-daily-rotate-file
vi.mock('winston-daily-rotate-file', () => {
  const DailyRotateFile = vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    log: vi.fn()
  }))
  return { default: DailyRotateFile }
})

// Mock electron-store to avoid file system operations
vi.mock('electron-store', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      get: vi.fn((key: string, defaultValue?: unknown) => defaultValue),
      set: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      has: vi.fn(() => false),
      store: {}
    }))
  }
})

// Mock Node.js modules
vi.mock('node:os', () => {
  const mock = {
    platform: vi.fn(() => 'darwin'),
    arch: vi.fn(() => 'x64'),
    version: vi.fn(() => '20.0.0'),
    cpus: vi.fn(() => [{ model: 'Mock CPU' }]),
    homedir: vi.fn(() => '/mock/home'),
    totalmem: vi.fn(() => 8 * 1024 * 1024 * 1024) // 8GB
  }
  return { ...mock, default: mock }
})

vi.mock('node:path', async () => {
  const actual = await vi.importActual('node:path')
  return {
    ...actual,
    join: vi.fn((...args: string[]) => args.join('/')),
    resolve: vi.fn((...args: string[]) => args.join('/'))
  }
})

vi.mock('node:fs', () => {
  const mock = {
    promises: {
      access: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      readdir: vi.fn(),
      stat: vi.fn(),
      unlink: vi.fn(),
      rmdir: vi.fn()
    },
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
    unlinkSync: vi.fn(),
    rmdirSync: vi.fn(),
    createReadStream: vi.fn(),
    createWriteStream: vi.fn()
  }

  return { ...mock, default: mock }
})
