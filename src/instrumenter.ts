import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import type { Instrument, Language } from './types.js';

const REGION_PREFIX = 'claude-debug';

export class Instrumenter {
  private port: number;

  constructor(port: number) {
    this.port = port;
  }

  /**
   * Add instrumentation to a file at the specified line
   */
  addInstrument(instrument: Instrument): void {
    if (!existsSync(instrument.file)) {
      throw new Error(`File not found: ${instrument.file}`);
    }

    const content = readFileSync(instrument.file, 'utf-8');
    const lines = content.split('\n');

    if (instrument.line < 1 || instrument.line > lines.length + 1) {
      throw new Error(`Line ${instrument.line} is out of range (file has ${lines.length} lines)`);
    }

    const code = this.generateInstrumentCode(instrument);
    const codeLines = code.split('\n');

    // Insert at the specified line (1-indexed, so line 5 means insert before index 4)
    lines.splice(instrument.line - 1, 0, ...codeLines);

    writeFileSync(instrument.file, lines.join('\n'));
  }

  /**
   * Remove a specific instrument from a file
   */
  removeInstrument(instrument: Instrument): boolean {
    if (!existsSync(instrument.file)) {
      return false;
    }

    const content = readFileSync(instrument.file, 'utf-8');
    const regionId = `${REGION_PREFIX}-${instrument.id}`;

    const newContent = this.removeRegion(content, regionId, instrument.language);

    if (newContent !== content) {
      writeFileSync(instrument.file, newContent);
      return true;
    }

    return false;
  }

  /**
   * Remove all instruments from a file
   */
  removeAllInstrumentsFromFile(file: string): number {
    if (!existsSync(file)) {
      return 0;
    }

    const content = readFileSync(file, 'utf-8');
    let newContent = content;
    let count = 0;

    // Try both comment styles
    const patterns = [
      // JS/TS style
      new RegExp(`// #region ${REGION_PREFIX}-[^\\n]*\\n[\\s\\S]*?// #endregion[^\\n]*\\n?`, 'g'),
      // Python style
      new RegExp(`# region ${REGION_PREFIX}-[^\\n]*\\n[\\s\\S]*?# endregion[^\\n]*\\n?`, 'g')
    ];

    for (const pattern of patterns) {
      const matches = newContent.match(pattern);
      if (matches) {
        count += matches.length;
        newContent = newContent.replace(pattern, '');
      }
    }

    if (count > 0) {
      writeFileSync(file, newContent);
    }

    return count;
  }

  /**
   * Check if a file has any debug instruments
   */
  hasInstruments(file: string): boolean {
    if (!existsSync(file)) {
      return false;
    }

    const content = readFileSync(file, 'utf-8');
    return content.includes(`#region ${REGION_PREFIX}-`) ||
           content.includes(`# region ${REGION_PREFIX}-`);
  }

  private generateInstrumentCode(instrument: Instrument): string {
    switch (instrument.language) {
      case 'javascript':
      case 'typescript':
        return this.generateJSInstrument(instrument);
      case 'python':
        return this.generatePythonInstrument(instrument);
      default:
        return this.generateJSInstrument(instrument);
    }
  }

  private generateJSInstrument(instrument: Instrument): string {
    const dataObj = instrument.capture.length > 0
      ? `{ ${instrument.capture.map(v => `${v}: typeof ${v} !== 'undefined' ? ${v} : undefined`).join(', ')} }`
      : '{}';

    return `// #region ${REGION_PREFIX}-${instrument.id}
fetch('http://localhost:${this.port}/log', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: '${instrument.id}',
    location: '${instrument.file}:${instrument.line}',
    timestamp: Date.now(),
    data: ${dataObj}
  })
}).catch(() => {});
// #endregion ${REGION_PREFIX}-${instrument.id}`;
  }

  private generatePythonInstrument(instrument: Instrument): string {
    const dataDict = instrument.capture.length > 0
      ? `{ ${instrument.capture.map(v => `'${v}': ${v} if '${v}' in dir() else None`).join(', ')} }`
      : '{}';

    return `# region ${REGION_PREFIX}-${instrument.id}
try:
    import urllib.request as __dbg_req, json as __dbg_json
    __dbg_req.urlopen(__dbg_req.Request(
        'http://localhost:${this.port}/log',
        data=__dbg_json.dumps({
            'id': '${instrument.id}',
            'location': '${instrument.file}:${instrument.line}',
            'timestamp': __import__('time').time(),
            'data': ${dataDict}
        }).encode(),
        headers={'Content-Type': 'application/json'}
    ))
except: pass
# endregion ${REGION_PREFIX}-${instrument.id}`;
  }

  private removeRegion(content: string, regionId: string, language: Language): string {
    let pattern: RegExp;

    if (language === 'python') {
      pattern = new RegExp(`# region ${regionId}[^\\n]*\\n[\\s\\S]*?# endregion[^\\n]*\\n?`, 'g');
    } else {
      pattern = new RegExp(`// #region ${regionId}[^\\n]*\\n[\\s\\S]*?// #endregion[^\\n]*\\n?`, 'g');
    }

    return content.replace(pattern, '');
  }
}
