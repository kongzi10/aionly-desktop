export const getDefaultEndpointTypeById = (model: any) => {
  const id = (model.baseId || model.model || model.id)?.toLowerCase()
  const { getUpdatedModels } = handleCacheUpdatedModels()
  const updatedModels = getUpdatedModels()
  const matchedModel = updatedModels.find((item: any) => item.id === id)
  if (matchedModel) {
    matchedModel.capabilities = model.capabilities ?? matchedModel.capabilities ?? []
    return matchedModel.endpoint_type ?? 'openai'
  }
  if (id.includes('gemini')) {
    return 'gemini'
  }
  if (id.includes('claude')) {
    return 'anthropic'
  }
  return 'openai'
}

export const handleCacheUpdatedModels = () => {
  const KEY = 'cacheUpdatedModels'

  const getUpdatedModels = () => {
    const str = profileStorage.getItem(KEY)
    return str ? JSON.parse(str) : []
  }

  const setUpdatedModels = (updatedModel: any): void => {
    const updatedModels = getUpdatedModels()
    const existIndex = updatedModels.findIndex((item: any) => item.id === updatedModel?.id)
    if (existIndex === -1) {
      updatedModels.push(updatedModel)
    } else {
      updatedModels[existIndex] = updatedModel
    }
    const value = JSON.stringify(updatedModels)
    profileStorage.setItem(KEY, value)
  }

  return {
    setUpdatedModels,
    getUpdatedModels
  }
}
import { profileStorage } from '@renderer/services/ProfileStorageService'
