# UI Test Suite Documentation

This document describes the comprehensive UI test suite for MCP Config Manager.

## Test Files Overview

### 1. `ui-simple.test.js`
Basic UI functionality tests using Playwright.
- **Tests**: 2
- **Purpose**: Verify basic page loading and API connectivity
- **Runtime**: ~5 seconds

### 2. `ui-playwright.test.js`
Extended UI tests with more functionality.
- **Tests**: 3
- **Purpose**: Client display, modal opening
- **Runtime**: ~15 seconds

### 3. `ui-comprehensive-views.test.js` ⭐ NEW
Complete test suite covering all three views (List, Kanban, Server).
- **Tests**: 25+ comprehensive tests
- **Purpose**: Full functionality testing across all views
- **Runtime**: ~2-3 minutes

### 4. `ui-advanced-modals.test.js` ⭐ NEW
Advanced modal functionality and environment variable operations.
- **Tests**: 15+ detailed modal tests
- **Purpose**: Deep testing of forms, JSON editing, validation
- **Runtime**: ~2-3 minutes

### 5. `ui-basic-verification.test.js` ⭐ NEW
Quick verification test for development.
- **Tests**: 4 basic tests
- **Purpose**: Fast verification that UI setup works
- **Runtime**: ~10 seconds

## Test Coverage

### List View Tests
- ✅ Client display with server counts
- ✅ Client sorting (name/server count, asc/desc)
- ✅ Sort persistence across page refreshes
- ✅ Welcome view → Client view transitions
- ✅ Server list display with environment variables
- ✅ Bulk server operations (select all, deselect all, delete selected)
- ✅ Server editing (form mode and JSON mode)
- ✅ Data synchronization between form and JSON tabs
- ✅ Environment variable management (add/remove/copy)
- ✅ Server operations (copy, export, delete)

### Kanban View Tests
- ✅ Kanban columns for all clients
- ✅ Draggable server cards with consistent colors
- ✅ Server card color generation based on name hash
- ✅ Kanban sorting persistence
- ✅ Add server from kanban columns
- ✅ Server actions on kanban cards (edit/copy/export/delete)
- ✅ Drag and drop operations (structure verification)

### Server View Tests
- ✅ All servers display across clients
- ✅ Client associations for each server
- ✅ Edit server from server view
- ✅ "Add to More Clients" modal
- ✅ Copy server configuration to clipboard
- ✅ Delete server from all clients
- ✅ Server environment variable editing

### Modal Functionality Tests
- ✅ Add server using form mode with multiple environment variables
- ✅ Add server using JSON mode
- ✅ Form validation with error messages
- ✅ JSON validation with error handling
- ✅ Empty JSON object validation
- ✅ Dynamic environment variable operations
- ✅ Copy environment variable functionality
- ✅ Import configuration modal
- ✅ Rename server functionality
- ✅ Modal state management and reset
- ✅ Tab state maintenance during form/JSON switching

### Advanced Functionality Tests
- ✅ View switching and state persistence
- ✅ Sort preferences maintained across views
- ✅ Proper container visibility management
- ✅ Error handling for API failures
- ✅ Form and JSON data synchronization
- ✅ Environment variable masking for sensitive data
- ✅ Bulk operations with confirmation dialogs

## Running Tests

### Individual Test Files
```bash
# Basic verification (fastest)
npx mocha test/ui-basic-verification.test.js --timeout 60000

# Simple tests (original)
npx mocha test/ui-simple.test.js --timeout 60000

# Comprehensive view tests (extensive)
npx mocha test/ui-comprehensive-views.test.js --timeout 120000

# Advanced modal tests (detailed)
npx mocha test/ui-advanced-modals.test.js --timeout 120000
```

### All UI Tests
```bash
npm run test:ui
```

### Specific Test Patterns
```bash
# Run only List view tests
npx mocha test/ui-comprehensive-views.test.js --grep "List View"

# Run only environment variable tests
npx mocha test/ui-advanced-modals.test.js --grep "Environment Variable"

# Run only sorting tests
npx mocha test/ui-comprehensive-views.test.js --grep "sorting"
```

## Test Environment

### Mock Clients Used
- **claude**: Claude Desktop client with servers
- **vscode**: VS Code client with/without servers
- **gemini**: Empty client for testing additions

### Server Ports Used
- `3465`: ui-simple.test.js
- `3467`: ui-comprehensive-views.test.js
- `3468`: ui-advanced-modals.test.js
- `3469`: ui-basic-verification.test.js

### Test Data
Tests use rich mock configurations including:
- Multiple server types (npx, python, node)
- Complex environment variables
- Various argument structures
- Sensitive data masking scenarios

## Browser Configuration
- **Engine**: Playwright with Chromium
- **Mode**: Headless
- **Viewport**: 1400x900 (comprehensive tests)
- **Security**: Sandbox disabled for CI compatibility
- **Error Handling**: Console and page error monitoring

## Test Patterns

### Timing
- Most tests use 15-20 second timeouts
- Page loads wait 1-3 seconds for JavaScript initialization
- Modal operations wait 500-1000ms for transitions

### Error Handling
- All tests include dialog handlers for confirmations
- API failure simulation included
- Network error scenarios covered
- Invalid input validation tested

### Assertions
Tests verify:
- Element presence and visibility
- Text content and attributes
- State changes and persistence
- API response structure and data
- User interface behavior and feedback

## Maintenance Notes

### Adding New Tests
1. Follow existing patterns for setup/teardown
2. Use unique port numbers to avoid conflicts
3. Include proper error handling and timeouts
4. Add descriptive test names and comments
5. Test both positive and negative scenarios

### Common Issues
- **Port conflicts**: Each test file uses different ports
- **Timing issues**: Add adequate waits for async operations
- **Mock client names**: Use 'claude', 'vscode', 'gemini' only
- **Playwright API**: Use `setViewportSize()` not `setViewport()`

### Performance
- Basic verification: Use for quick development checks
- Comprehensive tests: Use for full regression testing
- Consider running subsets during development
- Full suite recommended for CI/CD pipelines