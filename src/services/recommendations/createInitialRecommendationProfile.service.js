import {
  RECOMMENDATION_EVENT_TYPES,
  RECOMMENDATION_PROFILE_DEFINITIONS,
  RECOMMENDATION_PROFILE_VERSION,
  RECOMMENDATION_SCORE_LIMITS,
  RECOMMENDATION_SUBPROFILE_DEFINITIONS,
} from "../../config/recommendations/recommendationProfile.config.js";

import {
  firstValidRecommendationValue,
  normalizeRecommendationValues,
} from "../../utils/recommendations/recommendationValue.util.js";

function buildInitialScores(
  definitions,
  initialScore,
) {
  return Object.keys(definitions).reduce(
    (result, id) => {
      result[id] = initialScore;
      return result;
    },
    {},
  );
}

function getProfileCandidates(userData) {
  return [
    userData?.dominantProfileId,
    userData?.profileId,
    userData?.initialProfileId,
    userData?.profile,
    userData?.recommendation?.profileId,
    userData?.recommendation?.profile,
    userData?.preferences?.profileId,
    userData?.preferences?.profile,
  ];
}

function getSubprofileCandidates(userData) {
  return [
    userData?.dominantSubprofileId,
    userData?.subprofileId,
    userData?.initialSubprofileId,
    userData?.subprofile,
    userData?.recommendation?.subprofileId,
    userData?.recommendation?.subprofile,
    userData?.preferences?.subprofileId,
    userData?.preferences?.subprofile,
  ];
}

export function resolveInitialRecommendationSelection({
  userData,
  fallbackTarget,
}) {
  const profileIds = Object.keys(
    RECOMMENDATION_PROFILE_DEFINITIONS,
  );

  const subprofileIds = Object.keys(
    RECOMMENDATION_SUBPROFILE_DEFINITIONS,
  );

  let profileId = firstValidRecommendationValue({
    values: getProfileCandidates(userData),
    allowedValues: profileIds,
  });

  let subprofileId =
    firstValidRecommendationValue({
      values: getSubprofileCandidates(userData),
      allowedValues: subprofileIds,
    });

  if (subprofileId && !profileId) {
    profileId =
      RECOMMENDATION_SUBPROFILE_DEFINITIONS[
        subprofileId
      ]?.profileId || null;
  }

  if (
    profileId &&
    subprofileId &&
    RECOMMENDATION_SUBPROFILE_DEFINITIONS[
      subprofileId
    ]?.profileId !== profileId
  ) {
    subprofileId = null;
  }

  if (!profileId) {
    profileId = fallbackTarget?.profileId || null;
  }

  if (
    !subprofileId &&
    fallbackTarget?.profileId === profileId
  ) {
    subprofileId =
      fallbackTarget?.subprofileId || null;
  }

  return {
    profileId,
    subprofileId,
  };
}

function normalizeBoundedScore(
  value,
  limits,
) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return limits.initial;
  }

  return Math.min(
    Math.max(parsed, limits.min),
    limits.max,
  );
}

export function normalizeRecommendationProfile({
  profileData,
  userData,
  fallbackTarget,
  uid,
  now,
}) {
  const initialSelection =
    resolveInitialRecommendationSelection({
      userData,
      fallbackTarget,
    });

  const profileScores = Object.keys(
    RECOMMENDATION_PROFILE_DEFINITIONS,
  ).reduce((result, profileId) => {
    result[profileId] = normalizeBoundedScore(
      profileData?.profileScores?.[profileId],
      RECOMMENDATION_SCORE_LIMITS.profile,
    );

    return result;
  }, {});

  const subprofileScores = Object.keys(
    RECOMMENDATION_SUBPROFILE_DEFINITIONS,
  ).reduce((result, subprofileId) => {
    const profileId =
      RECOMMENDATION_SUBPROFILE_DEFINITIONS[
        subprofileId
      ].profileId;

    const currentValue =
      profileData?.subprofileScores?.[
        subprofileId
      ] ??
      profileData?.subprofileScores?.[
        profileId
      ]?.[subprofileId];

    result[subprofileId] =
      normalizeBoundedScore(
        currentValue,
        RECOMMENDATION_SCORE_LIMITS.subprofile,
      );

    return result;
  }, {});

  const validProfileIds = Object.keys(
    RECOMMENDATION_PROFILE_DEFINITIONS,
  );

  const validSubprofileIds = Object.keys(
    RECOMMENDATION_SUBPROFILE_DEFINITIONS,
  );

  const storedDominantProfileId =
    normalizeRecommendationValues([
      profileData?.dominantProfileId,
      profileData?.dominant?.profileId,
    ]).find((value) =>
      validProfileIds.includes(value),
    ) || null;

  const storedDominantSubprofileId =
    normalizeRecommendationValues([
      profileData?.dominantSubprofileId,
      profileData?.dominant?.subprofileId,
    ]).find((value) =>
      validSubprofileIds.includes(value),
    ) || null;

  return {
    version: RECOMMENDATION_PROFILE_VERSION,
    uid,

    dominantProfileId:
      storedDominantProfileId ||
      initialSelection.profileId,

    dominantSubprofileId:
      storedDominantSubprofileId ||
      initialSelection.subprofileId,

    profileScores,
    subprofileScores,

    interactionTotals: {
      ...Object.values(
        RECOMMENDATION_EVENT_TYPES,
      ).reduce((result, eventType) => {
        result[eventType] = 0;
        return result;
      }, {}),
      ...(profileData?.interactionTotals || {}),
    },

    processedEventsCount:
      Number.isFinite(
        Number(profileData?.processedEventsCount),
      )
        ? Math.max(
            Math.trunc(
              Number(
                profileData.processedEventsCount,
              ),
            ),
            0,
          )
        : 0,

    createdAt:
      profileData?.createdAt || now,

    updatedAt:
      profileData?.updatedAt || now,
  };
}

export default function createInitialRecommendationProfile({
  uid,
  userData,
  fallbackTarget = null,
  now,
}) {
  const selection =
    resolveInitialRecommendationSelection({
      userData,
      fallbackTarget,
    });

  return {
    version: RECOMMENDATION_PROFILE_VERSION,
    uid,

    dominantProfileId: selection.profileId,
    dominantSubprofileId:
      selection.subprofileId,

    profileScores: buildInitialScores(
      RECOMMENDATION_PROFILE_DEFINITIONS,
      RECOMMENDATION_SCORE_LIMITS.profile.initial,
    ),

    subprofileScores: buildInitialScores(
      RECOMMENDATION_SUBPROFILE_DEFINITIONS,
      RECOMMENDATION_SCORE_LIMITS
        .subprofile.initial,
    ),

    interactionTotals: Object.values(
      RECOMMENDATION_EVENT_TYPES,
    ).reduce((result, eventType) => {
      result[eventType] = 0;
      return result;
    }, {}),

    processedEventsCount: 0,
    lastEvent: null,

    createdAt: now,
    updatedAt: now,
  };
}
