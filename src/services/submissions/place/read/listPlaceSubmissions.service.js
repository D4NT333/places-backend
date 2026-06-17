import { db } from "../../../../config/firebase.js";
import getUsersMapByIdsService from "./getUsersMapByIds.service.js";

const VALID_STATUSES = [
  "all",
  "in_review",
  "approved",
  "returned",
  "resubmitted",
  "rejected",
];

const VISIBLE_STATUSES = [
  "in_review",
  "approved",
  "returned",
  "resubmitted",
  "rejected",
];

function normalizeLimit(limit) {
  const parsedLimit = Number(limit);

  if (Number.isNaN(parsedLimit)) {
    return 15;
  }

  return Math.min(
    Math.max(parsedLimit, 1),
    30
  );
}

function formatTimestamp(timestamp) {
  if (!timestamp?.toDate) {
    return null;
  }

  return timestamp
    .toDate()
    .toISOString();
}

function getPhotoUrl(
  photo,
  preferredSize = "thumbnail"
) {
  if (!photo) return null;

  if (preferredSize === "thumbnail") {
    return (
      photo.thumbnail?.url ||
      photo.thumbnailURL ||
      photo.medium?.url ||
      photo.mediumURL ||
      photo.original?.url ||
      photo.downloadURL ||
      null
    );
  }

  if (preferredSize === "medium") {
    return (
      photo.medium?.url ||
      photo.mediumURL ||
      photo.original?.url ||
      photo.downloadURL ||
      photo.thumbnail?.url ||
      photo.thumbnailURL ||
      null
    );
  }

  return (
    photo.original?.url ||
    photo.downloadURL ||
    photo.medium?.url ||
    photo.mediumURL ||
    photo.thumbnail?.url ||
    photo.thumbnailURL ||
    null
  );
}

function getFirstPhotoUrl(
  photos = [],
  preferredSize = "thumbnail"
) {
  if (
    !Array.isArray(photos) ||
    photos.length === 0
  ) {
    return null;
  }

  return getPhotoUrl(
    photos[0],
    preferredSize
  );
}

function mapUserDisplayName(user) {
  if (!user) {
    return "Usuario desconocido";
  }

  return (
    user.name ||
    user.displayName ||
    user.username ||
    user.email ||
    "Usuario desconocido"
  );
}

function mapUserPhotoUrl(user) {
  if (!user) {
    return null;
  }

  return (
    user.photoURL ||
    user.photoUrl ||
    user.avatarUrl ||
    null
  );
}

function getUniqueUserIds(
  submissions = []
) {
  return [
    ...new Set(
      submissions
        .map(
          (submission) =>
            submission.createdBy
        )
        .filter(Boolean)
    ),
  ];
}

export default async function listPlaceSubmissionsService({
  status = "all",
  limit = 15,
  cursor = null,
}) {
  if (
    !VALID_STATUSES.includes(status)
  ) {
    throw new Error(
      "Estado de submission inválido."
    );
  }

  const finalLimit =
    normalizeLimit(limit);

  console.log(
    "========== LIST PLACE SUBMISSIONS SERVICE =========="
  );
  console.log(
    "Status recibido:",
    status
  );
  console.log(
    "Limit recibido:",
    limit
  );
  console.log(
    "Limit final:",
    finalLimit
  );
  console.log(
    "Cursor recibido:",
    cursor
  );

  let query;

  if (status === "all") {
    query = db
      .collection(
        "placeSubmissions"
      )
      .where(
        "status",
        "in",
        VISIBLE_STATUSES
      )
      .orderBy(
        "createdAt",
        "desc"
      )
      .limit(
        finalLimit
      );
  } else {
    query = db
      .collection(
        "placeSubmissions"
      )
      .where(
        "status",
        "==",
        status
      )
      .orderBy(
        "createdAt",
        "desc"
      )
      .limit(
        finalLimit
      );
  }

  if (cursor) {
    const cursorDoc = await db
      .collection(
        "placeSubmissions"
      )
      .doc(cursor)
      .get();

    if (cursorDoc.exists) {
      query = query.startAfter(
        cursorDoc
      );
    }
  }

  const snapshot =
    await query.get();

  const submissions =
    snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

  console.log(
    "Submissions encontradas:",
    submissions.length
  );

  const userIds =
    getUniqueUserIds(
      submissions
    );

  console.log(
    "User IDs encontrados:",
    userIds
  );

  const usersMap =
    await getUsersMapByIdsService(
      userIds
    );

  console.log(
    "Usuarios encontrados:",
    Object.keys(usersMap).length
  );

  const items =
    submissions.map(
      (submission) => {
        const user =
          usersMap[
            submission.createdBy
          ];

        return {
          id:
            submission.id,

          placeSubmissionId:
            submission.placeSubmissionId ||
            submission.id,

          name:
            submission.name ||
            "Lugar sin nombre",

          status:
            submission.status ||
            "unknown",

          createdAt:
            formatTimestamp(
              submission.createdAt
            ),

          userId:
            submission.createdBy ||
            null,

          userName:
            mapUserDisplayName(
              user
            ),

          userPhotoUrl:
            mapUserPhotoUrl(
              user
            ),

          placePhotoUrl:
            getFirstPhotoUrl(
              submission.photos,
              "thumbnail"
            ),

          reviewCycle:
            submission.reviewCycle ||
            1,

          wasReturnedBefore:
            Boolean(
              submission.wasReturnedBefore
            ),
        };
      }
    );

  const lastDoc =
    snapshot.docs[
      snapshot.docs.length - 1
    ];

  const nextCursor =
    lastDoc
      ? lastDoc.id
      : null;

  console.log(
    "Items finales:",
    items.length
  );
  console.log(
    "Next cursor:",
    nextCursor
  );
  console.log(
    "===================================================="
  );

  return {
    items,
    nextCursor,
  };
}