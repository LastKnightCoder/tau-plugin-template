import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const [plugins, ui] = process.argv.slice(2);
if (!plugins || !ui) throw new Error("用法：node use-local-sdk.mjs <插件 SDK.tgz> <UI SDK.tgz>");
const manifest = JSON.parse(await readFile("package.json", "utf8"));
const dependencyGroup = name => manifest.dependencies?.[`@tau/${name}`] !== undefined ? manifest.dependencies : manifest.devDependencies;
for (const name of ["plugins", "ui"]) {
  const current = dependencyGroup(name)?.[`@tau/${name}`];
  if (!current?.startsWith("file:.sdk/") && !current?.startsWith(`npm:@xiongtao.xt/tau-${name}@`))
    throw new Error("模板 SDK 依赖来源不符合预期");
}
await mkdir(".sdk", { recursive: true });
for (const [name, source] of [["plugins", plugins], ["ui", ui]]) {
  const hash = createHash("sha256").update(await readFile(source)).digest("hex").slice(0, 16);
  const target = `.sdk/${name}-${hash}.tgz`;
  await cp(path.resolve(source), target);
  dependencyGroup(name)[`@tau/${name}`] = `file:${target}`;
}
await writeFile("package.json", JSON.stringify(manifest, null, 2) + "\n");
console.log("本地 SDK 已准备；运行 pnpm install 生成或更新锁文件，再运行 pnpm build。");
