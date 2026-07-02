// LLM souls — a real Claude adapter for promoted beings (leaders, the possessed).
// Paste an Anthropic API key in the in-game Souls panel (stored only in your browser's
// localStorage; calls go straight from your browser to Anthropic — no server, and the
// key is never committed anywhere). Without a key the offline generative souls run.
const KEY_STORE = 'aeon_llm_key';
const MODEL = 'claude-haiku-4-5-20251001'; // fast + cheap; one short line per call

let lastCall = 0;
const MIN_GAP_MS = 2500; // global throttle so fast-forward can't spam the API

export function connectClaude(apiKey) {
  return async ({ prompt }) => {
    const now = Date.now();
    if (now - lastCall < MIN_GAP_MS) return null;   // keep the offline line this time
    lastCall = now;
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 50,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!r.ok) throw new Error('anthropic ' + r.status);
    const j = await r.json();
    const text = (j.content && j.content[0] && j.content[0].text || '').trim();
    return text.replace(/^["'“]|["'”]$/g, '').slice(0, 120) || null;
  };
}

export function savedKey() { try { return localStorage.getItem(KEY_STORE) || ''; } catch { return ''; } }
export function saveKey(k) { try { k ? localStorage.setItem(KEY_STORE, k) : localStorage.removeItem(KEY_STORE); } catch {} }

// Try the key with a minimal request so the panel can show a real status.
export async function testKey(apiKey) {
  const fn = connectClaude(apiKey);
  lastCall = 0;
  const line = await fn({ prompt: 'Say one short greeting from a Stone-Age villager (max 6 words).' });
  return !!line;
}
