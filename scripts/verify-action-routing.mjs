import assert from 'node:assert/strict';
import { routeChatAgent } from '../agents/router.mjs';

const cases = [
  ['帮我下载爱奇艺到电脑上', 'hermes'],
  ['帮我看看C盘还剩多少空间', 'hermes'],
  ['帮我打开记事本', 'hermes']
];

for (const [content, expected] of cases) {
  assert.equal(routeChatAgent(content), expected, `${content} routed incorrectly`);
}

console.log(JSON.stringify({ ok: true, cases }, null, 2));
