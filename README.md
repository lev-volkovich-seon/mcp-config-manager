# MCP Config Manager

Simple CLI and web UI tool to manage Model Context Protocol (MCP) configurations across multiple AI clients.

## Features

- **Multi-client support**: Manage configs for Claude, VS Code, Cursor, Windsurf, Gemini, and more
- **Simple CLI**: Command-line interface for quick operations
- **Web UI**: Clean web interface with List and Kanban views
- **Kanban Board**: Drag-and-drop servers between clients
- **JSON Editor**: Edit server configs as raw JSON or using forms
- **Bulk Operations**: Copy servers to multiple clients at once
- **Clipboard Support**: Quick copy server configs to clipboard
- **Cross-platform**: Works on macOS, Windows, and Linux
- **Import/Export**: Share configurations between clients and users
- **Environment variables**: Easily manage API keys and settings

## Installation

```bash
# Clone or download the project
cd mcp-config-manager

# Install dependencies
npm install

# Make CLI globally available (optional)
npm link
```

## Usage

### CLI Commands

```bash
# List all clients and their status
mcp-manager list

# Show servers for a specific client
mcp-manager show claude

# Add a new server
mcp-manager add claude my-server -c npx -a "-y" "@example/server" -e API_KEY=abc123

# Remove a server from one client
mcp-manager remove claude my-server

# Remove a server from ALL clients
mcp-manager remove all my-server

# Copy server between clients
mcp-manager copy claude my-server cursor

# Copy server to ALL other clients
mcp-manager copy claude my-server all

# Manage environment variables
mcp-manager env claude my-server set API_KEY new-value
mcp-manager env claude my-server unset API_KEY
mcp-manager env claude my-server list

# Export/Import configurations
mcp-manager export claude config.json
mcp-manager export claude --server my-server server-config.json
mcp-manager import cursor config.json

# Start web UI
mcp-manager web
# or
npm run web
```

### Web UI

Start the web server:
```bash
npm run web
# or
mcp-manager web --port 3456
```

Then open http://localhost:3456 in your browser.

The web UI provides:
- **List View**: Traditional interface with detailed server management
  - Multi-select checkboxes for bulk delete operations
  - Remove from all clients button for each server
  - Bulk action toolbar with select all/none options
- **Kanban View**: Drag-and-drop servers between clients
  - Full functionality on cards (edit, copy, export, delete)
  - Visual icons for quick actions
  - Drag to copy servers between clients
- **JSON Editor**: Toggle between form and raw JSON editing
- **Multi-select Copy**: Copy servers to multiple clients at once
- **Clipboard Support**: Quick copy server configs with one click
- **Config Path Display**: See where each client's config file is located
- Visual overview of all clients
- Add/edit/delete servers
- Import/export configurations
- Environment variable management

## Supported Clients

- **Claude Desktop**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Claude Code**: `.mcp.json` in project root
- **VS Code**: `.vscode/mcp.json`
- **Cursor**: `.cursor/mcp.json`
- **Windsurf**: `~/.codeium/windsurf/mcp_config.json`
- **Gemini**: `~/.gemini/settings.json`
- **Amazon Q**: `~/.aws/amazonq/mcp.json`

## Configuration Format

Standard MCP server configuration:
```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@example/mcp-server"],
      "env": {
        "API_KEY": "your-key-here"
      }
    }
  }
}
```

## Security Note

Environment variables may contain sensitive data like API keys. The tool masks values containing "KEY" or "SECRET" in the display but stores them in plain text in config files.

## License

MIT