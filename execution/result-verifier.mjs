export class ResultVerifier {
  verifyModelResult(result) {
    const text = String(result?.text || '').trim();
    if (!text) throw new Error('模型没有生成可交付结果');
    if (/(?:task[_ -]?id|stack trace|executor|gateway|tool_call|session_id)/i.test(text)) throw new Error('结果包含内部信息');
    return { ok: true, text };
  }
  verifyToolResult(call, verification) {
    if (!verification?.ok) throw new Error('本地工具未通过验证');
    if (call.type === 'read_file' && !verification.summary && !verification.content && !verification.size && !(verification.results || []).some((item) => item.content || item.size)) throw new Error('文件读取结果为空');
    return { ok: true, verification };
  }
  verifyCodeResult({capabilities,execution,workspace,writable,successCriteria}) {
    if(!Array.isArray(capabilities)||!capabilities.length) throw new Error('code能力声明缺失');
    if(!String(execution?.text||'').trim()) throw new Error('code执行没有返回证据');
    if(capabilities.includes('code.read')&&!capabilities.includes('code.modify')&&writable) throw new Error('code.read不得获得写权限');
    if(capabilities.includes('code.modify')&&!writable) throw new Error('code.modify缺少写权限');
    if(!String(workspace||'').trim()) throw new Error('code执行workspace缺失');
    if(!Array.isArray(successCriteria)||!successCriteria.length) throw new Error('code任务缺少验收标准');
    return {ok:true,capabilities,workspace,writable,evidenceText:execution.text};
  }
  verifyCapabilityResult(capabilityId, result) {
    if (!result?.ok) throw new Error(`能力${capabilityId}未执行成功：${result?.reason || 'unknown'}`);
    if (capabilityId === 'runtime.status' && (!String(result.text || '').trim() || !result.evidence?.readAt)) throw new Error('runtime.status缺少实时状态证据');
    if (capabilityId === 'file.read') {
      if (!String(result.content || '') || !result.evidence?.sha256) throw new Error('file.read缺少内容或SHA-256证据');
      if (result.evidence.before?.size !== result.evidence.after?.size || result.evidence.before?.mtimeMs !== result.evidence.after?.mtimeMs || result.evidence.before?.sha256 !== result.evidence.after?.sha256) throw new Error('file.read前后文件证据不一致');
    }
    if (capabilityId === 'process.list' && !Array.isArray(result.processes)) throw new Error('process.list缺少进程快照');
    if (capabilityId === 'process.stop') {
      if (!result.target?.pid) throw new Error('process.stop缺少精确PID证据');
      if (!result.verification?.pidAbsent || result.remaining) throw new Error('process.stop未通过停止后复查');
    }
    return { ok: true, capabilityId, result };
  }
}
