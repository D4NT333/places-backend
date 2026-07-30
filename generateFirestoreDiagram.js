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
      ...new Set(value.map((item) => detectType(item))),
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
    typeof value === "object"
    && value !== null
  ) {
    return "map";
  }

  return typeof value;
}

function inspectObject(value) {
  const result = {};

  for (const [fieldName, fieldValue] of Object.entries(value)) {
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
  for (const [fieldName, sourceField] of Object.entries(source)) {
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

function schemaToLines(schema, depth = 0) {
  const lines = [];

  const indent = "&nbsp;".repeat(depth * 4);

  for (const [fieldName, definition] of Object.entries(schema)) {
    const types = [...definition.types];

    const hasMap = types.includes("map");
    const otherTypes = types.filter((type) => type !== "map");

    if (hasMap && definition.children) {
      const suffix = otherTypes.length > 0
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


async function inspectCollection(
  collectionRef,
  collectionPath,
  state,
  depth = 0,
) {
  if (depth > MAX_DEPTH) {
    return;
  }

  if (!state.collections.has(collectionPath)) {
    state.collections.set(collectionPath, {
      path: collectionPath,
      schema: {},
      parentPath: null,
    });
  }

  const collectionInfo =
    state.collections.get(collectionPath);

  const snapshot = await collectionRef
    .limit(SAMPLE_DOCUMENTS)
    .get();

  if (snapshot.empty) {
    return;
  }

  for (const documentSnapshot of snapshot.docs) {
    const documentSchema = inspectObject(
      documentSnapshot.data(),
    );

    mergeSchemas(
      collectionInfo.schema,
      documentSchema,
    );

    const subcollections =
      await documentSnapshot.ref.listCollections();

    for (const subcollectionRef of subcollections) {
      const subcollectionPath =
        `${collectionPath}/{documentId}/${subcollectionRef.id}`;

      if (!state.collections.has(subcollectionPath)) {
        state.collections.set(subcollectionPath, {
          path: subcollectionPath,
          schema: {},
          parentPath: collectionPath,
        });
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

function generateMermaid(collections) {
  const lines = [
    "%%{init: {'flowchart': {'htmlLabels': true, 'nodeSpacing': 120, 'rankSpacing': 160, 'curve': 'basis'}}}%%",
    "flowchart LR",
  ];

  for (const collection of collections.values()) {
    const nodeId = sanitizeMermaidId(
      collection.path,
    );

    const fields = schemaToLines(
      collection.schema,
    );

    const title = escapeMermaid(
      `Colección: ${collection.path}`,
    );

    const fieldsHtml = fields
      .map((field) => {
        return `${escapeMermaid(field)}<br/>`;
      })
      .join("");

    const content = [
      "<div style='text-align:left; min-width:260px;'>",
      `<b>${title}</b><br/>`,
      "────────────────<br/>",
      fieldsHtml,
      "</div>",
    ].join("");

    lines.push(
      `  ${nodeId}["${content}"]`,
    );
  }

  for (const collection of collections.values()) {
    if (!collection.parentPath) {
      continue;
    }

    const parentId = sanitizeMermaidId(
      collection.parentPath,
    );

    const childId = sanitizeMermaidId(
      collection.path,
    );

    lines.push(
      `  ${parentId} -->|"subcolección"| ${childId}`,
    );
  }

  return lines.join("\n");
}

async function main() {
  console.log("Leyendo Firestore...");

  const rootCollections =
    await db.listCollections();

  const state = {
    collections: new Map(),
  };

  for (const collectionRef of rootCollections) {
    console.log(
      `Analizando colección: ${collectionRef.id}`,
    );

    await inspectCollection(
      collectionRef,
      collectionRef.id,
      state,
    );
  }

  const mermaid = generateMermaid(
    state.collections,
  );

  await fs.mkdir("./generated", {
    recursive: true,
  });

  await fs.writeFile(
    "./generated/firestore-diagram.mmd",
    mermaid,
    "utf8",
  );

  await fs.writeFile(
    "./generated/firestore-schema.json",
    JSON.stringify(
      [...state.collections.values()].map(
        (collection) => ({
          path: collection.path,
          parentPath: collection.parentPath,
          schema: serializeSchema(
            collection.schema,
          ),
        }),
      ),
      null,
      2,
    ),
    "utf8",
  );

  console.log("");
  console.log("Listo:");
  console.log(
    "generated/firestore-diagram.mmd",
  );
  console.log(
    "generated/firestore-schema.json",
  );
}

function serializeSchema(schema) {
  const result = {};

  for (const [fieldName, definition] of Object.entries(schema)) {
    result[fieldName] = {
      types: [...definition.types],
      children: definition.children
        ? serializeSchema(definition.children)
        : null,
    };
  }

  return result;
}

main().catch((error) => {
  console.error(
    "No se pudo generar el diagrama:",
    error,
  );

  process.exitCode = 1;
});