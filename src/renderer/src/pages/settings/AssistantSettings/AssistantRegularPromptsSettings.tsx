import { ExclamationCircleOutlined } from '@ant-design/icons'
import { DraggableList } from '@renderer/components/DraggableList'
import { DeleteIcon, EditIcon } from '@renderer/components/Icons'
import FileItem from '@renderer/pages/files/FileItem'
import type { Assistant, QuickPhrase } from '@renderer/types'
import { Button, Flex, Form, Input, Modal, Popconfirm } from 'antd'
import { PlusIcon } from 'lucide-react'
import type { FC } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'
import { v4 as uuidv4 } from 'uuid'

import { SettingDivider, SettingRow, SettingTitle } from '..'

const { TextArea } = Input

interface AssistantRegularPromptsSettingsProps {
  assistant: Assistant
  updateAssistant: (assistant: Assistant) => void
}

const AssistantRegularPromptsSettings: FC<AssistantRegularPromptsSettingsProps> = ({ assistant, updateAssistant }) => {
  const { t } = useTranslation()
  const [promptsList, setPromptsList] = useState<QuickPhrase[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<QuickPhrase | null>(null)
  const [dragging, setDragging] = useState(false)
  const [form] = Form.useForm<{ title: string; content: string }>()

  useEffect(() => {
    setPromptsList(assistant.regularPhrases || [])
  }, [assistant.regularPhrases])

  const handleAdd = () => {
    setEditingPrompt(null)
    form.resetFields()
    setIsModalOpen(true)
  }

  const handleEdit = (prompt: QuickPhrase) => {
    setEditingPrompt(prompt)
    form.setFieldsValue({ title: prompt.title, content: prompt.content })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    const updatedPrompts = promptsList.filter((prompt) => prompt.id !== id)
    setPromptsList(updatedPrompts)
    updateAssistant({ ...assistant, regularPhrases: updatedPrompts })
  }

  const handleModalOk = async (values: { title: string; content: string }) => {
    let updatedPrompts: QuickPhrase[]
    if (editingPrompt) {
      updatedPrompts = promptsList.map((prompt) => (prompt.id === editingPrompt.id ? { ...prompt, ...values } : prompt))
    } else {
      const newPrompt: QuickPhrase = {
        id: uuidv4(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...values
      }
      updatedPrompts = [...promptsList, newPrompt]
    }
    setPromptsList(updatedPrompts)
    updateAssistant({ ...assistant, regularPhrases: updatedPrompts })
    setIsModalOpen(false)
    form.resetFields()
  }

  const handleUpdateOrder = async (newPrompts: QuickPhrase[]) => {
    setPromptsList(newPrompts)
    updateAssistant({ ...assistant, regularPhrases: newPrompts })
  }

  const reversedPrompts = [...promptsList].reverse()

  return (
    <Container>
      <SettingTitle>
        {t('assistants.settings.regular_phrases.title', 'Regular Prompts')}
        <Button type="text" icon={<PlusIcon size={18} />} onClick={handleAdd} />
      </SettingTitle>
      <SettingDivider />
      <SettingRow>
        <StyledPromptList>
          <DraggableList
            list={reversedPrompts}
            onUpdate={(newPrompts) => handleUpdateOrder([...newPrompts].reverse())}
            style={{ paddingBottom: dragging ? '34px' : 0 }}
            onDragStart={() => setDragging(true)}
            onDragEnd={() => setDragging(false)}>
            {(prompt) => (
              <FileItem
                key={prompt.id}
                fileInfo={{
                  name: prompt.title,
                  ext: '.txt',
                  extra: prompt.content,
                  actions: (
                    <Flex gap={4} style={{ opacity: 0.6 }}>
                      <Button key="edit" type="text" icon={<EditIcon size={14} />} onClick={() => handleEdit(prompt)} />
                      <Popconfirm
                        title={t('assistants.settings.regular_phrases.delete', 'Delete Prompt')}
                        description={t(
                          'assistants.settings.regular_phrases.deleteConfirm',
                          'Are you sure to delete this prompt?'
                        )}
                        okText={t('common.confirm')}
                        cancelText={t('common.cancel')}
                        onConfirm={() => handleDelete(prompt.id)}
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
        </StyledPromptList>
      </SettingRow>

      <Modal
        title={
          editingPrompt
            ? t('assistants.settings.regular_phrases.edit', 'Edit Prompt')
            : t('assistants.settings.regular_phrases.add', 'Add Prompt')
        }
        open={isModalOpen}
        onOk={() => form.submit()}
        onCancel={() => {
          setIsModalOpen(false)
          form.resetFields()
        }}
        width={520}
        transitionName="animation-move-down"
        centered>
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
            label={t('assistants.settings.regular_phrases.titleLabel', 'Title')}
            rules={[
              { required: true, message: t('assistants.settings.regular_phrases.titleRequired', 'Title is required') }
            ]}>
            <Input
              placeholder={t('assistants.settings.regular_phrases.titlePlaceholder', 'Enter title')}
              spellCheck={false}
              allowClear
            />
          </Form.Item>
          <Form.Item
            name="content"
            label={t('assistants.settings.regular_phrases.contentLabel', 'Content')}
            rules={[
              {
                required: true,
                message: t('assistants.settings.regular_phrases.contentRequired', 'Content is required')
              }
            ]}>
            <TextArea
              placeholder={t('assistants.settings.regular_phrases.contentPlaceholder', 'Enter content')}
              spellCheck={false}
              autoSize={{ minRows: 6, maxRows: 10 }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
`

const StyledPromptList = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export default AssistantRegularPromptsSettings
