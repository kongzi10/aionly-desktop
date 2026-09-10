import { ExclamationCircleOutlined } from '@ant-design/icons'
import { DraggableList } from '@renderer/components/DraggableList'
import { DeleteIcon, EditIcon } from '@renderer/components/Icons'
import { useTheme } from '@renderer/context/ThemeProvider'
import FileItem from '@renderer/pages/files/FileItem'
import QuickPhraseService from '@renderer/services/QuickPhraseService'
import type { QuickPhrase } from '@renderer/types'
import { Button, Flex, Form, Input, Modal, Popconfirm } from 'antd'
import { PlusIcon } from 'lucide-react'
import type { FC } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { SettingContainer, SettingDivider, SettingGroup, SettingRow, SettingTitle } from '.'

const { TextArea } = Input

const QuickPhraseSettings: FC = () => {
  const { t } = useTranslation()
  const [phrasesList, setPhrasesList] = useState<QuickPhrase[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPhrase, setEditingPhrase] = useState<QuickPhrase | null>(null)
  const [dragging, setDragging] = useState(false)
  const [form] = Form.useForm<{ title: string; content: string }>()
  const { theme } = useTheme()

  const loadPhrases = async () => {
    const data = await QuickPhraseService.getAll()
    setPhrasesList(data)
  }

  useEffect(() => {
    void loadPhrases()
  }, [])

  const handleAdd = () => {
    setEditingPhrase(null)
    form.resetFields()
    setIsModalOpen(true)
  }

  const handleEdit = (phrase: QuickPhrase) => {
    setEditingPhrase(phrase)
    form.setFieldsValue({ title: phrase.title, content: phrase.content })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    await QuickPhraseService.delete(id)
    await loadPhrases()
  }

  const handleModalOk = async (values: { title: string; content: string }) => {
    if (editingPhrase) {
      await QuickPhraseService.update(editingPhrase.id, values)
    } else {
      await QuickPhraseService.add(values)
    }
    setIsModalOpen(false)
    form.resetFields()
    await loadPhrases()
  }

  const handleUpdateOrder = async (newPhrases: QuickPhrase[]) => {
    setPhrasesList(newPhrases)
    await QuickPhraseService.updateOrder(newPhrases)
  }

  const reversedPhrases = [...phrasesList].reverse()

  return (
    <SettingContainer theme={theme}>
      <SettingGroup style={{ marginBottom: 0 }} theme={theme}>
        <SettingTitle>
          {t('settings.quickPhrase.title')}
          <Button type="text" icon={<PlusIcon size={18} />} onClick={handleAdd} />
        </SettingTitle>
        <SettingDivider />
        <SettingRow>
          <QuickPhraseList>
            <DraggableList
              list={reversedPhrases}
              onUpdate={(newPhrases) => handleUpdateOrder([...newPhrases].reverse())}
              style={{ paddingBottom: dragging ? '34px' : 0 }}
              onDragStart={() => setDragging(true)}
              onDragEnd={() => setDragging(false)}>
              {(phrase) => (
                <FileItem
                  key={phrase.id}
                  fileInfo={{
                    name: phrase.title,
                    ext: '.txt',
                    extra: phrase.content,
                    actions: (
                      <Flex gap={4} style={{ opacity: 0.6 }}>
                        <Button
                          key="edit"
                          type="text"
                          icon={<EditIcon size={14} />}
                          onClick={() => handleEdit(phrase)}
                        />
                        <Popconfirm
                          title={t('settings.quickPhrase.delete')}
                          description={t('settings.quickPhrase.deleteConfirm')}
                          okText={t('common.confirm')}
                          cancelText={t('common.cancel')}
                          onConfirm={() => handleDelete(phrase.id)}
                          icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}>
                          <Button
                            key="delete"
                            type="text"
                            danger
                            icon={<DeleteIcon size={14} className="lucide-custom" />}
                          />
                        </Popconfirm>
                      </Flex>
                    )
                  }}
                />
              )}
            </DraggableList>
          </QuickPhraseList>
        </SettingRow>
      </SettingGroup>

      <Modal
        title={editingPhrase ? t('settings.quickPhrase.edit') : t('settings.quickPhrase.add')}
        open={isModalOpen}
        onOk={() => form.submit()}
        onCancel={() => {
          setIsModalOpen(false)
          form.resetFields()
        }}
        width={520}
        transitionName="animation-move-down"
        centered
        maskClosable={false}>
        <Form
          form={form}
          layout="vertical"
          requiredMark
          colon={false}
          validateTrigger={['onChange']}
          style={{ marginBottom: 16 }}
          onFinish={handleModalOk}>
          <Form.Item
            name="title"
            label={t('settings.quickPhrase.titleLabel')}
            rules={[{ required: true, message: t('settings.quickPhrase.titleRequired') }]}>
            <Input placeholder={t('settings.quickPhrase.titlePlaceholder')} spellCheck={false} allowClear />
          </Form.Item>
          <Form.Item
            name="content"
            label={t('settings.quickPhrase.contentLabel')}
            rules={[{ required: true, message: t('settings.quickPhrase.contentRequired') }]}>
            <TextArea
              placeholder={t('settings.quickPhrase.contentPlaceholder')}
              spellCheck={false}
              autoSize={{ minRows: 6, maxRows: 10 }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </SettingContainer>
  )
}

const QuickPhraseList = styled.div`
  width: 100%;
  height: calc(100vh - 162px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export default QuickPhraseSettings
