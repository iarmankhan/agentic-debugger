import { createServer, IncomingMessage, ServerResponse, Server } from 'node:http';
import { appendFileSync } from 'node:fs';
import type { LogEntry } from './types.js';

export class DebugLogServer {
  private server: Server | null = null;
  private port: number;
  private logFile: string;

  constructor(port: number, logFile: string) {
    this.port = port;
    this.logFile = logFile;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => this.handleRequest(req, res));

      this.server.on('error', (err) => {
        reject(err);
      });

      this.server.listen(this.port, () => {
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    // Set CORS headers for browser support
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', port: this.port }));
      return;
    }

    // Log endpoint
    if (req.method === 'POST' && req.url === '/log') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const logEntry: LogEntry = JSON.parse(body);
          this.writeLog(logEntry);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    // 404 for unknown routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  private writeLog(entry: LogEntry): void {
    const logLine = JSON.stringify({
      ...entry,
      receivedAt: Date.now()
    }) + '\n';

    appendFileSync(this.logFile, logLine);
  }

  isRunning(): boolean {
    return this.server !== null;
  }
}
