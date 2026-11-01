# 博客模板

用户在 Tau 里发布博客时，页面长什么样、地址怎么组织由博客模板决定。你可以把自己设计的博客页面做成模板，用户安装后在「发布 › 站点设置 › 博客模板」里选择，发布出去的站点就用你的页面显示他的文章、卡片和项目。

模板是一个静态网站：一组 HTML、JS、CSS 文件，在浏览器里读取 Tau 生成的[站点数据](site-data.md)来渲染页面。它不在 Tau 里运行，没有 `context`，也不经过插件的启用和停用。

## 从起步仓库开始

在 GitHub 上用 [模板起步仓库](https://github.com/LastKnightCoder/tau-blog-template-starter) 创建自己的仓库（「Use this template」），克隆到本地：

```sh
pnpm install --frozen-lockfile
pnpm dev     # 用内置的示例数据预览页面
pnpm check   # 类型检查
pnpm build   # 生成 output/<模板ID>-<版本>.zip
```

| 文件                      | 用途                                                   |
| ------------------------- | ------------------------------------------------------ |
| `template.json`           | 模板的身份和[站点字段](#站点字段)，构建时写进 manifest |
| `index.html`              | 入口页面，带有[占位符](#入口页面与占位符)              |
| `src/main.tsx`            | 读取数据、列表、搜索和单页路由                         |
| `src/Content.tsx`         | 正文的等待与错误展示                                   |
| `scripts/build.mjs`       | 构建页面、计算文件摘要、生成 manifest 和 ZIP           |
| `scripts/dev-fixture.mjs` | `pnpm dev` 用的示例数据，生产构建不包含它              |
| `STYLING_GUIDE.md`        | 在模板里使用 Tailwind 的配置说明                       |

先把 `template.json` 的 `id`、`name` 改成自己的。`example.template` 只是占位，ID 相同的模板会互相覆盖。

需要更完整的参考时，看官方的 [Tau 博客模板](https://github.com/LastKnightCoder/tau-blog-template)：它有文章、卡片、项目、搜索和多级路径路由。

插件模板的 `build.mjs` 只用来打包运行在 Tau 里的插件，不能构建博客模板，用起步仓库自带的 `scripts/build.mjs`。

## 模板包的组成

`pnpm build` 生成的 ZIP 解开后是：

```text
example.template/
  manifest.json
  README.md
  site/
    index.html
    assets/
      index-<摘要>.js
      index-<摘要>.css
```

`site/` 下的文件发布时原样复制到站点根目录，Tau 再把数据文件写进同一个站点。`data/`、`_tau/`、`plugin-assets/` 这几个目录留给 Tau，模板里不能有同名的目录。

### manifest

构建脚本根据 `template.json` 生成的 manifest：

```json
{
  "formatVersion": 1,
  "apiVersion": 1,
  "platform": "desktop",
  "id": "yourname.paper-blog",
  "name": "纸页",
  "version": "1.0.0",
  "description": "安静的单栏博客模板，适合长文。",
  "categories": ["blog-template"],
  "keywords": ["博客", "单栏"],
  "minAppVersion": "0.59.0",
  "template": {
    "protocolVersion": 1,
    "root": "site",
    "entries": ["index.html"],
    "siteFields": [
      {
        "key": "tagline",
        "label": "副标题",
        "type": "text",
        "placeholder": "一句话介绍你的站点"
      }
    ]
  },
  "integrity": {
    "site/index.html": "<SHA-256>",
    "site/assets/index-<摘要>.js": "<SHA-256>"
  }
}
```

| 字段                                      | 说明                                                                  |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `formatVersion`、`apiVersion`、`platform` | 照抄上面的值。模板只能在桌面 Tau 中选择和发布                         |
| `id`、`name`、`version`、`description`    | 与插件相同，见[插件的组成](plugin-basics.md#manifest)                 |
| `categories`                              | 填 `["blog-template"]`，插件中心会把它放进「博客模板」分类            |
| `minAppVersion`                           | 可选。填你实际测试过的桌面 Tau 版本                                   |
| `template.protocolVersion`                | 照抄 `1`                                                              |
| `template.root`                           | 静态文件所在的目录，起步仓库是 `site`                                 |
| `template.entries`                        | 入口 HTML，相对 `root` 的路径，至少一个，必须以 `.html` 结尾          |
| `template.siteFields`                     | 可选。让用户填写的站点配置，见[站点字段](#站点字段)                   |
| `integrity`                               | `root` 下每个文件的 SHA-256，由构建脚本生成。没有列进来的文件不会发布 |

- 文件路径不能含 `\`、`:`、`%`、`?`、`#`，不能有 `.` 或 `..` 段，也不能是符号链接。
- ZIP 不超过 16 MiB，解压后不超过 32 MiB、512 个文件。

## 入口页面与占位符

模板不知道自己会被部署到哪个地址，也不知道这一次发布的数据清单叫什么。在入口 HTML 的属性里写占位符，发布时 Tau 替换成真实值：

| 占位符             | 替换为                                             |
| ------------------ | -------------------------------------------------- |
| `__TAU_MANIFEST__` | 数据清单的地址，例如 `/blog/data/site.<摘要>.json` |
| `__TAU_BASE__`     | 站点的部署路径，以 `/` 开头和结尾，例如 `/blog/`   |

```html
<meta name="tau-manifest" content="__TAU_MANIFEST__" />
```

页面脚本从这个 `meta` 读出清单地址，再交给数据读取客户端，写法见[站点数据 · 读取数据](site-data.md#读取数据)。

- 占位符只能写在 HTML 属性里。写在脚本、正文或注释中，发布会失败。
- 只有 `template.entries` 里的文件会被替换。
- `pnpm dev` 时，起步仓库的 `vite.config.ts` 把 `__TAU_MANIFEST__` 换成示例数据的地址。

### 路由与深链

起步仓库只有一个页面，用 `?content=<key>` 选择正文，所以静态托管直接打开任何链接都能找到 `index.html`。改成多级路径（如 `/articles/3`）时：

- 把入口 HTML 复制一份 `404.html`，一起列进 `template.entries`。GitHub Pages 找不到文件时会自动返回它，S3 需要把错误页设为 `404.html`。
- 页面可能在任意深度，资源地址改用 `__TAU_BASE__` 开头的绝对路径。官方模板的 `scripts/build.mjs` 在构建后把入口里 `./` 开头的 `src`、`href` 替换成 `__TAU_BASE__`。
- 路由的 basename 取清单里的 `site.basePath`。

页面地址怎么对应到内容，见[站点数据 · 路由与站内链接](site-data.md#路由与站内链接)。

## 站点字段

Tau 只提供站点标题、图标和部署地址。副标题、站点描述、布局开关这类配置，由模板在 `template.json` 的 `siteFields` 里声明，用户在「站点设置 › 博客模板」里填写：

```json
"siteFields": [
  { "key": "tagline", "label": "副标题", "type": "text", "placeholder": "一句话介绍你的站点" },
  {
    "key": "layout",
    "label": "首页布局",
    "type": "select",
    "options": [
      { "value": "list", "label": "列表" },
      { "value": "grid", "label": "网格" }
    ],
    "default": "list"
  },
  { "key": "showSearch", "label": "显示搜索", "type": "switch", "default": true }
]
```

| 字段          | 说明                                                       |
| ------------- | ---------------------------------------------------------- |
| `key`         | 以字母开头，只含字母、数字和下划线，不能重复               |
| `label`       | 设置里显示的名称，必填                                     |
| `type`        | `text`、`textarea`、`url`、`select`、`switch`              |
| `description` | 可选。显示在名称下方的说明                                 |
| `placeholder` | 可选，只用于 `text`、`textarea`、`url`                     |
| `options`     | `select` 必填，`{ value, label }` 数组，`value` 不能重复   |
| `default`     | 可选。`switch` 是布尔值；`select` 必须是某个选项的 `value` |

用户没填的字段取 `default`；没有默认值时，文本类为空字符串，开关为 `false`，下拉为第一个选项。发布后从清单的 `site.fields` 读取：

```tsx
import type { DataManifest } from "@tau/blog";

function Tagline({ manifest }: { manifest: DataManifest }) {
  const tagline = manifest.site.fields.tagline;
  return typeof tagline === "string" && tagline ? <p>{tagline}</p> : null;
}
```

## 渲染正文与样式

用 `@tau/blog`（npm 包 `@xiongtao.xt/tau-blog`）的 `ContentRenderer` 显示正文。Tau 能发布的内容它都能显示，包括插件提供的编辑器块、网页嵌入、音视频、用户设置的图片外观和高亮笔触；模板只需要提供 `hrefFor`，把内容引用转成你的页面地址。

- 导入 `@tau/blog/styles.css`。
- 在 `<html>` 上写 `data-theme="paper" data-mode="light"` 使用 Tau 的主题取值，也可以去掉它，在自己的样式里定义 `--tau-*` 变量。
- 用 Tailwind 时按起步仓库的 `STYLING_GUIDE.md` 配置，否则正文的样式可能和你的工具类互相覆盖。

不用 `@tau/blog`、自己渲染正文时，数据格式见[站点数据](site-data.md)。

## 调试

`pnpm dev` 用示例数据看页面。要用自己的内容试发布：

1. 在 Tau 开发版（准备方法见[快速开始 · 在 Tau 里调试](getting-started.md#在-tau-里调试)）的插件页点「⋯ › 从 ZIP 安装…」，选中 `output/` 下的 ZIP。模板不需要启用，装完就能用。
2. 打开侧边栏的「发布」，在「站点设置 › 博客模板」里选中你的模板，填好站点字段后发布。
3. 改完代码后提高 `template.json` 和 `package.json` 的 `version`，重新构建、重新安装。

## 发布

模板和插件一样提交到插件中心，第一次在[插件中心](https://plugins.taunote.app)网页上传 ZIP，把模板 ID 绑定到你的 GitHub 仓库，之后的流程见[发布与更新](release.md)。

起步仓库没有自带发布工作流。需要推送 tag 自动发布时，复制插件模板的 `.github/workflows/release.yml`，把版本校验改为读 `template.json`，ZIP 路径改为 `output/<模板ID>-<版本>.zip`。

## 下一步

读[站点数据](site-data.md)，了解清单、内容文件和站内链接的数据结构。要把生成的站点送到自己的服务器，写一个[博客发布提供方](providers/publish.md)。
