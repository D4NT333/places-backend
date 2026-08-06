import {
  RECOMMENDATION_EVENT_IMPACTS,
  RECOMMENDATION_PROFILE_DEFINITIONS,
  RECOMMENDATION_PROFILE_VERSION,
  RECOMMENDATION_SCORE_LIMITS,
} from "../../config/recommendations/recommendationProfile.config.js";

import {
  moveScoresAwayFromTarget,
  moveScoresTowardTarget,
} from "../../utils/recommendations/redistributeRecommendationScores.util.js";

import resolveRecommendationDominants from "../../utils/recommendations/resolveRecommendationDominants.util.js";

import resolvePlaceRecommendationTarget from "./resolvePlaceRecommendationTarget.service.js";

import {
  normalizeRecommendationProfile,
} from "./createInitialRecommendationProfile.service.js";

function getSnapshotData(snapshot) {
  if (!snapshot?.exists) {
    return null;
  }

  return snapshot.data() || null;
}

function normalizeCount(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(Math.trunc(parsed), 0);
}

function getPlaceId(place) {
  return String(
    place?.placeId || place?.id || "",
  ).trim();
}

function buildPreferredRecipientWeights(
  storedDeltas,
  targetId,
) {
  if (!storedDeltas || typeof storedDeltas !== "object") {
    return null;
  }

  return Object.entries(storedDeltas).reduce(
    (result, [scoreId, delta]) => {
      if (scoreId === targetId) {
        return result;
      }

      const parsedDelta = Number(delta);

      if (
        Number.isFinite(parsedDelta) &&
        parsedDelta < 0
      ) {
        result[scoreId] = Math.abs(parsedDelta);
      }

      return result;
    },
    {},
  );
}

function getTargetFromReverseImpact(reverseImpact) {
  const target = reverseImpact?.target;

  if (
    !target?.profileId ||
    !target?.subprofileId
  ) {
    return null;
  }

  return {
    profileId: target.profileId,
    subprofileId: target.subprofileId,
    tagId: target.tagId || null,
    approachId: target.approachId || null,
    subtagId: target.subtagId || null,
  };
}

export default function applyRecommendationEventService({
  transaction,
  profileRef,
  profileSnapshot,
  userData,
  uid,
  place,
  eventType,
  eventId = null,
  reverseImpact = null,
  now,
}) {
  if (
    !transaction ||
    typeof transaction.set !== "function"
  ) {
    throw new Error(
      "La transacción es obligatoria para actualizar el perfil.",
    );
  }

  if (!profileRef) {
    throw new Error(
      "La referencia del perfil es obligatoria.",
    );
  }

  const eventImpact =
    RECOMMENDATION_EVENT_IMPACTS[eventType];

  if (!eventImpact) {
    return {
      updated: false,
      reason: "event_not_supported",
      impact: null,
    };
  }

  const resolvedPlaceTarget =
    resolvePlaceRecommendationTarget(place);

  const storedReverseTarget =
    getTargetFromReverseImpact(reverseImpact);

  const target =
    eventImpact.direction < 0 &&
    storedReverseTarget
      ? storedReverseTarget
      : resolvedPlaceTarget.target;

  if (!target) {
    return {
      updated: false,
      reason:
        resolvedPlaceTarget.reason ||
        "place_target_not_resolved",
      impact: null,
      resolution: resolvedPlaceTarget,
    };
  }

  const profileData = getSnapshotData(
    profileSnapshot,
  );

  const currentProfile =
    normalizeRecommendationProfile({
      profileData,
      userData,
      fallbackTarget: target,
      uid,
      now,
    });

  const profileIds = Object.keys(
    RECOMMENDATION_PROFILE_DEFINITIONS,
  );

  const siblingSubprofileIds =
    RECOMMENDATION_PROFILE_DEFINITIONS[
      target.profileId
    ]?.subprofileIds || [];

  let profileResult;
  let subprofileResult;

  if (eventImpact.direction > 0) {
    profileResult = moveScoresTowardTarget({
      scores: currentProfile.profileScores,
      scoreIds: profileIds,
      targetId: target.profileId,
      requestedWeight: eventImpact.weight,
      limits: RECOMMENDATION_SCORE_LIMITS.profile,
    });

    subprofileResult = moveScoresTowardTarget({
      scores: currentProfile.subprofileScores,
      scoreIds: siblingSubprofileIds,
      targetId: target.subprofileId,
      requestedWeight: eventImpact.weight,
      limits:
        RECOMMENDATION_SCORE_LIMITS.subprofile,
    });
  } else {
    const profileReverseWeight = Number(
      reverseImpact?.profile?.appliedWeight,
    );

    const subprofileReverseWeight = Number(
      reverseImpact?.subprofile?.appliedWeight,
    );

    profileResult = moveScoresAwayFromTarget({
      scores: currentProfile.profileScores,
      scoreIds: profileIds,
      targetId: target.profileId,
      requestedWeight:
        Number.isFinite(profileReverseWeight)
          ? profileReverseWeight
          : eventImpact.weight,
      limits: RECOMMENDATION_SCORE_LIMITS.profile,
      preferredRecipientWeights:
        buildPreferredRecipientWeights(
          reverseImpact?.profile?.deltas,
          target.profileId,
        ),
    });

    subprofileResult = moveScoresAwayFromTarget({
      scores: currentProfile.subprofileScores,
      scoreIds: siblingSubprofileIds,
      targetId: target.subprofileId,
      requestedWeight:
        Number.isFinite(subprofileReverseWeight)
          ? subprofileReverseWeight
          : eventImpact.weight,
      limits:
        RECOMMENDATION_SCORE_LIMITS.subprofile,
      preferredRecipientWeights:
        buildPreferredRecipientWeights(
          reverseImpact?.subprofile?.deltas,
          target.subprofileId,
        ),
    });
  }

  const nextProfileScores =
    profileResult.scores;

  const nextSubprofileScores = {
    ...currentProfile.subprofileScores,
    ...subprofileResult.scores,
  };

  const dominants =
    resolveRecommendationDominants({
      profileScores: nextProfileScores,
      subprofileScores: nextSubprofileScores,
      previousDominantProfileId:
        currentProfile.dominantProfileId,
      previousDominantSubprofileId:
        currentProfile.dominantSubprofileId,
      preferredProfileId: target.profileId,
      preferredSubprofileId:
        target.subprofileId,
    });

  const interactionTotals = {
    ...currentProfile.interactionTotals,
    [eventType]:
      normalizeCount(
        currentProfile.interactionTotals?.[
          eventType
        ],
      ) + 1,
  };

  const applied =
    profileResult.appliedWeight > 0 ||
    subprofileResult.appliedWeight > 0;

  const impact = eventImpact.direction > 0
    ? {
        version: RECOMMENDATION_PROFILE_VERSION,
        sourceEventId: eventId,
        sourceEventType: eventType,
        target,
        profile: {
          appliedWeight:
            profileResult.appliedWeight,
          deltas: profileResult.deltas,
        },
        subprofile: {
          appliedWeight:
            subprofileResult.appliedWeight,
          deltas: subprofileResult.deltas,
        },
        appliedAt: now,
      }
    : null;

  const nextProfile = {
    version: RECOMMENDATION_PROFILE_VERSION,
    uid,

    dominantProfileId:
      dominants.dominantProfileId,

    dominantSubprofileId:
      dominants.dominantSubprofileId,

    profileScores: nextProfileScores,
    subprofileScores: nextSubprofileScores,

    interactionTotals,

    processedEventsCount:
      currentProfile.processedEventsCount + 1,

    lastEvent: {
      eventId,
      eventType,
      placeId: getPlaceId(place),
      direction: eventImpact.direction,
      target,
      applied,
      profileAppliedWeight:
        profileResult.appliedWeight,
      subprofileAppliedWeight:
        subprofileResult.appliedWeight,
      createdAt: now,
    },

    createdAt: currentProfile.createdAt,
    updatedAt: now,
  };

  transaction.set(
    profileRef,
    nextProfile,
    {
      merge: true,
    },
  );

  return {
    updated: true,
    applied,
    reason: applied
      ? null
      : "score_limits_reached",
    target,
    dominantProfileId:
      dominants.dominantProfileId,
    dominantSubprofileId:
      dominants.dominantSubprofileId,
    profileScores: nextProfileScores,
    subprofileScores: nextSubprofileScores,
    impact,
    resolution: resolvedPlaceTarget,
  };
}
