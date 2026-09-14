import { loggerService } from '@logger'
import { encryptBase64, encryptWithAes, generateAesKey } from '@renderer/utils/crypt/crypto'
import { encrypt } from '@renderer/utils/crypt/jsencrypt'
import { AxiosCanceler } from '@renderer/utils/helper/axiosCancel'
import { checkStatus } from '@renderer/utils/helper/checkStatus'
import { message } from 'antd'
import axios from 'axios'

const logger = loggerService.withContext('RequestHttp')

const encryptHeader = 'encrypt-key'
const config = {
  // 默认地址请求地址，可在 .env.** 文件中修改
  baseURL: import.meta.env.VITE_API_URL,
  // 设置超时时间
  timeout: 2000000,
  // 跨域时候允许携带凭证
  withCredentials: true,
  // 默认显示错误信息（响应拦截器错误回调）
  showError: true
}

const axiosCanceler = new AxiosCanceler()

class RequestHttp {
  service: any
  constructor(config) {
    // instantiation
    this.service = axios.create(config)

    /**
     * @description 请求拦截器
     * 客户端发送请求 -> [请求拦截器] -> 服务器
     * token校验(JWT) : 接受服务器返回的 token,存储到 vuex/pinia/本地储存当中
     */
    this.service.interceptors.request.use(
      (config) => {
        // 重复请求不需要取消，在 api 服务中通过指定的第三个参数: { cancel: false } 来控制
        config.cancel = config.cancel !== false
        config.cancel && axiosCanceler.addPending(config)
        // console.log("config.loading", config.loading);
        // 当前请求不需要显示 loading，在 api 服务中通过指定的第三个参数: { loading: false } 来控制
        // config.loading = config.loading === false ? config.loading : true;
        // config.loading && showFullScreenLoading();
        // 是否需要设置 token
        const isToken = config.headers?.isToken === false
        // 是否需要加密
        const isEncrypt = config.headers?.isEncrypt === 'true'
        const token = localStorage.getItem('token')
        if (token && !isToken) {
          // config.headers['Authorization'] = 'Bearer ' + useUserStore().getToken();// 让每个请求携带自定义token 请根据实际情况自行修改
          config.headers['Authorization'] = 'Bearer ' + token // 让每个请求携带自定义token 请根据实际情况自行修改
        }
        // clientid 和 hostname 应该在所有请求中都携带
        config.headers['clientid'] = import.meta.env.VITE_APP_CLIENT_ID
        config.headers['hostname'] = window.location.hostname
        if (import.meta.env.VITE_APP_ENCRYPT === 'true') {
          // 当开启参数加密
          if (isEncrypt && (config.method === 'post' || config.method === 'put')) {
            // 生成一个 AES 密钥
            const aesKey = generateAesKey()
            logger.debug('AES key encrypted', { key: encryptBase64(aesKey) })
            config.headers[encryptHeader] = encrypt(encryptBase64(aesKey))
            config.data =
              typeof config.data === 'object'
                ? encryptWithAes(JSON.stringify(config.data), aesKey)
                : encryptWithAes(config.data, aesKey)
          }
        }
        // FormData数据去请求头Content-Type
        if (config.data instanceof FormData) {
          delete config.headers['Content-Type']
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    /**
     * @description 响应拦截器
     *  服务器换返回信息 -> [拦截统一处理] -> 客户端JS获取到信息
     */
    this.service.interceptors.response.use(
      (response) => {
        const { data, config } = response

        axiosCanceler.removePending(config)
        // config.loading && tryHideFullScreenLoading();
        // 登录失效
        if (data.code == '401') {
          // 免登录接口的业务码 401 不是登录态过期，改为 reject 把 msg 交给调用方
          if (config.headers?.isToken === false) {
            logger.warn('response biz code 401 (isToken=false)', { url: config.url, code: data.code, msg: data.msg })
            return Promise.reject(data)
          }
          // 该分支随后 return Promise.resolve()，调用方拿到 undefined，故先落日志便于定位
          logger.warn('response biz code 401', { url: config.url, code: data.code, msg: data.msg })
          localStorage.removeItem('token')
          message.warning('登录过期请重新登录！')
          // 跳转到登录页
          window.location.hash = '/login'
          return Promise.resolve()
        }
        // 全局错误信息拦截（防止下载文件的时候返回数据流，没有 code 直接报错）
        if (data.code && data.code != 200) {
          message.error(data.msg)
          return Promise.reject(data.msg || '系统错误')
        }
        // 成功请求（在页面上除非特殊情况，否则不用处理失败逻辑）
        return data
      },
      async (error) => {
        // console.log("error======>", error);
        const { response, config } = error
        // 请求超时 && 网络错误单独判断，没有 response
        if (error.message.indexOf('timeout') !== -1) {
          message.error('请求超时！请您稍后重试')
        }
        if (error.message.indexOf('Network Error') !== -1) {
          message.error('网络错误！请您稍后重试')
        }
        // 根据服务器响应的错误状态码，做不同的处理
        if (response) checkStatus(response.status, response.data.msg, config.showError)
        // 服务器结果都没有返回(可能服务器错误可能客户端断网)，断网处理:可以跳转到断网页面
        // if (!window.navigator.onLine) router.replace("/500");
        return Promise.reject(error)
      }
    )
  }

  /**
   * @description 常用请求方法封装
   */
  get(url, params, _object = {}) {
    return this.service.get(url, { params, ..._object })
  }
  post(url, params, _object = {}) {
    return this.service.post(url, params, _object)
  }
  put(url, params, _object = {}) {
    return this.service.put(url, params, _object)
  }
  delete(url, params, _object = {}) {
    return this.service.delete(url, { params, ..._object })
  }
  download(url, params, _object = {}) {
    return this.service.post(url, params, { ..._object, responseType: 'blob' })
  }
  /** 表单 POST 下载（与平台端 proxy.download 参数格式一致，如 params[detailByDay]） */
  downloadForm(url, params, _object: any = {}) {
    const body = new URLSearchParams()
    Object.keys(params).forEach((key) => {
      const value = params[key]
      if (value !== null && value !== undefined && value !== '') {
        body.append(key, String(value))
      }
    })
    return this.service.post(url, body, {
      ..._object,
      responseType: 'blob',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ..._object.headers
      }
    })
  }
}

export default new RequestHttp(config)
