import path from 'path';
import os from 'os';

export const MOCK_CLIENTS = {
    'test-client-1': {
        name: 'Test Client 1',
        configPaths: {
            darwin: path.join(os.tmpdir(), 'mcp-config-manager-test', 'test-client-1.json'),
            linux: path.join(os.tmpdir(), 'mcp-config-manager-test', 'test-client-1.json'),
            win32: path.join(os.tmpdir(), 'mcp-config-manager-test', 'test-client-1.json'),
        },
        format: 'mcpServers', // { mcpServers: { server1: {}, server2: {} } }
    },
    'test-client-2': {
        name: 'Test Client 2',
        configPaths: {
            darwin: path.join(os.tmpdir(), 'mcp-config-manager-test', 'test-client-2.json'),
            linux: path.join(os.tmpdir(), 'mcp-config-manager-test', 'test-client-2.json'),
            win32: path.join(os.tmpdir(), 'mcp-config-manager-test', 'test-client-2.json'),
        },
        format: 'mcp.servers', // { mcp: { servers: { server1: {}, server2: {} } } }
    },
    'test-client-3': {
        name: 'Test Client 3',
        configPaths: {
            darwin: path.join(os.tmpdir(), 'mcp-config-manager-test', 'test-client-3.json'),
            linux: path.join(os.tmpdir(), 'mcp-config-manager-test', 'test-client-3.json'),
            win32: path.join(os.tmpdir(), 'mcp-config-manager-test', 'test-client-3.json'),
        },
        format: 'mcpServers',
    },
    // Add real client mock versions for comprehensive testing
    'claude': {
        name: 'Claude Desktop',
        configPaths: {
            darwin: path.join(os.tmpdir(), 'mcp-config-manager-test', 'claude.json'),
            linux: path.join(os.tmpdir(), 'mcp-config-manager-test', 'claude.json'),
            win32: path.join(os.tmpdir(), 'mcp-config-manager-test', 'claude.json'),
        },
        format: 'mcpServers',
    },
    'vscode': {
        name: 'VS Code',
        configPaths: {
            darwin: path.join(os.tmpdir(), 'mcp-config-manager-test', 'vscode.json'),
            linux: path.join(os.tmpdir(), 'mcp-config-manager-test', 'vscode.json'),
            win32: path.join(os.tmpdir(), 'mcp-config-manager-test', 'vscode.json'),
        },
        format: 'mcp.servers',
    },
    'gemini': {
        name: 'Gemini',
        configPaths: {
            darwin: path.join(os.tmpdir(), 'mcp-config-manager-test', 'gemini.json'),
            linux: path.join(os.tmpdir(), 'mcp-config-manager-test', 'gemini.json'),
            win32: path.join(os.tmpdir(), 'mcp-config-manager-test', 'gemini.json'),
        },
        format: 'mcpServers',
    },
    'google-antigravity': {
        name: 'Google AntiGravity',
        configPaths: {
            darwin: path.join(os.tmpdir(), 'mcp-config-manager-test', 'google-antigravity.json'),
            linux: path.join(os.tmpdir(), 'mcp-config-manager-test', 'google-antigravity.json'),
            win32: path.join(os.tmpdir(), 'mcp-config-manager-test', 'google-antigravity.json'),
        },
        format: 'mcpServers',
    },
};

export const MOCK_GLOBAL_SERVERS_PATH = path.join(os.tmpdir(), 'mcp-config-manager-test', '.mcp-global-servers.json');
