export default async function createPlaceSubmissionService(payload) {
  console.log("========== PLACE SUBMISSION RECIBIDA ==========");
  console.log(JSON.stringify(payload, null, 2));
  console.log("===============================================");

  return {
    received: true,
    payload,
  };
}