/**
 * Perplexity-backed internet_search tool definition and executor.
 * Uses Perplexity Chat Completions API (OpenAI-compatible) to fetch fresh info.
 */

export const internetSearchTool = {
  type: 'function',
  function: {
    name: 'internet_search',
    description:
      'Perform a web search using Perplexity (Sonar) and return a concise answer with citations. Use this for up-to-date or external knowledge.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: {
          type: 'string',
          description: 'Natural language query to search on the web.',
        },
      },
      required: ['query'],
    },
  },
} as const;

type SearchArgs = {
  query: string;
  model?: string;
};

type PerplexityChoice = {
  message?: { role: string; content?: string | null };
};

type PerplexityResponse = {
  choices?: PerplexityChoice[];
  citations?: string[];
};

/**
 * Execute a Perplexity Chat Completions request.
 * Environment:
 * - PERPLEXITY_API_KEY or SONAR_API_KEY
 * - PERPLEXITY_BASE_URL (default: https://api.perplexity.ai)
 * - PERPLEXITY_MODEL (default: sonar-pro)
 */
export async function runInternetSearch(args: SearchArgs): Promise<
  | { answer: string; citations?: string[] }
  | { error: string }
> {
  const apiKey = process.env.PERPLEXITY_API_KEY || process.env.SONAR_API_KEY;
  if (!apiKey) {
    return { error: 'Missing PERPLEXITY_API_KEY (or SONAR_API_KEY) in environment' };
  }

  const baseURL = process.env.PERPLEXITY_BASE_URL || 'https://api.perplexity.ai';
  const model = args.model || process.env.PERPLEXITY_MODEL || 'sonar-pro';

  try {
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: args.query }],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { error: `Perplexity request failed (${res.status}): ${text}` };
    }

    const data = (await res.json()) as PerplexityResponse;
    const answer = data.choices?.[0]?.message?.content || '';
    return { answer, citations: data.citations };
  } catch (err: any) {
    return { error: String(err?.message || err || 'unknown error') };
  }
}

export type ToolDef = typeof internetSearchTool;

