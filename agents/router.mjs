export function ownerFromAgentId(agentId) {
  if (agentId === 'deepseek') return 'DeepSeek';
  if (agentId === 'hermes') return 'Hermes';
  if (agentId === 'openclaw') return 'OpenClaw';
  return '人工';
}

export function isActionIntent(content) {
  return /下载|安装|打开|启动|运行|执行|操作电脑|帮我弄|帮我处理|修复环境|解决环境|看一下.*空间|看看.*空间|磁盘.*空间|剩余空间|查.*空间|清理|配置|卸载|创建文件|读取文件|移动文件|复制文件/.test(String(content || ''));
}

export function routeChatAgent(content) {
  const text = String(content || '').toLowerCase();
  if (
    text.includes('openclaw') ||
    /浏览器|网页自动化|打开网页|点击|录屏|截图|手机|飞书|微信|telegram|discord|slack|频道|gateway|长任务|编排|多员工|多agent|多 agent/.test(content)
  ) {
    return 'openclaw';
  }
  if (
    text.includes('hermes') ||
    (text.includes('current_task.md') && /读|读取|总结|待办/.test(content)) ||
    /c盘|c 盘|磁盘|剩余空间|命令|终端|powershell|cmd|环境变量|端口|进程|服务|文件存在|安装成功|下载|安装|打开|启动|查看|清理|卸载/.test(content)
  ) {
    return 'hermes';
  }
  if (isActionIntent(content)) return 'hermes';
  return 'deepseek';
}

export function progressReplyForAgent(agentId) {
  const name = ownerFromAgentId(agentId);
  if (agentId === 'hermes') {
    return `好的，我让 ${name} 去执行了。它会先跑命令拿证据，完成后我会把结果和关键数字直接告诉你。`;
  }
  if (agentId === 'openclaw') {
    return `好的，我让 ${name} 去操作电脑了。这个任务可能需要几分钟，完成后我会用安装路径、窗口状态或其他证据汇报结果。`;
  }
  return '我先理解你的需求，再给出回复。';
}
