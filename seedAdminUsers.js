import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  auth,
  db,
} from "./src/config/firebase.js";

const ADMIN_USERS = [
  {
    email: "exploring.axter@gmail.com",
    role: "super_admin",
  },
  {
    email: "unknownaster2@gmail.com",
    role: "admin",
  },
];

async function seedAdminUsers() {
  try {
    for (const adminConfig of ADMIN_USERS) {
      const userRecord =
        await auth.getUserByEmail(
          adminConfig.email,
        );

      const isSuperAdmin =
        adminConfig.role ===
        "super_admin";

      const adminRef = db
        .collection("adminUsers")
        .doc(userRecord.uid);

      const existingDoc =
        await adminRef.get();

      const existingData =
        existingDoc.exists
          ? existingDoc.data()
          : {};

      await adminRef.set(
        {
          uid: userRecord.uid,

          displayName:
            userRecord.displayName ||
            existingData?.displayName ||
            adminConfig.email
              .split("@")[0],

          email:
            userRecord.email ||
            adminConfig.email,

          role: adminConfig.role,

          isActive: true,

          permissions: {
            manageAdmins:
              isSuperAdmin,
          },

          createdAt:
            existingData?.createdAt ||
            FieldValue.serverTimestamp(),

          createdBy:
            existingData?.createdBy ??
            null,

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        },
      );

      console.log(
        `✓ ${adminConfig.email} registrado como ${adminConfig.role}`,
      );
    }

    console.log(
      "\nAdministradores iniciales registrados correctamente.",
    );

    process.exit(0);
  } catch (error) {
    console.error(
      "Error registrando administradores:",
      error,
    );

    process.exit(1);
  }
}

seedAdminUsers();