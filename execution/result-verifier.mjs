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
}
