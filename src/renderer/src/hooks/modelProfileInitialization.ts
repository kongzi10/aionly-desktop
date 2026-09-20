import {
  setDefaultModel as setDefaultModelAction,
  setQuickModel as setQuickModelAction,
  setTranslateModel as setTranslateModelAction
} from '@renderer/store/llm'
import type { Model } from '@renderer/types'

type ModelAction =
  | ReturnType<typeof setDefaultModelAction>
  | ReturnType<typeof setQuickModelAction>
  | ReturnType<typeof setTranslateModelAction>
type ModelDispatch = (action: ModelAction) => unknown

export function createCurrentStoreModelSetters(dispatch: ModelDispatch) {
  return {
    setDefaultModel: (model: Model) => dispatch(setDefaultModelAction({ model })),
    setQuickModel: (model: Model) => dispatch(setQuickModelAction({ model })),
    setTranslateModel: (model: Model) => dispatch(setTranslateModelAction({ model }))
  }
}
