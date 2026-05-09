import { db } from "../../../config/firebase.js";

const DEFAULT_TAG_ID = "tag_gastronomy";

function mapDoc(doc) {
  return {
    id: doc.id,
    ...doc.data(),
  };
}

function sortBySortOrder(items = []) {
  return [...items].sort((a, b) => {
    const sortA = typeof a.sortOrder === "number" ? a.sortOrder : 999;
    const sortB = typeof b.sortOrder === "number" ? b.sortOrder : 999;

    return sortA - sortB;
  });
}

function normalizeTag(tag = {}) {
  return {
    id: tag.id,
    label: tag.label || "Sin etiqueta",
    iconKey: tag.iconKey || null,
    isActive: tag.isActive === true,
    sortOrder: typeof tag.sortOrder === "number" ? tag.sortOrder : 999,

    // El precio vive en la tag principal
    priceConfig: tag.priceConfig || null,
  };
}

function normalizeSubtag(subtag = {}) {
  return {
    id: subtag.id,
    label: subtag.label || "Sin subcategoría",
    tagId: subtag.tagId || null,
    isActive: subtag.isActive === true,
    sortOrder: typeof subtag.sortOrder === "number" ? subtag.sortOrder : 999,
  };
}

function normalizeApproach(approach = {}) {
  return {
    id: approach.id,
    label: approach.label || "Sin enfoque",
    tagId: approach.tagId || null,
    isActive: approach.isActive === true,
    sortOrder: typeof approach.sortOrder === "number" ? approach.sortOrder : 999,
  };
}

async function getActiveTags() {
  const snapshot = await db
    .collection("tag")
    .where("isActive", "==", true)
    .get();

  const tags = snapshot.docs.map(mapDoc).map(normalizeTag);

  return sortBySortOrder(tags);
}

async function getActiveSubtagsByTagId(tagId) {
  const snapshot = await db
    .collection("subtag")
    .where("tagId", "==", tagId)
    .where("isActive", "==", true)
    .get();

  const subtags = snapshot.docs.map(mapDoc).map(normalizeSubtag);

  return sortBySortOrder(subtags);
}

async function getActiveApproachesByTagId(tagId) {
  const snapshot = await db
    .collection("approach")
    .where("tagId", "==", tagId)
    .where("isActive", "==", true)
    .get();

  const approaches = snapshot.docs.map(mapDoc).map(normalizeApproach);

  return sortBySortOrder(approaches);
}

export default async function getCreateCatalogService(tagId) {
  const tags = await getActiveTags();

  if (tags.length === 0) {
    return {
      selectedTagId: null,
      selectedTag: null,
      tags: [],
      subtags: [],
      approaches: [],
      priceConfig: null,
    };
  }

  const requestedTagExists = tagId
    ? tags.some((tag) => tag.id === tagId)
    : false;

  const hasDefaultTag = tags.some((tag) => tag.id === DEFAULT_TAG_ID);

  const selectedTagId = requestedTagExists
    ? tagId
    : hasDefaultTag
    ? DEFAULT_TAG_ID
    : tags[0].id;

  const selectedTag = tags.find((tag) => tag.id === selectedTagId) || null;

  const [subtags, approaches] = await Promise.all([
    getActiveSubtagsByTagId(selectedTagId),
    getActiveApproachesByTagId(selectedTagId),
  ]);

  return {
    selectedTagId,
    selectedTag,

    // Todas las tags para renderizar los chips principales
    tags,

    // Solo las subtags de la tag seleccionada
    subtags,

    // Solo los approaches de la tag seleccionada
    // Si no hay, regresa []
    approaches,

    // El precio sale de la tag principal seleccionada
    priceConfig: selectedTag?.priceConfig || null,
  };
}