import { spawn } from 'child_process';
import path from 'path';
import * as fs from 'fs/promises';
import { fileURLToPath } from 'url';
import os from 'os';
import { MOCK_CLIENTS, MOCK_GLOBAL_SERVERS_PATH } from './mock-clients.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..');
const SERVER_PATH = path.join(PROJECT_ROOT, 'src', 'server.js');
const TEMP_DIR = path.join(os.tmpdir(), 'mcp-config-manager-test');

let serverProcess;

export async function startServer(port = 3456) {
    return new Promise((resolve, reject) => {
        serverProcess = spawn('node', [SERVER_PATH], {
            env: { ...process.env, PORT: port, MCP_GLOBAL_SERVERS_PATH: MOCK_GLOBAL_SERVERS_PATH },
            cwd: PROJECT_ROOT,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        serverProcess.stdout.on('data', (data) => {
            const output = data.toString();
            // console.log(`Server stdout: ${output}`);
            if (output.includes(`server running on http://localhost:${port}`)) {
                resolve(serverProcess);
            }
        });

        serverProcess.stderr.on('data', (data) => {
            console.error(`Server stderr: ${data.toString()}`);
        });

        serverProcess.on('error', (err) => {
            console.error('Failed to start server process:', err);
            reject(err);
        });

        serverProcess.on('close', (code) => {
            if (code !== 0) {
                console.warn(`Server process exited with code ${code}`);
            }
        });
    });
}

export function stopServer() {
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
    }
}

export async function setupTestEnvironment() {
    await fs.mkdir(TEMP_DIR, { recursive: true });
    // Ensure global servers file is empty or non-existent at start
    await fs.writeFile(MOCK_GLOBAL_SERVERS_PATH, JSON.stringify({}, null, 2));
}

export async function cleanupTestEnvironment() {
    await fs.rm(TEMP_DIR, { recursive: true, force: true });
}

export async function writeMockClientConfig(clientId, config) {
    const clientInfo = MOCK_CLIENTS[clientId];
    if (!clientInfo) {
        throw new Error(`Unknown mock client: ${clientId}`);
    }
    const configPath = clientInfo.configPaths[os.platform()];
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    let finalConfig = {};
    if (clientInfo.format === 'mcpServers') {
        finalConfig = { mcpServers: config.servers };
    } else if (clientInfo.format === 'mcp.servers') {
        finalConfig = { mcp: { servers: config.servers } };
    }
    await fs.writeFile(configPath, JSON.stringify(finalConfig, null, 2));
}

export async function readMockClientConfig(clientId) {
    const clientInfo = MOCK_CLIENTS[clientId];
    if (!clientInfo) {
        throw new Error(`Unknown mock client: ${clientId}`);
    }
    const configPath = clientInfo.configPaths[os.platform()];
    try {
        const content = await fs.readFile(configPath, 'utf-8');
        const parsed = JSON.parse(content);
        if (clientInfo.format === 'mcpServers') {
            return { servers: parsed.mcpServers || {} };
        } else if (clientInfo.format === 'mcp.servers') {
            return { servers: parsed.mcp?.servers || {} };
        }
        return { servers: {} };
    } catch (error) {
        if (error.code === 'ENOENT') {
            return { servers: {} };
        }
        throw error;
    }
}

export async function readMockGlobalServers() {
    try {
        const content = await fs.readFile(MOCK_GLOBAL_SERVERS_PATH, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {};
        }
        throw error;
    }
}
