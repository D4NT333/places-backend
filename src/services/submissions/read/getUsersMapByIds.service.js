import { db } from "../../../config/firebase.js";

export default async function getUsersMapByIdsService(userIds = []) {
  const cleanUserIds = [...new Set(userIds)].filter(Boolean);

  if (cleanUserIds.length === 0) {
    return {};
  }

  const usersMap = {};

  const chunks = [];

  for (let i = 0; i < cleanUserIds.length; i += 30) {
    chunks.push(cleanUserIds.slice(i, i + 30));
  }

  for (const chunk of chunks) {
    const snapshot = await db
      .collection("user")
      .where("__name__", "in", chunk)
      .get();

    snapshot.docs.forEach((doc) => {
      usersMap[doc.id] = {
        id: doc.id,
        ...doc.data(),
      };
    });
  }

  return usersMap;
}