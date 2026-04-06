import fs from 'fs';

const url = 'https://introspect-ai.vercel.app/api/llm';

const basePayload = {
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
   userIntent: 'substantive',
   forcedNextMove: 'ask_open',
   inputType: 'typed'
};

async function test(name, userText) {
    console.log(`\n=======================`);
    console.log(`INIT: ${name}`);
    console.log(`=======================`);
    
    const payload = { ...basePayload, userResponse: userText };
    try {
        const result = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Request-ID': `req-${name}-${Date.now()}` },
            body: JSON.stringify(payload)
        });
        
        console.log(`Status HTTP: ${result.status}`);
        const body = await result.text();
        console.log(`Body: ${body.substring(0, 300)}`);
    } catch (e) {
        console.error("Test Exception:", e);
    }
}

async function run() {
    await test("TEST A - Bypass Direct to Vercel", "DEBUG_BYPASS_OPENAI");
    await test("TEST B - Real Submit (Mock Mode / OpenAI depending on .env)", "Cansaço profundo no trabalho");
}

run().catch(console.error);
