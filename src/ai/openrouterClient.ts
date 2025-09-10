import 'dotenv/config';
// Use OpenPipe wrapper around the OpenAI SDK to add OpenPipe headers automatically
import OpenAI from 'openpipe/openai';
import logger from '../lib/logger';

/**
 * OpenRouter API client factory and singleton accessor.
 *
 * Why: Provide a centralized, typed client configured for OpenRouter routing.
 * How: Use OpenAI SDK with base_url pointing to OpenRouter as per Quickstart docs.
 * Docs: https://openrouter.ai/docs/quickstart
 */

// Environment variable keys used for configuration
const OR_API_KEY_ENV = 'OPENROUTER_API_KEY';
const OR_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const OP_API_KEY_ENV = 'OPENPIPE_API_KEY';

let client: OpenAI | null = null;

/**
 * createClient
 * Create a new OpenAI client configured for OpenRouter.
 */
export function createClient(): OpenAI {
  const apiKey = process.env[OR_API_KEY_ENV];

  if (!apiKey) {
    // Log with guidance so developers know how to set it up
    logger.error(
      'Missing OPENROUTER_API_KEY. Please set it in .env (see .env.example).'
    );
    throw new Error('OPENROUTER_API_KEY not set');
  }

  // Optional attribution headers as per docs
  const httpReferer = process.env.OPENROUTER_HTTP_REFERER; // e.g., https://your.app
  const xTitle = process.env.OPENROUTER_X_TITLE; // e.g., Your App Name
  const openpipeApiKey = process.env[OP_API_KEY_ENV];

  const instance = new OpenAI({
    baseURL: OR_BASE_URL,
    apiKey,
    // Pass OpenPipe API key so requests include the OpenPipe header automatically
    ...(openpipeApiKey
      ? { openpipe: { apiKey: openpipeApiKey } as any }
      : {}),
    defaultHeaders: {
      ...(!!httpReferer ? { 'HTTP-Referer': httpReferer } : {}),
      ...(!!xTitle ? { 'X-Title': xTitle } : {}),
    },
  });

  logger.info('OpenRouter client initialized', { baseURL: OR_BASE_URL });
  return instance;
}

/**
 * getClient
 * Get or lazily initialize the OpenRouter client singleton.
 */
export function getClient(): OpenAI {
  if (!client) {
    client = createClient();
  }
  return client;
}

export default getClient;

