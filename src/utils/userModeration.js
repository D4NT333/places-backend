export const USER_STATUSES = {
  ACTIVE: "active",
  WARNED: "warned",
  BANNED: "banned",
};

export const MODERATION_TYPES = {
  WARNING: "warning",
  PERMANENT_BAN: "permanent_ban",
};

export const MODERATION_SOURCES = {
  VALIDATED_REPORT: "validated_report",
  MANUAL: "manual",
};

export const MAX_WARNINGS = 4;

export function normalizeWarningCount(value) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  return Math.max(
    Math.trunc(parsedValue),
    0,
  );
}

export function getUserStatusFromWarningCount(
  warningCount,
) {
  const normalizedWarningCount =
    normalizeWarningCount(warningCount);

  if (
    normalizedWarningCount >=
    MAX_WARNINGS
  ) {
    return USER_STATUSES.BANNED;
  }

  if (normalizedWarningCount > 0) {
    return USER_STATUSES.WARNED;
  }

  return USER_STATUSES.ACTIVE;
}