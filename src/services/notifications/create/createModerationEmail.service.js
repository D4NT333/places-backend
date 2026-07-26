import {
  Timestamp,
} from "firebase-admin/firestore";

import {
  auth,
  db,
} from "../../../config/firebase.js";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default async function createModerationEmailService({
  uid,
  subject,
  title,
  reasonLabel,
  message,
  moderationId,
}) {
  const cleanUid =
    String(uid || "").trim();

  if (!cleanUid) {
    throw new Error(
      "El usuario es obligatorio para enviar el correo.",
    );
  }

  /*
   * El correo no se guarda dentro de user/{uid}.
   * Se consulta directamente desde Firebase Auth.
   */
  const userRecord =
    await auth.getUser(cleanUid);

  const email =
    String(
      userRecord.email || "",
    ).trim();

  if (!email) {
    return {
      queued: false,
      reason: "user_without_email",
    };
  }

  const cleanReason =
    String(
      reasonLabel ||
        "Incumplimiento de las normas",
    ).trim();

  const cleanMessage =
    String(message || "").trim();

  const mailRef = db
    .collection("mail")
    .doc();

  await mailRef.set({
    to: email,

    message: {
      subject,

      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#172033;">
          <h2>${escapeHtml(title)}</h2>

          <p>
            Tu cuenta de Lsearch fue bloqueada permanentemente.
          </p>

          <p>
            <strong>Motivo:</strong>
            ${escapeHtml(cleanReason)}
          </p>

          <p>
            ${escapeHtml(cleanMessage)}
          </p>

          <p>
            Esta medida fue aplicada después de una revisión administrativa.
          </p>
        </div>
      `,
    },

    metadata: {
      type:
        "account_permanently_banned",

      uid:
        cleanUid,

      moderationId:
        moderationId || null,
    },

    createdAt:
      Timestamp.now(),
  });

  return {
    queued: true,
    mailId: mailRef.id,
  };
}