import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { runtimeRoot } from '../runtime-paths.mjs';

const defaultRoot = process.env.AIW_CONVERSATION_DIR || join(runtimeRoot, 'feishu-workbench-bridge', 'conversations');
const now = () => new Date().toISOString();
const key = (id) => createHash('sha256').update(String(id || 'unknown')).digest('hex').slice(0, 24);

export class SessionStore {
  constructor(options = {}) { this.root = options.root || defaultRoot; this.cache = new Map(); }
  path(id) { return join(this.root, `${key(id)}.json`); }
  async load(conversationId, userId = '') {
    if (this.cache.has(conversationId)) return this.cache.get(conversationId);
    let state;
    try { state = JSON.parse(await fs.readFile(this.path(conversationId), 'utf8')); }
    catch { state = { schemaVersion: '1.0', conversationId, userId, originalMessages: [], createdAt: now(), updatedAt: now() }; }
    this.cache.set(conversationId, state);
    return state;
  }
  async save(state) {
    state.updatedAt = now();
    await fs.mkdir(dirname(this.path(state.conversationId)), { recursive: true });
    const tmp = `${this.path(state.conversationId)}.${process.pid}.tmp`;
    await fs.writeFile(tmp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    await fs.rename(tmp, this.path(state.conversationId));
    this.cache.set(state.conversationId, state);
    return state;
  }
  async appendMessage(state, message) {
    state.originalMessages = [...(state.originalMessages || []), { at: now(), ...message }].slice(-200);
    return this.save(state);
  }
  async history(conversationId, limit = 20) { return (await this.load(conversationId)).originalMessages.slice(-limit); }
}
