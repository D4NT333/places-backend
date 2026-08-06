import {
  Timestamp,
} from "firebase-admin/firestore";

import {
  db,
} from "../../../config/firebase.js";

const PLACES_COLLECTION =
  "places";

const TARGET_PLACE_ID =
  "1sHxSkZlCNaMfMh16T5i";

const NEXT_ACTIVITY_STATUS = {
  active:
    "low_activity",

  low_activity:
    "pending",

  pending:
    "inactive",

  inactive:
    "inactive",
};

export default async function updatePlacesActivityStatusService() {
  const now =
    Timestamp.now();

  const placeReference =
    db
      .collection(
        PLACES_COLLECTION,
      )
      .doc(
        TARGET_PLACE_ID,
      );

  const result =
    await db.runTransaction(
      async (
        transaction,
      ) => {
        const placeSnapshot =
          await transaction.get(
            placeReference,
          );

        if (
          !placeSnapshot.exists
        ) {
          const error =
            new Error(
              `No existe el lugar ${TARGET_PLACE_ID}.`,
            );

          error.statusCode =
            404;

          throw error;
        }

        const place =
          placeSnapshot.data();

        if (
          place.deletedAt
        ) {
          return {
            targetPlaceId:
              TARGET_PLACE_ID,

            updated:
              false,

            skipped:
              true,

            reason:
              "deleted_place",

            previousStatus:
              place.activityStatus ||
              null,

            nextStatus:
              place.activityStatus ||
              null,
          };
        }

        const currentStatus =
          typeof place.activityStatus ===
            "string" &&
          NEXT_ACTIVITY_STATUS[
            place.activityStatus
          ]
            ? place.activityStatus
            : "active";

        const nextStatus =
          NEXT_ACTIVITY_STATUS[
            currentStatus
          ];

        /*
         * Si ya está inactive,
         * permanece inactive.
         */
        if (
          currentStatus ===
          nextStatus
        ) {
          return {
            targetPlaceId:
              TARGET_PLACE_ID,

            updated:
              false,

            skipped:
              true,

            reason:
              "already_inactive",

            previousStatus:
              currentStatus,

            nextStatus,
          };
        }

        const updateData = {
          activityStatus:
            nextStatus,

          activityStatusUpdatedAt:
            now,

          updatedAt:
            now,
        };

        if (
          nextStatus ===
          "pending"
        ) {
          updateData.confirmationStartedAt =
            place.confirmationStartedAt ||
            now;
        }

        if (
          nextStatus ===
          "low_activity"
        ) {
          updateData.confirmationStartedAt =
            null;
        }

        transaction.update(
          placeReference,
          updateData,
        );

        return {
          targetPlaceId:
            TARGET_PLACE_ID,

          updated:
            true,

          skipped:
            false,

          previousStatus:
            currentStatus,

          nextStatus,
        };
      },
    );

  return {
    ...result,

    message:
      result.updated
        ? `El lugar cambió de ${result.previousStatus} a ${result.nextStatus}.`
        : "El lugar ya se encontraba en inactive.",
  };
}