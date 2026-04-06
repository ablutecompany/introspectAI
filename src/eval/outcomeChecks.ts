import type { OutcomeResponse } from '../engine/outcomeRules';

export interface OutcomeQualityChecks {
   isRepetitive: boolean;
   isTooAffirmative: boolean;
   hasLatentPattern: boolean;
   hasValidTension: boolean;
   isGenericHoroscope: boolean;
}

export class OutcomeChecks {
   static evaluateQuality(outcome: OutcomeResponse, history: string[]): OutcomeQualityChecks {
      if (outcome.level < 2) {
         return {
            isRepetitive: false, 
            isTooAffirmative: false, 
            hasLatentPattern: false, 
            hasValidTension: false, 
            isGenericHoroscope: false
         };
      }
      
      const payloadString = JSON.stringify(outcome.payload).toLowerCase();
      const forbiddenWords = [
         'claramente', 'definitivamente', 'tu és', 'obviamente', 'sem dúvida', 
         'o teu eixo dominante', 'o teu problema é', 'a única razão'
      ];
      const isTooAffirmative = forbiddenWords.some(w => payloadString.includes(w));
      
      const genericWords = ['uma pessoa muito', 'todos temos', 'sentes coisas intensas', 'és especial', 'estás num momento de transformação'];
      const isGenericHoroscope = genericWords.some(w => payloadString.includes(w));

      const firstHistorySlice = history.slice(0, 3).join(' ').toLowerCase();
      // Check if outcome tension repeats initial surface exactly
      const tensionSentence = outcome.payload.tensionSentence || '';
      const stringSample = tensionSentence.toLowerCase().slice(10, 30);
      const isRepetitive = stringSample.length > 5 && firstHistorySlice.includes(stringSample);

      return {
          isRepetitive: !!isRepetitive,
          isTooAffirmative,
          hasLatentPattern: !!outcome.payload.pattern || !!outcome.payload.latentPattern,
          hasValidTension: !!outcome.payload.tensionSentence,
          isGenericHoroscope
      };
   }
}
