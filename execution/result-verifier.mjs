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
  verifyCapabilityResult(capabilityId, result) {
    if (!result?.ok) throw new Error(`能力${capabilityId}未执行成功：${result?.reason || 'unknown'}`);
    if (capabilityId === 'process.list' && !Array.isArray(result.processes)) throw new Error('process.list缺少进程快照');
    if (capabilityId === 'process.stop') {
      if (!result.target?.pid) throw new Error('process.stop缺少精确PID证据');
      if (!result.verification?.pidAbsent || result.remaining) throw new Error('process.stop未通过停止后复查');
    }
    return { ok: true, capabilityId, result };
  }
}
