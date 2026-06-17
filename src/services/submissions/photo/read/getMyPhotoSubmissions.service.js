import { db } from "../../../../config/firebase.js";

const PHOTO_SUBMISSIONS_COLLECTION =
  "photoSubmissions";

const VISIBLE_STATUSES = [
  "in_review",
  "approved",
  "rejected",
];

function serializeTimestamp(value) {
  if (!value) {
    return null;
  }

  if (
    typeof value.toDate ===
    "function"
  ) {
    return value
      .toDate()
      .toISOString();
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date.toISOString();
}

function getImageUrl(value) {
  if (
    typeof value ===
    "string"
  ) {
    return value.trim();
  }

  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return "";
  }

  const url =
    value.url ||
    value.downloadURL ||
    value.uri ||
    "";

  return typeof url ===
    "string"
    ? url.trim()
    : "";
}

function getFirstMediumUrl(
  photos
) {
  if (
    !Array.isArray(photos)
  ) {
    return "";
  }

  const photoWithMedium =
    photos.find((photo) => {
      return getImageUrl(
        photo?.medium
      );
    });

  return getImageUrl(
    photoWithMedium?.medium
  );
}

export default async function getMyPhotoSubmissionsService(
  uid
) {
  if (!uid) {
    throw new Error(
      "No se recibió el identificador del usuario."
    );
  }

  const snapshot =
    await db
      .collection(
        PHOTO_SUBMISSIONS_COLLECTION
      )
      .where(
        "createdBy",
        "==",
        uid
      )
      .where(
        "status",
        "in",
        VISIBLE_STATUSES
      )
      .select(
        "submissionId",
        "placeId",
        "placeName",
        "status",
        "photos",
        "createdAt",
        "rejectionReason"
      )
      .get();

  const submissions =
    snapshot.docs.map(
      (document) => {
        const data =
          document.data();

        const mediumUrl =
          getFirstMediumUrl(
            data.photos
          );

        return {
          id:
            document.id,

          submissionId:
            data.submissionId ||
            document.id,

          placeId:
            data.placeId ||
            "",

          placeName:
            data.placeName ||
            "Lugar sin nombre",

          status:
            data.status ||
            "in_review",

          mediumUrl,

          rejectionReason:
            typeof data.rejectionReason ===
            "string"
              ? data.rejectionReason.trim()
              : "",

          createdAt:
            serializeTimestamp(
              data.createdAt
            ),
        };
      }
    );

  submissions.sort(
    (
      firstSubmission,
      secondSubmission
    ) => {
      const firstDate =
        firstSubmission.createdAt
          ? new Date(
              firstSubmission.createdAt
            ).getTime()
          : 0;

      const secondDate =
        secondSubmission.createdAt
          ? new Date(
              secondSubmission.createdAt
            ).getTime()
          : 0;

      return (
        secondDate -
        firstDate
      );
    }
  );

  return submissions;
}