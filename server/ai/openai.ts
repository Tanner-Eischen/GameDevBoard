import OpenAI from "openai";
import { getEnvironment } from '../config/env.js';

const env = getEnvironment();

export const openai = new OpenAI({
  apiKey: env.AI_INTEGRATIONS_OPENAI_API_KEY || env.OPENAI_API_KEY,
  baseURL: env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});
