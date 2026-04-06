import { askLLM } from './server/llm/client.ts';

const payload = {
   internalState: {
       sessionId: 'test-session-123',
       turnIndex: 0,
       phase: 'micro_triage',
       transcriptHistory: [],
       mode: 'conversation',
       costSignals: [],
       fearSignals: [],
       mechanismSignals: [],
       dominantHypothesis: null
   },
   userResponse: '[User Context Buffer]: Peso principal: Cansaço / sem energia. Intensidade: Muito. Momento: Ao acordar. Tipo de peso: Cansaço. Exemplo dominante: No trabalho',
   userIntent: 'auto',
   forcedNextMove: 'ask_open',
   inputType: 'typed'
};

async function testInternal() {
    console.log("Running askLLM locally...");
    const result = await askLLM(payload);
    console.log("Result:", result);
}

testInternal().catch(console.error);
