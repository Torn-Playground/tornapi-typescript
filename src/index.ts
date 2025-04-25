import { OpenAPIV3 } from "@scalar/openapi-types";
import fs from "fs/promises";
import { getOpenApiReader, getTypeScriptWriter, makeConverter } from "typeconv";
import * as prettier from "prettier";

(async () => {
    await fs.mkdir("dist").catch(() => {});

    const specification: OpenAPIV3.Document = await fetch("https://www.torn.com/swagger/openapi.json").then((r) => r.json());
    // const specification: OpenAPIV3.Document = await fs.readFile("dist/openapi.json", "utf-8").then(r => JSON.parse(r));

    await fs.writeFile("dist/openapi.json", JSON.stringify(specification, null, 2));

    const reader = getOpenApiReader();
    const writer = getTypeScriptWriter();
    const { convert } = makeConverter(reader, writer);

    const { data } = await convert({ data: JSON.stringify(specification) });

    const cleanData = data.replaceAll("[key: string]: any;", "").replaceAll("& ({\n        \n    } | null)", "| null");

    const formattedData = await prettier.format(cleanData, { parser: "typescript", tabWidth: 4 });

    await fs.writeFile("dist/index.d.ts", formattedData);
})();
