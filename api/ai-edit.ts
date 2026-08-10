type RequestLike = {
  body?: unknown;
  method?: string;
};

type ResponseLike = {
  json: (payload: unknown) => void;
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ResponseLike;
};

type EditRequest = {
  instruction?: unknown;
  text?: unknown;
};

const systemPrompt = [
  'You are a careful editor for a fantasy roleplaying campaign document.',
  'Return only the replacement for the selected passage: no explanation, quote marks, or preface.',
  'Preserve the original meaning unless the instruction explicitly asks to change it.',
  'Preserve Markdown structure, links, references, and line breaks unless the instruction asks otherwise.'
].join(' ');

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { instruction, text } = (req.body ?? {}) as EditRequest;
  if (typeof text !== 'string' || !text.trim() || text.length > 12000 || typeof instruction !== 'string' || !instruction.trim() || instruction.length > 1600) {
    res.status(400).json({ error: 'Select up to 12,000 characters and provide a short editing instruction.' });
    return;
  }

  const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  if (!apiKey) {
    res.status(503).json({ error: 'AI editing has not been configured for this deployment.' });
    return;
  }

  try {
    const upstream = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      body: JSON.stringify({
        messages: [
          { content: systemPrompt, role: 'system' },
          { content: `Instruction: ${instruction}\n\nSelected passage:\n${text}`, role: 'user' }
        ],
        model: 'openai/gpt-5.6-sol'
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      method: 'POST'
    });

    const result = await upstream.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
    const replacement = result.choices?.[0]?.message?.content?.trim();
    if (!upstream.ok || !replacement) {
      throw new Error(result.error?.message || 'The AI service did not return a replacement.');
    }

    res.status(200).json({ text: replacement });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'Could not reach the AI service.' });
  }
}
