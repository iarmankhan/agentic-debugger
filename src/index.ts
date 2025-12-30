#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { SessionManager } from './session.js';
import { Instrumenter } from './instrumenter.js';

// Use current working directory for the debug session
const workingDirectory = process.cwd();
const sessionManager = new SessionManager(workingDirectory);
let instrumenter: Instrumenter | null = null;

const server = new Server(
  {
    name: 'agentic-debugger',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'start_debug_session',
        description: 'Start a debug session. This starts a local HTTP server to receive logs from instrumented code.',
        inputSchema: {
          type: 'object',
          properties: {
            port: {
              type: 'number',
              description: 'Port number for the debug server (default: 9876)',
              default: 9876,
            },
          },
        },
      },
      {
        name: 'stop_debug_session',
        description: 'Stop the current debug session and shut down the log server.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'add_instrument',
        description: 'Add a debug instrument at a specific line in a file. The instrument will log variable values when executed.',
        inputSchema: {
          type: 'object',
          properties: {
            file: {
              type: 'string',
              description: 'Path to the file to instrument (relative to working directory)',
            },
            line: {
              type: 'number',
              description: 'Line number where to insert the instrument (1-indexed)',
            },
            capture: {
              type: 'array',
              items: { type: 'string' },
              description: 'Variable names to capture and log',
              default: [],
            },
          },
          required: ['file', 'line'],
        },
      },
      {
        name: 'remove_instruments',
        description: 'Remove debug instruments from files.',
        inputSchema: {
          type: 'object',
          properties: {
            file: {
              type: 'string',
              description: 'Path to file to remove instruments from. If not specified, removes from all instrumented files.',
            },
          },
        },
      },
      {
        name: 'list_instruments',
        description: 'List all active debug instruments.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'read_debug_logs',
        description: 'Read the collected debug logs from the current session.',
        inputSchema: {
          type: 'object',
          properties: {
            format: {
              type: 'string',
              enum: ['raw', 'pretty'],
              description: 'Output format (default: pretty)',
              default: 'pretty',
            },
          },
        },
      },
      {
        name: 'clear_debug_logs',
        description: 'Clear all collected debug logs.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'start_debug_session': {
        const port = (args?.port as number) || 9876;
        const session = await sessionManager.startSession(port);
        instrumenter = new Instrumenter(port);

        return {
          content: [
            {
              type: 'text',
              text: `Debug session started!\n\nSession ID: ${session.id}\nServer: http://localhost:${port}\nLog file: ${session.logFile}\n\nYou can now add instruments to capture variable values.`,
            },
          ],
        };
      }

      case 'stop_debug_session': {
        if (!sessionManager.isActive()) {
          return {
            content: [{ type: 'text', text: 'No active debug session to stop.' }],
          };
        }

        // Remove all instruments from files before stopping
        const instruments = sessionManager.getInstruments();
        if (instrumenter) {
          for (const instrument of instruments) {
            instrumenter.removeInstrument(instrument);
          }
        }

        await sessionManager.stopSession();
        instrumenter = null;

        return {
          content: [
            {
              type: 'text',
              text: `Debug session stopped. Removed ${instruments.length} instrument(s) from code.`,
            },
          ],
        };
      }

      case 'add_instrument': {
        if (!sessionManager.isActive() || !instrumenter) {
          return {
            content: [{ type: 'text', text: 'No active debug session. Start one first with start_debug_session.' }],
            isError: true,
          };
        }

        const file = args?.file as string;
        const line = args?.line as number;
        const capture = (args?.capture as string[]) || [];

        if (!file || !line) {
          return {
            content: [{ type: 'text', text: 'Missing required parameters: file and line' }],
            isError: true,
          };
        }

        const instrument = sessionManager.addInstrument({ file, line, capture });
        instrumenter.addInstrument(instrument);

        return {
          content: [
            {
              type: 'text',
              text: `Instrument added!\n\nID: ${instrument.id}\nFile: ${instrument.file}\nLine: ${line}\nCapturing: ${capture.length > 0 ? capture.join(', ') : '(no variables)'}\n\nThe instrument will log data when that line is executed.`,
            },
          ],
        };
      }

      case 'remove_instruments': {
        if (!sessionManager.isActive() || !instrumenter) {
          return {
            content: [{ type: 'text', text: 'No active debug session.' }],
            isError: true,
          };
        }

        const file = args?.file as string | undefined;

        if (file) {
          // Remove from specific file
          const instruments = sessionManager.getInstrumentsByFile(file);
          for (const instrument of instruments) {
            instrumenter.removeInstrument(instrument);
            sessionManager.removeInstrument(instrument.id);
          }
          return {
            content: [
              {
                type: 'text',
                text: `Removed ${instruments.length} instrument(s) from ${file}`,
              },
            ],
          };
        } else {
          // Remove from all files
          const instruments = sessionManager.getInstruments();
          for (const instrument of instruments) {
            instrumenter.removeInstrument(instrument);
          }
          sessionManager.clearInstruments();
          return {
            content: [
              {
                type: 'text',
                text: `Removed ${instruments.length} instrument(s) from all files`,
              },
            ],
          };
        }
      }

      case 'list_instruments': {
        const instruments = sessionManager.getInstruments();

        if (instruments.length === 0) {
          return {
            content: [{ type: 'text', text: 'No active instruments.' }],
          };
        }

        const list = instruments
          .map((i) => `- ${i.id}: ${i.file}:${i.line} [${i.capture.join(', ') || 'no capture'}]`)
          .join('\n');

        return {
          content: [
            {
              type: 'text',
              text: `Active instruments (${instruments.length}):\n\n${list}`,
            },
          ],
        };
      }

      case 'read_debug_logs': {
        if (!sessionManager.isActive()) {
          return {
            content: [{ type: 'text', text: 'No active debug session.' }],
            isError: true,
          };
        }

        const format = (args?.format as string) || 'pretty';
        const logs = sessionManager.readLogs();

        if (!logs.trim()) {
          return {
            content: [
              {
                type: 'text',
                text: 'No logs collected yet. Make sure to reproduce the bug to trigger the instruments.',
              },
            ],
          };
        }

        if (format === 'raw') {
          return {
            content: [{ type: 'text', text: logs }],
          };
        }

        // Pretty format
        const entries = logs
          .trim()
          .split('\n')
          .map((line) => {
            try {
              return JSON.parse(line);
            } catch {
              return null;
            }
          })
          .filter(Boolean);

        const formatted = entries
          .map((entry, i) => {
            const time = new Date(entry.timestamp).toISOString();
            const data = JSON.stringify(entry.data, null, 2);
            return `[${i + 1}] ${time}\nInstrument: ${entry.id}\nLocation: ${entry.location}\nData:\n${data}`;
          })
          .join('\n\n---\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `Debug logs (${entries.length} entries):\n\n${formatted}`,
            },
          ],
        };
      }

      case 'clear_debug_logs': {
        if (!sessionManager.isActive()) {
          return {
            content: [{ type: 'text', text: 'No active debug session.' }],
            isError: true,
          };
        }

        sessionManager.clearLogs();
        return {
          content: [{ type: 'text', text: 'Debug logs cleared.' }],
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Agentic Debugger MCP server running');
}

main().catch(console.error);
