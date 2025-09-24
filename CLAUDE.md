# Claude Assistant Instructions

This file contains instructions for Claude when working on the MCP Config Manager project.

## Project Overview

MCP Config Manager is a tool for managing Model Context Protocol (MCP) server configurations across different AI clients like Claude Desktop, VS Code, and others. It provides both a CLI interface and a web UI with dual-mode form/JSON editing capabilities.

## Development Workflow

### Before Making Changes
1. **Always run tests first** to establish baseline:
   ```bash
   npm test
   ```

2. **Check current functionality** by running the web server:
   ```bash
   npm run web
   ```

### Testing Guidelines

#### CLI Tests
- Primary test command: `npm run test:cli`
- All CLI functionality: `npm test`
- Tests should pass: **17/17** ✅

#### UI Tests
- Use Playwright for UI testing: `npm run test:ui`
- Run specific test: `npx mocha test/ui-simple.test.js`
- Tests should pass: **2/2** ✅

#### Test Environment
- Mock clients are configured in `test/mock-clients.js`
- Use `MCP_USE_MOCK_CLIENTS=true` environment variable for testing
- Server respects `PORT` environment variable for different test ports

### Code Quality

#### JavaScript Syntax
- **Always check JavaScript syntax** before committing:
  ```bash
  find public/js -name "*.js" -exec node -c {} \;
  ```

#### Key Areas to Verify
1. **Form/JSON dual-mode functionality** in `public/js/modals.js`
2. **Server PORT handling** in `src/server.js`
3. **API endpoints** work with mock clients
4. **Frontend-backend integration** via browser API calls

### Git Workflow

#### Before Committing
1. **Update README.md** with any new features, changes, or instructions
2. **Run full test suite** to ensure nothing is broken:
   ```bash
   npm test
   ```
3. **Check for any debug files** to clean up:
   ```bash
   find . -name "debug-*.js" -o -name "*.png" -o -name "*.log" | grep -E "(debug|test)"
   ```

#### Commit Message Format
Use conventional commit format with detailed description:
```
feat: Add new feature description
fix: Fix specific issue description
test: Add or improve tests
docs: Update documentation

- Detailed bullet points of changes
- Include test status (e.g., "Tests: 17/17 CLI ✅, 2/2 UI ✅")
- Note any breaking changes

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

#### After Committing
1. **Always update README.md** if you added new features or changed functionality
2. **Test the build** if applicable:
   ```bash
   npm run build  # if build script exists
   ```

### Common Issues & Solutions

#### Server Issues
- **Port conflicts**: Use different ports for tests (3456=default, 3459=UI tests, 3465=simple tests)
- **Mock clients not loading**: Ensure `MCP_USE_MOCK_CLIENTS=true` and mock configs exist
- **Server not respecting PORT**: Check `src/server.js` reads `process.env.PORT`

#### UI Test Issues
- **Puppeteer timeouts**: Use Playwright instead (`npm install --save-dev playwright`)
- **JavaScript errors**: Check browser console and fix syntax errors
- **API connection refused**: Ensure server is fully started before browser tests

#### Frontend Issues
- **Client cards not showing**: Check JavaScript console for API fetch errors
- **Form/JSON mode issues**: Verify `saveServer()` function in `public/js/modals.js`
- **Tab switching problems**: Check `switchTab()` function validation logic

### File Structure Knowledge

#### Key Files
- `src/server.js` - Express server with API endpoints
- `src/config-manager.js` - Core MCP configuration management logic
- `public/js/modals.js` - Form/JSON dual-mode functionality
- `public/js/main.js` - Frontend client loading and UI logic
- `test/mock-clients.js` - Mock client definitions for testing

#### Test Files
- `test/cli.test.js` - Basic CLI tests (17 tests)
- `test/cli-comprehensive.test.js` - Extended CLI tests
- `test/ui-simple.test.js` - Working Playwright UI tests (2 tests)
- `test/ui-playwright.test.js` - Comprehensive UI tests
- `test/test-utils.js` - Shared test utilities

### Documentation Updates

When making significant changes, always update:

1. **README.md** sections:
   - Installation instructions
   - Usage examples
   - API documentation
   - Testing instructions
   - Changelog/version info

2. **Package.json** version and scripts if needed

3. **This CLAUDE.md** file with new patterns or issues discovered

### Performance & Best Practices

- **Use TodoWrite tool** for complex multi-step tasks to track progress
- **Run tests in parallel** when possible using single message with multiple tool calls
- **Batch file operations** when reading/editing multiple files
- **Verify functionality end-to-end** including form/JSON dual-mode editing
- **Clean up debug artifacts** before committing

### Emergency Procedures

#### If Tests Are Failing
1. Check recent commits for breaking changes
2. Verify server starts correctly: `npm run web`
3. Test API endpoints manually: `curl http://localhost:3456/api/clients`
4. Check JavaScript syntax: `node -c public/js/modals.js`
5. Review mock client setup in test environment

#### If UI Not Loading
1. Check browser console for JavaScript errors
2. Verify API endpoints return data
3. Test with mock clients: `MCP_USE_MOCK_CLIENTS=true npm run web`
4. Check network tab for failed requests

## Remember: Always Test → Update README → Commit → Push