export default async function getAdminUserReportsService({
  userId,
  limit = 15,
  cursor = null,
}) {
  return {
    reports: [],
    count: 0,
    hasMore: false,
    nextCursor: null,
    limit: Math.min(Number(limit) || 15, 30),
    emptyMessage: "Este usuario no tiene reportes recibidos.",
  };
}