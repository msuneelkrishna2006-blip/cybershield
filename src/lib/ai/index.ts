/**
 * CyberShield India — AI Engine Index
 *
 * Exports the configured AI provider chain with automatic fallback.
 * Provider order: Gemini → Heuristic Engine
 */

export { type AIProvider, type ScanAnalysisResult, type ChatResponse, type AnalysisInput, type ScanType, type ChatMessage, type RiskLevel, analyzeWithFallback, chatWithFallback, detectPromptInjection, stripSensitiveData } from './provider';
export { GeminiProvider } from './gemini-provider';
export { HeuristicEngine } from './heuristic-engine';

import { type AIProvider } from './provider';
import { GeminiProvider } from './gemini-provider';
import { HeuristicEngine } from './heuristic-engine';

/** Singleton provider chain — ordered by preference */
let _providerChain: AIProvider[] | null = null;

/**
 * Get the configured AI provider chain.
 * Gemini (primary) → Heuristic Engine (always-available fallback).
 */
export function getProviderChain(): AIProvider[] {
  if (_providerChain) return _providerChain;

  _providerChain = [
    new GeminiProvider(),
    new HeuristicEngine(),
  ];

  return _providerChain;
}
