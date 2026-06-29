import { db } from "../../../../config/firebase.js";

const DESCRIPTION_SUBMISSIONS_COLLECTION =
  "descriptionSubmissions";

const VALID_STATUSES = [
  "all",
  "in_review",
  "approved",
  "rejected",
];

/*
 * Incluye también nombres antiguos que tu normalizador reconoce.
 * pending_delete no está aquí, por lo que nunca llegará al listado normal.
 */
const VISIBLE_DATABASE_STATUSES = [
  "in_review",
  "inReview",
  "pending",
  "approved",
  "accepted",
  "rejected",
];

function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeTimestamp(value) {
  if (!value) return null;

  if (
    typeof value.toDate ===
    "function"
  ) {
    return value
      .toDate()
      .toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return null;
}

function buildPhotoUrl(
  baseUrl,
  mainPhoto
) {
  const reference =
    cleanText(
      mainPhoto?.reference
    );

  if (!reference) {
    return null;
  }

  return `${baseUrl}/api/places/photos/google?reference=${encodeURIComponent(
    reference
  )}`;
}

function normalizeStatus(status) {
  const cleanStatus =
    cleanText(status);

  if (
    cleanStatus ===
      "in_review" ||
    cleanStatus ===
      "inReview" ||
    cleanStatus ===
      "pending"
  ) {
    return "in_review";
  }

  if (
    cleanStatus ===
      "approved" ||
    cleanStatus ===
      "accepted"
  ) {
    return "approved";
  }

  if (
    cleanStatus ===
    "rejected"
  ) {
    return "rejected";
  }

  return "in_review";
}

function normalizeStatusLabel(
  status
) {
  const normalizedStatus =
    normalizeStatus(status);

  const labels = {
    in_review: "Pendiente",
    approved: "Aprobada",
    rejected: "Rechazada",
  };

  return (
    labels[normalizedStatus] ||
    "Pendiente"
  );
}

function normalizeSubmissionDoc(
  doc,
  baseUrl
) {
  const submission =
    doc.data();

  const status =
    normalizeStatus(
      submission.status
    );

  const mainPhoto =
    submission.placeSnapshot
      ?.mainPhoto ||
    null;

  return {
    id:
      doc.id,

    submissionId:
      cleanText(
        submission.submissionId
      ) || doc.id,

    type:
      cleanText(
        submission.type
      ) || "description",

    status,

    statusLabel:
      normalizeStatusLabel(
        status
      ),

    placeId:
      cleanText(
        submission.placeId
      ),

    placeDocId:
      cleanText(
        submission.placeDocId
      ),

    placeName:
      cleanText(
        submission.placeName
      ) ||
      cleanText(
        submission
          .placeSnapshot
          ?.name
      ) ||
      "Lugar sin nombre",

    currentDescription:
      cleanText(
        submission
          .currentDescription
      ),

    proposedDescription:
      cleanText(
        submission
          .proposedDescription
      ),

    preview:
      cleanText(
        submission
          .proposedDescription
      ),

    placeSnapshot: {
      name:
        cleanText(
          submission
            .placeSnapshot
            ?.name
        ),

      address:
        cleanText(
          submission
            .placeSnapshot
            ?.address
        ),

      mainPhoto,

      mainPhotoUrl:
        buildPhotoUrl(
          baseUrl,
          mainPhoto
        ),

      tagId:
        cleanText(
          submission
            .placeSnapshot
            ?.tagId
        ),

      tagLabel:
        cleanText(
          submission
            .placeSnapshot
            ?.tagLabel
        ),

      subtags:
        Array.isArray(
          submission
            .placeSnapshot
            ?.subtags
        )
          ? submission
              .placeSnapshot
              .subtags
          : [],

      approaches:
        Array.isArray(
          submission
            .placeSnapshot
            ?.approaches
        )
          ? submission
              .placeSnapshot
              .approaches
          : [],
    },

    createdBy: {
      uid:
        cleanText(
          submission
            .createdBy
            ?.uid
        ),

      email:
        cleanText(
          submission
            .createdBy
            ?.email
        ),

      name:
        cleanText(
          submission
            .createdBy
            ?.name
        ) ||
        "Usuario",

      picture:
        cleanText(
          submission
            .createdBy
            ?.picture
        ) ||
        null,
    },

    reviewedBy:
      submission.reviewedBy ||
      null,

    reviewedAt:
      normalizeTimestamp(
        submission.reviewedAt
      ),

    reviewMessage:
      cleanText(
        submission.reviewMessage
      ),

    createdAt:
      normalizeTimestamp(
        submission.createdAt
      ),

    updatedAt:
      normalizeTimestamp(
        submission.updatedAt
      ),

    deletedAt:
      normalizeTimestamp(
        submission.deletedAt
      ),
  };
}

export default async function getDescriptionSubmissionsService({
  status = "all",
  limit = 50,
  cursor = null,
  baseUrl,
}) {
  const requestedStatus =
    cleanText(status) ||
    "all";

  if (
    !VALID_STATUSES.includes(
      requestedStatus
    )
  ) {
    throw new Error(
      "Estado de propuesta inválido."
    );
  }

  const cleanLimit =
    Number(limit);

  const finalLimit =
    Number.isFinite(
      cleanLimit
    ) &&
    cleanLimit > 0 &&
    cleanLimit <= 100
      ? cleanLimit
      : 50;

  let query = db
    .collection(
      DESCRIPTION_SUBMISSIONS_COLLECTION
    )
    .where(
      "deletedAt",
      "==",
      null
    );

  if (
    requestedStatus ===
    "all"
  ) {
    query = query.where(
      "status",
      "in",
      VISIBLE_DATABASE_STATUSES
    );
  } else {
    query = query.where(
      "status",
      "==",
      requestedStatus
    );
  }

  query = query.orderBy(
    "createdAt",
    "asc"
  );

  if (cursor) {
    const cursorDoc = await db
      .collection(
        DESCRIPTION_SUBMISSIONS_COLLECTION
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
    await query
      .limit(finalLimit + 1)
      .get();

  const hasMore =
    snapshot.docs.length > finalLimit;

  const pageDocs = hasMore
    ? snapshot.docs.slice(
        0,
        finalLimit
      )
    : snapshot.docs;

  const items = pageDocs.map(
    (doc) =>
      normalizeSubmissionDoc(
        doc,
        baseUrl
      )
  );

  const lastDoc =
    pageDocs[
      pageDocs.length - 1
    ];

  return {
    items,
    nextCursor:
      hasMore && lastDoc
        ? lastDoc.id
        : null,
  };
}