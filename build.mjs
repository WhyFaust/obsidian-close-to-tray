import { readFile, writeFile } from "node:fs/promises";

const program = await readFile(new URL("./src/indicator.py", import.meta.url), "utf8");
const plugin = await readFile(new URL("./src/plugin.js", import.meta.url), "utf8");
await writeFile(new URL("./main.js", import.meta.url),
    '"use strict";\nconst INDICATOR_PROGRAM = ' + JSON.stringify(program) + ";\n\n" + plugin);
