import type { InternalState } from '../types/internalState';
import type { OutcomeQualityChecks } from './outcomeChecks';

export interface SessionScoreRubric {
  clarityScore: number;         // Max 10
  guidanceScore: number;        // Max 10 
  antiDriftScore: number;       // Max 10
  timingScore: number;          // Max 10
  outcomeSpecificityScore: number; // Max 10
  finalVerdict: 'PASSED_SOLID' | 'PASSED_WITH_WARNINGS' | 'FAILED';
}

export class ScoreSession {
  static score(
     metrics: {
        totalTurns: number;
        driftIntercepts: number;
        simplificationRequests: number;
        finalPhase: string;
        quality: OutcomeQualityChecks;
        readinessScore: number;
     }
  ): SessionScoreRubric {
     
     let clarityScore = 10 - metrics.simplificationRequests * 2;
     if (clarityScore < 0) clarityScore = 0;

     let antiDriftScore = 10;
     if (metrics.driftIntercepts > 0) antiDriftScore = 10; // Positive adaptation
     
     let guidanceScore = 10;
     if (metrics.totalTurns > 10 && metrics.readinessScore < 2) guidanceScore = 4; // Lost the thread
     
     let timingScore = 10;
     if (metrics.finalPhase !== 'closure_ready' && metrics.totalTurns >= 7) timingScore = 6;
     if (metrics.finalPhase === 'outcome_delivered' && metrics.readinessScore < 2) timingScore = 2; // Premature close
     
     let outcomeSpecificityScore = 10;
     if (metrics.quality.isRepetitive) outcomeSpecificityScore -= 3;
     if (metrics.quality.isTooAffirmative) outcomeSpecificityScore -= 4;
     if (metrics.quality.isGenericHoroscope) outcomeSpecificityScore -= 5;
     if (!metrics.quality.hasLatentPattern && metrics.readinessScore >= 2) outcomeSpecificityScore -= 3;
     
     if (outcomeSpecificityScore < 0) outcomeSpecificityScore = 0;

     const minOk = 5;
     let finalVerdict: 'PASSED_SOLID' | 'PASSED_WITH_WARNINGS' | 'FAILED' = 'PASSED_SOLID';

     if (clarityScore < minOk || guidanceScore < minOk || timingScore < minOk || outcomeSpecificityScore < minOk) {
         finalVerdict = 'PASSED_WITH_WARNINGS';
     }
     
     if (outcomeSpecificityScore < 4 || timingScore < 3) {
         finalVerdict = 'FAILED';
     }

     return {
         clarityScore,
         guidanceScore,
         antiDriftScore,
         timingScore,
         outcomeSpecificityScore,
         finalVerdict
     };
  }
}
