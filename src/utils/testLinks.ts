/** Labels for online test access links when the test has two question groups. */
export const TEST_GROUP_LABELS: Record<number, string> = {
  1: 'I група',
  2: 'II група',
};

/** Base URL for student-facing test links (defaults to current app origin). */
export function getPublicAppOrigin(): string {
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
  const configured = env?.VITE_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}

/** Build the shareable URL for an online test access token. */
export function buildOnlineTestLink(token: string): string {
  const origin = getPublicAppOrigin();
  const encoded = encodeURIComponent(token);
  return `${origin}/take/${encoded}`;
}

export interface TestLinkEntry {
  groupNumber: number;
  label?: string;
  url: string;
}

export function buildTestLinkEntries(
  tokens: { group_number: number; token: string }[],
  hasGroups: boolean
): TestLinkEntry[] {
  const sorted = [...tokens].sort((a, b) => a.group_number - b.group_number);
  return sorted.map(row => ({
    groupNumber: row.group_number,
    label: hasGroups ? TEST_GROUP_LABELS[row.group_number] : undefined,
    url: buildOnlineTestLink(row.token),
  }));
}
