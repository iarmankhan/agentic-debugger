export type Language = 'javascript' | 'typescript' | 'python';

export interface Instrument {
  id: string;
  file: string;
  line: number;
  language: Language;
  capture: string[];
  createdAt: number;
}

export interface DebugSession {
  id: string;
  port: number;
  startedAt: number;
  logFile: string;
  instruments: Map<string, Instrument>;
}

export interface LogEntry {
  id: string;
  location: string;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface InstrumentOptions {
  file: string;
  line: number;
  capture: string[];
}
