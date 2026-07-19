export function ownerFromAgentId(agentId) {
  if (agentId === 'deepseek') return 'DeepSeek';
  if (agentId === 'hermes') return 'Hermes';
  if (agentId === 'openclaw') return 'OpenClaw';
  return '人工';
}

export function isActionIntent(content) {
  const raw = String(content || '').trim();
  const text = raw.toLowerCase();
  if (!raw) return false;
  if (/^(什么是|为什么|怎么理解|解释一下|介绍一下|总结一下|翻译|写一段|生成一段|给我讲讲)/.test(raw)) return false;
  if (/[a-z0-9.-]+\.(com|cn|net|org|io|dev|app|ai|top|xyz)\b/i.test(raw)) return true;
  if (/https?:\/\//i.test(raw)) return true;
  if (/帮我|替我|给我|请.*(打开|下载|安装|运行|执行|查看|看看|查|清理|删除|创建|新建|复制|移动|粘贴|启动|关闭|访问|进入|登录|点击|搜索|修复|配置|测试|检测|体检|截图|录屏|发送|保存|导出|解压|压缩)/.test(raw)) return true;
  if (/(打开|下载|安装|运行|执行|查看|看看|查|清理|删除|创建|新建|复制|移动|粘贴|启动|关闭|访问|进入|登录|点击|搜索|修复|配置|测试|检测|体检|截图|录屏|发送|保存|导出|解压|压缩).*(电脑|本机|系统|C盘|c盘|磁盘|文件|文件夹|目录|应用|软件|程序|浏览器|网页|页面|网站|端口|进程|服务|网络|代理|桌面|开始菜单|回收站|缓存|临时文件|终端|命令行|powershell|cmd|设置|下载文件夹)/i.test(raw)) return true;
  if (/(电脑|本机|系统|C盘|c盘|磁盘|文件|文件夹|目录|应用|软件|程序|浏览器|网页|页面|网站|端口|进程|服务|网络|代理|桌面|开始菜单|回收站|缓存|临时文件|终端|命令行|powershell|cmd|设置|下载文件夹).*(打开|下载|安装|运行|执行|查看|看看|查|清理|删除|创建|新建|复制|移动|粘贴|启动|关闭|访问|进入|登录|点击|搜索|修复|配置|测试|检测|体检|截图|录屏|发送|保存|导出|解压|压缩)/i.test(raw)) return true;
  return /^(打开|下载|安装|运行|执行|查看|看看|清理|删除|创建|新建|启动|关闭|访问|进入|修复|检测|体检)\b/i.test(text);
}

export function isBrowserActionIntent(content) {
  const raw = String(content || '').trim();
  return isActionIntent(raw) && (/浏览器|网页|页面|网站|网址|链接|github|https?:\/\//i.test(raw) || /[a-z0-9.-]+\.(com|cn|net|org|io|dev|app|ai|top|xyz)\b/i.test(raw));
}

export function routeChatAgent(content) {
  const text = String(content || '').toLowerCase();
  if (text.includes('openclaw') || /点击|录屏|截图|手机|飞书|微信|telegram|discord|slack|频道|gateway|长任务|编排|多员工|多agent|多 agent/.test(content)) {
    return 'openclaw';
  }
  if (text.includes('hermes') || isActionIntent(content)) {
    return 'hermes';
  }
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
