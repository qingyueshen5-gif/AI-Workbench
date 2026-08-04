import { ALL_SERVER_OWNED_RUN_PATHS } from './server-owned-run-paths.js';

function clonePlainValue(value) {
  if (Array.isArray(value)) return value.map(clonePlainValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clonePlainValue(child)]));
  }
  return value;
}

function deleteProtocolPath(target, path) {
  const segments = path.split('.');
  let parent = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    if (!parent || typeof parent !== 'object' || Array.isArray(parent)) return;
    parent = parent[segments[index]];
  }
  if (parent && typeof parent === 'object' && !Array.isArray(parent)) delete parent[segments.at(-1)];
}

export function toWritableRunDto(run) {
  if (!run || typeof run !== 'object' || Array.isArray(run)) return run;
  const writable = clonePlainValue(run);
  for (const path of ALL_SERVER_OWNED_RUN_PATHS) deleteProtocolPath(writable, path);
  return writable;
}

export function toWritableDataDto(data) {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) return data.map(clonePlainValue);
  if (typeof data !== 'object') return data;
  const writable = clonePlainValue(data);
  if (Array.isArray(data.runs)) writable.runs = data.runs.map(toWritableRunDto);
  return writable;
}
