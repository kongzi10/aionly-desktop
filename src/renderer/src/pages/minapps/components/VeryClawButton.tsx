import { loggerService } from '@logger'
import veryclawLogo from '@renderer/assets/images/veryclaw.png'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import ToolboxCard from './ToolboxCard'

const logger = loggerService.withContext('VeryClawButton')

export default function VeryClawButton() {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const opening = useRef(false)

  const handleClick = async () => {
    if (opening.current) return
    if (!window.api.veryclaw?.open) {
      window.toast.error(t('minapp.veryclaw.restart_required'))
      return
    }
    opening.current = true
    setBusy(true)
    try {
      const result = await window.api.veryclaw.open()
      if (result.status === 'not-installed') {
        window.modal.confirm({
          title: t('minapp.veryclaw.install_title'),
          content: t('minapp.veryclaw.install_content'),
          okText: t('minapp.veryclaw.download'),
          cancelText: t('common.cancel'),
          centered: true,
          onOk: async () => {
            if (!window.api.veryclaw.download) {
              window.toast.error(t('minapp.veryclaw.restart_required'))
              throw new Error('VeryClaw download API requires restart')
            }
            let result
            try {
              result = await window.api.veryclaw.download()
            } catch (error) {
              logger.error('Failed to download VeryClaw', error as Error)
              window.toast.error(t('minapp.veryclaw.download_failed'))
              throw error
            }
            if (result.status !== 'started') {
              const message = t(
                result.status === 'unavailable' ? 'minapp.veryclaw.download_unavailable' : 'minapp.veryclaw.unsupported'
              )
              window.toast.error(message)
              throw new Error(message)
            }
          }
        })
      } else if (result.status === 'unsupported') {
        window.toast.error(t('minapp.veryclaw.unsupported'))
      }
    } catch (error) {
      logger.error('Failed to open VeryClaw', error as Error)
      window.toast.error(t('minapp.veryclaw.open_failed'))
    } finally {
      opening.current = false
      setBusy(false)
    }
  }

  return (
    <ToolboxCard
      icon={<img src={veryclawLogo} alt={t('minapp.veryclaw.name')} draggable={false} />}
      title={t('minapp.veryclaw.name')}
      onClick={handleClick}
      busy={busy}
    />
  )
}
