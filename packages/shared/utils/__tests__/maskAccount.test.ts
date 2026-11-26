import { describe, expect, it } from 'vitest'

import { maskAccount } from '../maskAccount'

describe('maskAccount', () => {
  it('掩码大陆手机号：前3后4', () => {
    expect(maskAccount('15212347105')).toBe('152****7105')
    expect(maskAccount('13900000001')).toBe('139****0001')
  })

  it('掩码邮箱：前缀前3位 + @域名', () => {
    expect(maskAccount('810123456@qq.com')).toBe('810****@qq.com')
    expect(maskAccount('alice.smith@example.org')).toBe('ali****@example.org')
  })

  it('邮箱前缀不足3位时取1位', () => {
    expect(maskAccount('ab@qq.com')).toBe('a****@qq.com')
    expect(maskAccount('a@qq.com')).toBe('a****@qq.com')
  })

  it('其他用户名：长度>4 取前2后2', () => {
    expect(maskAccount('abcdef')).toBe('ab****ef')
    expect(maskAccount('abcde')).toBe('ab****de')
  })

  it('其他用户名：长度<=4 取首字符 + ***', () => {
    expect(maskAccount('abcd')).toBe('a***')
    expect(maskAccount('ab')).toBe('a***')
    expect(maskAccount('张')).toBe('张***')
  })

  it('空串与空白返回空串', () => {
    expect(maskAccount('')).toBe('')
    expect(maskAccount('   ')).toBe('')
  })

  it('超长用户名不泄露中段', () => {
    const masked = maskAccount('a'.repeat(64))
    expect(masked).toBe('aa****aa')
  })

  it('含非法字符时按用户名兜底规则处理', () => {
    expect(maskAccount('u$er#name!')).toBe('u$****e!')
  })

  it('非1开头的11位数字按用户名兜底', () => {
    expect(maskAccount('25212347105')).toBe('25****05')
  })
})
