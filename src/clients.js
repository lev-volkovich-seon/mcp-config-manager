import path from 'path';
import os from 'os';

export const CLIENTS = {
  claude: {
    name: 'Claude Desktop',
    configPaths: {
      darwin: path.join(os.homedir(), 'Library/Application Support/Claude/claude_desktop_config.json'),
      win32: path.join(process.env.APPDATA || '', 'Claude/claude_desktop_config.json'),
      linux: path.join(os.homedir(), '.config/Claude/claude_desktop_config.json')
    },
    format: 'mcpServers'
  },
  'claude-code': {
    name: 'Claude Code',
    configPaths: {
      darwin: path.join(os.homedir(), '.claude.json'),
      win32: path.join(os.homedir(), '.claude.json'),
      linux: path.join(os.homedir(), '.claude.json')
    },
    format: 'mcpServers'
  },
  vscode: {
    name: 'VS Code',
    configPaths: {
      darwin: '.vscode/mcp.json',
      win32: '.vscode/mcp.json',
      linux: '.vscode/mcp.json'
    },
    format: 'mcp.servers'
  },
  cursor: {
    name: 'Cursor',
    configPaths: {
      darwin: '.cursor/mcp.json',
      win32: '.cursor/mcp.json',
      linux: '.cursor/mcp.json'
    },
    format: 'mcpServers'
  },
  'cursor-global': {
    name: 'Cursor (Global)',
    configPaths: {
      darwin: path.join(os.homedir(), '.cursor/mcp.json'),
      win32: path.join(os.homedir(), '.cursor/mcp.json'),
      linux: path.join(os.homedir(), '.cursor/mcp.json')
    },
    format: 'mcpServers'
  },
  gemini: {
    name: 'Gemini',
    configPaths: {
      darwin: path.join(os.homedir(), '.gemini/settings.json'),
      win32: path.join(os.homedir(), '.gemini/settings.json'),
      linux: path.join(os.homedir(), '.gemini/settings.json')
    },
    format: 'mcpServers'
  },
  windsurf: {
    name: 'Windsurf',
    configPaths: {
      darwin: path.join(os.homedir(), '.codeium/windsurf/mcp_config.json'),
      win32: path.join(process.env.APPDATA || '', 'WindSurf/mcp_settings.json'),
      linux: path.join(os.homedir(), '.codeium/windsurf/mcp_config.json')
    },
    format: 'mcpServers'
  },
  amazonq: {
    name: 'Amazon Q Developer',
    configPaths: {
      darwin: path.join(os.homedir(), '.aws/amazonq/mcp.json'),
      win32: path.join(os.homedir(), '.aws/amazonq/mcp.json'),
      linux: path.join(os.homedir(), '.aws/amazonq/mcp.json')
    },
    format: 'mcpServers'
  },
  codex: {
    name: 'Codex',
    configPaths: {
      darwin: path.join(os.homedir(), '.codex/config.toml'),
      win32: path.join(os.homedir(), '.codex/config.toml'),
      linux: path.join(os.homedir(), '.codex/config.toml')
    },
    format: 'codex'
  },
  '5ire': {
    name: '5ire',
    configPaths: {
      darwin: path.join(os.homedir(), 'Library/Application Support/5ire/mcp.json'),
      win32: path.join(process.env.APPDATA || '', '5ire/mcp.json'),
      linux: path.join(os.homedir(), '.config/5ire/mcp.json')
    },
    format: 'mcpServers'
  },
  'factory-bridge': {
    name: 'Factory Bridge',
    configPaths: {
      darwin: path.join(os.homedir(), 'Library/Application Support/Factory Bridge/mcp.json'),
      win32: path.join(process.env.APPDATA || '', 'Factory Bridge/mcp.json'),
      linux: path.join(os.homedir(), '.config/Factory Bridge/mcp.json')
    },
    format: 'mcpServers'
  },
  cline: {
    name: 'Cline',
    configPaths: {
      darwin: path.join(os.homedir(), 'Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json'),
      win32: path.join(process.env.APPDATA || '', 'Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json'),
      linux: path.join(os.homedir(), '.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json')
    },
    format: 'mcpServers'
  },
  'roo-code': {
    name: 'Roo Code',
    configPaths: {
      darwin: path.join(os.homedir(), 'Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json'),
      win32: path.join(process.env.APPDATA || '', 'Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json'),
      linux: path.join(os.homedir(), '.config/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json')
    },
    format: 'mcpServers'
  }
};