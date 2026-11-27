import { build } from "esbuild";
import AdmZip from "adm-zip";
import {
  cp,
  lstat,
  mkdir,
  readdir,
  readFile,
  writeFile,
  mkdtemp,
  rename,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { isBuiltin } from "node:module";

const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const portable = manifest.backend === undefined;
const templatePackage = manifest.template !== undefined;
const skillPackage =
  manifest.kind === "skills" ||
  (manifest.formatVersion === 1 && manifest.main === undefined && !templatePackage);
const { buildUnifiedPackageManifest } = await import("@tau/plugins/unified");
const packageContract = await import("@tau/plugins/package");
const LOCALIZED_README_PATTERN = /^README\.([A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*)\.md$/;
const parseLocalizedReadmeFilename =
  packageContract.parseLocalizedReadmeFilename ??
  (fileName => {
    const match = LOCALIZED_README_PATTERN.exec(fileName);
    if (!match || match[1].length > 35) return null;
    try {
      return new Intl.Locale(match[1]).toString();
    } catch {
      return null;
    }
  });
const backend =
  manifest.backend === undefined
    ? undefined
    : packageContract.validateBackendManifest(manifest.backend);

/** skills/<id>/ 下每个目录是一个 Skill：必须有带 description 的 SKILL.md，全部文件原样打包。 */
async function collectSkills(staging) {
  let folders;
  try {
    folders = (await readdir("skills", { withFileTypes: true }))
      .filter(entry => !entry.name.startsWith("."))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    if (error.code === "ENOENT") return { ids: [], files: [] };
    throw error;
  }
  const ids = [];
  const files = [];
  async function walk(relative) {
    for (const entry of await readdir(relative, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || ["node_modules", "__pycache__"].includes(entry.name))
        continue;
      const file = `${relative}/${entry.name}`;
      if ((await lstat(file)).isSymbolicLink()) throw new Error(`Skill 不能包含符号链接：${file}`);
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile()) {
        await mkdir(path.dirname(path.join(staging, file)), { recursive: true });
        await cp(file, path.join(staging, file));
        files.push(file);
      }
    }
  }
  for (const folder of folders) {
    if (!folder.isDirectory()) throw new Error(`skills 下只能放 Skill 目录：${folder.name}`);
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(folder.name))
      throw new Error(`Skill 目录名只能使用字母、数字、点、横线和下划线：${folder.name}`);
    const readme = await readFile(`skills/${folder.name}/SKILL.md`, "utf8").catch(() => null);
    if (readme === null) throw new Error(`skills/${folder.name} 缺少 SKILL.md`);
    const front = readme.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!front || !/^description:\s*\S/m.test(front[1]))
      throw new Error(
        `skills/${folder.name}/SKILL.md 需要在开头的 front matter 中填写 description`
      );
    ids.push(folder.name);
    await walk(`skills/${folder.name}`);
  }
  return { ids, files };
}

const shared = [
  "@tau/plugins",
  "@tau/plugins/whiteboard",
  "@tau/plugins/sync",
  "@tau/ui",
  "react",
  "react-dom",
  "react-dom/client",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
];
if (portable)
  shared.splice(
    0,
    shared.length,
    ...(await import("@tau/plugins/portable")).PORTABLE_SHARED_MODULES
  );
await mkdir("dist", { recursive: true });
const staging = await mkdtemp(path.resolve("dist/.building-"));
const buildId = randomUUID();
const pointer = path.resolve("dist", `.building-pointer-${buildId}`);
try {
  const readme = await readFile("README.md", "utf8");
  if (!readme.trim()) throw new Error("README.md 必须包含插件介绍与使用说明");
  if (typeof manifest.description !== "string" || !manifest.description.trim())
    throw new Error("manifest.description 必须为非空简介");
  await writeFile(path.join(staging, "README.md"), readme);
  const localizedReadmes = new Map();
  for (const entry of await readdir(".", { withFileTypes: true })) {
    const locale = parseLocalizedReadmeFilename(entry.name);
    if (!locale) continue;
    if ((await lstat(entry.name)).isSymbolicLink() || !entry.isFile())
      throw new Error(`多语言说明必须是普通文件：${entry.name}`);
    if (localizedReadmes.has(locale))
      throw new Error(`多语言说明存在重复语言：${entry.name}`);
    const content = await readFile(entry.name, "utf8");
    if (!content.trim()) throw new Error(`${entry.name} 不能为空`);
    localizedReadmes.set(locale, entry.name);
    await writeFile(path.join(staging, `README.${locale}.md`), content);
  }
  for (const name of ["LICENSE", "CHANGELOG.md"]) {
    try {
      await writeFile(path.join(staging, name), await readFile(name));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const skills = await collectSkills(staging);
  if (skillPackage && !skills.ids.length)
    throw new Error("Skill 包至少需要一个 skills/<id>/SKILL.md");
  const templateFiles = [];
  if (templatePackage) {
    const root = manifest.template.root;
    if (
      typeof root !== "string" ||
      root.includes("\\") ||
      root.split("/").some(part => !part || part === "." || part === "..")
    )
      throw new Error("模板资源目录无效");
    const collectTemplate = async relative => {
      const info = await lstat(relative);
      if (info.isSymbolicLink()) throw new Error(`模板不能包含符号链接：${relative}`);
      if (info.isDirectory()) {
        for (const name of await readdir(relative)) await collectTemplate(`${relative}/${name}`);
      } else if (info.isFile()) {
        await mkdir(path.dirname(path.join(staging, relative)), { recursive: true });
        await cp(relative, path.join(staging, relative));
        templateFiles.push(relative);
      } else throw new Error(`模板资源必须是普通文件：${relative}`);
    };
    await collectTemplate(root);
  }
  const result =
    skillPackage || templatePackage
      ? undefined
      : await build({
          entryPoints: ["src/index.tsx"],
          outfile: path.join(staging, "main.js"),
          bundle: true,
          platform: "browser",
          format: "cjs",
          target: "es2022",
          jsx: "automatic",
          external: shared,
          plugins: [
            {
              name: "browser-dependencies",
              setup(builder) {
                builder.onResolve({ filter: /.*/ }, args => {
                  if (isBuiltin(args.path))
                    return { errors: [{ text: `浏览器入口不能依赖 Node 内置模块：${args.path}` }] };
                });
              },
            },
          ],
          metafile: true,
          loader: { ".svg": "dataurl" },
          define: {
            __PLUGIN_PORTABLE__: JSON.stringify(portable),
            __PLUGIN_META__: JSON.stringify({
              id: manifest.id,
              name: manifest.name,
              version: manifest.version,
            }),
          },
        });
  for (const output of Object.values(result?.metafile.outputs ?? {})) {
    for (const dependency of output.imports) {
      if (dependency.external && !shared.includes(dependency.path))
        throw new Error(`插件构建包含未支持的外部依赖：${dependency.path}`);
    }
  }
  const styles = Object.keys(result?.metafile.outputs ?? {}).some(file =>
    file.endsWith("main.css")
  );
  if (backend) {
    const result = await build({
      entryPoints: ["src/backend.ts"],
      outfile: path.join(staging, backend.entry),
      bundle: true,
      platform: "node",
      format: "cjs",
      target: "es2022",
      external: ["@tau/plugins/backend"],
      metafile: true,
    });
    for (const output of Object.values(result.metafile.outputs))
      for (const dependency of output.imports)
        if (
          dependency.external &&
          dependency.path !== "@tau/plugins/backend" &&
          !isBuiltin(dependency.path)
        )
          throw new Error(`后台包含未打包依赖：${dependency.path}`);
  }
  const integrity = {};
  for (const file of [
    ...(skillPackage || templatePackage ? [] : ["main.js"]),
    ...templateFiles,
    ...(styles ? ["main.css"] : []),
    ...(backend ? [backend.entry] : []),
    ...skills.files,
  ])
    integrity[file] = createHash("sha256")
      .update(await readFile(path.join(staging, file)))
      .digest("hex");
  const basePackaged = buildUnifiedPackageManifest(manifest, {
    ...(!skillPackage && !templatePackage ? { main: "main.js" } : {}),
    integrity,
    ...(styles ? { styles: "main.css" } : {}),
    ...(skills.ids.length ? { skills: skills.ids } : {}),
  });
  const packaged = {
    ...basePackaged,
    ...(basePackaged.i18n === undefined && manifest.i18n ? { i18n: manifest.i18n } : {}),
    ...(basePackaged.locales === undefined && manifest.locales
      ? { locales: manifest.locales }
      : {}),
  };
  await writeFile(path.join(staging, "manifest.json"), JSON.stringify(packaged, null, 2));
  const destination = path.resolve("dist", `${manifest.version}-${buildId}`);
  await rename(staging, destination);
  await writeFile(
    pointer,
    JSON.stringify({
      formatVersion: 1,
      id: manifest.id,
      buildId,
      directory: path.basename(destination),
    })
  );
  await rename(pointer, path.resolve("dist", `tau-build-${manifest.id}.json`));
  const zip = new AdmZip();
  zip.addLocalFolder(destination, manifest.id);
  const archive = path.resolve("dist", `${manifest.id}-${manifest.version}.zip`);
  zip.writeZip(archive);
  console.log(
    `构建完成：${archive}\n格式 4 包通过插件中心安装，开发验证使用显式支持该协议的开发宿主。`
  );
} catch (error) {
  await rm(staging, { recursive: true, force: true });
  throw error;
} finally {
  await rm(pointer, { force: true });
}
