import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const statuses = ['待开始', '进行中', '已完成', '失败'];
const ownerOptions = [
  { value: 'DeepSeek', label: 'DeepSeek', status: '已接入' },
  { value: '人工', label: '人工', status: '手动' },
  { value: 'Codex', label: 'Codex', status: '未接入' },
  { value: 'GPT', label: 'GPT', status: '未接入' },
  { value: 'Claude', label: 'Claude', status: '未接入' }
];
const internalActionTexts = new Set(['把这条消息同步为任务']);
const defaultData = {
  dailyGoals: {},
  messages: [],
  conversations: [],
  activeConversationId: '',
  tasks: [],
  preferences: {
    defaultOwner: '人工',
    dailyTaskLimit: 5,
    deepSeekModel: 'deepseek-chat',
    communicationStyle: ''
  },
  modelConnection: {
    status: '未连接',
    provider: '',
    model: '',
    checkedAt: ''
  },
  systemErrors: [],
  storage: {
    fileSizeBytes: 0,
    taskCount: 0,
    messageCount: 0,
    historyDayCount: 0,
    systemErrorCount: 0
  }
};

const dateKey = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const todayKey = () => dateKey();
const timeText = (value) => new Date(value).toLocaleString('zh-CN', { hour12: false });
const newId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const createSystemError = (description, operation) => ({
  id: newId(),
  createdAt: new Date().toISOString(),
  description,
  operation
});

function App() {
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    fetch('/api/data')
      .then((response) => response.json())
      .then((payload) => setData(mergeData(payload)))
      .catch((error) => setSaveError(error.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!data.tasks.length) {
      setSelectedTaskId('');
      return;
    }
    if (!selectedTaskId || !data.tasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(data.tasks[0].id);
    }
  }, [data.tasks, selectedTaskId]);

  async function saveData(next) {
    const response = await fetch('/api/data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next)
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || '保存失败');
    setData(mergeData(payload));
    return mergeData(payload);
  }

  function updateData(updater) {
    setData((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      saveData(next).catch((error) => {
        setSaveError(error.message);
        setData(current);
      });
      return next;
    });
  }

  if (loading) {
    return <main className="min-h-screen bg-white p-6 text-zinc-800">加载中...</main>;
  }

  const selectedTask = data.tasks.find((task) => task.id === selectedTaskId);

  return (
    <main className="bg-white text-zinc-950">
      <div className="workbench-shell w-full">
        <ConversationSidebar data={data} updateData={updateData} />

        <section className="chat-main bg-white">
          <TopBar data={data} panelOpen={panelOpen} setPanelOpen={setPanelOpen} />
          {saveError && (
            <div className="mx-5 mt-4 flex items-start justify-between gap-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              <div className="whitespace-pre-wrap">{saveError}</div>
              <button onClick={() => setSaveError('')} className="shrink-0 rounded border border-red-300 px-2 py-0.5 text-xs hover:bg-red-100">
                关闭
              </button>
            </div>
          )}
          <ChatStream data={data} setData={setData} setSaveError={setSaveError} updateData={updateData} />
        </section>

        <RightDrawer
          open={panelOpen}
          setOpen={setPanelOpen}
          data={data}
          selectedTask={selectedTask}
          selectedTaskId={selectedTaskId}
          setSelectedTaskId={setSelectedTaskId}
          updateData={updateData}
        />
      </div>
    </main>
  );
}

function mergeData(payload) {
  const conversations = sanitizeConversations(payload.conversations || []);
  return {
    ...defaultData,
    ...payload,
    conversations,
    activeConversationId: payload.activeConversationId || conversations?.[0]?.id || '',
    messages: getActiveMessages(payload),
    preferences: { ...defaultData.preferences, ...(payload.preferences || {}) },
    modelConnection: { ...defaultData.modelConnection, ...(payload.modelConnection || {}) },
    storage: { ...defaultData.storage, ...(payload.storage || {}) }
  };
}

function sanitizeTitleText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 32);
}

function isInternalActionMessage(message) {
  const content = sanitizeTitleText(message?.content);
  return !content || internalActionTexts.has(content) || message?.isTask === true;
}

function deriveConversationTitle(conversation) {
  const current = sanitizeTitleText(conversation?.title);
  if (current && current !== '新对话' && !internalActionTexts.has(current)) return current;
  const firstUserMessage = (conversation?.messages || []).find((message) =>
    message.role === 'user' && !isInternalActionMessage(message)
  );
  const fallbackUserLikeMessage = (conversation?.messages || []).find((message) => !isInternalActionMessage(message));
  return sanitizeTitleText(firstUserMessage?.content || fallbackUserLikeMessage?.content) || '新对话';
}

function sanitizeConversations(conversations) {
  return (conversations || []).map((conversation) => ({
    ...conversation,
    title: deriveConversationTitle(conversation)
  }));
}

function getActiveConversation(data) {
  return (data.conversations || []).find((conversation) => conversation.id === data.activeConversationId) || data.conversations?.[0];
}

function getActiveMessages(data) {
  return getActiveConversation(data)?.messages || data.messages || [];
}

function ConversationSidebar({ data, updateData }) {
  const [openMenuId, setOpenMenuId] = useState('');
  const conversations = [...(data.conversations || [])].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  const days = [...new Set([
    ...Object.keys(data.dailyGoals),
    ...data.tasks.map((task) => dateKey(task.createdAt))
  ])].sort((a, b) => b.localeCompare(a)).slice(0, 8);

  return (
    <aside className="history-sidebar hidden border-r border-zinc-200 bg-zinc-50 md:flex">
      <div className="flex h-16 items-center justify-between px-4">
        <div>
          <h1 className="text-lg font-semibold">AI Workbench</h1>
          <div className="text-xs text-zinc-500">聊天工作台</div>
        </div>
        <div className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-500">v0.2</div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <button
          onClick={() => {
            const createdAt = new Date().toISOString();
            const conversation = { id: newId(), title: '新对话', createdAt, updatedAt: createdAt, messages: [] };
            updateData((current) => ({
              ...current,
              activeConversationId: conversation.id,
              conversations: [conversation, ...(current.conversations || [])],
              messages: []
            }));
          }}
          className="mb-4 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-left text-sm hover:bg-zinc-100"
        >
          新建对话
        </button>
        <div className="mb-2 px-2 text-xs font-semibold text-zinc-500">Recents</div>
        <div className="space-y-1">
          {conversations.map((conversation) => (
            <div key={conversation.id} className="conversation-row group relative">
              <button
                onClick={() => updateData((current) => ({
                  ...current,
                  activeConversationId: conversation.id,
                  messages: conversation.messages || []
                }))}
                className={`block w-full truncate rounded-md py-2 pl-3 pr-9 text-left text-sm ${conversation.id === data.activeConversationId ? 'bg-zinc-200 text-zinc-950' : 'text-zinc-700 hover:bg-zinc-200'}`}
              >
                {deriveConversationTitle(conversation)}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpenMenuId(openMenuId === conversation.id ? '' : conversation.id);
                }}
                className="conversation-menu-button flex h-7 w-7 items-center justify-center rounded-md text-lg leading-none text-zinc-500 hover:bg-zinc-300"
                aria-label="更多对话操作"
                aria-expanded={openMenuId === conversation.id}
              >
                ⋮
              </button>
              {openMenuId === conversation.id && (
                <div className="absolute right-1 top-9 z-20 w-32 rounded-lg border border-zinc-200 bg-white p-1 text-sm shadow-lg">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      const nextTitle = window.prompt('重命名对话', deriveConversationTitle(conversation));
                      if (!nextTitle?.trim()) return;
                      setOpenMenuId('');
                      updateData((current) => ({
                        ...current,
                        conversations: (current.conversations || []).map((item) =>
                          item.id === conversation.id ? { ...item, title: sanitizeTitleText(nextTitle), updatedAt: new Date().toISOString() } : item
                        )
                      }));
                    }}
                    className="w-full rounded-md px-2 py-1.5 text-left text-zinc-700 hover:bg-zinc-100"
                  >
                    重命名
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenMenuId('');
                      updateData((current) => {
                        const remaining = (current.conversations || []).filter((item) => item.id !== conversation.id);
                        const nextActive = current.activeConversationId === conversation.id
                          ? remaining[0]?.id || ''
                          : current.activeConversationId;
                        const nextConversation = remaining.find((item) => item.id === nextActive);
                        return {
                          ...current,
                          conversations: remaining,
                          activeConversationId: nextActive,
                          messages: nextConversation?.messages || []
                        };
                      });
                    }}
                    className="w-full rounded-md px-2 py-1.5 text-left text-red-700 hover:bg-red-50"
                  >
                    删除
                  </button>
                </div>
              )}
            </div>
          ))}
          {!conversations.length && <div className="px-3 py-6 text-sm text-zinc-500">暂无对话</div>}
        </div>

        {!!days.length && (
          <div className="mt-6">
            <div className="mb-2 px-2 text-xs font-semibold text-zinc-500">History</div>
            <div className="space-y-1">
              {days.map((day) => (
                <button key={day} className="block w-full truncate rounded-md px-3 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-200">
                  {data.dailyGoals[day] || `${day} 的记录`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-zinc-200 p-3 text-xs text-zinc-500">本地优先工作台</div>
    </aside>
  );
}

function TopBar({ data, panelOpen, setPanelOpen }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-100 px-5">
      <div>
        <h1 className="text-base font-semibold">当前对话</h1>
      </div>
      <button
        onClick={() => setPanelOpen(!panelOpen)}
        className="ml-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 text-xl leading-none hover:bg-zinc-100"
        aria-label="打开侧边面板"
      >
        ≡
      </button>
    </header>
  );
}

function RightDrawer({ open, setOpen, data, selectedTask, selectedTaskId, setSelectedTaskId, updateData }) {
  return (
    <>
      {open && <button className="drawer-backdrop" aria-label="关闭侧边面板" onClick={() => setOpen(false)} />}
      <aside className={`drawer-panel ${open ? 'drawer-panel-open' : ''}`}>
        <div className="flex h-16 items-center justify-between border-b border-zinc-200 px-4">
          <h2 className="text-sm font-semibold">工作台侧栏</h2>
          <button onClick={() => setOpen(false)} className="rounded-md border border-zinc-200 px-2 py-1 text-sm hover:bg-zinc-100">关闭</button>
        </div>
        <div className="h-[calc(100vh-4rem)] overflow-y-auto px-4 py-4">
          <section className="border-b border-zinc-200 pb-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">今日和任务</h3>
            <TodayPanel data={data} selectedTaskId={selectedTaskId} setSelectedTaskId={setSelectedTaskId} />
            <div className="mt-4">
              <TaskPanel
                data={data}
                selectedTask={selectedTask}
                selectedTaskId={selectedTaskId}
                setSelectedTaskId={setSelectedTaskId}
                updateData={updateData}
              />
            </div>
          </section>
          <section className="py-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">设置、历史和错误</h3>
            <SettingsPanel data={data} />
            <HistoryPanel data={data} />
          </section>
        </div>
      </aside>
    </>
  );
}

function ChatStream({ data, setData, setSaveError, updateData }) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const messagesRef = useRef(null);
  const messages = getActiveMessages(data);

  useEffect(() => {
    const container = messagesRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }, [data.activeConversationId, messages.length]);

  async function sendMessage() {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setDraft('');
    setSaveError('');
    try {
      const response = await fetch('/api/chat-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, conversationId: data.activeConversationId })
      });
      const payload = await response.json();
      if (payload.data) setData(mergeData(payload.data));
      if (!response.ok) throw new Error(payload.error || '聊天提炼失败');
      if (payload.warning) setSaveError(payload.warning);
    } catch (error) {
      setSaveError(error.message);
      const fallbackMessage = { id: newId(), role: 'user', content, createdAt: new Date().toISOString() };
      const assistantMessage = { id: newId(), role: 'assistant', content: `这次没有处理成功：${error.message}`, createdAt: new Date().toISOString() };
      const errorLog = createSystemError(error.message, '聊天发送');
      updateData((current) => ({
        ...current,
        systemErrors: [errorLog, ...(current.systemErrors || [])],
        messages: [...getActiveMessages(current), fallbackMessage, assistantMessage],
        conversations: (current.conversations || []).map((conversation) =>
          conversation.id === current.activeConversationId
            ? { ...conversation, messages: [...(conversation.messages || []), fallbackMessage, assistantMessage], updatedAt: assistantMessage.createdAt }
            : conversation
        )
      }));
    } finally {
      setSending(false);
    }
  }

  function applySuggestion(message, suggestion) {
    updateData((current) => {
      const today = todayKey();
      const next = { ...current };
      if (suggestion.type === 'goal') {
        next.dailyGoals = { ...current.dailyGoals, [today]: suggestion.text };
      }
      if (suggestion.type === 'task') {
        next.tasks = [{
          id: newId(),
          title: suggestion.text,
          status: '待开始',
          owner: current.preferences.defaultOwner || '人工',
          createdAt: new Date().toISOString(),
          notes: '由用户确认的聊天提炼',
          failureReason: '',
          sourceMessageId: message.id
        }, ...current.tasks];
      }
      if (suggestion.type === 'preference') {
        next.preferences = { ...current.preferences, communicationStyle: suggestion.text };
      }
      const messages = getActiveMessages(current);
      const nextMessages = messages.map((item) =>
        item.id === message.id
          ? {
              ...item,
              extraction: {
                ...item.extraction,
                suggestions: (item.extraction?.suggestions || []).filter((candidate) => candidate !== suggestion),
                applied: [...(item.extraction?.applied || []), `已确认：${suggestion.text}`]
              }
            }
          : item
      );
      next.messages = nextMessages;
      next.conversations = (current.conversations || []).map((conversation) =>
        conversation.id === current.activeConversationId
          ? { ...conversation, messages: nextMessages, updatedAt: new Date().toISOString() }
          : conversation
      );
      return next;
    });
  }

  return (
    <div className="chat-stream">
      <div ref={messagesRef} className="chat-messages px-4">
        <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-end py-8">
          <div className="space-y-6">
          {messages.map((message) => (
            <article key={message.id} className={message.role === 'assistant' ? 'group' : 'group text-right'}>
              <div className={message.role === 'assistant' ? 'mb-1 text-xs text-zinc-400' : 'mb-1 text-right text-xs text-zinc-400'}>{timeText(message.createdAt)}</div>
              <div className={message.role === 'assistant'
                ? 'max-w-[78%] rounded-2xl bg-white px-1 py-2 text-sm leading-6 text-zinc-900'
                : 'ml-auto max-w-[78%] rounded-2xl bg-zinc-100 px-4 py-3 text-sm leading-6 text-zinc-900'}
              >
                {message.content}
              </div>
              {(!!message.extraction?.applied?.length || !!message.extraction?.suggestions?.length) && (
                <div className="ml-auto mt-3 max-w-[78%] text-left text-sm">
                  {!!message.extraction?.applied?.length && (
                    <ul className="space-y-1 text-emerald-700">
                      {message.extraction.applied.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  )}
                  {!!message.extraction?.suggestions?.length && (
                    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                      {message.extraction.suggestions.map((suggestion, index) => (
                        <div key={`${suggestion.type}-${suggestion.text}-${index}`} className="flex items-center justify-between gap-3 py-1">
                          <span className="min-w-0">{suggestion.text}</span>
                          <button onClick={() => applySuggestion(message, suggestion)} className="shrink-0 rounded-md border border-amber-300 px-2 py-1 text-xs hover:bg-amber-100">
                            确认
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </article>
          ))}
          {!messages.length && (
            <div className="pb-24 text-center">
              <div className="text-2xl font-semibold text-zinc-900">今天要推进什么？</div>
              <div className="mt-3 text-sm text-zinc-500">直接输入目标、任务或偏好，工作台会自动提炼。</div>
            </div>
          )}
          </div>
        </div>
      </div>

      <div className="chat-input-area bg-white px-4 pb-5 pt-3">
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-3xl border border-zinc-300 bg-white px-4 py-3 shadow-sm">
          <button type="button" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-xl leading-none text-zinc-600">+</button>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
            className="max-h-32 min-h-8 flex-1 resize-none border-0 bg-transparent px-1 py-1 text-sm leading-6 outline-none"
            placeholder="例如：我今天想把登录页面做完，默认负责人是Codex。"
          />
          <button onClick={sendMessage} disabled={sending || !draft.trim()} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm text-white disabled:cursor-not-allowed disabled:bg-zinc-300">
            {sending ? '…' : '↑'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TodayPanel({ data, selectedTaskId, setSelectedTaskId }) {
  const [expanded, setExpanded] = useState(false);
  const today = todayKey();
  const todayTasks = data.tasks.filter((task) => dateKey(task.createdAt) === today);
  const doneCount = todayTasks.filter((task) => task.status === '已完成').length;
  const progress = todayTasks.length ? Math.round((doneCount / todayTasks.length) * 100) : 0;
  return (
    <section className="border-b border-zinc-200 pb-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">今日</h2>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="mt-3 w-full rounded-md px-2 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100"
      >
        <span className="block font-medium text-zinc-900">{data.dailyGoals[today] || '还没有从聊天中提炼出今日目标'}</span>
        <span className="mt-1 block text-xs text-zinc-500">{expanded ? '收起关联任务' : '查看关联任务'}</span>
      </button>
      {expanded && (
        <div className="mt-2 rounded-lg border border-zinc-200 bg-white p-2">
          {todayTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => setSelectedTaskId(task.id)}
              className={`flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-zinc-100 ${selectedTaskId === task.id ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-700'}`}
            >
              <span className="min-w-0 truncate">{task.title}</span>
              <span className={`shrink-0 rounded-md px-2 py-1 text-xs ${statusClass(task.status)}`}>{task.status}</span>
            </button>
          ))}
          {!todayTasks.length && <div className="px-2 py-3 text-sm text-zinc-500">这个目标下还没有关联任务。</div>}
        </div>
      )}
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-200">
        <div className="h-full bg-emerald-600" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-2 text-xs text-zinc-500">{doneCount} / {todayTasks.length} 已完成</div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-zinc-600">
        <div className="rounded-md bg-zinc-100 p-2">任务 {data.storage.taskCount || data.tasks.length}</div>
        <div className="rounded-md bg-zinc-100 p-2">消息 {data.storage.messageCount || data.messages.length}</div>
        <div className="rounded-md bg-zinc-100 p-2">错误 {data.storage.systemErrorCount || data.systemErrors.length}</div>
      </div>
    </section>
  );
}

function TaskPanel({ data, selectedTask, selectedTaskId, setSelectedTaskId, updateData }) {
  const [failureDraft, setFailureDraft] = useState('');
  const [statusError, setStatusError] = useState('');

  useEffect(() => {
    setFailureDraft(selectedTask?.failureReason || '');
    setStatusError('');
  }, [selectedTask?.id]);

  function updateTask(id, patch) {
    updateData((current) => ({
      ...current,
      tasks: current.tasks.map((task) => task.id === id ? { ...task, ...patch } : task)
    }));
  }

  function changeStatus(status) {
    if (!selectedTask) return;
    if (status === '失败' && !selectedTask.failureReason?.trim()) {
      setStatusError('标记失败前必须填写失败原因。');
      return;
    }
    setStatusError('');
    updateTask(selectedTask.id, { status });
  }

  function saveFailure() {
    if (!selectedTask || !failureDraft.trim()) {
      setStatusError('失败原因不能为空。');
      return;
    }
    setStatusError('');
    updateTask(selectedTask.id, { status: '失败', failureReason: failureDraft.trim() });
  }

  return (
    <section className="border-b border-zinc-200 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">任务</h2>
        <span className="text-xs text-zinc-500">{data.tasks.length} 条</span>
      </div>
      <ul className="max-h-64 divide-y divide-zinc-200 overflow-y-auto">
        {data.tasks.map((task) => (
          <li key={task.id}>
            <button onClick={() => setSelectedTaskId(task.id)} className={`flex w-full items-center justify-between gap-3 py-2 text-left text-sm ${selectedTaskId === task.id ? 'text-zinc-950' : 'text-zinc-600'}`}>
              <span className="min-w-0 truncate">{task.title}</span>
              <span className={`shrink-0 rounded-md px-2 py-1 text-xs ${statusClass(task.status)}`}>{task.status}</span>
            </button>
          </li>
        ))}
        {!data.tasks.length && <li className="py-6 text-sm text-zinc-500">聊天后自动生成任务。</li>}
      </ul>

      {selectedTask && (
        <div className="mt-4 border-t border-zinc-200 pt-4">
          <div className="text-sm font-medium">{selectedTask.title}</div>
          <label className="mt-3 block">
            <span className="text-xs text-zinc-500">状态</span>
            <select value={selectedTask.status} onChange={(event) => changeStatus(event.target.value)} className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm">
              {statuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label className="mt-3 block">
            <span className="text-xs text-zinc-500">负责人</span>
            <select value={selectedTask.owner} onChange={(event) => updateTask(selectedTask.id, { owner: event.target.value })} className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm">
              {ownerOptions.map((owner) => <option key={owner.value} value={owner.value}>{owner.label}（{owner.status}）</option>)}
            </select>
          </label>
          <label className="mt-3 block">
            <span className="text-xs text-zinc-500">备注</span>
            <textarea value={selectedTask.notes || ''} onChange={(event) => updateTask(selectedTask.id, { notes: event.target.value })} className="mt-1 h-20 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
          </label>
          <label className="mt-3 block">
            <span className="text-xs text-zinc-500">失败原因</span>
            <textarea value={failureDraft} onChange={(event) => setFailureDraft(event.target.value)} className="mt-1 h-20 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
          </label>
          {statusError && <div className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{statusError}</div>}
          <button onClick={saveFailure} className="mt-3 w-full rounded-md bg-red-700 px-4 py-2 text-sm text-white">
            {selectedTask.status === '失败' ? '保存失败原因' : '保存为失败'}
          </button>
        </div>
      )}
    </section>
  );
}

function SettingsPanel({ data }) {
  const connection = data.modelConnection || defaultData.modelConnection;
  const connected = connection.status === '已连接';
  return (
    <section className="mb-4 rounded-lg border border-zinc-200 bg-white p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium text-zinc-900">AI 连接</div>
        <span className={connected ? 'text-xs text-emerald-700' : 'text-xs text-zinc-500'}>{connected ? '已连接' : '未连接'}</span>
      </div>
      <div className="mt-2 text-xs leading-5 text-zinc-500">
        {connected ? `${connection.provider || 'DeepSeek'} ${connection.model || data.preferences.deepSeekModel}` : 'DeepSeek 暂未连接'}
        {connection.checkedAt ? ` · ${timeText(connection.checkedAt)}` : ''}
      </div>
      <div className="mt-2 text-xs leading-5 text-zinc-500">本地项目路径已隐藏，仅用于本机数据保存。</div>
    </section>
  );
}

function HistoryPanel({ data }) {
  const [query, setQuery] = useState('');
  const keyword = query.trim().toLowerCase();
  const failedMatches = data.tasks.filter((task) =>
    keyword && task.status === '失败' && task.failureReason?.toLowerCase().includes(keyword)
  );
  const systemErrorMatches = (data.systemErrors || []).filter((error) => {
    const text = `${error.description || ''} ${error.operation || ''}`.toLowerCase();
    return keyword && text.includes(keyword);
  });
  const days = useMemo(() => {
    const keys = new Set(Object.keys(data.dailyGoals));
    data.tasks.forEach((task) => keys.add(dateKey(task.createdAt)));
    return [...keys].sort((a, b) => b.localeCompare(a)).slice(0, 8);
  }, [data]);

  return (
    <section className="py-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">历史和错误</h2>
      <input value={query} onChange={(event) => setQuery(event.target.value)} className="mt-3 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-800" placeholder="搜索失败原因或系统错误" />
      {keyword && (
        <div className="mt-3 space-y-2 text-sm">
          {[...failedMatches.map((task) => ({ id: task.id, title: task.title, detail: task.failureReason })), ...systemErrorMatches.map((error) => ({ id: error.id, title: error.operation, detail: error.description }))].map((item) => (
            <div key={item.id} className="rounded-md bg-zinc-100 p-2">
              <div className="font-medium">{item.title}</div>
              <div className="mt-1 text-zinc-600">{item.detail}</div>
            </div>
          ))}
          {!failedMatches.length && !systemErrorMatches.length && <div className="text-zinc-500">没有匹配结果。</div>}
        </div>
      )}
      <div className="mt-4 space-y-3">
        {days.map((day) => {
          const tasks = data.tasks.filter((task) => dateKey(task.createdAt) === day);
          return (
            <div key={day} className="border-t border-zinc-200 pt-3 text-sm">
              <div className="font-medium">{day}</div>
              <div className="mt-1 text-zinc-600">{data.dailyGoals[day] || '未填写目标'}</div>
              <div className="mt-1 text-xs text-zinc-500">{tasks.length} 个任务</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function statusClass(status) {
  if (status === '已完成') return 'bg-emerald-100 text-emerald-800';
  if (status === '进行中') return 'bg-sky-100 text-sky-800';
  if (status === '失败') return 'bg-red-100 text-red-800';
  return 'bg-zinc-100 text-zinc-700';
}

createRoot(document.getElementById('root')).render(<App />);
