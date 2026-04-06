export interface PostSessionFeedbackData {
  clarityScore: number;
  focusScore: number;
  outcomeUsefulness: number;
  outcomeGeneric: number;
  preferredMode: 'conversation' | 'writing';
  wouldUseAgain: boolean;
  mostConfusing: string;
  mostValuable: string;
}

export interface SessionTelemetry {
  sessionId: string;
  durationMs: number;
  totalTurns: number;
  simplificationRequests: number;
  recenteringEvents: number;
  vagueAnswers: number;
  resumedFromInterruption: boolean;
  feedback: PostSessionFeedbackData;
  outcomeGenerated: any;
}

export class HumanTestScorer {
   static aggregateFriction(telemetryParams: SessionTelemetry[]) {
       const total = telemetryParams.length;
       if (total === 0) return null;

       return {
           averageClarity: telemetryParams.reduce((acc, curr) => acc + curr.feedback.clarityScore, 0) / total,
           averageFocus: telemetryParams.reduce((acc, curr) => acc + curr.feedback.focusScore, 0) / total,
           totalSimplificationRequests: telemetryParams.reduce((acc, curr) => acc + curr.simplificationRequests, 0),
           totalVagueAnswers: telemetryParams.reduce((acc, curr) => acc + curr.vagueAnswers, 0),
           frequentConfusions: telemetryParams.map(t => t.feedback.mostConfusing).filter(Boolean),
       };
   }
}
