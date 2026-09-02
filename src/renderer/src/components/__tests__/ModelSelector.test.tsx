import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the imported modules
vi.mock('@renderer/components/Avatar/ModelAvatar', () => ({
  default: ({ model, size }: any) => (
    <div data-testid="model-avatar" style={{ width: size, height: size }}>
      {model.name.charAt(0)}
    </div>
  )
}))

vi.mock('@renderer/utils', () => ({
  matchKeywordsInString: (input: string, target: string) => target.toLowerCase().includes(input.toLowerCase())
}))

// 组件与 useAiOnlyModels hook 都直接依赖该模块，mock 掉避免引入 axios 请求层
vi.mock('@renderer/api/billManagement', () => ({
  selectTokenPlanHourlyDayUsageApi: vi.fn().mockResolvedValue({ rows: [] })
}))

const { cannedModels, remoteModel, getUserEnabledPlanMock } = vi.hoisted(() => {
  const makeModel = (id: string, modelName: string, serviceName: string, group: string) => ({
    id,
    model: id,
    baseId: id,
    modelName,
    name: modelName,
    serviceName,
    group,
    provider: 'aionly',
    packageNum: '先用后付'
  })
  return {
    // 模拟"前端已加载"的分页数据（等价于 mockProviders 中的模型）
    cannedModels: [
      makeModel('text-embedding-ada-002', 'text-embedding-ada-002', 'OpenAI', 'embedding'),
      makeModel('gpt-4.1', 'GPT-4.1', 'OpenAI', 'chat'),
      makeModel('embed-english-v3.0', 'embed-english-v3.0', 'Cohere', 'embedding'),
      makeModel('rerank-english-v2.0', 'rerank-english-v2.0', 'Cohere', 'rerank')
    ],
    // 只存在于服务端、本地未加载的模型
    remoteModel: makeModel('deepseek-v3.1', 'deepseek-v3.1', 'DeepSeek', 'chat'),
    getUserEnabledPlanMock: vi.fn<() => any>(() => null)
  }
})

// Mock useAiOnlyModels hook：getFilteredModels 返回"已加载"的数据
vi.mock('@renderer/hooks/useAiOnlyModels', () => ({
  ModelAttribute: { TextModel: 'text_model', ImageModel: 'image_generation' },
  transformToModel: (item: any) => ({ ...item, id: item.baseId || item.model, name: item.modelName }),
  fetchAiOnlyModelsApi: vi.fn().mockResolvedValue({ models: [], total: 0 }),
  useAiOnlyModels: vi.fn(() => ({
    models: [],
    loading: false,
    setLoading: vi.fn(),
    pageParams: {},
    setPageParams: vi.fn(),
    fetchModels: vi.fn(),
    fetchNextPage: vi.fn(),
    hasMore: false,
    reset: vi.fn(),
    getFilteredModels: vi.fn(() => cannedModels),
    handleScroll: vi.fn()
  }))
}))

vi.mock('@renderer/hooks/useUserTokenPlan', () => ({
  default: () => ({ getUserEnabledPlan: getUserEnabledPlanMock })
}))

vi.mock('@renderer/store', () => ({
  useAppSelector: vi.fn(() => undefined)
}))

vi.mock('@renderer/store/user', () => ({
  selectUserInfo: (state: any) => state?.user?.userInfo,
  setAiOnlyModels: vi.fn()
}))

// Import after mocking
import { fetchAiOnlyModelsApi } from '@renderer/hooks/useAiOnlyModels'
import type { Provider } from '@renderer/types'

import ModelSelector, { modelSelectFilter } from '../ModelSelector'

/** 与 ModelSelector 内部一致的防抖间隔 */
const SEARCH_DEBOUNCE_MS = 300

describe('ModelSelector', () => {
  const mockProviders: Provider[] = [
    {
      id: 'openai',
      name: 'OpenAI',
      type: 'openai',
      apiKey: '123',
      apiHost: 'https://api.openai.com',
      models: []
    },
    {
      id: 'cohere',
      name: 'Cohere',
      type: 'openai',
      apiKey: '123',
      apiHost: 'https://api.cohere.com',
      models: []
    }
  ]

  describe('grouped mode (grouped=true)', () => {
    it('should render grouped options and apply predicate', () => {
      render(<ModelSelector providers={mockProviders} predicate={(model) => model.group === 'embedding'} open />)

      // Check for group labels
      expect(screen.getByText('OpenAI')).toBeInTheDocument()
      expect(screen.getByText('Cohere')).toBeInTheDocument()

      // Check for correct models
      const ada = screen.getByText('text-embedding-ada-002')
      const cohere = screen.getByText('embed-english-v3.0')
      expect(ada).toBeInTheDocument()
      expect(cohere).toBeInTheDocument()

      // Check that filtered models are not present
      expect(screen.queryByText('GPT-4.1')).not.toBeInTheDocument()
      expect(screen.queryByText('rerank-english-v2.0')).not.toBeInTheDocument()
    })

    it('should render model name without provider suffix', () => {
      render(<ModelSelector providers={mockProviders} predicate={(model) => model.group === 'embedding'} open />)

      const ada = screen.getByText('text-embedding-ada-002')
      expect(ada.textContent).toBe('text-embedding-ada-002')
      expect(ada.textContent).not.toContain(' | OpenAI')
    })

    it('should hide avatar when showAvatar is false', () => {
      render(<ModelSelector providers={mockProviders} showAvatar={false} open />)
      expect(screen.queryByTestId('model-avatar')).not.toBeInTheDocument()
    })

    it('should show avatar when showAvatar is true', () => {
      render(<ModelSelector providers={mockProviders} showAvatar={true} open />)
      // 4 models in total from the hook
      expect(screen.getAllByTestId('model-avatar')).toHaveLength(4)
    })
  })

  describe('flat mode (grouped=false)', () => {
    it('should render flat options and apply predicate', () => {
      render(
        <ModelSelector
          providers={mockProviders}
          predicate={(model) => model.group === 'embedding'}
          grouped={false}
          open
        />
      )

      // In flat mode, there are no group labels in the dropdown structure
      expect(document.querySelector('.ant-select-item-option-group')).toBeNull()

      // Check for correct models
      expect(screen.getByText('text-embedding-ada-002')).toBeInTheDocument()
      expect(screen.getByText('embed-english-v3.0')).toBeInTheDocument()

      // Check that filtered models are not present
      expect(screen.queryByText('GPT-4.1')).not.toBeInTheDocument()
      expect(screen.queryByText('rerank-english-v2.0')).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should render no options when apiModels is empty', () => {
      render(<ModelSelector apiModels={[]} autoFetch={false} open />)
      expect(document.querySelector('.ant-select-item-option')).toBeNull()
    })

    it('should fall back to hook models when apiModels is not provided', () => {
      render(<ModelSelector providers={[]} open />)
      expect(screen.getByText('text-embedding-ada-002')).toBeInTheDocument()
    })
  })

  describe('modelSelectFilter function', () => {
    it('should filter by provider name in title', () => {
      const mockOption = {
        title: 'GPT-4.1 | OpenAI',
        value: 'openai-gpt-4.1'
      }
      expect(modelSelectFilter('openai', mockOption)).toBe(true)
    })

    it('should filter by model name in title', () => {
      const mockOption = {
        title: 'embed-english-v3.0 | Cohere',
        value: 'cohere-embed-english-v3.0'
      }
      expect(modelSelectFilter('english', mockOption)).toBe(true)
    })

    it('should filter by value if title is not present', () => {
      const mockOption = {
        value: 'openai-gpt-4.1'
      }
      expect(modelSelectFilter('gpt', mockOption)).toBe(true)
    })

    it('should return false for no match', () => {
      const mockOption = {
        title: 'GPT-4.1 | OpenAI',
        value: 'openai-gpt-4.1'
      }
      expect(modelSelectFilter('nonexistent', mockOption)).toBe(false)
    })
  })

  describe('local search (filterOption)', () => {
    it('should filter locally loaded options when user types in search input', async () => {
      const user = userEvent.setup()
      // 远程搜索接口返回空，验证本地过滤行为
      vi.mocked(fetchAiOnlyModelsApi).mockResolvedValue({ models: [], total: 0 })
      render(<ModelSelector providers={mockProviders} open />)

      // Find the search input field, which is a combobox
      const searchInput = screen.getByRole('combobox')
      await user.type(searchInput, 'embed')

      // After filtering, only embedding models should be visible
      expect(screen.getByText('text-embedding-ada-002')).toBeInTheDocument()
      expect(screen.getByText('embed-english-v3.0')).toBeInTheDocument()

      // Other models should not be visible
      expect(screen.queryByText('GPT-4.1')).not.toBeInTheDocument()
      expect(screen.queryByText('rerank-english-v2.0')).not.toBeInTheDocument()

      // The group titles for visible items should still be there
      expect(screen.getByText('OpenAI')).toBeInTheDocument()
      expect(screen.getByText('Cohere')).toBeInTheDocument()
    })
  })

  describe('remote fuzzy search', () => {
    beforeEach(() => {
      vi.mocked(fetchAiOnlyModelsApi).mockReset()
      vi.mocked(fetchAiOnlyModelsApi).mockResolvedValue({ models: [remoteModel], total: 1 })
    })

    it('should query the server with modelName and display remote-only models', async () => {
      const user = userEvent.setup()
      // 本地只加载了第一条，远程结果里的模型本地没有
      render(<ModelSelector apiModels={cannedModels.slice(0, 1)} autoFetch={false} open />)

      await user.type(screen.getByRole('combobox'), 'deep')

      await waitFor(() => expect(fetchAiOnlyModelsApi).toHaveBeenCalled())
      expect(fetchAiOnlyModelsApi).toHaveBeenCalledWith(expect.objectContaining({ modelName: 'deep' }))

      // 远程独有的模型可以搜到（本地首页里没有）
      expect(await screen.findByText('deepseek-v3.1')).toBeInTheDocument()
      // 未匹配搜索词的本地数据不再展示
      expect(screen.queryByText('text-embedding-ada-002')).not.toBeInTheDocument()
    })

    it('should debounce rapid keystrokes into a single request', async () => {
      const user = userEvent.setup()
      render(<ModelSelector apiModels={cannedModels} autoFetch={false} open />)

      await user.type(screen.getByRole('combobox'), 'deepseek')

      await waitFor(() => expect(fetchAiOnlyModelsApi).toHaveBeenCalled())
      expect(fetchAiOnlyModelsApi).toHaveBeenCalledTimes(1)
      expect(fetchAiOnlyModelsApi).toHaveBeenCalledWith(expect.objectContaining({ modelName: 'deepseek' }))
    })

    it('should restore locally loaded options when keyword is cleared', async () => {
      const user = userEvent.setup()
      render(<ModelSelector apiModels={cannedModels} autoFetch={false} open />)
      const searchInput = screen.getByRole('combobox')

      await user.type(searchInput, 'deep')
      expect(await screen.findByText('deepseek-v3.1')).toBeInTheDocument()

      await user.clear(searchInput)
      expect(await screen.findByText('GPT-4.1')).toBeInTheDocument()
      expect(screen.queryByText('deepseek-v3.1')).not.toBeInTheDocument()
    })

    it('should not trigger remote search for token plan users', async () => {
      getUserEnabledPlanMock.mockReturnValue({ id: 'plan-1', planId: 'p-1' })
      const user = userEvent.setup()
      render(<ModelSelector apiModels={cannedModels} autoFetch={false} open />)

      await user.type(screen.getByRole('combobox'), 'deep')
      // 等过防抖窗口（300ms），确认没有发起远程搜索
      await new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_MS + 100))
      expect(fetchAiOnlyModelsApi).not.toHaveBeenCalled()
    })

    afterEach(() => {
      getUserEnabledPlanMock.mockReset()
      getUserEnabledPlanMock.mockReturnValue(null)
    })
  })
})
