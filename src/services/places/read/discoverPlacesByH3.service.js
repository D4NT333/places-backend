export async function discoverPlacesByH3Service(hexId) {
 console.log("Service recibió hexId:", hexId);

  return {
    receivedHexId: hexId,
    status: "ok",
  };
}