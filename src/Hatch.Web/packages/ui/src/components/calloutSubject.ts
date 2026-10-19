/** Which subject's callout is open, under the group's reporting rule: null
    while nothing is open, while the group is suspended, or when the open
    anchor registered no subject; otherwise the subject it registered. */
export function openSubject(
  openId: string | null,
  suspended: boolean,
  subjects: ReadonlyMap<string, string>,
): string | null {
  if (openId === null || suspended) return null;
  return subjects.get(openId) ?? null;
}
