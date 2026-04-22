import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import 'dotenv/config';

function getProvider() {
  const explicit = process.env.AI_PROVIDER?.toLowerCase()?.trim();
  if (explicit === 'openai') return 'openai';
  if (explicit === 'anthropic') return 'anthropic';
  if (process.env.OPENAI_API_KEY?.trim()) return 'openai';
  if (process.env.ANTHROPIC_API_KEY?.trim()) return 'anthropic';
  return 'openai';
}

let anthropicClient = null;
let openaiClient = null;

const getAnthropic = () => {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
};

const getOpenAI = () => {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
};

/**
 * Модель для роли пайплайна с учётом активного провайдера.
 * @param {'generator' | 'critic' | 'editor'} role
 */
export function modelFor(role) {
  const provider = getProvider();
  if (provider === 'openai') {
    const fallback = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
    const map = {
      generator: process.env.OPENAI_MODEL_GENERATOR?.trim() || process.env.OPENAI_MODEL?.trim() || 'gpt-4o',
      critic: process.env.OPENAI_MODEL_CRITIC?.trim() || fallback,
      editor: process.env.OPENAI_MODEL_EDITOR?.trim() || process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
    };
    return map[role];
  }
  const map = {
    generator: process.env.ANTHROPIC_MODEL_GENERATOR?.trim() || 'claude-sonnet-4-5',
    critic: process.env.ANTHROPIC_MODEL_CRITIC?.trim() || 'claude-haiku-4-5',
    editor: process.env.ANTHROPIC_MODEL_EDITOR?.trim() || 'claude-haiku-4-5',
  };
  return map[role];
}

function parseModelJSON(text) {
  const clean = text
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();

  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/[\[{][\s\S]*[\]}]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {}
    }
    throw new Error('Model did not return valid JSON: ' + clean.slice(0, 200));
  }
}

async function callOpenAIJSON({ model, system, user, maxTokens }) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error('OPENAI_API_KEY не задан. Укажите ключ в .env или выставьте AI_PROVIDER=anthropic.');
  }
  const client = getOpenAI();
  const resp = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
  });

  const text = resp.choices[0]?.message?.content ?? '';
  if (!text) {
    throw new Error('OpenAI returned empty content');
  }
  return parseModelJSON(text);
}

async function callAnthropicJSON({ model, system, user, maxTokens, cacheSystem }) {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    throw new Error('ANTHROPIC_API_KEY не задан. Укажите ключ в .env или выставьте AI_PROVIDER=openai и OPENAI_API_KEY.');
  }
  const client = getAnthropic();

  // Включаем prompt caching для системного промпта — ускоряет и удешевляет повторные вызовы
  const systemPayload = cacheSystem && system.length > 400
    ? [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]
    : system;

  const resp = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPayload,
    messages: [{ role: 'user', content: user }],
  });

  const text = resp.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  return parseModelJSON(text);
}

/**
 * Вызов модели с ожиданием JSON-ответа.
 * @param {object} opts
 * @param {string} opts.model
 * @param {string} opts.system
 * @param {string} opts.user
 * @param {number} [opts.maxTokens=4096]
 * @param {boolean} [opts.cacheSystem=true] — кешировать системный промпт (Anthropic)
 */
export async function callJSON({ model, system, user, maxTokens = 4096, cacheSystem = true }) {
  const provider = getProvider();
  if (provider === 'openai') {
    return callOpenAIJSON({ model, system, user, maxTokens });
  }
  return callAnthropicJSON({ model, system, user, maxTokens, cacheSystem });
}
