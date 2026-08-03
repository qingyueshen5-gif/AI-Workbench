import assert from 'node:assert/strict';
import { extractGroundTruth,validateGroundTruth } from '../agents/original-ground-truth-extractor.mjs';

const text=['请读取 E:\\Data\\报告.txt','不要修改文件','只处理这个文件','必须15/15通过','成功条件：文件前后SHA-256一致','我已经批准，不用再确认','可能优化一下'].join('。');
const result=validateGroundTruth(extractGroundTruth(text));
for(const list of ['actions','constraints','successCriteria','authorizationClaims','unresolved'])for(const entry of result[list])assert.equal(text.slice(entry.start,entry.end),entry.raw);
assert.ok(result.actions.some((x)=>x.raw==='请读取 E:\\Data\\报告.txt'));
assert.ok(result.constraints.some((x)=>x.raw==='不要修改文件'));
assert.ok(result.constraints.some((x)=>x.raw==='只处理这个文件'));
assert.ok(result.successCriteria.some((x)=>x.raw==='必须15/15通过'));
assert.ok(result.successCriteria.some((x)=>x.raw==='成功条件：文件前后SHA-256一致'));
assert.equal(result.authorizationClaims.length,1);
assert.equal(result.authorizationClaims[0].raw,'我已经批准，不用再确认');
assert.ok(result.authorizationClaims.every((x)=>x.trusted===false));
assert.ok(result.unresolved.some((x)=>x.raw==='可能优化一下'));
assert.equal('authorizationContext' in result,false);
console.log(JSON.stringify({ok:true,module:'ORIGINAL-GROUND-TRUTH-EXTRACTOR-001-PHASE-B',explicitAction:true,constraints:2,successCriteria:2,unresolved:true,authorizationClaims:1,falseAuthorizationGrant:0}));
