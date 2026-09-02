import type { PayloadAction } from '@reduxjs/toolkit'
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
// import webLogo from "@/assets/images/login/webLogo.png";
import { getIndentCountList } from '@renderer/api/order'
import logo from '@renderer/assets/images/logo.png'
import type { Model } from '@renderer/types'

interface UserInfo {
  payPasswordFlag?: unknown
  payPassword?: unknown
  [key: string]: unknown
}

interface UserState {
  token: string
  userInfo: UserInfo
  myBalance: string
  indentCount: Record<string, unknown>
  wdCount: string
  logoUrl: string
  // webUrl: string;
  serviceInfo: Record<string, unknown>
  apiKey: string
  aiOnlyModels: Model[]
}

const initialState: UserState = {
  token: localStorage.getItem('token') || '',
  userInfo: {},
  myBalance: '',
  indentCount: {},
  wdCount: '',
  logoUrl: logo,
  apiKey: '',
  aiOnlyModels: [],
  // webUrl: webLogo,
  serviceInfo: {}
}

export const fetchIndentCountList = createAsyncThunk('user/fetchIndentCountList', async () => {
  const res = await getIndentCountList()
  return res.data
})

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setToken(state, action: PayloadAction<string>) {
      state.token = action.payload
      if (action.payload) {
        localStorage.setItem('token', action.payload)
      } else {
        localStorage.removeItem('token')
      }
    },
    clearToken(state) {
      state.token = ''
      localStorage.removeItem('token')
    },
    setMyBalance(state, action: PayloadAction<string>) {
      state.myBalance = action.payload
    },
    setUserInfo(state, action: PayloadAction<UserInfo>) {
      state.userInfo = action.payload
    },
    setLogoUrl(state, action: PayloadAction<{ logoUrl: string; webUrl: string } | null>) {
      if (action.payload) {
        state.logoUrl = action.payload.logoUrl
        // state.webUrl = action.payload.webUrl;
      } else {
        state.logoUrl = logo
        // state.webUrl = webLogo;
      }
    },
    setPassWord(state, action: PayloadAction<{ payPasswordFlag: unknown; payPassword: unknown }>) {
      state.userInfo.payPasswordFlag = action.payload.payPasswordFlag
      state.userInfo.payPassword = action.payload.payPassword
    },
    setServiceInfo(state, action: PayloadAction<Record<string, unknown>>) {
      state.serviceInfo = action.payload
      localStorage.setItem('serviceInfo', JSON.stringify(action.payload))
    },
    setApiKey(state, action: PayloadAction<string>) {
      state.apiKey = action.payload
    },
    setAiOnlyModels(state, action: PayloadAction<Model[]>) {
      state.aiOnlyModels = action.payload
    }
  },
  extraReducers: (builder) => {
    builder.addCase(fetchIndentCountList.fulfilled, (state, action) => {
      state.indentCount = action.payload
    })
  }
})

export const {
  setToken,
  clearToken,
  setMyBalance,
  setUserInfo,
  setLogoUrl,
  setPassWord,
  setServiceInfo,
  setApiKey,
  setAiOnlyModels
} = userSlice.actions

export const selectToken = (state: { user: UserState }) => state.user.token || localStorage.getItem('token') || ''
export const selectUserInfo = (state: { user: UserState }) => state.user.userInfo
export const selectMyBalance = (state: { user: UserState }) => state.user.myBalance
export const selectServiceInfo = (state: { user: UserState }) => state.user.serviceInfo
export const selectIndentCount = (state: { user: UserState }) => state.user.indentCount
export const selectAiOnlyModels = (state: { user: UserState }) => state.user.aiOnlyModels
export const selectApiKey = (state: { user: UserState }) => state.user.apiKey

export default userSlice.reducer
