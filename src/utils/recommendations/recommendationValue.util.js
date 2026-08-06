const VALUE_FIELDS = [
  "id",
  "value",
  "slug",
  "key",
  "code",
  "label",
  "name",
  "tagId",
  "tagLabel",
  "subtagId",
  "subtagLabel",
  "approachId",
  "approachLabel",
];

export function normalizeRecommendationValue(value) {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    return "";
  }

  return String(value)
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

export function extractRecommendationValues(value) {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(
      extractRecommendationValues,
    );
  }

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return [value];
  }

  if (typeof value !== "object") {
    return [];
  }

  return VALUE_FIELDS.flatMap((field) => {
    const fieldValue = value[field];

    if (
      fieldValue === null ||
      fieldValue === undefined
    ) {
      return [];
    }

    if (
      typeof fieldValue === "string" ||
      typeof fieldValue === "number"
    ) {
      return [fieldValue];
    }

    return [];
  });
}

export function normalizeRecommendationValue(value) {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    return "";
  }

  return String(value)
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    /*
     * Los catálogos de Firestore utilizan IDs como:
     *
     * tag_art
     * subtag_tacos
     * approach_local
     *
     * La matriz utiliza IDs internos limpios:
     *
     * art
     * tacos
     * local
     */
    .replace(/^subtag_/, "")
    .replace(/^approach_/, "")
    .replace(/^tag_/, "");
}

export function firstValidRecommendationValue({
  values,
  allowedValues,
  aliases = {},
}) {
  const allowedSet = new Set(allowedValues);

  return (
    normalizeRecommendationValues(
      values,
      aliases,
    ).find((value) => allowedSet.has(value)) ||
    null
  );
}
