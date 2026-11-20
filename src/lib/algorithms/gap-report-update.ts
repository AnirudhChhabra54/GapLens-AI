// ==============================================================================
// GapLens AI — Merge New Assessment Evidence Into the Gap Report
// Pure state transform used by the client workspace context so a submitted
// retest immediately updates mastery, readiness, and blind-spot insight.
// ==============================================================================

import type { BlindSpotItem, GapReportData } from "@/types/assessment";
import type { AssessmentTopicResult } from "@/types/assessment";

export function mergeAssessmentIntoGapReport(
  prevReport: GapReportData,
  results: AssessmentTopicResult[]
): GapReportData {
  const resultMap = new Map(results.map((result) => [result.topicId, result]));

  const updatedTopics = prevReport.topics.map((topic) => {
    const result = resultMap.get(topic.topicId);
    if (!result) return topic;

    const currentBlindSpots = results.filter(
      (r) => r.topicId === topic.topicId && r.blindSpot
    ).length;

    return {
      ...topic,
      masteryScore: result.masteryScore,
      classification: result.classification,
      evidenceLevel: result.evidenceLevel ?? topic.evidenceLevel,
      totalAttempts: result.totalAttempts ?? topic.totalAttempts + 1,
      correctAttempts: result.correctAttempts ?? topic.correctAttempts,
      blindSpotCount: currentBlindSpots,
    };
  });

  const assessed = updatedTopics.filter((topic) => topic.totalAttempts > 0);
  const weighted = assessed.reduce(
    (acc, topic) => acc + topic.masteryScore * (topic.examWeight > 0 ? topic.examWeight : 1),
    0
  );
  const weightTotal = assessed.reduce(
    (acc, topic) => acc + (topic.examWeight > 0 ? topic.examWeight : 1),
    0
  );
  const averageMastery =
    weightTotal > 0 ? Number((weighted / weightTotal).toFixed(1)) : 0;
  const readinessScore = Number(
    ((prevReport.readiness.coveragePercentage / 100) * averageMastery).toFixed(1)
  );

  // Replace prior blind spots for every topic assessed in this submission.
  // A corrected retest removes the stale misconception; a new error adds one.
  const assessedTopicIds = new Set(results.map((result) => result.topicId));
  const retainedItems = prevReport.blindSpots.items.filter(
    (item) => !assessedTopicIds.has(item.topicId)
  );
  const addedItems = results
    .map((result) => result.blindSpot)
    .filter((item): item is BlindSpotItem => Boolean(item));
  const mergedItems = [...retainedItems, ...addedItems];

  const riskCounts = new Map<string, { topicTitle: string; blindSpotCount: number }>();
  for (const item of mergedItems) {
    const current = riskCounts.get(item.topicId);
    riskCounts.set(item.topicId, {
      topicTitle: item.topicTitle,
      blindSpotCount: (current?.blindSpotCount || 0) + 1,
    });
  }
  const highRiskTopics = Array.from(riskCounts.entries())
    .map(([topicId, value]) => ({ topicId, ...value }))
    .sort((a, b) => b.blindSpotCount - a.blindSpotCount);

  return {
    ...prevReport,
    topics: updatedTopics,
    readiness: {
      ...prevReport.readiness,
      averageMastery,
      readinessScore,
    },
    blindSpots: {
      ...prevReport.blindSpots,
      totalBlindSpots: mergedItems.length,
      highRiskTopics,
      items: mergedItems,
    },
  };
}
