import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import ModelLabelTags, { getLabelPalette } from '../ModelLabelTags'

// 功能开关可变 mock：默认开启，个别用例临时关闭验证一键回滚
const mockFlags = vi.hoisted(() => ({ FEATURE_MODEL_LABEL_TAGS: true }))
vi.mock('@renderer/config/featureFlags', () => mockFlags)

afterEach(() => {
  mockFlags.FEATURE_MODEL_LABEL_TAGS = true
})

describe('ModelLabelTags', () => {
  it('items 为空/未传时不渲染任何内容', () => {
    const { container } = render(<ModelLabelTags />)
    expect(container.firstChild).toBeNull()

    const { container: container2 } = render(<ModelLabelTags items={[]} />)
    expect(container2.firstChild).toBeNull()

    const { container: container3 } = render(<ModelLabelTags items={null} />)
    expect(container3.firstChild).toBeNull()
  })

  it('渲染标签名，多标签横向排列', () => {
    const { getByText } = render(
      <ModelLabelTags
        items={[
          { id: '1', name: '人气模型' },
          { id: '2', name: '最新推荐' }
        ]}
      />
    )
    expect(getByText('人气模型')).toBeInTheDocument()
    expect(getByText('最新推荐')).toBeInTheDocument()
  })

  it('功能开关关闭时不渲染（一键回滚）', () => {
    mockFlags.FEATURE_MODEL_LABEL_TAGS = false
    const { container } = render(<ModelLabelTags items={[{ id: '1', name: '人气模型' }]} />)
    expect(container.firstChild).toBeNull()
  })

  it('style 透传到 pill 元素', () => {
    const { getByText } = render(<ModelLabelTags items={[{ id: '1', name: '人气模型' }]} style={{ marginLeft: 4 }} />)
    expect(getByText('人气模型').style.marginLeft).toBe('4px')
  })

  it('原型中的状态类标签（已弃用/未发布）可正常渲染', () => {
    const { getByText } = render(
      <ModelLabelTags
        items={[
          { id: '5', name: '已弃用' },
          { id: '6', name: '未发布' }
        ]}
      />
    )
    expect(getByText('已弃用')).toBeInTheDocument()
    expect(getByText('未发布')).toBeInTheDocument()
  })
})

describe('getLabelPalette 语义配色', () => {
  it('弃用/下线类标签 → 红色', () => {
    for (const name of ['已弃用', '已下线', '即将下架']) {
      expect(getLabelPalette(name)).toEqual({ border: '#ffccc7', background: '#fff1f0', color: '#cf1322' })
    }
  })

  it('未发布类标签 → 橙色', () => {
    for (const name of ['未发布', '未上线']) {
      expect(getLabelPalette(name)).toEqual({ border: '#ffd591', background: '#fff7e6', color: '#d46b08' })
    }
  })

  it('其余推荐类标签（旗舰模型/最新上架/人气模型/最新推荐）→ 紫色', () => {
    for (const name of ['旗舰模型', '最新上架', '人气模型', '最新推荐']) {
      expect(getLabelPalette(name)).toEqual({ border: '#b37feb', background: '#f9f0ff', color: '#722ed1' })
    }
  })
})
