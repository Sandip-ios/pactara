/** Who counts as a new-version member for crew discovery. Server-side only callers pass profile rows. */
export type VersionProfile = { new_version_enabled: boolean | null; app_version: string | null } | null | undefined;

export const isOnNewVersion = (p: VersionProfile): boolean => p?.new_version_enabled === true && p?.app_version === "new";

/** Discoverable flag for a newly created crew: classic creators always false; new-version creators default true. */
export const discoverableOnCreate = (creator: VersionProfile, requested: boolean | undefined): boolean =>
  isOnNewVersion(creator) && requested !== false;

/** Find a crew shows a crew only when it is discoverable and its owner is on the new version. */
export const shownInFindACrew = (discoverable: boolean, owner: VersionProfile): boolean => discoverable && isOnNewVersion(owner);
