import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  db,
} from "../../../config/firebase.js";

const ADMIN_USERS_COLLECTION =
  "adminUsers";

const VALID_ROLES = [
  "admin",
  "super_admin",
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

export default async function updateAdminRoleService({
  requesterUid,
  targetAdminUid,
  newRole,
}) {
  const cleanRequesterUid =
    cleanText(requesterUid);

  const cleanTargetUid =
    cleanText(targetAdminUid);

  const cleanRole =
    cleanText(newRole);

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
    !VALID_ROLES.includes(
      cleanRole,
    )
  ) {
    throw createServiceError(
      "El rol administrativo seleccionado no es válido.",
      400,
    );
  }

  if (
    cleanRequesterUid ===
    cleanTargetUid
  ) {
    throw createServiceError(
      "No puedes modificar tu propio rol administrativo.",
      409,
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

        const previousRole =
          targetAdmin.role ===
          "super_admin"
            ? "super_admin"
            : "admin";

        if (
          previousRole === cleanRole
        ) {
          throw createServiceError(
            "La cuenta ya tiene el rol seleccionado.",
            409,
          );
        }

        /*
         * Si se intenta degradar a un superadministrador,
         * verificamos que exista por lo menos otro
         * superadministrador activo.
         */
        if (
          previousRole ===
            "super_admin" &&
          cleanRole === "admin" &&
          targetAdmin.isActive === true
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
              "No es posible cambiar el rol del último superadministrador activo.",
              409,
            );
          }
        }

        transaction.update(
          targetAdminRef,
          {
            role: cleanRole,

            permissions: {
              ...(targetAdmin.permissions ||
                {}),

              manageAdmins:
                cleanRole ===
                "super_admin",
            },

            roleUpdatedAt:
              FieldValue.serverTimestamp(),

            roleUpdatedBy:
              cleanRequesterUid,

            updatedAt:
              FieldValue.serverTimestamp(),
          },
        );

        return {
          uid: cleanTargetUid,
          previousRole,
          role: cleanRole,
          permissions: {
            ...(targetAdmin.permissions ||
              {}),

            manageAdmins:
              cleanRole ===
              "super_admin",
          },
        };
      },
    );

  return result;
}