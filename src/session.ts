import { randomUUID } from 'node:crypto';
import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { DebugLogServer } from './server.js';
import type { DebugSession, Instrument, InstrumentOptions, Language } from './types.js';

export class SessionManager {
  private session: DebugSession | null = null;
  private server: DebugLogServer | null = null;
  private workingDirectory: string;

  constructor(workingDirectory: string) {
    this.workingDirectory = workingDirectory;
  }

  async startSession(port: number = 9876): Promise<DebugSession> {
    if (this.session) {
      throw new Error('Debug session already active. Stop it first.');
    }

    const logFile = resolve(this.workingDirectory, 'debug.log');

    // Clear any existing log file
    if (existsSync(logFile)) {
      unlinkSync(logFile);
    }
    writeFileSync(logFile, '');

    this.server = new DebugLogServer(port, logFile);
    await this.server.start();

    this.session = {
      id: randomUUID(),
      port,
      startedAt: Date.now(),
      logFile,
      instruments: new Map()
    };

    return this.session;
  }

  async stopSession(): Promise<void> {
    if (this.server) {
      await this.server.stop();
      this.server = null;
    }
    this.session = null;
  }

  getSession(): DebugSession | null {
    return this.session;
  }

  isActive(): boolean {
    return this.session !== null;
  }

  addInstrument(options: InstrumentOptions): Instrument {
    if (!this.session) {
      throw new Error('No active debug session');
    }

    const language = this.detectLanguage(options.file);
    const instrument: Instrument = {
      id: `dbg-${randomUUID().slice(0, 8)}`,
      file: resolve(this.workingDirectory, options.file),
      line: options.line,
      language,
      capture: options.capture,
      createdAt: Date.now()
    };

    this.session.instruments.set(instrument.id, instrument);
    return instrument;
  }

  removeInstrument(id: string): boolean {
    if (!this.session) {
      throw new Error('No active debug session');
    }
    return this.session.instruments.delete(id);
  }

  getInstruments(): Instrument[] {
    if (!this.session) {
      return [];
    }
    return Array.from(this.session.instruments.values());
  }

  getInstrumentsByFile(file: string): Instrument[] {
    const resolvedFile = resolve(this.workingDirectory, file);
    return this.getInstruments().filter(i => i.file === resolvedFile);
  }

  clearInstruments(): void {
    if (this.session) {
      this.session.instruments.clear();
    }
  }

  readLogs(): string {
    if (!this.session) {
      throw new Error('No active debug session');
    }

    if (!existsSync(this.session.logFile)) {
      return '';
    }

    return readFileSync(this.session.logFile, 'utf-8');
  }

  clearLogs(): void {
    if (!this.session) {
      throw new Error('No active debug session');
    }

    writeFileSync(this.session.logFile, '');
  }

  private detectLanguage(file: string): Language {
    const ext = file.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
      case 'mjs':
      case 'cjs':
        return 'javascript';
      case 'py':
        return 'python';
      default:
        return 'javascript'; // Default fallback
    }
  }
}
