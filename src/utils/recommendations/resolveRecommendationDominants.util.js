import {
  RECOMMENDATION_PROFILE_DEFINITIONS,
} from "../../config/recommendations/recommendationProfile.config.js";

const SCORE_TOLERANCE = 0.000001;

function resolveDominantScoreId({
  scores,
  allowedIds,
  previousId,
  preferredId,
}) {
  const validIds = allowedIds.filter(
    (id) => Number.isFinite(Number(scores?.[id])),
  );

  if (!validIds.length) {
    return null;
  }

  const maximumScore = Math.max(
    ...validIds.map((id) => Number(scores[id])),
  );

  const tiedIds = validIds.filter(
    (id) =>
      Math.abs(
        Number(scores[id]) - maximumScore,
      ) <= SCORE_TOLERANCE,
  );

  if (tiedIds.includes(previousId)) {
    return previousId;
  }

  if (tiedIds.includes(preferredId)) {
    return preferredId;
  }

  return tiedIds[0];
}

export default function resolveRecommendationDominants({
  profileScores,
  subprofileScores,
  previousDominantProfileId,
  previousDominantSubprofileId,
  preferredProfileId,
  preferredSubprofileId,
}) {
  const profileIds = Object.keys(
    RECOMMENDATION_PROFILE_DEFINITIONS,
  );

  const dominantProfileId =
    resolveDominantScoreId({
      scores: profileScores,
      allowedIds: profileIds,
      previousId: previousDominantProfileId,
      preferredId: preferredProfileId,
    });

  const allowedSubprofileIds =
    RECOMMENDATION_PROFILE_DEFINITIONS[
      dominantProfileId
    ]?.subprofileIds || [];

  const previousSubprofileBelongsToDominant =
    allowedSubprofileIds.includes(
      previousDominantSubprofileId,
    );

  const preferredSubprofileBelongsToDominant =
    allowedSubprofileIds.includes(
      preferredSubprofileId,
    );

  const dominantSubprofileId =
    resolveDominantScoreId({
      scores: subprofileScores,
      allowedIds: allowedSubprofileIds,
      previousId:
        previousSubprofileBelongsToDominant
          ? previousDominantSubprofileId
          : null,
      preferredId:
        preferredSubprofileBelongsToDominant
          ? preferredSubprofileId
          : null,
    });

  return {
    dominantProfileId,
    dominantSubprofileId,
  };
}
