import type { Sensitivity } from "./types.js";

const SECRET_PATTERNS: Array<{ expression: RegExp; replacement: string }> = [
  { expression: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, replacement: "[REDACTED_PRIVATE_KEY]" },
  { expression: /\bsk-[A-Za-z0-9_-]{16,}\b/g, replacement: "[REDACTED_OPENAI_TOKEN]" },
  { expression: /\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{20,}\b/g, replacement: "[REDACTED_GITHUB_TOKEN]" },
  { expression: /\b(?:api[_-]?key|access[_-]?token|secret|password)\s*[:=]\s*["']?[^\s"']{8,}["']?/gi, replacement: "[REDACTED_SECRET]" },
  { expression: /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/gi, replacement: "Bearer [REDACTED_TOKEN]" },
];

export function assertSensitivityAllowed(sensitivity: Sensitivity): void {
  if (sensitivity === "restricted") {
    throw new Error("Restricted context is blocked from model processing in Kovacs V0.1.");
  }
}

export function redactSecrets(input: string): { text: string; count: number } {
  let text = input;
  let count = 0;
  for (const pattern of SECRET_PATTERNS) {
    text = text.replace(pattern.expression, () => {
      count += 1;
      return pattern.replacement;
    });
  }
  return { text, count };
}
