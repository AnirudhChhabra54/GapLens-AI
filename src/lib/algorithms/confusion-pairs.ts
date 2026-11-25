// ==============================================================================
// GapLens AI — Semantic Confusion Pair Detector
// Identifies pairs of closely related syllabus concepts where at least one
// exhibits low mastery or blind spots, enabling targeted contrast drills.
// ==============================================================================

import type { TopicMastery } from "@/types/assessment";
import { generateDeterministic768dEmbedding } from "@/lib/ai/provider";
import { cosineSimilarity } from "@/lib/rag/hybrid-retrieval";

export interface ConfusionPair {
  topicA: TopicMastery;
  topicB: TopicMastery;
  similarityScore: number;
  reason: string;
}

/**
 * Detects semantically close topic pairs where students risk mixing up definitions.
 */
export function detectConfusionPairs(topics: TopicMastery[], limit = 3): ConfusionPair[] {
  if (topics.length < 2) return [];

  const vectors = topics.map((t) =>
    generateDeterministic768dEmbedding(`${t.topicTitle} ${t.unitModule || ""}`)
  );

  const pairs: ConfusionPair[] = [];

  for (let i = 0; i < topics.length; i++) {
    for (let j = i + 1; j < topics.length; j++) {
      const a = topics[i];
      const b = topics[j];
      const hasRisk =
        a.classification === "weak" ||
        b.classification === "weak" ||
        a.blindSpotCount > 0 ||
        b.blindSpotCount > 0;
      if (!hasRisk) continue;

      const sameUnit = Boolean(a.unitModule && b.unitModule && a.unitModule === b.unitModule);
      const sim = cosineSimilarity(vectors[i], vectors[j]) + (sameUnit ? 0.12 : 0);

      pairs.push({
        topicA: a,
        topicB: b,
        similarityScore: Number(Math.min(0.99, sim).toFixed(2)),
        reason: sameUnit
          ? `Shared unit (${a.unitModule}) with active mastery gap — high risk of concept bleed.`
          : `Semantically adjacent concepts with active mastery deficit.`,
      });
    }
  }

  return pairs.sort((x, y) => y.similarityScore - x.similarityScore).slice(0, limit);
}
