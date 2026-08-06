import {
  RECOMMENDATION_ELIGIBLE_TAG_IDS,
  RECOMMENDATION_SEGMENTATION_MATRIX,
  RECOMMENDATION_VALUE_ALIASES,
} from "../../config/recommendations/recommendationProfile.config.js";

import {
  normalizeRecommendationValues,
} from "../../utils/recommendations/recommendationValue.util.js";

function getPlaceTagValues(place) {
  return [
    place?.tagId,
    place?.tagLabel,
    place?.tag,
    place?.categoryId,
    place?.categoryLabel,
    place?.category,
    place?.tags,
  ];
}

function getPlaceSubtagValues(place) {
  return [
    place?.subtagId,
    place?.subtagIds,
    place?.subtag,
    place?.subtags,
    place?.subcategories,
  ];
}

function getPlaceApproachValues(place) {
  return [
    place?.approachId,
    place?.approachIds,
    place?.approach,
    place?.approaches,
    place?.focus,
    place?.focuses,
  ];
}

export default function resolvePlaceRecommendationTarget(
  place,
) {
  if (!place || typeof place !== "object") {
    return {
      eligible: false,
      reason: "invalid_place",
      target: null,
      matches: [],
    };
  }

  const normalizedTagIds =
    normalizeRecommendationValues(
      getPlaceTagValues(place),
      RECOMMENDATION_VALUE_ALIASES.tags,
    );

  const tagId = normalizedTagIds.find(
    (candidateTagId) =>
      RECOMMENDATION_ELIGIBLE_TAG_IDS.includes(
        candidateTagId,
      ),
  );

  if (!tagId) {
    return {
      eligible: false,
      reason: "tag_not_eligible",
      target: null,
      matches: [],
      normalized: {
        tagIds: normalizedTagIds,
        subtagIds: [],
        approachIds: [],
      },
    };
  }

  const normalizedSubtagIds =
    normalizeRecommendationValues(
      getPlaceSubtagValues(place),
      RECOMMENDATION_VALUE_ALIASES.subtags,
    );

  const normalizedApproachIds =
    normalizeRecommendationValues(
      getPlaceApproachValues(place),
      RECOMMENDATION_VALUE_ALIASES.approaches,
    );

  const tagRules =
    RECOMMENDATION_SEGMENTATION_MATRIX[tagId] ||
    {};

  const matches = [];

  normalizedApproachIds.forEach((approachId) => {
    const rule = tagRules[approachId];

    if (!rule) {
      return;
    }

    const matchedSubtagId =
      normalizedSubtagIds.find((subtagId) =>
        rule.allowedSubtagIds.includes(subtagId),
      );

    if (!matchedSubtagId) {
      return;
    }

    matches.push({
      profileId: rule.profileId,
      subprofileId: rule.subprofileId,
      tagId,
      approachId,
      subtagId: matchedSubtagId,
    });
  });

  if (!matches.length) {
    const hasKnownApproach =
      normalizedApproachIds.some(
        (approachId) => Boolean(tagRules[approachId]),
      );

    return {
      eligible: false,
      reason: hasKnownApproach
        ? "subtag_not_mapped"
        : "approach_not_mapped",
      target: null,
      matches: [],
      normalized: {
        tagIds: normalizedTagIds,
        subtagIds: normalizedSubtagIds,
        approachIds: normalizedApproachIds,
      },
    };
  }

  /*
   * Los lugares normalmente cuentan con un enfoque.
   * Si en datos históricos aparecen varios, conservamos
   * el orden almacenado en el lugar y utilizamos la primera
   * coincidencia válida de forma determinista.
   */
  return {
    eligible: true,
    reason: null,
    target: matches[0],
    matches,
    normalized: {
      tagIds: normalizedTagIds,
      subtagIds: normalizedSubtagIds,
      approachIds: normalizedApproachIds,
    },
  };
}
