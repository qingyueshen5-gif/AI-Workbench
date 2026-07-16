import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const statuses = ['待开始', '进行中', '已完成', '失败'];
const owners = ['GPT', 'Codex', 'Claude', '人工'];
const defaultData = {
  dailyGoals: {},
  messages: [],
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

function App() {
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');

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
    setSaveError('');
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
    return <main className="min-h-screen bg-zinc-100 p-6 text-zinc-800">加载中...</main>;
  }

  const selectedTask = data.tasks.find((task) => task.id === selectedTaskId);

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row">
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-zinc-200">
          <TopBar data={data} />
          {saveError && <div className="mx-5 mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</div>}
          <ChatStream data={data} setData={setData} setSaveError={setSaveError} updateData={updateData} />
        </section>

        <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto lg:w-96">
          <TodayPanel data={data} />
          <TaskPanel
            data={data}
            selectedTask={selectedTask}
            selectedTaskId={selectedTaskId}
            setSelectedTaskId={setSelectedTaskId}
            updateData={updateData}
          />
          <HistoryPanel data={data} />
        </aside>
      </div>
    </main>
  );
}

function mergeData(payload) {
  return {
    ...defaultData,
    ...payload,
    preferences: { ...defaultData.preferences, ...(payload.preferences || {}) },
    modelConnection: { ...defaultData.modelConnection, ...(payload.modelConnection || {}) },
    storage: { ...defaultData.storage, ...(payload.storage || {}) }
  };
}

function TopBar({ data }) {
  const connection = data.modelConnection || defaultData.modelConnection;
  const connected = connection.status === '已连接';
  return (
    <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
      <div>
        <h1 className="text-lg font-semibold">AI Workbench</h1>
        <div className="text-sm text-zinc-500">聊天驱动目标、任务和偏好</div>
      </div>
      <div className={connected ? 'text-right text-sm text-emerald-700' : 'text-right text-sm text-zinc-600'}>
        <div className="font-medium">{connected ? `DeepSeek ${connection.model}` : 'DeepSeek 未连接'}</div>
        {connection.checkedAt && <div className="text-xs text-zinc-500">{timeText(connection.checkedAt)}</div>}
      </div>
    </header>
  );
}

function ChatStream({ data, setData, setSaveError, updateData }) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

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
        body: JSON.stringify({ content })
      });
      const payload = await response.json();
      if (payload.data) setData(mergeData(payload.data));
      if (!response.ok) throw new Error(payload.error || '聊天提炼失败');
      if (payload.warning) setSaveError(payload.warning);
    } catch (error) {
      setSaveError(error.message);
      updateData((current) => ({
        ...current,
        messages: [...current.messages, { id: newId(), role: 'user', content, createdAt: new Date().toISOString() }]
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
      next.messages = current.messages.map((item) =>
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
      return next;
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="mx-auto max-w-3xl space-y-5">
          {data.messages.map((message) => (
            <article key={message.id} className="group">
              <div className="mb-1 text-xs text-zinc-500">{timeText(message.createdAt)}</div>
              <div className="rounded-lg bg-zinc-100 px-4 py-3 text-sm leading-6 text-zinc-900">
                {message.content}
              </div>
              {!!message.extraction?.applied?.length && (
                <ul className="mt-2 space-y-1 text-xs text-emerald-700">
                  {message.extraction.applied.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
              {!!message.extraction?.suggestions?.length && (
                <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
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
            </article>
          ))}
          {!data.messages.length && (
            <div className="py-24 text-center text-sm text-zinc-500">
              直接说今天想做什么，工作台会从聊天里提炼目标、任务和偏好。
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-zinc-200 bg-white p-4">
        <div className="mx-auto flex max-w-3xl gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
            className="min-h-12 flex-1 resize-none rounded-lg border border-zinc-300 px-3 py-3 text-sm outline-none focus:border-zinc-800"
            placeholder="例如：我今天想把登录页面做完，默认负责人是Codex。"
          />
          <button onClick={sendMessage} disabled={sending || !draft.trim()} className="h-12 rounded-lg bg-zinc-900 px-5 text-sm text-white disabled:cursor-not-allowed disabled:bg-zinc-400">
            {sending ? '提炼中' : '发送'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TodayPanel({ data }) {
  const today = todayKey();
  const todayTasks = data.tasks.filter((task) => dateKey(task.createdAt) === today);
  const doneCount = todayTasks.filter((task) => task.status === '已完成').length;
  const progress = todayTasks.length ? Math.round((doneCount / todayTasks.length) * 100) : 0;
  return (
    <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-zinc-200">
      <h2 className="text-sm font-semibold">今日</h2>
      <div className="mt-3 text-sm text-zinc-700">{data.dailyGoals[today] || '还没有从聊天中提炼出今日目标'}</div>
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
    <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-zinc-200">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">任务</h2>
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
              {owners.map((owner) => <option key={owner}>{owner}</option>)}
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
    <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-zinc-200">
      <h2 className="text-sm font-semibold">历史和错误</h2>
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
