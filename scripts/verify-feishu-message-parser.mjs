import assert from 'node:assert/strict';
import { parseFeishuMessage } from './workbench-feishu-adapter.mjs';

const base = { message_id: 'om_test', chat_id: 'oc_test' };
const cases = [
  ['A ordinary', { ...base, message_type: 'text', content: JSON.stringify({ text: '你好' }) }, '你好', true],
  ['B multiline', { ...base, message_type: 'text', content: JSON.stringify({ text: '1. 第一步\n2. 第二步\n保持原样' }) }, '1. 第一步\n2. 第二步\n保持原样', true],
  ['C windows path', { ...base, message_type: 'text', content: JSON.stringify({ text: '读取 E:\\AI-Workbench\\NEXT_STEP.md，不要修改。' }) }, '读取 E:\\AI-Workbench\\NEXT_STEP.md，不要修改。', true],
  ['D json string', { ...base, message_type: 'text', content: '{"text":"中文 English **markdown**"}' }, '中文 English **markdown**', true],
  ['E object', { ...base, message_type: 'text', content: { text: '对象内容：保留，标点！' } }, '对象内容：保留，标点！', true],
  ['F rich post', { ...base, message_type: 'post', content: { post: { zh_cn: { title: '任务', content: [[{ tag: 'text', text: '第一行' }, { tag: 'a', text: '链接文字' }], [{ tag: 'text', text: '2. 第二行' }]] } } } }, '任务\n第一行\n链接文字\n2. 第二行', true],
  ['G markdown', { ...base, message_type: 'text', content: { text: '# 标题\n- **重点**\n`E:\\路径\\文件.md`' } }, '# 标题\n- **重点**\n`E:\\路径\\文件.md`', true],
  ['H empty', { ...base, message_type: 'text', content: '{"text":""}' }, '', true],
  ['I unsupported', { ...base, message_type: 'audio', content: { file_key: 'file_x' } }, '', false],
];
const results=[];
for (const [name,message,expected,supported] of cases) {
  const parsed=parseFeishuMessage(message,{ sender_id:{ open_id:'ou_test' }});
  assert.equal(parsed.messageId,'om_test',name);
  assert.equal(parsed.chatId,'oc_test',name);
  assert.equal(parsed.text,expected,name);
  assert.equal(parsed.supported,supported,name);
  results.push({name,ok:true,messageType:parsed.messageType,rawContentType:parsed.rawContentType,text:parsed.text,attachments:parsed.attachments});
}
console.log(JSON.stringify({ok:true,cases:results},null,2));
