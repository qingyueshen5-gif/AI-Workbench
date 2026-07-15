import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dataFile = join(root, 'data', 'workbench.json');
const port = Number(process.env.PORT || 8787);

const initialData = {
  dailyGoals: {},
  messages: [],
  tasks: []
};

async function readData() {
  try {
    const raw = await readFile(dataFile, 'utf8');
    return { ...initialData, ...JSON.parse(raw) };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writeData(initialData);
    return initialData;
  }
}

async function writeData(data) {
  await mkdir(dirname(dataFile), { recursive: true });
  await writeFile(dataFile, JSON.stringify(data, null, 2), 'utf8');
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  response.end(JSON.stringify(payload));
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    response.end();
    return;
  }

  try {
    if (request.url === '/api/data' && request.method === 'GET') {
      sendJson(response, 200, await readData());
      return;
    }

    if (request.url === '/api/data' && request.method === 'PUT') {
      const body = await readBody(request);
      const data = JSON.parse(body || '{}');
      const invalidFailedTask = data.tasks?.find(
        (task) => task.status === '失败' && !task.failureReason?.trim()
      );
      if (invalidFailedTask) {
        sendJson(response, 400, { error: '失败任务必须填写失败原因' });
        return;
      }
      await writeData({ ...initialData, ...data });
      sendJson(response, 200, await readData());
      return;
    }

    sendJson(response, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`API server listening at http://127.0.0.1:${port}`);
});
