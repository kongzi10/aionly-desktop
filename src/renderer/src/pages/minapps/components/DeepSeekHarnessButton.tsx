import { loggerService } from '@logger'
import deepseekLogo from '@renderer/assets/images/providers/deepseek.png'
import MinAppIcon from '@renderer/components/Icons/MinAppIcon'
import { useMinappPopup } from '@renderer/hooks/useMinappPopup'
import type { MinAppType } from '@renderer/types'
import { codeTools, DSH_WEB_DEFAULTS } from '@shared/config/constant'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import ToolboxCard from './ToolboxCard'

const logger = loggerService.withContext('DeepSeekHarnessButton')
const INSTALL_STATUS_KEY = 'deepseek_harness_installing'

const DEEPSEEK_HARNESS_APP: MinAppType = {
  id: 'deepseek-harness',
  name: 'DeepSeek Harness',
  logo: deepseekLogo,
  url: `http://${DSH_WEB_DEFAULTS.HOST}:${DSH_WEB_DEFAULTS.PORT}`, // dsh web 默认地址，实际以启动后返回的 url 为准
  bodered: true,
  style: { borderRadius: 10 }
}

/**
 * 小程序页固定的 DeepSeek Harness 入口：
 * - 已安装：启动 `dsh web`（已在运行则复用），以小程序 webview 方式打开 Web UI
 * - 未安装：自动安装（必要时先安装 bun），安装完成后同样启动并以 webview 打开
 */
const DeepSeekHarnessButton: FC = () => {
  const { t } = useTranslation()
  const { openSmartMinapp } = useMinappPopup()
  const [busy, setBusy] = useState(false)

  // 组件挂载时检查是否有未完成的安装
  useEffect(() => {
    const checkInstallStatus = async () => {
      const isInstalling = localStorage.getItem(INSTALL_STATUS_KEY) === 'true'
      if (!isInstalling) return

      // 检查是否已经安装完成
      const installed = await window.api.codeTools.isInstalled(codeTools.deepseekHarness)
      if (installed) {
        // 已安装完成，清除标记
        localStorage.removeItem(INSTALL_STATUS_KEY)
        window.toast.success(t('minapp.deepseek_harness.install_success'))
        return
      }

      // 仍在安装中，显示 loading
      setBusy(true)
      window.toast.info(t('minapp.deepseek_harness.installing'))

      // 每 5 秒检查一次，最多等待 5 分钟
      let checkCount = 0
      const maxChecks = 60 // 5 分钟 / 5 秒
      const intervalId = setInterval(async () => {
        checkCount++
        const nowInstalled = await window.api.codeTools.isInstalled(codeTools.deepseekHarness)

        if (nowInstalled) {
          clearInterval(intervalId)
          localStorage.removeItem(INSTALL_STATUS_KEY)
          setBusy(false)
          window.toast.success(t('minapp.deepseek_harness.install_success'))
        } else if (checkCount >= maxChecks) {
          // 超时
          clearInterval(intervalId)
          localStorage.removeItem(INSTALL_STATUS_KEY)
          setBusy(false)
          window.toast.error(t('minapp.deepseek_harness.install_timeout'))
        }
      }, 5000)

      // 组件卸载时清理定时器
      return () => clearInterval(intervalId)
    }

    checkInstallStatus()
  }, [t])

  const handleClick = useCallback(async () => {
    if (busy) return

    try {
      const installed = await window.api.codeTools.isInstalled(codeTools.deepseekHarness)
      if (!installed) {
        // dsh 通过 bun 全局安装，先确保 bun 可用
        const bunExists = await window.api.isBinaryExist('bun')
        if (!bunExists) {
          await window.api.installBunBinary()
        }

        setBusy(true)
        localStorage.setItem(INSTALL_STATUS_KEY, 'true') // 标记开始安装
        window.toast.info(t('minapp.deepseek_harness.installing'))

        const result = await window.api.codeTools.install(codeTools.deepseekHarness)
        localStorage.removeItem(INSTALL_STATUS_KEY) // 安装完成，清除标记

        if (!result.success) {
          window.toast.error(`${t('minapp.deepseek_harness.install_failed')}: ${result.message}`)
          return
        }
        window.toast.success(t('minapp.deepseek_harness.install_success'))
      }

      // 启动 dsh web
      setBusy(true)

      // 延迟显示启动提示：如果 1 秒内完成（已在运行），就不显示提示
      const toastTimer = setTimeout(() => {
        window.toast.info(t('minapp.deepseek_harness.starting'))
      }, 1000)

      const startResult = await window.api.codeTools.startDeepSeekHarness()
      clearTimeout(toastTimer) // 清除未触发的 toast

      if (startResult.success && startResult.url) {
        // 以小程序 webview 方式打开（自动适配顶部导航/侧边栏布局，与其他小程序一致）
        openSmartMinapp({ ...DEEPSEEK_HARNESS_APP, url: startResult.url }, true)
      } else {
        window.toast.error(`${t('minapp.deepseek_harness.start_failed')}: ${startResult.message}`)
      }
    } catch (error) {
      localStorage.removeItem(INSTALL_STATUS_KEY) // 发生错误，清除标记
      logger.error('Failed to launch DeepSeek Harness:', error as Error)
      window.toast.error(`${t('minapp.deepseek_harness.start_failed')}: ${(error as Error).message}`)
    } finally {
      setBusy(false)
    }
  }, [busy, t, openSmartMinapp])

  return (
    <ToolboxCard
      icon={<MinAppIcon size={56} app={DEEPSEEK_HARNESS_APP} />}
      title="DeepSeek Harness"
      onClick={handleClick}
      busy={busy}
    />
  )
}

export default DeepSeekHarnessButton
