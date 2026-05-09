import getCreateCatalogService from "../../services/places/read/getCreateCatalog.service.js";

export default async function getCreateCatalogController(req, res) {
  try {
    const { tagId } = req.query;

    const result = await getCreateCatalogService(tagId);

    return res.status(200).json({
      ok: true,
      message: "Catálogo de creación cargado correctamente",
      data: result,
    });
  } catch (error) {
    console.error("getCreateCatalogController error:", error);

    return res.status(500).json({
      ok: false,
      message: error.message || "Error al cargar el catálogo de creación",
    });
  }
}