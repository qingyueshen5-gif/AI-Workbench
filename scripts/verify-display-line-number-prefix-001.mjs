import assert from 'node:assert/strict';
export function stripDisplayLineNumberPrefix(line){return String(line).replace(/^\s*\d+\|/,'');}
const contaminated=["1|import fs from 'node:fs/promises';","  27|  const value = 123;","003|\treturn '45';"];
assert.deepEqual(contaminated.map(stripDisplayLineNumberPrefix),["import fs from 'node:fs/promises';","  const value = 123;","\treturn '45';"]);
const valid=["  const value = 123;","const code = '1|literal';","  42 + value;"];
assert.deepEqual(valid.map(stripDisplayLineNumberPrefix),valid);
console.log(JSON.stringify({ok:true,module:'DISPLAY-LINE-NUMBER-PREFIX-MUST-NOT-BE-WRITTEN',detected:3,cleaned:3,falsePositives:0}));
