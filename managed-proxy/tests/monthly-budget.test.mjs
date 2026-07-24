import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from '../../node_modules/typescript/lib/typescript.js';

async function loadWorker() {
  const source = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;
  const dir = mkdtempSync(join(tmpdir(), 'aiw-managed-proxy-test-'));
  const file = join(dir, 'worker.mjs');
  writeFileSync(file, compiled, 'utf8');
  return import(pathToFileURL(file).href);
}

class MockD1 {
  constructor() {
    this.installations = new Map();
    this.revoked = new Set();
    this.dailyUsage = new Map();
    this.monthlyBudget = new Map();
    this.failBudgetWrite = false;
  }

  prepare(sql) {
    return new MockStatement(this, sql);
  }

  dailyKey(date, installationHash, ipHash) {
    return `${date}|${installationHash}|${ipHash}`;
  }

  budgetKey(month, model) {
    return `${month}|${model}`;
  }

  dailyRows(date) {
    return [...this.dailyUsage.values()].filter((row) => row.usage_date === date);
  }
}

class MockStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this.args = [];
  }

  bind(...args) {
    this.args = args;
    return this;
  }

  async first() {
    const sql = this.sql;
    if (sql.includes('FROM daily_usage') && sql.includes('installation_hash = ?')) {
      const [date, installationHash] = this.args;
      const n = this.db.dailyRows(date)
        .filter((row) => row.installation_hash === installationHash)
        .reduce((sum, row) => sum + row.request_count, 0);
      return { n };
    }
    if (sql.includes('FROM daily_usage') && sql.includes('ip_hash = ?')) {
      const [date, ipHash] = this.args;
      const n = this.db.dailyRows(date)
        .filter((row) => row.ip_hash === ipHash)
        .reduce((sum, row) => sum + row.request_count, 0);
      return { n };
    }
    if (sql.includes('SUM(request_count)')) {
      const [date] = this.args;
      const n = this.db.dailyRows(date).reduce((sum, row) => sum + row.request_count, 0);
      return { n };
    }
    if (sql.includes('SUM(input_tokens + output_tokens)')) {
      const [date] = this.args;
      const n = this.db.dailyRows(date).reduce((sum, row) => sum + row.input_tokens + row.output_tokens, 0);
      return { n };
    }
    if (sql.includes('SELECT status FROM installations')) {
      const [installationHash] = this.args;
      const row = this.db.installations.get(installationHash);
      return row ? { status: row.status } : null;
    }
    if (sql.includes('SELECT jti FROM revoked_tokens')) {
      const [jti] = this.args;
      return this.db.revoked.has(jti) ? { jti } : null;
    }
    throw new Error(`Unhandled first SQL: ${sql}`);
  }

  async run() {
    const sql = this.sql;
    if (sql.includes('INSERT INTO installations')) {
      const [installationHash, createdAt, lastSeenAt] = this.args;
      const current = this.db.installations.get(installationHash) || {};
      this.db.installations.set(installationHash, {
        status: current.status || 'active',
        created_at: current.created_at || createdAt,
        last_seen_at: lastSeenAt
      });
      return { meta: { changes: 1 }, changes: 1 };
    }
    if (sql.includes('INSERT INTO daily_usage')) {
      const [date, installationHash, ipHash, inputTokens, outputTokens, updatedAt] = this.args;
      const key = this.db.dailyKey(date, installationHash, ipHash);
      const row = this.db.dailyUsage.get(key) || {
        usage_date: date,
        installation_hash: installationHash,
        ip_hash: ipHash,
        request_count: 0,
        input_tokens: 0,
        output_tokens: 0,
        updated_at: updatedAt
      };
      row.request_count += 1;
      row.input_tokens += Number(inputTokens);
      row.output_tokens += Number(outputTokens);
      row.updated_at = updatedAt;
      this.db.dailyUsage.set(key, row);
      return { meta: { changes: 1 }, changes: 1 };
    }
    if (sql.includes('INSERT OR IGNORE INTO monthly_model_budget')) {
      if (this.db.failBudgetWrite) throw new Error('mock budget insert failure');
      const [month, model, updatedAt] = this.args;
      const key = this.db.budgetKey(month, model);
      if (!this.db.monthlyBudget.has(key)) {
        this.db.monthlyBudget.set(key, {
          month_key: month,
          model,
          reserved_micro_usd: 0,
          call_count: 0,
          updated_at: updatedAt
        });
      }
      return { meta: { changes: 1 }, changes: 1 };
    }
    if (sql.includes('UPDATE monthly_model_budget')) {
      if (this.db.failBudgetWrite) throw new Error('mock budget update failure');
      const [amount, updatedAt, month, model, repeatedAmount, cap] = this.args.map((item) => Number.isFinite(Number(item)) ? Number(item) : item);
      assert.equal(amount, repeatedAmount);
      const key = this.db.budgetKey(month, model);
      const row = this.db.monthlyBudget.get(key);
      if (!row || row.reserved_micro_usd + amount > Number(cap)) {
        return { meta: { changes: 0 }, changes: 0 };
      }
      row.reserved_micro_usd += amount;
      row.call_count += 1;
      row.updated_at = updatedAt;
      return { meta: { changes: 1 }, changes: 1 };
    }
    throw new Error(`Unhandled run SQL: ${sql}`);
  }
}

function baseEnv(overrides = {}) {
  return {
    DB: new MockD1(),
    DEEPSEEK_API_KEY: 'test-key-not-real',
    TOKEN_SIGNING_SECRET: 'local-test-signing-secret',
    INSTALLATION_HASH_SALT: 'local-test-salt',
    ALLOWED_MODELS: 'deepseek-chat',
    MONTHLY_MODEL_HARD_CAP_MICRO_USD: '1000000',
    MODEL_PRICE_CONFIG_JSON: JSON.stringify({
      'deepseek-chat': {
        provider: 'deepseek',
        inputCacheMissMicroUsdPerMillionTokens: 1000000,
        outputMicroUsdPerMillionTokens: 1000000
      }
    }),
    CURRENT_MONTH_OVERRIDE: '2026-07',
    UPSTREAM_TIMEOUT_MS: '20',
    ...overrides
  };
}

async function register(worker, env, installationId = 'installation-local-test-0001') {
  const response = await worker.default.fetch(new Request('https://worker.test/v1/install/register', {
    method: 'POST',
    body: JSON.stringify({ installationId, version: 'test' })
  }), env);
  assert.equal(response.status, 200);
  return response.json();
}

function chatRequest(token, payload) {
  return new Request('https://worker.test/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
}

function payload(content = 'hello', maxTokens = 10, model = 'deepseek-chat') {
  return {
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content }]
  };
}

function reservedAmountFor(payloadObject) {
  const raw = JSON.stringify(payloadObject);
  return Buffer.byteLength(raw, 'utf8') + Number(payloadObject.max_tokens || 2048);
}

test('budget below cap allows mock upstream', async () => {
  const worker = await loadWorker();
  const env = baseEnv();
  const { token } = await register(worker, env);
  let upstreamCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    upstreamCalls += 1;
    return new Response(JSON.stringify({ usage: { completion_tokens: 3 }, choices: [] }), { status: 200 });
  };
  try {
    const response = await worker.default.fetch(chatRequest(token, payload()), env);
    assert.equal(response.status, 200);
    assert.equal(upstreamCalls, 1);
    const row = [...env.DB.monthlyBudget.values()][0];
    assert.equal(row.call_count, 1);
    assert.ok(row.reserved_micro_usd > 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('exact cap allows once and next call is rejected before upstream', async () => {
  const worker = await loadWorker();
  const p = payload();
  const amount = reservedAmountFor(p);
  const env = baseEnv({ MONTHLY_MODEL_HARD_CAP_MICRO_USD: String(amount) });
  const { token } = await register(worker, env);
  let upstreamCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    upstreamCalls += 1;
    return new Response(JSON.stringify({ usage: { completion_tokens: 1 } }), { status: 200 });
  };
  try {
    assert.equal((await worker.default.fetch(chatRequest(token, p), env)).status, 200);
    const rejected = await worker.default.fetch(chatRequest(token, p), env);
    assert.equal(rejected.status, 429);
    assert.equal((await rejected.json()).error.code, 'monthly_budget_exhausted');
    assert.equal(upstreamCalls, 1);
    assert.equal([...env.DB.monthlyBudget.values()][0].reserved_micro_usd, amount);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('concurrent calls cannot reserve over hard cap', async () => {
  const worker = await loadWorker();
  const p = payload();
  const amount = reservedAmountFor(p);
  const env = baseEnv({ MONTHLY_MODEL_HARD_CAP_MICRO_USD: String(amount * 10) });
  const { token } = await register(worker, env);
  let upstreamCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    upstreamCalls += 1;
    return new Response(JSON.stringify({ usage: { completion_tokens: 1 } }), { status: 200 });
  };
  try {
    const responses = await Promise.all(Array.from({ length: 25 }, () => worker.default.fetch(chatRequest(token, p), env)));
    const statuses = responses.map((response) => response.status);
    assert.equal(statuses.filter((status) => status === 200).length, 10);
    assert.equal(statuses.filter((status) => status === 429).length, 15);
    assert.equal(upstreamCalls, 10);
    assert.equal([...env.DB.monthlyBudget.values()][0].reserved_micro_usd, amount * 10);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('upstream timeout and 500 do not refund reservation', async () => {
  const worker = await loadWorker();
  const env = baseEnv();
  const { token } = await register(worker, env);
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      throw new Error('mock timeout');
    };
    assert.equal((await worker.default.fetch(chatRequest(token, payload('timeout')), env)).status, 502);
    const afterTimeout = [...env.DB.monthlyBudget.values()][0].reserved_micro_usd;
    assert.ok(afterTimeout > 0);

    globalThis.fetch = async () => new Response(JSON.stringify({ error: 'mock 500' }), { status: 500 });
    assert.equal((await worker.default.fetch(chatRequest(token, payload('server error')), env)).status, 500);
    const after500 = [...env.DB.monthlyBudget.values()][0].reserved_micro_usd;
    assert.ok(after500 > afterTimeout);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('D1 budget failure and unknown price fail closed before upstream', async () => {
  const worker = await loadWorker();
  const env = baseEnv();
  const { token } = await register(worker, env);
  let upstreamCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    upstreamCalls += 1;
    return new Response('{}', { status: 200 });
  };
  try {
    env.DB.failBudgetWrite = true;
    const d1Failure = await worker.default.fetch(chatRequest(token, payload()), env);
    assert.equal(d1Failure.status, 503);
    assert.equal((await d1Failure.json()).error.code, 'monthly_budget_unavailable');
    assert.equal(upstreamCalls, 0);

    env.DB.failBudgetWrite = false;
    const unknownEnv = baseEnv({ ALLOWED_MODELS: 'unknown-model' });
    const { token: unknownToken } = await register(worker, unknownEnv, 'installation-local-test-0002');
    const missingPrice = await worker.default.fetch(chatRequest(unknownToken, payload('x', 10, 'unknown-model')), unknownEnv);
    assert.equal(missingPrice.status, 503);
    assert.equal((await missingPrice.json()).error.code, 'model_price_unavailable');
    assert.equal(upstreamCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('month switch uses a new ledger row', async () => {
  const worker = await loadWorker();
  const env = baseEnv();
  const { token } = await register(worker, env);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ usage: { completion_tokens: 1 } }), { status: 200 });
  try {
    assert.equal((await worker.default.fetch(chatRequest(token, payload()), env)).status, 200);
    env.CURRENT_MONTH_OVERRIDE = '2026-08';
    assert.equal((await worker.default.fetch(chatRequest(token, payload()), env)).status, 200);
    assert.ok(env.DB.monthlyBudget.has('2026-07|deepseek-chat'));
    assert.ok(env.DB.monthlyBudget.has('2026-08|deepseek-chat'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('multibyte input reserves by UTF-8 request bytes when larger than char estimate', async () => {
  const worker = await loadWorker();
  const p = payload('中文中文中文', 10);
  const env = baseEnv();
  const { token } = await register(worker, env);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ usage: { completion_tokens: 1 } }), { status: 200 });
  try {
    assert.equal((await worker.default.fetch(chatRequest(token, p), env)).status, 200);
    const row = [...env.DB.monthlyBudget.values()][0];
    assert.equal(row.reserved_micro_usd, reservedAmountFor(p));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
