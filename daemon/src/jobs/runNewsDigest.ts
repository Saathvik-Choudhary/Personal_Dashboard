/**
 * Daemon-side news digest runner (spec §7.1). Owns persistence: fetch sources → call the pure
 * core job → write digests/{today} + mark the jobRun. The core job itself does no Firestore I/O.
 */
import {
  generateNewsDigest,
  fetchCandidateArticles,
  DEFAULT_SOURCES,
  repositories,
  type Digest,
  type UserProfile,
} from "@orbit/core";

export async function runNewsDigest(
  uid: string,
  profile: UserProfile,
  dateKey: string,
): Promise<{ inputTokens: number; outputTokens: number; itemCount: number }> {
  const sources = profile.newsSources?.length ? profile.newsSources : DEFAULT_SOURCES;
  const articles = await fetchCandidateArticles(sources);

  const { data: items, usage } = await generateNewsDigest({
    topics: profile.newsTopics ?? [],
    articles,
  });

  const digest: Digest = {
    date: dateKey,
    items,
    generatedAt: new Date().toISOString(),
    status: "success",
  };
  await repositories.digests.writeDigest(uid, digest);

  return { ...usage, itemCount: items.length };
}
