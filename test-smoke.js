import fs from 'fs';

const url = 'https://introspect-ai.vercel.app/api/llm-smoke';

async function testSmokeCase() {
    console.log("Sending GET request to:", url);
    const result = await fetch(url);
    console.log("Status:", result.status);
    const body = await result.text();
    console.log("Response Body:", body);
}

testSmokeCase().catch(console.error);
