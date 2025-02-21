import { OpenAPIV3 } from "@scalar/openapi-types";
import fs from "fs/promises";
import { getOpenApiReader, getTypeScriptWriter, makeConverter } from "typeconv";
import * as prettier from "prettier";

(async () => {
    await fs.mkdir("dist").catch(() => {});

    const specification: OpenAPIV3.Document = await fetch("https://www.torn.com/swagger/openapi.json").then((r) => r.json());
    // const specification: OpenAPIV3.Document = await fs.readFile("dist/openapi.json", "utf-8").then(r => JSON.parse(r));
    cleanupAllOf(specification);
    cleanupOneOf(specification);
    markRequired(specification.components?.schemas);

    await fs.writeFile("dist/openapi.json", JSON.stringify(specification, null, 2));

    const reader = getOpenApiReader();
    const writer = getTypeScriptWriter();
    const { convert } = makeConverter(reader, writer);

    const { data } = await convert({ data: JSON.stringify(specification) });

    const cleanData = data.replaceAll("[key: string]: any;", "").replaceAll("& ({\n        \n    } | null)", "| null");

    const formattedData = await prettier.format(cleanData, { parser: "typescript", tabWidth: 4 });

    await fs.writeFile("dist/index.d.ts", formattedData);
})();

/**
 * Remove 'type' from schemas that have defined 'allOf'.
 * Our library for creating the types doesn't work at all with this defined.
 * @param specification
 */
function cleanupAllOf(specification: OpenAPIV3.Document) {
    if (!specification.components?.schemas) return;

    Object.values(specification.components.schemas)
        .filter((schema): schema is OpenAPIV3.SchemaObject => "properties" in schema)
        .flatMap((schema: OpenAPIV3.SchemaObject) => Object.values(schema.properties!))
        .filter((property) => "allOf" in property && "type" in property)
        .forEach((property) => delete property["type"]);
}

/**
 * Remove 'type' from schemas that have defined 'oneOf'.
 * Our library for creating the types generates weird stuff if both are present.
 * @param specification
 */
function cleanupOneOf(specification: OpenAPIV3.Document) {
    if (!specification.components?.schemas) return;

    Object.values(specification.components.schemas)
        .filter((schema): schema is OpenAPIV3.SchemaObject => "properties" in schema)
        .flatMap((schema: OpenAPIV3.SchemaObject) => Object.values(schema.properties!))
        .filter((property) => "oneOf" in property && "type" in property)
        .forEach((property) => delete property["type"]);
}

/**
 * Since everything in the TornAPI is always present, but nullable, put it all in required.
 * @param schemas
 */
function markRequired(schemas: { [p: string]: any } | undefined) {
    if (!schemas) return;

    Object.values(schemas)
        .filter((schema): schema is OpenAPIV3.SchemaObject => typeof schema === "object")
        .forEach((schema) => {
            if ("properties" in schema) {
                const requiredProperties = Object.entries(schema.properties!).map(([name]) => name);
                if (requiredProperties.length) {
                    schema.required = requiredProperties;
                }

                markRequired(schema.properties);
            }
            if ("items" in schema && "properties" in schema.items) {
                markRequired(schema.items);
            }
        });
}
