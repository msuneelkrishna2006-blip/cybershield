/**
 * CyberShield India — AI Guardian Chat API
 * POST /api/v1/chat
 *
 * Conversational cybersecurity assistant powered by Gemini AI
 * with heuristic fallback. Uses streaming for real-time responses.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { getAccessToken } from '@/lib/auth/cookies';
import { chatWithFallback, getProviderChain, detectPromptInjection, stripSensitiveData } from '@/lib/ai';
import { apiSuccess, apiError } from '@/lib/api/response';

const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().min(1).max(5000),
  })).min(1).max(50),
});

export async function POST(request: NextRequest) {
  try {
    const token = getAccessToken(request);
    if (!token) return apiError('UNAUTHORIZED', 'Authentication required', 401);

    try {
      verifyAccessToken(token);
    } catch {
      return apiError('UNAUTHORIZED', 'Invalid or expired token', 401);
    }

    const body = await request.json();
    const parsed = chatSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid chat input', 400, parsed.error.flatten().fieldErrors);
    }

    const { messages } = parsed.data;

    // Check last user message for prompt injection
    const lastUserMsg = messages.filter(m => m.role === 'user').pop();
    if (lastUserMsg && detectPromptInjection(lastUserMsg.content)) {
      return apiSuccess({
        message: 'I noticed your message contains patterns that look like they might be trying to modify my behavior. I can only help with cybersecurity questions. Could you rephrase your question?',
        suggestions: [
          'How to identify a scam message?',
          'How to report cybercrime in India?',
          'How to protect my UPI account?',
        ],
        provider: 'safety_filter',
      });
    }

    // Strip sensitive data from user messages before sending to AI
    const sanitizedMessages = messages.map(m => ({
      ...m,
      content: m.role === 'user' ? stripSensitiveData(m.content) : m.content,
    }));

    const providers = getProviderChain();
    const { response, provider } = await chatWithFallback(providers, sanitizedMessages);

    return apiSuccess({
      message: response.message,
      suggestions: response.suggestions || [],
      relatedTopics: response.relatedTopics || [],
      provider,
    });
  } catch (error) {
    console.error('[Chat] Error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'Chat service temporarily unavailable', 500);
  }
}
