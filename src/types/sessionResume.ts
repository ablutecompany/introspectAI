export interface SessionResumeSnapshot {
   sessionId: string;
   updatedAt: number;
   mode: 'conversation' | 'writing';
   phase: string;
   summaryOfWhatIsClear: string[];
   summaryOfWhatIsStillOpen: string[];
   nextPromptPreview: string;
   outcomeLevelCandidate: number | null;
   resumeConfidence: string;
}
