import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { _electron as electron } from '@playwright/test'

import { expect, test as base } from '../fixtures/electron.fixture'

const test = base.extend({
  electronApp: async ({}, use, testInfo) => {
    const profile = testInfo.outputPath('profile')
    await mkdir(profile, { recursive: true })
    const bootstrap = testInfo.outputPath('bootstrap.cjs')
    // Keep both flavor-based and user-configured data paths inside the test profile.
    await writeFile(
      bootstrap,
      `
      const { app } = require('electron');
      const setPath = app.setPath.bind(app);
      app.setPath = (key, value) => setPath(key, key === 'userData' ? ${JSON.stringify(profile)} : value);
      app.setPath('appData', ${JSON.stringify(profile)});
      app.setPath('userData', ${JSON.stringify(profile)});
      app.setAsDefaultProtocolClient = () => false;
      require(${JSON.stringify(path.resolve('out/main/index.js'))});
    `
    )
    const application = await electron.launch({
      args: [bootstrap],
      env: { ...process.env, NODE_ENV: 'test' },
      timeout: 30000
    })
    try {
      await use(application)
    } finally {
      await application.close()
    }
  },
  mainWindow: async ({ electronApp }, use) => {
    await expect.poll(() => electronApp.windows().some((window) => window.url().includes('/index.html'))).toBe(true)
    const window = electronApp.windows().find((window) => window.url().includes('/index.html'))!
    await window.waitForSelector('#root')
    await use(window)
  }
})

test('VeryClaw is the third toolbox entry and prompts when missing', async ({ electronApp, mainWindow }, testInfo) => {
  // All HTTP requests are stubbed before seeding local UI state; no test credentials reach a service.
  await mainWindow
    .context()
    .route(/^https?:\/\//, (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, data: {}, rows: [] }) })
    )
  // Exercise the real renderer/preload/IPC boundary without launching another desktop app.
  await electronApp.evaluate(({ ipcMain }) => {
    ipcMain.removeHandler('veryclaw:open')
    ipcMain.handle('veryclaw:open', () => ({ status: 'not-installed' }))
    ipcMain.removeHandler('veryclaw:download')
    ipcMain.handle('veryclaw:download', () => {
      process.env.VERYCLAW_E2E_DOWNLOAD_CALLED = '1'
      return { status: 'started' }
    })
  })
  await mainWindow.waitForFunction(() => !!window.store)
  await mainWindow.evaluate(() => {
    window.store.dispatch({ type: 'user/setToken', payload: 'offline-e2e-fixture' })
    window.location.hash = '/apps'
  })
  const button = mainWindow.getByRole('button', { name: 'VeryClaw' })
  await expect(button).toBeVisible()
  expect(await button.evaluate((element) => Array.from(element.parentElement!.children).indexOf(element))).toBe(2)
  await expect(button.locator('img')).toHaveJSProperty('naturalWidth', 128)
  await mainWindow.screenshot({ path: testInfo.outputPath('toolbox.png') })
  await button.click()
  await expect(mainWindow.getByRole('dialog')).toContainText('VeryClaw')
  await mainWindow.screenshot({ path: testInfo.outputPath('download-dialog.png') })
  await mainWindow.getByRole('button', { name: /下载安装|下載安裝|Download and install/ }).click()
  await expect(mainWindow.getByRole('dialog')).toBeHidden()
  expect(await electronApp.evaluate(() => process.env.VERYCLAW_E2E_DOWNLOAD_CALLED)).toBe('1')
})
