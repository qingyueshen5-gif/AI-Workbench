import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const statuses = ['待开始', '进行中', '已完成', '失败'];
const owners = ['GPT', 'Codex', 'Claude', '人工'];
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
  const [data, setData] = useState({ dailyGoals: {}, messages: [], tasks: [] });
  const [activePage, setActivePage] = useState('home');
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    fetch('/api/data')
      .then((response) => response.json())
      .then((payload) => setData(payload))
      .catch((error) => setSaveError(error.message))
      .finally(() => setLoading(false));
  }, []);

  function updateData(updater) {
    setData((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      fetch('/api/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next)
      })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || '保存失败');
          setSaveError('');
        })
        .catch((error) => {
          setSaveError(error.message);
          setData(current);
        });
      return next;
    });
  }

  if (loading) {
    return <main className="min-h-screen bg-stone-50 p-6 text-zinc-800">加载中...</main>;
  }

  const pages = [
    ['home', '首页'],
    ['chat', '聊天'],
    ['tasks', '任务状态'],
    ['history', '历史记录']
  ];

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-900">
      <div className="mx-auto flex w-full max-w-6xl gap-5 px-5 py-6">
        <aside className="w-36 shrink-0">
          <h1 className="mb-4 text-xl font-semibold">AI Workbench</h1>
          <nav className="space-y-2">
            {pages.map(([id, label]) => (
              <button
                key={id}
                onClick={() => setActivePage(id)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                  activePage === id ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-700 hover:bg-zinc-100'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 flex-1">
          {saveError && <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</div>}
          {activePage === 'home' && <Home data={data} updateData={updateData} />}
          {activePage === 'chat' && <Chat data={data} updateData={updateData} />}
          {activePage === 'tasks' && <Tasks data={data} updateData={updateData} />}
          {activePage === 'history' && <History data={data} />}
        </section>
      </div>
    </main>
  );
}

function Home({ data, updateData }) {
  const today = todayKey();
  const goal = data.dailyGoals[today] || '';
  const todayTasks = data.tasks.filter((task) => dateKey(task.createdAt) === today);
  const doneCount = todayTasks.filter((task) => task.status === '已完成').length;
  const progress = todayTasks.length ? Math.round((doneCount / todayTasks.length) * 100) : 0;
  const [newTask, setNewTask] = useState('');

  function addTask() {
    if (!newTask.trim()) return;
    const task = {
      id: newId(),
      title: newTask.trim(),
      status: '待开始',
      owner: '人工',
      createdAt: new Date().toISOString(),
      notes: '',
      failureReason: ''
    };
    updateData((current) => ({ ...current, tasks: [task, ...current.tasks] }));
    setNewTask('');
  }

  return (
    <div className="space-y-5">
      <section className="bg-white p-5 shadow-sm ring-1 ring-zinc-200">
        <label className="mb-2 block text-sm font-medium text-zinc-600">今天目标</label>
        <input
          value={goal}
          onChange={(event) =>
            updateData((current) => ({
              ...current,
              dailyGoals: { ...current.dailyGoals, [today]: event.target.value }
            }))
          }
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-base outline-none focus:border-zinc-800"
          placeholder="写下一行今天目标"
        />
      </section>

      <section className="bg-white p-5 shadow-sm ring-1 ring-zinc-200">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">今日完成</h2>
          <span className="text-sm text-zinc-600">{doneCount} / {todayTasks.length}，{progress}%</span>
        </div>
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-zinc-200">
          <div className="h-full bg-emerald-600" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex gap-2">
          <input
            value={newTask}
            onChange={(event) => setNewTask(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && addTask()}
            className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-800"
            placeholder="新增今天任务"
          />
          <button onClick={addTask} className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white">添加</button>
        </div>
        <ul className="mt-4 divide-y divide-zinc-200">
          {todayTasks.map((task) => (
            <li key={task.id} className="flex items-center gap-3 py-3">
              <input
                type="checkbox"
                checked={task.status === '已完成'}
                onChange={(event) =>
                  updateData((current) => ({
                    ...current,
                    tasks: current.tasks.map((item) =>
                      item.id === task.id ? { ...item, status: event.target.checked ? '已完成' : '待开始' } : item
                    )
                  }))
                }
                className="h-4 w-4"
              />
              <span className={task.status === '已完成' ? 'text-zinc-400 line-through' : ''}>{task.title}</span>
            </li>
          ))}
          {!todayTasks.length && <li className="py-6 text-sm text-zinc-500">今天还没有任务。</li>}
        </ul>
      </section>
    </div>
  );
}

function Chat({ data, updateData }) {
  const [message, setMessage] = useState('');

  function sendMessage() {
    if (!message.trim()) return;
    const entry = { id: newId(), content: message.trim(), createdAt: new Date().toISOString(), isTask: false, taskId: '' };
    updateData((current) => ({ ...current, messages: [...current.messages, entry] }));
    setMessage('');
  }

  function markAsTask(entry) {
    if (entry.isTask) return;
    const task = {
      id: newId(),
      title: entry.content,
      status: '待开始',
      owner: '人工',
      createdAt: new Date().toISOString(),
      notes: '',
      failureReason: '',
      sourceMessageId: entry.id
    };
    updateData((current) => ({
      ...current,
      messages: current.messages.map((item) => item.id === entry.id ? { ...item, isTask: true, taskId: task.id } : item),
      tasks: [task, ...current.tasks]
    }));
  }

  return (
    <section className="bg-white p-5 shadow-sm ring-1 ring-zinc-200">
      <h2 className="mb-4 text-lg font-semibold">聊天</h2>
      <div className="flex gap-2">
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && sendMessage()}
          className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-800"
          placeholder="输入消息"
        />
        <button onClick={sendMessage} className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white">发送</button>
      </div>
      <ul className="mt-5 space-y-3">
        {data.messages.map((entry) => (
          <li key={entry.id} className="rounded-md border border-zinc-200 p-3">
            <div className="mb-1 text-xs text-zinc-500">{timeText(entry.createdAt)}</div>
            <div className="whitespace-pre-wrap text-sm">{entry.content}</div>
            <button
              onClick={() => markAsTask(entry)}
              disabled={entry.isTask}
              className="mt-3 rounded-md border border-zinc-300 px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
            >
              {entry.isTask ? '已同步到任务列表' : '标记为任务'}
            </button>
          </li>
        ))}
        {!data.messages.length && <li className="py-6 text-sm text-zinc-500">暂无消息。</li>}
      </ul>
    </section>
  );
}

function Tasks({ data, updateData }) {
  const [selectedId, setSelectedId] = useState(data.tasks[0]?.id || '');
  const [failureDraft, setFailureDraft] = useState('');
  const [statusError, setStatusError] = useState('');
  const selected = data.tasks.find((task) => task.id === selectedId);

  useEffect(() => {
    if (!data.tasks.length) {
      setSelectedId('');
      return;
    }
    if (!data.tasks.some((task) => task.id === selectedId)) {
      setSelectedId(data.tasks[0].id);
    }
  }, [data.tasks, selectedId]);

  useEffect(() => {
    setFailureDraft(selected?.failureReason || '');
    setStatusError('');
  }, [selected?.id]);

  function updateTask(id, patch) {
    updateData((current) => ({
      ...current,
      tasks: current.tasks.map((task) => task.id === id ? { ...task, ...patch } : task)
    }));
  }

  function changeStatus(status) {
    if (!selected) return;
    if (status === '失败' && !selected.failureReason?.trim()) {
      setFailureDraft('');
      setStatusError('标记失败前必须填写失败原因。');
      return;
    }
    setStatusError('');
    updateTask(selected.id, { status });
  }

  function saveFailure() {
    if (!selected || !failureDraft.trim()) {
      setStatusError('失败原因不能为空。');
      return;
    }
    setStatusError('');
    updateTask(selected.id, { status: '失败', failureReason: failureDraft.trim() });
    setFailureDraft('');
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="bg-white p-5 shadow-sm ring-1 ring-zinc-200">
        <h2 className="mb-4 text-lg font-semibold">任务列表</h2>
        <ul className="divide-y divide-zinc-200">
          {data.tasks.map((task) => (
            <li key={task.id}>
              <button
                onClick={() => setSelectedId(task.id)}
                className={`flex w-full items-center justify-between gap-3 py-3 text-left ${selectedId === task.id ? 'text-zinc-950' : 'text-zinc-700'}`}
              >
                <span className="min-w-0 truncate">{task.title}</span>
                <span className={`shrink-0 rounded-md px-2 py-1 text-xs ${statusClass(task.status)}`}>{task.status}</span>
              </button>
            </li>
          ))}
          {!data.tasks.length && <li className="py-6 text-sm text-zinc-500">暂无任务。</li>}
        </ul>
      </section>

      <section className="bg-white p-5 shadow-sm ring-1 ring-zinc-200">
        <h2 className="mb-4 text-lg font-semibold">任务详情</h2>
        {selected ? (
          <div className="space-y-4">
            <div>
              <div className="text-sm text-zinc-500">任务</div>
              <div className="mt-1 text-sm">{selected.title}</div>
            </div>
            <label className="block">
              <span className="text-sm text-zinc-500">状态</span>
              <select value={selected.status} onChange={(event) => changeStatus(event.target.value)} className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2">
                {statuses.map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-zinc-500">负责人</span>
              <select value={selected.owner} onChange={(event) => updateTask(selected.id, { owner: event.target.value })} className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2">
                {owners.map((owner) => <option key={owner}>{owner}</option>)}
              </select>
            </label>
            <div>
              <div className="text-sm text-zinc-500">创建时间</div>
              <div className="mt-1 text-sm">{timeText(selected.createdAt)}</div>
            </div>
            <label className="block">
              <span className="text-sm text-zinc-500">备注</span>
              <textarea value={selected.notes || ''} onChange={(event) => updateTask(selected.id, { notes: event.target.value })} className="mt-1 h-24 w-full rounded-md border border-zinc-300 px-3 py-2" />
            </label>
            <label className="block">
              <span className="text-sm text-zinc-500">失败原因</span>
              <textarea
                value={failureDraft}
                onChange={(event) => setFailureDraft(event.target.value)}
                className="mt-1 h-24 w-full rounded-md border border-zinc-300 px-3 py-2"
                placeholder="失败时必填"
              />
            </label>
            {statusError && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{statusError}</div>}
            <button onClick={saveFailure} className="w-full rounded-md bg-red-700 px-4 py-2 text-sm text-white">
              {selected.status === '失败' ? '保存失败原因' : '保存为失败'}
            </button>
          </div>
        ) : (
          <div className="text-sm text-zinc-500">选择一个任务查看详情。</div>
        )}
      </section>
    </div>
  );
}

function History({ data }) {
  const [query, setQuery] = useState('');
  const days = useMemo(() => {
    const keys = new Set(Object.keys(data.dailyGoals));
    data.tasks.forEach((task) => keys.add(dateKey(task.createdAt)));
    return [...keys].sort((a, b) => b.localeCompare(a));
  }, [data]);

  const failedMatches = data.tasks.filter((task) =>
    task.status === '失败' && task.failureReason?.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div className="space-y-5">
      <section className="bg-white p-5 shadow-sm ring-1 ring-zinc-200">
        <h2 className="mb-4 text-lg font-semibold">失败原因搜索</h2>
        <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-800" placeholder="输入关键词" />
        {query.trim() && (
          <ul className="mt-4 divide-y divide-zinc-200">
            {failedMatches.map((task) => (
              <li key={task.id} className="py-3 text-sm">
                <div className="font-medium">{task.title}</div>
                <div className="mt-1 text-zinc-600">{task.failureReason}</div>
              </li>
            ))}
            {!failedMatches.length && <li className="py-4 text-sm text-zinc-500">没有匹配结果。</li>}
          </ul>
        )}
      </section>

      {days.map((day) => {
        const tasks = data.tasks.filter((task) => dateKey(task.createdAt) === day);
        const done = tasks.filter((task) => task.status === '已完成').length;
        return (
          <section key={day} className="bg-white p-5 shadow-sm ring-1 ring-zinc-200">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold">{day}</h3>
              <span className="text-sm text-zinc-600">{done} / {tasks.length}</span>
            </div>
            <div className="mb-3 text-sm text-zinc-700">目标：{data.dailyGoals[day] || '未填写'}</div>
            <ul className="space-y-2">
              {tasks.map((task) => (
                <li key={task.id} className="rounded-md border border-zinc-200 p-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span>{task.title}</span>
                    <span className={`shrink-0 rounded-md px-2 py-1 text-xs ${statusClass(task.status)}`}>{task.status}</span>
                  </div>
                  {task.status === '失败' && <div className="mt-2 text-red-700">失败原因：{task.failureReason}</div>}
                </li>
              ))}
              {!tasks.length && <li className="text-sm text-zinc-500">当天没有任务。</li>}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function statusClass(status) {
  if (status === '已完成') return 'bg-emerald-100 text-emerald-800';
  if (status === '进行中') return 'bg-blue-100 text-blue-800';
  if (status === '失败') return 'bg-red-100 text-red-800';
  return 'bg-zinc-100 text-zinc-700';
}

createRoot(document.getElementById('root')).render(<App />);
