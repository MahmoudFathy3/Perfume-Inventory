import assert from 'node:assert/strict'
import test from 'node:test'
import { whatsappPhone } from '../lib/phone'

test('رقم واتساب: المصري المحلي بياخد كود 20، والدولي زي ما هو، والعربي بيتحوّل', () => {
  assert.equal(whatsappPhone('01012345678'), '201012345678')
  assert.equal(whatsappPhone('010 1234-5678'), '201012345678', 'المسافات والشرَط بتتشال')
  assert.equal(whatsappPhone('٠١٠١٢٣٤٥٦٧٨'), '201012345678', 'أرقام عربي')
  assert.equal(whatsappPhone('+201012345678'), '201012345678')
  assert.equal(whatsappPhone('00966501234567'), '966501234567', 'سعودي بالكود الدولي')
  assert.equal(whatsappPhone('201012345678'), '201012345678', 'مكتوب بالكود من غير +')
  assert.equal(whatsappPhone(''), null)
  assert.equal(whatsappPhone(null), null)
  assert.equal(whatsappPhone('123'), null, 'قصير قوي')
})
