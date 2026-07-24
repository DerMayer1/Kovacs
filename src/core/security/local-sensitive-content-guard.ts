import { inspectSensitiveContent, type SensitiveContentCategory } from "./sensitive-content.js";

export interface GuardedText {
  text: string;
  sensitive_count: number;
  sensitive_categories: SensitiveContentCategory[];
  prompt_injection_detected: boolean;
}

const PROMPT_INJECTION = /\b(ignore|disregard|override|forget)\b.{0,80}\b(previous|prior|system|developer|instructions?|rules?|policy)\b|\b(system prompt|developer message|jailbreak)\b/i;

export class LocalSensitiveContentGuard {
  constructor(private readonly restrictedTerms: string[] = []) {}

  inspect(value: string): GuardedText {
    const inspected = inspectSensitiveContent(value, this.restrictedTerms);
    return { text: inspected.text, sensitive_count: inspected.count, sensitive_categories: inspected.categories,
      prompt_injection_detected: PROMPT_INJECTION.test(value) };
  }
}
