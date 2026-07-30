import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  db,
} from "../../../config/firebase.js";

const ADMIN_USERS_COLLECTION =
  "adminUsers";

const VALID_ACTIONS = [
  "disable",
  "reactivate",
];

function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function createServiceError(
  message,
  statusCode,
) {
  const error = new Error(message);

  error.statusCode = statusCode;

  return error;
}

export default async function updateAdminStatusService({
  requesterUid,
  targetAdminUid,
  action,
  reason = "",
}) {
  const cleanRequesterUid =
    cleanText(requesterUid);

  const cleanTargetUid =
    cleanText(targetAdminUid);

  const cleanAction =
    cleanText(action);

  const cleanReason =
    cleanText(reason);

  if (
    !cleanRequesterUid ||
    !cleanTargetUid
  ) {
    throw createServiceError(
      "No fue posible identificar las cuentas administrativas.",
      400,
    );
  }

  if (
    !VALID_ACTIONS.includes(
      cleanAction,
    )
  ) {
    throw createServiceError(
      "La acción administrativa seleccionada no es válida.",
      400,
    );
  }

  if (
    cleanRequesterUid ===
    cleanTargetUid
  ) {
    throw createServiceError(
      "No puedes modificar el estado de tu propia cuenta administrativa.",
      409,
    );
  }

  if (
    cleanAction === "disable" &&
    cleanReason.length < 10
  ) {
    throw createServiceError(
      "El motivo de desactivación debe contener al menos 10 caracteres.",
      400,
    );
  }

  const targetAdminRef = db
    .collection(
      ADMIN_USERS_COLLECTION,
    )
    .doc(cleanTargetUid);

  const result =
    await db.runTransaction(
      async (transaction) => {
        const targetAdminDoc =
          await transaction.get(
            targetAdminRef,
          );

        if (
          !targetAdminDoc.exists
        ) {
          throw createServiceError(
            "El administrador seleccionado no existe.",
            404,
          );
        }

        const targetAdmin =
          targetAdminDoc.data() || {};

        const currentlyActive =
          targetAdmin.isActive === true;

        if (
          cleanAction === "disable" &&
          !currentlyActive
        ) {
          throw createServiceError(
            "La cuenta administrativa ya está desactivada.",
            409,
          );
        }

        if (
          cleanAction === "reactivate" &&
          currentlyActive
        ) {
          throw createServiceError(
            "La cuenta administrativa ya está activa.",
            409,
          );
        }

        /*
         * No permitimos desactivar al último
         * superadministrador activo.
         */
        if (
          cleanAction === "disable" &&
          targetAdmin.role ===
            "super_admin"
        ) {
          const activeSuperAdminsQuery =
            db
              .collection(
                ADMIN_USERS_COLLECTION,
              )
              .where(
                "role",
                "==",
                "super_admin",
              )
              .where(
                "isActive",
                "==",
                true,
              );

          const activeSuperAdminsSnapshot =
            await transaction.get(
              activeSuperAdminsQuery,
            );

          const otherActiveSuperAdmins =
            activeSuperAdminsSnapshot.docs
              .filter(
                (doc) =>
                  doc.id !==
                  cleanTargetUid,
              );

          if (
            otherActiveSuperAdmins.length ===
            0
          ) {
            throw createServiceError(
              "No es posible desactivar al último superadministrador activo.",
              409,
            );
          }
        }

        if (
          cleanAction === "disable"
        ) {
          transaction.update(
            targetAdminRef,
            {
              isActive: false,

              disabledAt:
                FieldValue.serverTimestamp(),

              disabledBy:
                cleanRequesterUid,

              disableReason:
                cleanReason,

              updatedAt:
                FieldValue.serverTimestamp(),
            },
          );

          return {
            uid:
              cleanTargetUid,

            status:
              "disabled",

            isActive:
              false,

            reason:
              cleanReason,
          };
        }

        transaction.update(
          targetAdminRef,
          {
            isActive: true,

            reactivatedAt:
              FieldValue.serverTimestamp(),

            reactivatedBy:
              cleanRequesterUid,

            disabledAt:
              FieldValue.delete(),

            disabledBy:
              FieldValue.delete(),

            disableReason:
              FieldValue.delete(),

            updatedAt:
              FieldValue.serverTimestamp(),
          },
        );

        return {
          uid:
            cleanTargetUid,

          status:
            "active",

          isActive:
            true,
        };
      },
    );

  return result;
}