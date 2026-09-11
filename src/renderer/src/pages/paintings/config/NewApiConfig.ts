import type { GeneratePainting } from '@renderer/types'
import { uuid } from '@renderer/utils'

export const SUPPORTED_MODELS = ['gpt-image-1']

// 要求 size 为 width*height 格式的模型（如阿里百炼/通义系）；其余模型（gpt-image、豆包等）使用 widthxheight
const STAR_SIZE_MODEL_KEYWORDS = ['qwen-image', 'wanx', 'tongyi']

// 豆包/Seedream 系要求总像素 >= 3686400（1920x1920），小于该值的尺寸等比放大
const MIN_PIXEL_MODEL_KEYWORDS = ['doubao', 'seedream']
const MIN_TOTAL_PIXELS = 3686400

export const formatSizeForModel = (model: string, size?: string) => {
  if (!size || size === 'auto') return undefined
  const [width, height] = size.toLowerCase().split('x').map(Number)
  if (Number.isNaN(width) || Number.isNaN(height)) return size
  if (
    MIN_PIXEL_MODEL_KEYWORDS.some((keyword) => model.toLowerCase().includes(keyword)) &&
    width * height < MIN_TOTAL_PIXELS
  ) {
    const scale = Math.sqrt(MIN_TOTAL_PIXELS / (width * height))
    const scaledWidth = Math.ceil((width * scale) / 32) * 32
    const scaledHeight = Math.ceil((height * scale) / 32) * 32
    return STAR_SIZE_MODEL_KEYWORDS.some((keyword) => model.toLowerCase().includes(keyword))
      ? `${scaledWidth}*${scaledHeight}`
      : `${scaledWidth}x${scaledHeight}`
  }
  return STAR_SIZE_MODEL_KEYWORDS.some((keyword) => model.toLowerCase().includes(keyword))
    ? size.replace('x', '*')
    : size
}

export const MODELS = [
  {
    name: 'gpt-image-1',
    group: 'OpenAI',
    imageSizes: [{ value: 'auto' }, { value: '1024x1024' }, { value: '1536x1024' }, { value: '1024x1536' }],
    max_images: 10,
    quality: [{ value: 'auto' }, { value: 'high' }, { value: 'medium' }, { value: 'low' }],
    moderation: [{ value: 'auto' }, { value: 'low' }],
    output_compression_format: [{ value: 'jpeg' }, { value: 'webp' }],
    output_format: [{ value: 'image/png' }, { value: 'image/jpeg' }, { value: 'image/webp' }],
    background: [{ value: 'auto' }, { value: 'transparent' }, { value: 'opaque' }]
  }
]

export const DEFAULT_PAINTING: GeneratePainting = {
  id: uuid(),
  urls: [],
  files: [],
  model: '',
  prompt: '',
  quality: 'auto',
  n: 1,
  background: 'auto',
  moderation: 'auto',
  size: 'auto'
}
