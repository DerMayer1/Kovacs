# Local vector memory and privacy

Memory embeddings are generated locally with deterministic feature hashing over normalized tokens and character trigrams. No text is sent to an embedding API. The index is stored in `memory_vectors` beside the existing sourced memory record.

Retrieval combines lexical similarity, cosine similarity, memory confidence, and a small pin bonus. Only `active` memories are eligible. Results disclose `local-hybrid`, the memory source, and a hash prefix as provenance.

Deleting a memory cascades to its vector. Scoped deletion and retention pruning use the same foreign-key boundary. JSON export contains memory records and index metadata (`memory_id`, dimensions, source hash, creation time), not raw vector arrays.

Perception data follows a stricter boundary: raw screenshots, OCR, accessibility values, and titles are transient. A stored context frame contains only compact derived fields and a one-way digest. Private or unauthorized windows never reach perception.
