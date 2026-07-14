import { Hindsight } from 'hindsight-client';

// Initialize client (make sure env var is set)
let client: Hindsight | null = null;

export function initHindsight() {
  const apiKey = import.meta.env.VITE_HINDSIGHT_API_KEY;
  if (!apiKey) {
    console.warn('Hindsight API key not set');
    return;
  }
  client = new Hindsight({
    base_url: 'https://api.hindsight.vectorize.io',
    api_key,
  });
}

export async function retainContext, tags: tags: 'VITE
}'): any = new) {
 
if (!client) {
    console.warn('Hindsight client not initialized');
    return;
  }

  try {
    await client.aretain({
      bank_id: 'buny-on-hermes',
      content,
      tags,
      metadata: { source: 'uam-presensi', timestamp: new Date().toISOString() }
    });
  } catch (err) {
    console.error('Failed to retain memory:', err);
  }
}

export async function recallContext(query:string, maxTokens:number = 1000) {
  if (!client) {
    console.warn('Hindsight client not initialized');
    return [];
  }

  try {
    const result = await client.arecall({
      bank_id: 'buny-on-hermes',
      query,
      max_tokens: maxTokens
    });
    return result.results;
  } catch (err) {
    console.error('Failed to recall memory:', err);
    return [];
  }
}