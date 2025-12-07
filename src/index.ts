import { OpenAPIV3 } from "@scalar/openapi-types";
import fs from "node:fs/promises";
import { getOpenApiReader, getTypeScriptWriter, makeConverter } from "typeconv";
import * as prettier from "prettier";
import typescript, { ScriptTarget } from "typescript";

const EXCLUDED_PARAMS = ["comment", "key"];

(async () => {
    await fs.mkdir("dist").catch(() => {});

    const specification: OpenAPIV3.Document = await fetch("https://www.torn.com/swagger/openapi.json").then((r) => r.json());
    // const specification: OpenAPIV3.Document = await fs.readFile("dist/openapi.json", "utf-8").then(r => JSON.parse(r));

    await fs.writeFile("dist/openapi.json", JSON.stringify(specification, null, 2));

    const types = await writeTypes(specification);
    const client = await writeClient(specification);

    const allCode = await prettier.format(types + "\n" + client, {
        parser: "typescript",
        tabWidth: 4,
    });
    await fs.writeFile("dist/index.ts", allCode);

    const compiledCode = typescript.transpile(allCode, { target: ScriptTarget.ESNext });
    await fs.writeFile("dist/index.js", compiledCode);

    const compiledDeclarations = typescript.transpileDeclaration(allCode, {}).outputText;
    await fs.writeFile("dist/index.d.ts", compiledDeclarations);
})();

async function writeTypes(specification: OpenAPIV3.Document): Promise<string> {
    const reader = getOpenApiReader();
    const writer = getTypeScriptWriter();
    const { convert } = makeConverter(reader, writer);

    const { data } = await convert({ data: JSON.stringify(specification) });

    return data.replaceAll("[key: string]: any;", "").replaceAll("& ({\n        \n    } | null)", "| null");
}

interface SelectionDetail {
    section: string;
    selection: string;
    response: string;
    params: ParamDetail[];
}

interface ParamDetail {
    name: string;
}

async function writeClient(specification: OpenAPIV3.Document): Promise<string> {
    const details = Object.entries(specification.paths!)
        .map<SelectionDetail | null>(([path, value]) => {
            const splitPath = path.split("/").filter((x) => !!x);
            if (splitPath.length <= 1) return null;

            const selection = splitPath[splitPath.length - 1];

            const splitSchema = value?.get?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref?.split("/");
            const type = splitSchema ? splitSchema[splitSchema.length - 1] : null;

            return {
                section: splitPath[0],
                selection,
                response: type,
                params: extractParameters(value?.get?.parameters, specification.components!.parameters!),
            };
        })
        .filter((detail) => !!detail);

    return await prettier.format(await generateFullClient(details), {
        parser: "typescript",
        tabWidth: 4,
    });
}

function generateSectionTypeV2(details: SelectionDetail[], section: string) {
    return [
        `export interface ${section.charAt(0).toUpperCase() + section.slice(1)}V2 extends BaseSchema {`,
        `selections: {`,
        ...details
            .filter((detail) => detail.section === section)
            .filter((detail, index, self) => index === self.findIndex((l) => l.selection === detail.selection))
            .map((detail) => [
                `${detail.selection}: {`,
                `response: ${detail.response}`,
                `params: ${detail.params.length ? buildParams(detail.params) : "never"};`,
                "}",
            ])
            .flat(),
        "}",
        "}",
    ].join("\n");
}

function buildParams(params: ParamDetail[]) {
    return Object.values(params)
        .map((p) => `"${p.name}"`)
        .join(" | ");
}

async function generateFullClient(details: SelectionDetail[]) {
    const sectionsV1 = await getSectionsV1();
    const typesV1 = await Promise.all(sectionsV1.map(generateSectionTypeV1));
    const sectionsV2 = Array.from(new Set(details.map((detail) => detail.section)));
    const typesV2 = sectionsV2.map((section) => generateSectionTypeV2(details, section));

    return await templateClientCode([
        ...typesV1,
        "export interface SectionsV1Map {",
        ...sectionsV1.map((s) => `${s}: ${s.charAt(0).toUpperCase() + s.slice(1)}V1;`),
        "}",
        ...typesV2,
        "export interface SectionsV2Map {",
        ...sectionsV2.map((s) => `${s}: ${s.charAt(0).toUpperCase() + s.slice(1)}V2;`),
        "}",
        await generateErrorCodesEnum(),
    ]);
}

async function getSectionsV1(): Promise<string[]> {
    const response = await fetch("https://tornapi.tornplayground.eu/api/v1/sections");
    const { sections } = await response.json();
    return sections;
}

async function generateSectionTypeV1(section: string) {
    const url = `https://tornapi.tornplayground.eu/api/v1/schema/${section}`;
    const data = await fetch(url).then((r) => r.json());

    return [
        `export interface ${section.charAt(0).toUpperCase() + section.slice(1)}V1 extends BaseSchema {`,
        `selections: {`,
        ...data.selections
            .map((s: any) => [
                `${s.name}: {`,
                `response: ${buildResponseType(s.schema, s.structures)}`,
                `params: ${s.params.length ? buildParams(s.params) : "never"};`,
                `requiredID: ${!!s.id.optional} ;`,
                "}",
            ])
            .flat(),
        "}",
        "}",
    ].join("\n");
}

function buildResponseType(schema: Record<string, any>, structures: Record<string, any>[]) {
    const entries = Object.entries(schema);
    if (entries.every(([name]) => name.startsWith("<") && name.endsWith(">"))) {
        return `| {${entries.map(schemaToType).join("} \n | {")}}`;
    }
    return `{${entries.map(schemaToType).join("\n")}}`;

    function schemaToType([name, schema]: [string, Record<string, any>]): string {
        if (name.startsWith("<") && name.endsWith(">")) name = `[${name.slice(1, -1).replaceAll(/[_\-\s]/g, "_")}: string]`;
        else if (!name.startsWith(`"`) && !name.startsWith("[")) name = `"${name}"`;

        if (typeof schema.type === "string") {
            switch (schema.type.toLowerCase()) {
                case "array of strings":
                    return `${name}: string[];`;
                case "boolean":
                    return `${name}: boolean;`;
                case "array of integers":
                case "array of epoch timestamp (in seconds)":
                    return `${name}: number[];`;
                case "epoch timestamp (in seconds)":
                case "integer":
                case "number (with floating point)":
                case "integer or number (with floating point)":
                    return `${name}: number;`;
                case "numberboolean (0 for false, 1 for true)":
                    return `${name}: 0 | 1;`;
                case "1 or 1.25":
                    return `${name}: 1 | 1.25;`;
                case "1 or 1.5":
                    return `${name}: 1 | 1.5;`;
                case "1 or 2":
                    return `${name}: 1 | 2;`;
                case "string":
                case "date (yyyy-dd-mm hh:mm:ss)":
                case "date (yyyy-mm-dd hh:mm:ss)":
                    return `${name}: string;`;
                case "integer + string":
                    return `${name}: number | string;`;
                case "integer + (empty) string":
                    return `${name}: number | "";`;
                case "key-value map":
                    return `${name}: Record<string, any>;`;
                case "unknown, let us know what it looks like.":
                case "unknown":
                    return `${name}: unknown;`;
                default:
                    throw new Error(`Unknown type: ${schema.type}`);
            }
        } else if (schema.structure) {
            const structure = structures.find((s) => s.id === schema.structure.id);
            if (!structure)
                throw new Error("Structure not found", {
                    cause: { schema, structures },
                });
            if (schema.structure.type === "object") return schemaToType([name, structure.schema]);
            else if (schema.structure.type === "enum") {
                return `${name}: ${structure.values.map((v: string) => `"${v}"`).join(" | ")};`;
            } else
                throw new Error(`Unsupported structure type: ${schema.structure.type}`, {
                    cause: {
                        schema,
                        structures,
                    },
                });
        } else {
            return `${name}: ${buildResponseType(schema, structures)};`;
        }
    }
}

async function getErrorCodes(): Promise<{ code: number; message: string; description: string }[]> {
    const response = await fetch("https://tornapi.tornplayground.eu/api/v1/errors");
    const { errors } = await response.json();
    return errors;
}

async function generateErrorCodesEnum(): Promise<string> {
    const errors = await getErrorCodes();

    return [
        "export enum TornApiError {",
        ...errors.map(
            ({ code, message }) =>
                `${message
                    .toUpperCase()
                    .replaceAll(/[^\w\s]/g, "")
                    .split(" ")
                    .filter((t) => !["IS", "IN", "THE", "OF", "THIS", "IDENTITY", "PLEASE", "TRY", "DUE", "OWNER", "AGAIN"].includes(t))
                    .slice(0, 5)
                    .join("_")} = ${code},`,
        ),
        "}",
    ].join("\n");
}

function extractParameters(
    params?: (OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject)[],
    allParameters?: {
        [key: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject;
    },
): ParamDetail[] {
    if (!params) return [];

    return params
        .map<ParamDetail | null>((p) => {
            if ("$ref" in p) {
                if (!allParameters) return null;

                const splitReference = p.$ref!.split("/");
                const referenceName = splitReference[splitReference.length - 1];
                if (!(referenceName in allParameters)) return null;

                return { name: allParameters[referenceName].name! };
            } else {
                return { name: p.name };
            }
        })
        .filter<ParamDetail>((x) => !!x)
        .filter((x) => !EXCLUDED_PARAMS.includes(x.name));
}

async function templateClientCode(types: string[]) {
    const inputClientCode = await fs.readFile("src/template/client.ts", "utf-8");

    return inputClientCode.replace(/\/\* MARKER: types \*\/\s*([\s\S]*?)\s*\/\* MARKER END: types \*\//g, types.join("\n"));
}
