import type { LLMNextMoveType, AskLLMRequest } from '../../shared/contracts/interviewContract';

export interface AuditLogEntry {
  timestamp: string;
  sessionId: string;
  turnIndex: number;
  phase: string;
  requestedMove: LLMNextMoveType;
  rawLLMResponse?: string;
  validatedOutcome?: string;
  fallbackTriggered: boolean;
  error?: string;
  latencyMs: number;
}

export class SessionLogger {
  static logAudit(entry: AuditLogEntry) {
    // Para MVP, log no terminal (Backend server)
    const logPrefix = entry.fallbackTriggered ? '[WARN_FALLBACK]' : '[OK_PIPELINE]';
    console.log(`\n=== AUDIT LOG ${logPrefix} ===`);
    console.log(`| Sessão: ${entry.sessionId} | Turno: ${entry.turnIndex} | Fase: ${entry.phase}`);
    console.log(`| Maestro Ordenou: ${entry.requestedMove}`);
    console.log(`| Latência: ${entry.latencyMs}ms`);
    if (entry.error) console.log(`| ERRO: ${entry.error}`);
    console.log(`=======================\n`);
    
    // Numa versão final, faríamos fs.appendFile() rotativo ou envio para datadog.
  }
}
