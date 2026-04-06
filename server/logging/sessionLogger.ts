import type { LLMNextMoveType } from '../../shared/contracts/interviewContract.js';

export interface AuditLogEntry {
  timestamp: string;
  sessionId: string;
  turnIndex: number;
  phase: string;
  requestedMove: LLMNextMoveType;
  inputType: string;
  providerMode: 'mock' | 'live';
  rawLLMResponse?: string;
  validatedOutcome?: string;
  fallbackTriggered: boolean;
  error?: string;
  latencyMs: number;
}

export class SessionLogger {
  static logAudit(entry: AuditLogEntry) {
    const logPrefix = entry.fallbackTriggered ? '[WARN_FALLBACK]' : '[OK_PIPELINE]';
    console.log(`\n=== AUDIT LOG ${logPrefix} ===`);
    console.log(`| Sessão: ${entry.sessionId} | Turno: ${entry.turnIndex} | Fase: ${entry.phase}`);
    console.log(`| Maestro Ordenou: ${entry.requestedMove} | Input: ${entry.inputType}`);
    console.log(`| Provider Mode: ${entry.providerMode.toUpperCase()} | Latência: ${entry.latencyMs}ms`);
    if (entry.error) console.log(`| ERRO: ${entry.error}`);
    console.log(`=======================\n`);
  }
}
