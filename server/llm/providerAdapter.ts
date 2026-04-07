export class ProviderAdapter {
  static async requestOpenAI(sysPrompt: string, userPrompt: string, reqId: string = 'no-id', retries = 2): Promise<{content: string, providerMode: 'live' | 'mock'}> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey || apiKey === 'undefined') {
       console.error(`[OpenAI Adapter] ID: ${reqId} | CRITICAL: PRODUCTION MISSING OPENAI_API_KEY.`);
       throw new Error("A produção central ainda não está configurada com a chave do motor inteligente (OPENAI_API_KEY em falta).");
    }

    try {
      const controller = new AbortController();
      // Increase timeout explicitly for hefty OpenAI prompt responses, up to Vercel Hobby Limit safely
      const timeoutId = setTimeout(() => {
         console.warn(`[OpenAI Adapter] ID: ${reqId} | AbortController TIMEOUT reached (35000ms). Forcing abort.`);
         controller.abort();
      }, 35000); 

      console.log(`[OpenAI Adapter] ID: ${reqId} | Sending request to api.openai.com... (retries left: ${retries})`);
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: sysPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`OpenAI API error: ${res.statusText}`);
      console.log(`[OpenAI Adapter] ID: ${reqId} | OpenAI Request OK (Status: ${res.status}). Parsing body...`);
      const data = await res.json();
      console.log(`[OpenAI Adapter] ID: ${reqId} | Parsed body successfully.`);
      return { content: data.choices[0].message.content, providerMode: 'live' };

    } catch (e: any) {
      if (retries > 0) {
         console.warn(`[OpenAI Adapter] ID: ${reqId} | Provider failed, retrying... (${retries} left). Error:`, e.message);
         await new Promise(r => setTimeout(r, 1000));
         return this.requestOpenAI(sysPrompt, userPrompt, reqId, retries - 1);
      }
      throw e;
    }
  }

  // MockResolver Deleted natively
}
