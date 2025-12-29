# claude-debug-mcp

An MCP (Model Context Protocol) server that enables interactive debugging with code instrumentation for Claude Code. Inspired by Cursor's debug mode.

## Features

- **Live code instrumentation** - Inject debug logging at specific lines
- **Variable capture** - Log variable values at runtime
- **Multi-language support** - JavaScript, TypeScript, and Python
- **Browser support** - CORS-enabled for browser JS debugging
- **Clean removal** - Region markers ensure instruments are fully removed

## Installation

### Using npx (recommended)

Add to your Claude Code MCP configuration (`~/.mcp.json`):

```json
{
  "mcpServers": {
    "debug": {
      "command": "npx",
      "args": ["-y", "claude-debug-mcp"]
    }
  }
}
```

### Global install

```bash
npm install -g claude-debug-mcp
```

Then configure:

```json
{
  "mcpServers": {
    "debug": {
      "command": "claude-debug-mcp"
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

Claude:
1. Starts debug session
2. Reads your code to understand the logic
3. Adds instruments at suspicious locations
4. "Please run your code to reproduce the issue"

You: *runs code* "Done"

Claude:
5. Reads debug logs
6. "I see `discount` is undefined at line 15..."
7. Removes instruments
8. Fixes the bug
9. Stops debug session
```

## Instrument Examples

### JavaScript/TypeScript
```javascript
// #region claude-debug-abc123
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
// #endregion claude-debug-abc123
```

### Python
```python
# region claude-debug-abc123
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
# endregion claude-debug-abc123
```

## Supported Languages

| Language | Extensions |
|----------|------------|
| JavaScript | `.js`, `.mjs`, `.cjs` |
| TypeScript | `.ts`, `.tsx` |
| Python | `.py` |

## Optional: Debug Skill

For automatic discovery, create a skill at `~/.claude/skills/debug/SKILL.md`:

```yaml
---
name: debug
description: Interactive debugging with code instrumentation. Use when debugging bugs or tracing runtime values.
---

# Debug Mode

Use the debug MCP tools to instrument code and capture runtime values.

## Workflow
1. start_debug_session
2. add_instrument at suspicious locations
3. Ask user to reproduce
4. read_debug_logs
5. remove_instruments and fix
6. stop_debug_session
```

## Requirements

- Node.js >= 18.0.0
- Claude Code with MCP support

## License

MIT
