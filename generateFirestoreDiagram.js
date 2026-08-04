import fs from "node:fs/promises";

import {
  GeoPoint,
  Timestamp,
  DocumentReference,
} from "firebase-admin/firestore";

import {
  db,
} from "./src/config/firebase.js";

const SAMPLE_DOCUMENTS = 5;
const MAX_DEPTH = 5;

const GENERATED_DIRECTORY =
  "./generated";

const DIAGRAMS_DIRECTORY =
  `${GENERATED_DIRECTORY}/diagrams`;

/*
 * Cada elemento genera un archivo Mermaid independiente.
 *
 * fields:
 * - Si no existe, muestra todos los campos.
 * - Si contiene campos, muestra únicamente esos campos.
 *
 * edges:
 * - Permite representar relaciones lógicas que Firestore
 *   no almacena físicamente como subcolecciones.
 */
const DIAGRAM_GROUPS = [
  {
    fileName: "01-users-admin.mmd",
    direction: "LR",
    collections: [
      {
        path: "user",
        fields: [
          "uid",
          "photoURL",
          "provider",
          "emailVerified",
          "status",
          "name",
          "moderation",
          "createdAt",
          "lastLoginAt",
          "updatedAt",
        ],
      },
      {
        path: "user/{documentId}/favorites",
      },
      {
        path: "user/{documentId}/likedPlaces",
      },
      {
        path: "user/{documentId}/notifications",
      },
      {
        path: "user/{documentId}/pushTokens",
      },
      {
        path: "user/{documentId}/moderationHistory",
      },
      {
        path: "adminUsers",
      },
      {
        path:
          "adminUsers/{documentId}/weeklyActivity",
      },
    ],
  },

  {
    fileName: "02-taxonomy.mmd",
    direction: "LR",
    collections: [
      {
        path: "tag",
      },
      {
        path: "subtag",
      },
      {
        path: "approach",
      },
    ],
    edges: [
      {
        from: "tag",
        to: "subtag",
        label: "clasifica",
      },
      {
        from: "subtag",
        to: "approach",
        label: "relaciona enfoques",
      },
    ],
  },

  {
    fileName: "03-places.mmd",
    direction: "TB",
    collections: [
      {
        path: "places",
      },
    ],
  },

  {
    fileName: "04-place-metrics.mmd",
    direction: "LR",
    collections: [
      {
        path: "places",
        fields: [
          "placeId",
          "name",
          "status",
          "activityStatus",
          "activityCheckpoint",
          "lastInteractionAt",
          "metrics",
          "trend",
        ],
      },
      {
        path:
          "places/{documentId}/interactionStates",
      },
      {
        path:
          "places/{documentId}/dwellSessions",
      },
      {
        path:
          "places/{documentId}/events",
      },
      {
        path:
          "places/{documentId}/weeklyMetrics",
      },
      {
        path: "placeReviews",
      },
    ],
    edges: [
      {
        from: "places",
        to: "placeReviews",
        label: "recibe reseñas",
      },
    ],
  },

  {
    fileName: "05-moderation.mmd",
    direction: "LR",
    collections: [
      {
        path: "reports",
      },
      {
        path: "places",
        fields: [
          "placeId",
          "name",
          "status",
          "activityStatus",
          "moderation",
          "metrics",
          "updatedAt",
        ],
      },
      {
        path:
          "places/{documentId}/moderationActions",
      },
      {
        path: "user",
        fields: [
          "uid",
          "name",
          "status",
          "moderation",
          "updatedAt",
        ],
      },
      {
        path:
          "user/{documentId}/moderationHistory",
      },
      {
        path: "deletedSubmissions",
      },
    ],
    edges: [
      {
        from: "reports",
        to: "places",
        label: "puede afectar",
      },
      {
        from: "reports",
        to: "user",
        label: "puede afectar",
      },
      {
        from: "reports",
        to:
          "places/{documentId}/moderationActions",
        label: "genera acción",
      },
      {
        from: "reports",
        to:
          "user/{documentId}/moderationHistory",
        label: "genera antecedente",
      },
    ],
  },

  {
    fileName: "06-place-submissions.mmd",
    direction: "LR",
    collections: [
      {
        path: "placeSubmissions",
      },
      {
        path: "placeSubmissionReturns",
      },
      {
        path: "places",
        fields: [
          "placeId",
          "name",
          "createdBy",
          "status",
          "source",
          "origin",
          "createdAt",
          "updatedAt",
        ],
      },
    ],
    edges: [
      {
        from: "placeSubmissions",
        to: "placeSubmissionReturns",
        label: "puede devolverse",
      },
      {
        from: "placeSubmissions",
        to: "places",
        label: "aprobada crea",
      },
    ],
  },

  {
    fileName: "07-content-submissions.mmd",
    direction: "LR",
    collections: [
      {
        path: "photoSubmissions",
      },
      {
        path: "descriptionSubmissions",
      },
      {
        path: "deletedSubmissions",
      },
      {
        path: "places",
        fields: [
          "placeId",
          "name",
          "description",
          "photos",
          "mainPhoto",
          "photoCount",
          "metrics",
          "updatedAt",
        ],
      },
    ],
    edges: [
      {
        from: "photoSubmissions",
        to: "places",
        label: "actualiza fotografías",
      },
      {
        from: "descriptionSubmissions",
        to: "places",
        label: "actualiza descripción",
      },
      {
        from: "photoSubmissions",
        to: "deletedSubmissions",
        label: "solicitud de eliminación",
      },
      {
        from: "descriptionSubmissions",
        to: "deletedSubmissions",
        label: "solicitud de eliminación",
      },
    ],
  },

  {
    fileName: "08-google-import.mmd",
    direction: "LR",
    collections: [
      {
        path: "candidatesPlaces",
      },
      {
        path: "rejectedGooglePlaces",
      },
      {
        path: "places",
        fields: [
          "placeId",
          "name",
          "address",
          "location",
          "parentHexId",
          "placeHexId",
          "tagId",
          "tagLabel",
          "status",
          "source",
          "origin",
          "googleData",
          "createdAt",
          "updatedAt",
        ],
      },
    ],
    edges: [
      {
        from: "candidatesPlaces",
        to: "places",
        label: "candidato aprobado",
      },
      {
        from: "candidatesPlaces",
        to: "rejectedGooglePlaces",
        label: "candidato rechazado",
      },
    ],
  },
];

function detectType(value) {
  if (value === null) {
    return "null";
  }

  if (value instanceof Timestamp) {
    return "timestamp";
  }

  if (value instanceof GeoPoint) {
    return "geopoint";
  }

  if (value instanceof DocumentReference) {
    return "reference";
  }

  if (Buffer.isBuffer(value)) {
    return "bytes";
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "array";
    }

    const itemTypes = [
      ...new Set(
        value.map((item) => detectType(item)),
      ),
    ];

    return `array<${itemTypes.join(" | ")}>`;
  }

  if (typeof value === "string") {
    return "string";
  }

  if (typeof value === "boolean") {
    return "boolean";
  }

  if (typeof value === "number") {
    return Number.isInteger(value)
      ? "int64"
      : "double";
  }

  if (
    typeof value === "object" &&
    value !== null
  ) {
    return "map";
  }

  return typeof value;
}

function inspectObject(value) {
  const result = {};

  for (
    const [fieldName, fieldValue]
    of Object.entries(value)
  ) {
    const type = detectType(fieldValue);

    result[fieldName] = {
      types: new Set([type]),
      children:
        type === "map"
          ? inspectObject(fieldValue)
          : null,
    };
  }

  return result;
}

function mergeSchemas(target, source) {
  for (
    const [fieldName, sourceField]
    of Object.entries(source)
  ) {
    if (!target[fieldName]) {
      target[fieldName] = {
        types: new Set(),
        children: null,
      };
    }

    for (const type of sourceField.types) {
      target[fieldName].types.add(type);
    }

    if (sourceField.children) {
      target[fieldName].children ??= {};

      mergeSchemas(
        target[fieldName].children,
        sourceField.children,
      );
    }
  }

  return target;
}

function sanitizeMermaidId(value) {
  return `node_${value}`
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_");
}

function escapeMermaid(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll('"', "'")
    .replaceAll("|", "&#124;");
}

function schemaToLines(
  schema,
  depth = 0,
) {
  const lines = [];

  const indent =
    "&nbsp;".repeat(depth * 4);

  for (
    const [fieldName, definition]
    of Object.entries(schema)
  ) {
    const types = [
      ...definition.types,
    ];

    const hasMap =
      types.includes("map");

    const otherTypes =
      types.filter(
        (type) => type !== "map",
      );

    if (
      hasMap &&
      definition.children
    ) {
      const suffix =
        otherTypes.length > 0
          ? ` | ${otherTypes.join(" | ")}`
          : "";

      lines.push(
        `${indent}${fieldName}: map${suffix} {`,
      );

      lines.push(
        ...schemaToLines(
          definition.children,
          depth + 1,
        ),
      );

      lines.push(`${indent}}`);

      continue;
    }

    lines.push(
      `${indent}${fieldName}: ${types.join(" | ")}`,
    );
  }

  return lines;
}

function selectSchemaFields(
  schema,
  selectedFields,
) {
  if (
    !Array.isArray(selectedFields) ||
    selectedFields.length === 0
  ) {
    return schema;
  }

  const selectedSchema = {};

  for (const fieldName of selectedFields) {
    if (!schema[fieldName]) {
      continue;
    }

    selectedSchema[fieldName] =
      schema[fieldName];
  }

  return selectedSchema;
}

async function inspectCollection(
  collectionRef,
  collectionPath,
  state,
  depth = 0,
) {
  if (depth > MAX_DEPTH) {
    return;
  }

  if (
    !state.collections.has(
      collectionPath,
    )
  ) {
    state.collections.set(
      collectionPath,
      {
        path: collectionPath,
        schema: {},
        parentPath: null,
      },
    );
  }

  const collectionInfo =
    state.collections.get(
      collectionPath,
    );

  const snapshot =
    await collectionRef
      .limit(SAMPLE_DOCUMENTS)
      .get();

  if (snapshot.empty) {
    console.warn(
      `La colección ${collectionPath} no tiene documentos de muestra.`,
    );

    return;
  }

  for (
    const documentSnapshot
    of snapshot.docs
  ) {
    const documentSchema =
      inspectObject(
        documentSnapshot.data(),
      );

    mergeSchemas(
      collectionInfo.schema,
      documentSchema,
    );

    const subcollections =
      await documentSnapshot.ref
        .listCollections();

    for (
      const subcollectionRef
      of subcollections
    ) {
      const subcollectionPath =
        `${collectionPath}/{documentId}/${subcollectionRef.id}`;

      if (
        !state.collections.has(
          subcollectionPath,
        )
      ) {
        state.collections.set(
          subcollectionPath,
          {
            path: subcollectionPath,
            schema: {},
            parentPath:
              collectionPath,
          },
        );
      }

      await inspectCollection(
        subcollectionRef,
        subcollectionPath,
        state,
        depth + 1,
      );
    }
  }
}

function createDiagramCollections(
  allCollections,
  group,
) {
  const diagramCollections =
    new Map();

  for (
    const collectionConfig
    of group.collections
  ) {
    const collection =
      allCollections.get(
        collectionConfig.path,
      );

    if (!collection) {
      console.warn(
        `No se encontró la colección para ${group.fileName}: ${collectionConfig.path}`,
      );

      continue;
    }

    diagramCollections.set(
      collection.path,
      {
        ...collection,
        schema: selectSchemaFields(
          collection.schema,
          collectionConfig.fields,
        ),
      },
    );
  }

  return diagramCollections;
}

function generateMermaid(
  collections,
  {
    direction = "LR",
    edges = [],
  } = {},
) {
const lines = [
  `%%{
    init: {
      'theme': 'base',
      'themeVariables': {
        'fontFamily': 'Arial',
        'fontSize': '20px',
        'lineColor': '#333333',
        'primaryTextColor': '#111111',
        'primaryBorderColor': '#444444',
        'primaryColor': '#ffffff'
      },
      'flowchart': {
        'htmlLabels': true,
        'nodeSpacing': 120,
        'rankSpacing': 150,
        'curve': 'basis',
        'useMaxWidth': false
      }
    }
  }%%`,
  `flowchart ${direction}`,
];

  for (
    const collection
    of collections.values()
  ) {
    const nodeId =
      sanitizeMermaidId(
        collection.path,
      );

    const fields =
      schemaToLines(
        collection.schema,
      );

    const title =
      escapeMermaid(
        `Colección: ${collection.path}`,
      );

    const fieldsHtml =
      fields
        .map((field) => {
          return `${escapeMermaid(field)}<br/>`;
        })
        .join("");

    const content = [
      "<div style='text-align:left; min-width:340px; font-family:Arial; font-size:20px; line-height:1.35;'>",
      `<b>${title}</b><br/>`,
      "────────────────<br/>",
      fieldsHtml,
      "</div>",
    ].join("");

    lines.push(
      `  ${nodeId}["${content}"]`,
    );
  }

  /*
   * Relaciones físicas de subcolecciones.
   */
  for (
    const collection
    of collections.values()
  ) {
    if (!collection.parentPath) {
      continue;
    }

    if (
      !collections.has(
        collection.parentPath,
      )
    ) {
      continue;
    }

    const parentId =
      sanitizeMermaidId(
        collection.parentPath,
      );

    const childId =
      sanitizeMermaidId(
        collection.path,
      );

    lines.push(
      `  ${parentId} -->|"subcolección"| ${childId}`,
    );
  }

  /*
   * Relaciones lógicas definidas
   * manualmente para cada módulo.
   */
  for (const edge of edges) {
    if (
      !collections.has(edge.from) ||
      !collections.has(edge.to)
    ) {
      console.warn(
        `No se pudo generar la relación ${edge.from} -> ${edge.to}.`,
      );

      continue;
    }

    const fromId =
      sanitizeMermaidId(
        edge.from,
      );

    const toId =
      sanitizeMermaidId(
        edge.to,
      );

    const label =
      escapeMermaid(
        edge.label || "relación",
      );

    lines.push(
      `  ${fromId} -.->|"${label}"| ${toId}`,
    );
  }

  return lines.join("\n");
}

function serializeSchema(schema) {
  const result = {};

  for (
    const [fieldName, definition]
    of Object.entries(schema)
  ) {
    result[fieldName] = {
      types: [
        ...definition.types,
      ],
      children:
        definition.children
          ? serializeSchema(
              definition.children,
            )
          : null,
    };
  }

  return result;
}

async function writeSchemaFile(
  collections,
) {
  const serializedCollections = [
    ...collections.values(),
  ].map((collection) => {
    return {
      path: collection.path,
      parentPath:
        collection.parentPath,
      schema: serializeSchema(
        collection.schema,
      ),
    };
  });

  await fs.writeFile(
    `${GENERATED_DIRECTORY}/firestore-schema.json`,
    JSON.stringify(
      serializedCollections,
      null,
      2,
    ),
    "utf8",
  );
}

async function writeDiagramFiles(
  collections,
) {
  for (
    const group
    of DIAGRAM_GROUPS
  ) {
    const diagramCollections =
      createDiagramCollections(
        collections,
        group,
      );

    const mermaid =
      generateMermaid(
        diagramCollections,
        {
          direction:
            group.direction,
          edges:
            group.edges || [],
        },
      );

    const outputPath =
      `${DIAGRAMS_DIRECTORY}/${group.fileName}`;

    await fs.writeFile(
      outputPath,
      mermaid,
      "utf8",
    );

    console.log(
      `Generado: ${outputPath}`,
    );
  }
}

async function main() {
  console.log(
    "Leyendo Firestore...",
  );

  const rootCollections =
    await db.listCollections();

  const state = {
    collections: new Map(),
  };

  for (
    const collectionRef
    of rootCollections
  ) {
    console.log(
      `Analizando colección: ${collectionRef.id}`,
    );

    await inspectCollection(
      collectionRef,
      collectionRef.id,
      state,
    );
  }

  await fs.mkdir(
    DIAGRAMS_DIRECTORY,
    {
      recursive: true,
    },
  );

  await writeSchemaFile(
    state.collections,
  );

  await writeDiagramFiles(
    state.collections,
  );

  console.log("");
  console.log("Proceso terminado.");
  console.log("");
  console.log(
    `Esquema JSON: ${GENERATED_DIRECTORY}/firestore-schema.json`,
  );
  console.log(
    `Diagramas: ${DIAGRAMS_DIRECTORY}`,
  );
}

main().catch((error) => {
  console.error(
    "No se pudieron generar los diagramas:",
    error,
  );

  process.exitCode = 1;
});