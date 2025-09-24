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
};

export const MOCK_GLOBAL_SERVERS_PATH = path.join(os.tmpdir(), 'mcp-config-manager-test', '.mcp-global-servers.json');
