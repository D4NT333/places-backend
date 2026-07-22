import { db } from "../../../config/firebase.js";

function createHttpError(
  message,
  statusCode = 400
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

  return {
    source:
      cleanText(
        mainPhoto.source
      ),

    reference:
      cleanText(
        mainPhoto.reference
      ),

    order:
      Number.isFinite(
        Number(mainPhoto.order)
      )
        ? Number(mainPhoto.order)
        : 0,
  };
}

function mapFavoriteDoc(
  favoriteDoc,
  placeSnapshot
) {
  const favorite =
    favoriteDoc.data();

  const place =
    placeSnapshot.data();

  return {
    id:
      favoriteDoc.id,

    placeId:
      cleanText(
        place.placeId
      ) ||
      placeSnapshot.id,

    /*
     * Preferimos los datos actuales
     * del lugar y usamos el favorito
     * solamente como respaldo.
     */
    placeName:
      cleanText(
        place.name
      ) ||
      cleanText(
        favorite.placeName
      ),

    tagId:
      cleanText(
        place.tagId
      ) ||
      cleanText(
        favorite.tagId
      ),

    tagLabel:
      cleanText(
        place.tagLabel
      ) ||
      cleanText(
        favorite.tagLabel
      ),

    subtags:
      normalizeStringArray(
        place.subtags
      ).length > 0
        ? normalizeStringArray(
            place.subtags
          )
        : normalizeStringArray(
            favorite.subtags
          ),

    rating:
      Number.isFinite(
        Number(
          place.metrics
            ?.averageRating
        )
      )
        ? Number(
            place.metrics
              ?.averageRating
          )
        : Number.isFinite(
              Number(
                favorite.rating
              )
            )
          ? Number(
              favorite.rating
            )
          : 0,

    mainPhoto:
      normalizeMainPhoto(
        place.mainPhoto
      ) ||
      normalizeMainPhoto(
        favorite.mainPhoto
      ),

    status:
      cleanText(
        place.status
      ) ||
      "published",

    createdAt:
      favorite.createdAt ||
      null,
  };
}

function isPlaceVisibleInMobile(place) {
  if (!place) {
    return false;
  }

  if (
    cleanText(place.status) ===
    "hidden"
  ) {
    return false;
  }

  if (place.deletedAt) {
    return false;
  }

  return true;
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

  const favorites = [];

  favoriteItems.forEach(
    (item, index) => {
      const placeSnapshot =
        placeSnapshots[index];

      /*
       * Si el lugar fue eliminado de la
       * colección, simplemente se omite.
       */
      if (
        !placeSnapshot.exists
      ) {
        return;
      }

      const place =
        placeSnapshot.data();

      /*
       * El like permanece guardado, pero
       * hidden y eliminados no aparecen
       * en la aplicación móvil.
       */
      if (
        !isPlaceVisibleInMobile(
          place
        )
      ) {
        return;
      }

      favorites.push(
        mapFavoriteDoc(
          item.favoriteDoc,
          placeSnapshot
        )
      );
    }
  );

  return {
    favorites,
  };
}