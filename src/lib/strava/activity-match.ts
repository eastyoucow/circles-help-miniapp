export const ACTIVITY_MATCH_PHRASES = [
  "kruzh",
  "круж",
  "circles",
  "evgeny istyukov",
  "serge akhlebinin",
] as const;

export function activityMatchesInitiative(
  title: string,
  description: string,
): boolean {
  const haystack = `${title}\n${description}`.toLowerCase();
  return ACTIVITY_MATCH_PHRASES.some((phrase) =>
    haystack.includes(phrase.toLowerCase()),
  );
}
