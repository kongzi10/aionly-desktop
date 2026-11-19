import ModelSelector from '@renderer/components/ModelSelector'
import { TopView } from '@renderer/components/TopView'
import { isRerankModel } from '@renderer/config/models'
import { useTimer } from '@renderer/hooks/useTimer'
import i18n from '@renderer/i18n'
import type { Model, Provider } from '@renderer/types'
import { Modal } from 'antd'
import { first } from 'lodash'
import { useCallback, useMemo, useState } from 'react'

interface ShowParams {
  provider: Provider
}

interface Props extends ShowParams {
  reject: (reason?: any) => void
  resolve: (data: any) => void
}

const PopupContainer: React.FC<Props> = ({ provider, resolve, reject }) => {
  const [open, setOpen] = useState(true)
  const { setTimeoutTimer } = useTimer()

  // Keep the natural order of models
  const models = useMemo(() => provider.models.filter((m) => !isRerankModel(m)), [provider])

  const [model, setModel] = useState(first(models))

  const modelPredicate = useCallback((m: Model) => !isRerankModel(m), [])

  // 与 ModelSelector 选项 value 保持同一 JSON 结构与键序：命中平台列表时直接回显真实选项；
  // 尚未加载到时由 ModelSelector 的 fallbackOption 反解 name 回显，避免展示原始 JSON
  const modelValue = useMemo(() => {
    if (!model) return undefined
    return JSON.stringify({
      id: model.id,
      provider: 'aionly',
      group: (model as any).group ?? (model as any).serviceName ?? '',
      name: model.name,
      modelFileUrl: (model as any).modelFileUrl
    })
  }, [model])

  const onOk = () => {
    if (!model) {
      window.toast.error(i18n.t('message.error.enter.model'))
      return
    }
    setOpen(false)
    resolve(model)
  }

  const onCancel = () => {
    setOpen(false)
    setTimeoutTimer('onCancel', reject, 300)
  }

  const onClose = () => {
    TopView.hide(TopViewKey)
  }

  SelectProviderModelPopup.hide = onCancel

  return (
    <Modal
      title={i18n.t('message.api.check.model.title', { model: model })}
      open={open}
      onOk={onOk}
      onCancel={onCancel}
      afterClose={onClose}
      transitionName="animation-move-down"
      width={400}
      centered>
      <ModelSelector
        providers={[provider]}
        predicate={modelPredicate}
        grouped={false}
        value={modelValue}
        placeholder={i18n.t('settings.models.empty')}
        style={{ width: '100%' }}
        onChange={(value) => {
          // console.log('value', value)
          // console.log('models', models)
          const model =
            typeof value === 'string' && value.startsWith('{') && value.endsWith('}') ? JSON.parse(value) : value
          setModel(model)
          // setModel(models.find((m) => value === getModelUniqId(m)))
        }}
      />
    </Modal>
  )
}

const TopViewKey = 'SelectProviderModelPopup'

export default class SelectProviderModelPopup {
  static topviewId = 0
  static hide() {
    TopView.hide(TopViewKey)
  }
  static show(props: ShowParams) {
    return new Promise<any>((resolve, reject) => {
      TopView.show(
        <PopupContainer
          {...props}
          reject={() => {
            reject()
            TopView.hide(TopViewKey)
          }}
          resolve={(v) => {
            resolve(v)
            TopView.hide(TopViewKey)
          }}
        />,
        TopViewKey
      )
    })
  }
}
