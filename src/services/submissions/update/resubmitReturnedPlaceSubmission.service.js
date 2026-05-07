function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getObjectKeys(object = {}) {
  if (!object || typeof object !== "object") return [];

  return Object.keys(object);
}

export default async function resubmitReturnedPlaceSubmissionService({
  submissionId,
  uid,
  payload,
}) {
  if (!submissionId) {
    throw createHttpError("Falta submissionId.", 400);
  }

  if (!uid) {
    throw createHttpError("Usuario no autenticado.", 401);
  }

  const returnId = payload?.returnId || null;
  const correctedFields = payload?.correctedFields || {};
  const correctedFieldKeys = getObjectKeys(correctedFields);

  if (!returnId) {
    throw createHttpError("Falta returnId.", 400);
  }

  if (correctedFieldKeys.length === 0) {
    throw createHttpError("No llegaron campos corregidos.", 400);
  }

  console.log("====================================");
  console.log("REENVÍO DE PROPUESTA RECIBIDO");
  console.log("submissionId:", submissionId);
  console.log("uid:", uid);
  console.log("returnId:", returnId);
  console.log("correctedFieldKeys:", correctedFieldKeys);
  console.log("correctedFields:", JSON.stringify(correctedFields, null, 2));
  console.log("payload completo:", JSON.stringify(payload, null, 2));
  console.log("====================================");

  return {
    submissionId,
    uid,
    returnId,
    correctedFieldKeys,
    correctedFields,
    receivedAt: new Date().toISOString(),
  };
}