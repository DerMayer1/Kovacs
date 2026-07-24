import { createHash } from "node:crypto";

export const LOCAL_VECTOR_DIMENSIONS = 256;

function features(text: string): string[] {
  const normalized = text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s._/-]+/g, " ").replace(/\s+/g, " ").trim();
  const words = normalized.split(" ").filter((token) => token.length > 1);
  const trigrams: string[] = [];
  for (const word of words) {
    const padded = `^${word}$`;
    for (let index = 0; index <= padded.length - 3; index += 1) trigrams.push(`tri:${padded.slice(index, index + 3)}`);
  }
  return [...words.map((word) => `word:${word}`), ...trigrams];
}

function bucket(feature: string): { index: number; sign: number } {
  const digest = createHash("sha256").update(feature).digest();
  return { index: digest.readUInt16BE(0) % LOCAL_VECTOR_DIMENSIONS, sign: digest[2]! % 2 === 0 ? 1 : -1 };
}

export function embedLocally(text: string): number[] {
  const vector = Array.from({ length: LOCAL_VECTOR_DIMENSIONS }, () => 0);
  for (const feature of features(text)) {
    const target = bucket(feature);
    vector[target.index] = vector[target.index]! + target.sign;
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return magnitude ? vector.map((value) => Number((value / magnitude).toFixed(6))) : vector;
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length !== right.length || left.length === 0) return 0;
  let dot = 0; let leftMagnitude = 0; let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index]! * right[index]!;
    leftMagnitude += left[index]! ** 2; rightMagnitude += right[index]! ** 2;
  }
  return leftMagnitude && rightMagnitude ? dot / Math.sqrt(leftMagnitude * rightMagnitude) : 0;
}

export function lexicalSimilarity(query: string, candidate: string): number {
  const queryTerms = new Set(features(query).filter((item) => item.startsWith("word:")));
  const candidateTerms = new Set(features(candidate).filter((item) => item.startsWith("word:")));
  if (!queryTerms.size || !candidateTerms.size) return 0;
  const overlap = [...queryTerms].filter((term) => candidateTerms.has(term)).length;
  return overlap / Math.max(queryTerms.size, candidateTerms.size);
}

export function vectorSourceHash(text: string): string { return createHash("sha256").update(text).digest("hex"); }
