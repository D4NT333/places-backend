import { db } from "../../../config/firebase.js";

const SUBTAGS_COLLECTION = "subtag";
const TAGS_COLLECTION = "tag";

const GOOGLE_FAVORITE_MEDIUM_WIDTH = 720;
const GOOGLE_FAVORITE_THUMBNAIL_WIDTH = 320;
const FAVORITES_MAX_SUBTAGS = 2;

function createHttpError(
  message,
  statusCode = 400
) {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
}

function getPublicApiUrl() {
  return cleanText(
    process.env.PUBLIC_API_URL,
  ).replace(/\/+$/, "");
}

function buildGooglePhotoProxyUrl({
  reference,
  maxWidthPx,
}) {
  const cleanReference =
    cleanText(reference);

  const publicApiUrl =
    getPublicApiUrl();

  if (
    !cleanReference ||
    !publicApiUrl
  ) {
    return "";
  }

  return (
    `${publicApiUrl}/api/places/feed-photo/google` +
    `?reference=${encodeURIComponent(
      cleanReference,
    )}` +
    `&maxWidthPx=${maxWidthPx}`
  );
}

function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item) =>
        typeof item === "string"
    )
    .map((item) =>
      item.trim()
    )
    .filter(Boolean);
}

function normalizeMainPhoto(mainPhoto) {
  if (
    !mainPhoto ||
    typeof mainPhoto !== "object"
  ) {
    return null;
  }

  const source =
    cleanText(mainPhoto.source);

  const order =
    Number.isFinite(
      Number(mainPhoto.order),
    )
      ? Number(mainPhoto.order)
      : 0;

  /*
   * Lugar proveniente de Google.
   *
   * La referencia se convierte en URLs
   * mediante el mismo proxy usado por Home.
   */
  if (
    source === "google" &&
    cleanText(mainPhoto.reference)
  ) {
    const reference =
      cleanText(mainPhoto.reference);

    const mediumUrl =
      buildGooglePhotoProxyUrl({
        reference,
        maxWidthPx:
          GOOGLE_FAVORITE_MEDIUM_WIDTH,
      });

    const thumbnailUrl =
      buildGooglePhotoProxyUrl({
        reference,
        maxWidthPx:
          GOOGLE_FAVORITE_THUMBNAIL_WIDTH,
      });

    return {
      source,
      reference,
      order,

      url:
        mediumUrl ||
        thumbnailUrl ||
        "",

      mediumUrl:
        mediumUrl || "",

      thumbnailUrl:
        thumbnailUrl || "",

      widthPx:
        Number.isFinite(
          Number(mainPhoto.widthPx),
        )
          ? Number(mainPhoto.widthPx)
          : null,

      heightPx:
        Number.isFinite(
          Number(mainPhoto.heightPx),
        )
          ? Number(mainPhoto.heightPx)
          : null,
    };
  }

  /*
   * Lugar proveniente de una submission.
   *
   * La mainPhoto ya contiene las variantes
   * medium y posiblemente thumbnail.
   */
  const mediumUrl =
    cleanText(
      mainPhoto?.medium?.url ||
        mainPhoto?.mediumUrl ||
        mainPhoto?.url,
    );

  const thumbnailUrl =
    cleanText(
      mainPhoto?.thumbnail?.url ||
        mainPhoto?.thumbnailUrl,
    );

  return {
    source:
      source || "user",

    photoId:
      cleanText(mainPhoto.photoId),

    order,

    url:
      mediumUrl ||
      thumbnailUrl ||
      "",

    mediumUrl:
      mediumUrl || "",

    thumbnailUrl:
      thumbnailUrl || "",

    widthPx:
      Number.isFinite(
        Number(
          mainPhoto?.medium?.width ??
            mainPhoto?.medium?.widthPx ??
            mainPhoto?.widthPx,
        ),
      )
        ? Number(
            mainPhoto?.medium?.width ??
              mainPhoto?.medium?.widthPx ??
              mainPhoto?.widthPx,
          )
        : null,

    heightPx:
      Number.isFinite(
        Number(
          mainPhoto?.medium?.height ??
            mainPhoto?.medium?.heightPx ??
            mainPhoto?.heightPx,
        ),
      )
        ? Number(
            mainPhoto?.medium?.height ??
              mainPhoto?.medium?.heightPx ??
              mainPhoto?.heightPx,
          )
        : null,
  };
}

async function mapFavoriteDoc(
  favoriteDoc,
  placeSnapshot,
) {
  const favorite =
    favoriteDoc.data();

  const place =
    placeSnapshot.data();

  const placeSubtags =
    normalizeStringArray(
      place.subtags,
    );

  const favoriteSubtags =
    normalizeStringArray(
      favorite.subtags,
    );

  const subtags =
    await normalizeSubtagsWithLabels(
      placeSubtags.length > 0
        ? placeSubtags
        : favoriteSubtags,
    );

  const googleRating =
    Number(
      place?.googleData?.rating,
    );

  const averageRating =
    Number(
      place?.metrics?.averageRating,
    );

  const favoriteRating =
    Number(favorite.rating);

    const tagId =
  cleanText(place.tagId) ||
  cleanText(favorite.tagId);

const storedTagLabel =
  cleanText(place.tagLabel) ||
  cleanText(favorite.tagLabel);

const tagLabel =
  storedTagLabel ||
  await getTagLabelById(tagId);

  return {
    id:
      favoriteDoc.id,

    placeId:
      cleanText(place.placeId) ||
      placeSnapshot.id,

    placeName:
      cleanText(place.name) ||
      cleanText(
        favorite.placeName,
      ) ||
      "Lugar sin nombre",

   tagId,
tagLabel,

    subtags,

    rating:
      Number.isFinite(
        googleRating,
      ) &&
      googleRating > 0
        ? googleRating
        : Number.isFinite(
              averageRating,
            ) &&
            averageRating > 0
          ? averageRating
          : Number.isFinite(
                favoriteRating,
              )
            ? favoriteRating
            : 0,

    mainPhoto:
      normalizeMainPhoto(
        place.mainPhoto,
      ) ||
      normalizeMainPhoto(
        favorite.mainPhoto,
      ),

    status:
      cleanText(place.status) ||
      "published",

    activityStatus:
      cleanText(
        place.activityStatus,
      ),

    createdAt:
      favorite.createdAt ||
      null,
  };
}

function isPlaceVisibleInMobile(place) {
  if (!place) {
    return false;
  }

  const moderationStatus =
    cleanText(
      place.status,
    ).toLowerCase();

  const activityStatus =
    cleanText(
      place.activityStatus,
    ).toLowerCase();

  if (place.deletedAt) {
    return false;
  }

  if (
    [
      "hidden",
      "blocked",
      "deleted",
    ].includes(
      moderationStatus,
    )
  ) {
    return false;
  }

  if (
    activityStatus ===
    "inactive"
  ) {
    return false;
  }

  return true;
}

async function getTagLabelById(tagId) {
  const cleanTagId =
    cleanText(tagId);

  if (!cleanTagId) {
    return "";
  }

  try {
    const tagDoc = await db
      .collection(TAGS_COLLECTION)
      .doc(cleanTagId)
      .get();

    if (!tagDoc.exists) {
      return cleanTagId;
    }

    const tag = tagDoc.data();

    return (
      cleanText(tag.label) ||
      cleanText(tag.name) ||
      cleanText(tag.title) ||
      cleanTagId
    );
  } catch (error) {
    console.error(
      "Error obteniendo label de tag:",
      error,
    );

    return cleanTagId;
  }
}

async function getSubtagLabelById(
  subtagId,
) {
  const cleanSubtagId =
    cleanText(subtagId);

  if (!cleanSubtagId) {
    return "";
  }

  try {
    const subtagDoc = await db
      .collection(
        SUBTAGS_COLLECTION,
      )
      .doc(cleanSubtagId)
      .get();

    if (!subtagDoc.exists) {
      return cleanSubtagId;
    }

    const subtag =
      subtagDoc.data();

    return (
      cleanText(subtag.label) ||
      cleanText(subtag.name) ||
      cleanText(subtag.title) ||
      cleanSubtagId
    );
  } catch (error) {
    console.error(
      "Error obteniendo label de subtag:",
      error,
    );

    return cleanSubtagId;
  }
}

async function normalizeSubtagsWithLabels(
  subtags,
) {
  const cleanSubtags =
    normalizeStringArray(subtags);

  if (!cleanSubtags.length) {
    return [];
  }

  const labels =
    await Promise.all(
      cleanSubtags.map(
        getSubtagLabelById,
      ),
    );

  return labels
    .map(cleanText)
    .filter(Boolean)
    .slice(
      0,
      FAVORITES_MAX_SUBTAGS,
    );
}

export default async function listFavoritePlacesService({
  uid,
}) {
  const cleanUid =
    cleanText(uid);

  if (!cleanUid) {
    throw createHttpError(
      "Usuario no autenticado.",
      401
    );
  }

  const favoritesSnapshot =
    await db
      .collection("user")
      .doc(cleanUid)
      .collection("favorites")
      .orderBy(
        "createdAt",
        "desc"
      )
      .get();

  if (favoritesSnapshot.empty) {
    return {
      favorites: [],
    };
  }

  /*
   * Creamos una referencia por favorito.
   * No borramos el like aunque el lugar
   * esté oculto.
   */
  const favoriteItems =
    favoritesSnapshot.docs
      .map((favoriteDoc) => {
        const favorite =
          favoriteDoc.data();

        const placeId =
          cleanText(
            favorite.placeId
          ) ||
          favoriteDoc.id;

        if (!placeId) {
          return null;
        }

        return {
          favoriteDoc,
          placeId,
          placeRef:
            db
              .collection("places")
              .doc(placeId),
        };
      })
      .filter(Boolean);

  if (
    favoriteItems.length === 0
  ) {
    return {
      favorites: [],
    };
  }

  /*
   * Leemos todos los lugares en una
   * sola operación en vez de hacer
   * un await dentro de un for.
   */
  const placeSnapshots =
    await db.getAll(
      ...favoriteItems.map(
        (item) =>
          item.placeRef
      )
    );

const visibleFavoriteItems =
  favoriteItems
    .map((item, index) => ({
      ...item,
      placeSnapshot:
        placeSnapshots[index],
    }))
    .filter((item) => {
      if (
        !item.placeSnapshot.exists
      ) {
        return false;
      }

      return isPlaceVisibleInMobile(
        item.placeSnapshot.data(),
      );
    });

const favorites =
  await Promise.all(
    visibleFavoriteItems.map(
      (item) =>
        mapFavoriteDoc(
          item.favoriteDoc,
          item.placeSnapshot,
        ),
    ),
  );
    

  return {
    favorites,
  };
}