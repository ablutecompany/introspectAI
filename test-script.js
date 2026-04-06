import fs from 'fs';

const url = 'https://introspect-ai.vercel.app/api/llm';

const payload = {
   internalState: {
       sessionId: 'test-session-123',
       turnIndex: 0,
       phase: 'micro_triage',
       transcriptHistory: []
   },
   userResponse: '[User Context Buffer]: Peso principal: Cansaço / sem energia. Intensidade: Muito. Momento: Ao acordar. Tipo de peso: Cansaço. Exemplo dominante: No trabalho',
   userIntent: 'auto',
   forcedNextMove: 'ask_open',
   inputType: 'typed'
};

async function testEdgeCase() {
    console.log("Sending POST request to:", url);
    const result = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Request-ID': 'test-node-script-123' },
        body: JSON.stringify(payload)
    });
    console.log("Status:", result.status);
    const body = await result.text();
    console.log("Response Body:", body);
}

testEdgeCase().catch(console.error);
