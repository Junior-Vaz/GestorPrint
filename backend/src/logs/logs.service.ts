import { ConsoleLogger, Injectable } from '@nestjs/common';
import { LogsGateway } from './logs.gateway';

export interface LogEntry {
  level: 'log' | 'error' | 'warn' | 'debug' | 'verbose';
  context: string;
  message: string;
  timestamp: string;
}

const MAX_BUFFER = 500;

@Injectable()
export class LogsService extends ConsoleLogger {
  private buffer: LogEntry[] = [];
  private gateway: LogsGateway | null = null;

  setGateway(gateway: LogsGateway) {
    this.gateway = gateway;
  }

  getBuffer(): LogEntry[] {
    return this.buffer;
  }

  private push(entry: LogEntry) {
    this.buffer.push(entry);
    if (this.buffer.length > MAX_BUFFER) this.buffer.shift();
    this.gateway?.emit(entry);
  }

  log(message: any, context?: string) {
    super.log(message, context);
    this.push({ level: 'log', context: context || '', message: String(message), timestamp: new Date().toISOString() });
  }

  error(message: any, stack?: string, context?: string) {
    super.error(message, stack, context);
    const msg = stack ? `${message}\n${stack}` : String(message);
    this.push({ level: 'error', context: context || '', message: msg, timestamp: new Date().toISOString() });
  }

  warn(message: any, context?: string) {
    super.warn(message, context);
    this.push({ level: 'warn', context: context || '', message: String(message), timestamp: new Date().toISOString() });
  }

  debug(message: any, context?: string) {
    super.debug(message, context);
    this.push({ level: 'debug', context: context || '', message: String(message), timestamp: new Date().toISOString() });
  }

  verbose(message: any, context?: string) {
    super.verbose(message, context);
    this.push({ level: 'verbose', context: context || '', message: String(message), timestamp: new Date().toISOString() });
  }
}
