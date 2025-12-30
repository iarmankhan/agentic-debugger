# agentic-debugger

An MCP (Model Context Protocol) server that enables interactive debugging with code instrumentation for AI coding assistants. Inspired by Cursor's debug mode.

Works with any MCP-compatible AI coding tool:
- **Claude Code**
- **Cursor**
- **Windsurf**
- **Cline**
- **GitHub Copilot**
- **Kiro**
- **Zed**
- And more...

## Features

- **Live code instrumentation** - Inject debug logging at specific lines
- **Variable capture** - Log variable values at runtime
- **Multi-language support** - JavaScript, TypeScript, and Python
- **Browser support** - CORS-enabled for browser JS debugging
- **Clean removal** - Region markers ensure instruments are fully removed

## Installation

### Using npx (recommended)

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "debug": {
      "command": "npx",
      "args": ["-y", "agentic-debugger"]
    }
  }
}
```

**Configuration file locations:**
- Claude Code: `~/.mcp.json`
- Cursor: `.cursor/mcp.json` in your project or `~/.cursor/mcp.json`
- Other tools: Check your tool's MCP documentation

### Global install

```bash
npm install -g agentic-debugger
```

Then configure:

```json
{
  "mcpServers": {
    "debug": {
      "command": "agentic-debugger"
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `start_debug_session` | Start HTTP server for log collection |
| `stop_debug_session` | Stop server and cleanup |
| `add_instrument` | Insert logging code at file:line |
| `remove_instruments` | Remove debug code from file(s) |
| `list_instruments` | Show all active instruments |
| `read_debug_logs` | Read captured log data |
| `clear_debug_logs` | Clear the log file |

## How It Works

1. **Start session** - Spawns a local HTTP server (default port 9876)
2. **Add instruments** - Injects `fetch()` calls that POST to the server
3. **Reproduce bug** - Run your code, instruments capture variable values
4. **Analyze logs** - Read the captured data to identify issues
5. **Cleanup** - Remove all instruments and stop the server

## Debug Workflow Example

```
You: "Help me debug why the total is NaN"

AI Assistant:
1. Starts debug session
2. Reads your code to understand the logic
3. Adds instruments at suspicious locations
4. "Please run your code to reproduce the issue"

You: *runs code* "Done"

AI Assistant:
5. Reads debug logs
6. "I see `discount` is undefined at line 15..."
7. Removes instruments
8. Fixes the bug
9. Stops debug session
```

## Instrument Examples

### JavaScript/TypeScript
```javascript
// #region agentic-debug-abc123
fetch('http://localhost:9876/log', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: 'abc123',
    location: 'cart.js:15',
    timestamp: Date.now(),
    data: { total, discount, items }
  })
}).catch(() => {});
// #endregion agentic-debug-abc123
```

### Python
```python
# region agentic-debug-abc123
try:
    import urllib.request as __req, json as __json
    __req.urlopen(__req.Request(
        'http://localhost:9876/log',
        data=__json.dumps({
            'id': 'abc123',
            'location': 'cart.py:15',
            'timestamp': __import__('time').time(),
            'data': {'total': total, 'discount': discount}
        }).encode(),
        headers={'Content-Type': 'application/json'}
    ))
except: pass
# endregion agentic-debug-abc123
```

## Supported Languages

| Language | Extensions |
|----------|------------|
| JavaScript | `.js`, `.mjs`, `.cjs` |
| TypeScript | `.ts`, `.tsx` |
| Python | `.py` |

## Requirements

- Node.js >= 18.0.0
- An MCP-compatible AI coding assistant

## License

MIT
