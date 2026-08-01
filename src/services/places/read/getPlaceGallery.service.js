import { db } from "../../../config/firebase.js";

function createServiceError(
  message,
  statusCode,
) {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
}

function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeNumber(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function getPublicApiUrl() {
  return cleanText(
    process.env.PUBLIC_API_URL,
  ).replace(/\/+$/, "");
}

function buildGoogleGalleryPhotoUrl(
  reference,
) {
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
    `${publicApiUrl}/api/places/gallery-photo/google` +
    `?reference=${encodeURIComponent(
      cleanReference,
    )}`
  );
}

function normalizeGooglePhoto(
  photo,
  index,
) {
  const reference =
    cleanText(
      photo?.reference ||
      photo?.name ||
      photo?.photoReference,
    );

  if (!reference) {
    return null;
  }

  return {
    id:
      `google_${index}`,

    source:
      "google",

    order:
      Number.isFinite(
        Number(photo?.order),
      )
        ? Number(photo.order)
        : index,

    /*
     * Para la galería utilizamos una versión
     * grande entregada mediante el backend.
     */
    url:
      buildGoogleGalleryPhotoUrl(
        reference,
      ),

    originalUrl:
      buildGoogleGalleryPhotoUrl(
        reference,
      ),

    /*
     * Conservamos la referencia por si otra
     * pantalla necesita reutilizarla.
     */
    reference,

    widthPx:
      normalizeNumber(
        photo?.widthPx,
      ),

    heightPx:
      normalizeNumber(
        photo?.heightPx,
      ),
  };
}

function normalizeUserPhoto(
  photo,
  index,
) {
  const originalUrl =
    cleanText(
      photo?.original?.url ||
      photo?.originalUrl,
    );

  const mediumUrl =
    cleanText(
      photo?.medium?.url ||
      photo?.mediumUrl ||
      photo?.url,
    );

  const thumbnailUrl =
    cleanText(
      photo?.thumbnail?.url ||
      photo?.thumbnailUrl,
    );

  const galleryUrl =
    originalUrl ||
    mediumUrl ||
    thumbnailUrl;

  if (!galleryUrl) {
    return null;
  }

  return {
    id:
      cleanText(photo?.photoId) ||
      `user_${index}`,

    source:
      cleanText(photo?.source) ||
      "user",

    order:
      Number.isFinite(
        Number(photo?.order),
      )
        ? Number(photo.order)
        : index,

    /*
     * La galería prioriza la original.
     */
    url:
      galleryUrl,

    originalUrl:
      originalUrl ||
      galleryUrl,

    mediumUrl:
      mediumUrl ||
      galleryUrl,

    thumbnailUrl:
      thumbnailUrl ||
      mediumUrl ||
      galleryUrl,

    widthPx:
      normalizeNumber(
        photo?.original?.width ??
        photo?.original?.widthPx ??
        photo?.widthPx,
      ),

    heightPx:
      normalizeNumber(
        photo?.original?.height ??
        photo?.original?.heightPx ??
        photo?.heightPx,
      ),

    photoId:
      cleanText(photo?.photoId),

    sourceSubmissionId:
      cleanText(
        photo?.sourceSubmissionId,
      ),

    uploadedBy:
      cleanText(photo?.uploadedBy),
  };
}

function normalizePlacePhoto(
  photo,
  index,
) {
  const source =
    cleanText(photo?.source);

  if (
    source === "google" ||
    photo?.reference ||
    photo?.photoReference ||
    photo?.name
  ) {
    return normalizeGooglePhoto(
      photo,
      index,
    );
  }

  return normalizeUserPhoto(
    photo,
    index,
  );
}

export default async function getPlaceGalleryService({
  placeId,
}) {
  const cleanPlaceId =
    cleanText(placeId);

  if (!cleanPlaceId) {
    throw createServiceError(
      "El identificador del lugar es obligatorio.",
      400,
    );
  }

  const placeRef =
    db
      .collection("places")
      .doc(cleanPlaceId);

  const placeSnap =
    await placeRef.get();

  if (!placeSnap.exists) {
    throw createServiceError(
      "El lugar no existe.",
      404,
    );
  }

  const place =
    placeSnap.data();

  if (
    place?.deletedAt ||
    ![
      "published",
      "in_review",
      "warned",
    ].includes(place?.status)
  ) {
    throw createServiceError(
      "El lugar no está disponible.",
      404,
    );
  }

  const rawPhotos =
    Array.isArray(place?.photos)
      ? place.photos
      : [];

  const photos =
    rawPhotos
      .map(normalizePlacePhoto)
      .filter(Boolean)
      .filter((photo) =>
        Boolean(photo.url),
      )
      .sort(
        (firstPhoto, secondPhoto) =>
          firstPhoto.order -
          secondPhoto.order,
      );

  return {
    placeId:
      cleanText(place?.placeId) ||
      placeSnap.id,

    placeName:
      cleanText(place?.name),

    photos,

    total:
      photos.length,
  };
}