export class ProviderAdapter {
  static async requestOpenAI(sysPrompt: string, userPrompt: string, retries = 2): Promise<{content: string, providerMode: 'live' | 'mock'}> {
    // Vite requires explicit static strings, optional chaining breaks its regex parser.
    const isLive = import.meta.env.VITE_LIVE_MODE === 'true';
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

    // Use Mock unless explicitly flagged for live mode
    if (!isLive || !apiKey || apiKey === 'undefined') {
       return Promise.resolve({
         content: this.mockJsonResolver(sysPrompt, userPrompt),
         providerMode: 'mock'
       });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); 

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
      
      const data = await res.json();
      return { content: data.choices[0].message.content, providerMode: 'live' };

    } catch (e: any) {
      if (retries > 0) {
         console.warn(`Provider failed, retrying... (${retries} left)`);
         await new Promise(r => setTimeout(r, 1000));
         return this.requestOpenAI(sysPrompt, userPrompt, retries - 1);
      }
      throw e;
    }
  }

  private static mockJsonResolver(sys: string, user: string): string {
     // Trigger LLM Failure parsing if user text contains magic keyword for mock testing
     if (user.includes('MOCK_LLM_FAIL')) {
         return "This is a random text, not JSON, which will trigger the Zod fallback in guards.";
     }
     
     // Simulate real valid JSON matching schema constraints
     const forcedMoveMatch = sys.match(/"nextMoveType":\s*"([^"]+)"/);
     const moveInfo = forcedMoveMatch ? forcedMoveMatch[1] : 'ask_open';
     
     return JSON.stringify({
        nextMoveType: moveInfo,
        userFacingText: `[LLM ZOD VALIDADO] Simulação gerada com tom rigoroso focado na ação: ${moveInfo}.`,
        extractedSignals: { contexts: [], costs: ["Cansaço Simulado pelo JSON"], fears: [], mechanisms: [] },
        suggestedUpdates: { confidenceHint: "moderate" }
     });
  }
}
