import type { Sensitivity } from "../coaching/types.js";

export type SensitiveContentCategory = "private_key" | "openai_token" | "github_token" | "credential" | "bearer_token" | "connection_string" | "email" | "restricted_term";

const SECRET_PATTERNS: Array<{ category: SensitiveContentCategory; expression: RegExp; replacement: string }> = [
  { category: "private_key", expression: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, replacement: "[REDACTED_PRIVATE_KEY]" },
  { category: "openai_token", expression: /\bsk-[A-Za-z0-9_-]{16,}\b/g, replacement: "[REDACTED_OPENAI_TOKEN]" },
  { category: "github_token", expression: /\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{20,}\b/g, replacement: "[REDACTED_GITHUB_TOKEN]" },
  { category: "credential", expression: /\b(?:api[_-]?key|access[_-]?token|secret|password)\s*[:=]\s*["']?[^\s"']{8,}["']?/gi, replacement: "[REDACTED_SECRET]" },
  { category: "bearer_token", expression: /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/gi, replacement: "Bearer [REDACTED_TOKEN]" },
  { category: "connection_string", expression: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s"']+/gi, replacement: "[REDACTED_CONNECTION_STRING]" },
  { category: "email", expression: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: "[REDACTED_EMAIL]" },
];

export function assertSensitivityAllowed(sensitivity: Sensitivity): void {
  if (sensitivity === "restricted") {
    throw new Error("Restricted context is blocked from model processing in Kovacs V0.1.");
  }
}

export function redactSecrets(input: string): { text: string; count: number } {
  const inspected = inspectSensitiveContent(input);
  return { text: inspected.text, count: inspected.count };
}

export function inspectSensitiveContent(input: string, restrictedTerms: string[] = []): { text: string; count: number; categories: SensitiveContentCategory[] } {
  let text = input;
  let count = 0;
  const categories = new Set<SensitiveContentCategory>();
  for (const pattern of SECRET_PATTERNS) {
    text = text.replace(pattern.expression, () => {
      count += 1;
      categories.add(pattern.category);
      return pattern.replacement;
    });
  }
  for (const term of restrictedTerms.map((item) => item.trim()).filter((item) => item.length >= 2)) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(escaped, "gi"), () => { count += 1; categories.add("restricted_term"); return "[REDACTED_RESTRICTED_TERM]"; });
  }
  return { text, count, categories: [...categories] };
}
