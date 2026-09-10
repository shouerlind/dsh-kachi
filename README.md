# dsh-kachi

dsh(deepseek harness)的音效插件:为 dsh 的所有操作与 agent 状态变化播放任天堂 Switch 系统同款音效——「事事有回应」。包名 `dsh-kachi`(dsh- 前缀 + Switch 按键声「カチッ」)。

## 功能

- **三级通知分级**:介入级(后台标签页也响)/ 前台级(仅页面可见时响)/ 静默级(不发声)。
- **后台重要通知白名单**:权限审批请求、agent 提问、回合错误、任务完成。
- **设置页**:分级说明、13 个槽位全包选音(默认 Switch 音 / 备选 pack)、逐项试听。
- **全站交互音**:所有按钮/可点击项点击=按键音、悬停与键盘焦点=菜单移动音;二级面板的开启 / 选项移动 / 关闭另有专属音。经无源 DOM 委托实现,新区域零维护(见 [docs/adr/0001](docs/adr/0001-dsh-ui-sounds-dom-delegation.md))。
- **连接状态音**:断线重试=警示音,重连成功=恢复音(以 `ctx.connection.state` 为源,不靠 journal 重放的启发式)。
- **下载管理器兼容**:音效经 `/dsh-kachi/sound` 的 JSON 封套接口传输——没有 `.wav` 路径、没有 `audio/*` 响应头、响应体也不以 RIFF 魔数开头,IDM 等下载管理器无从认领下载(旧 `.wav` 静态路由已删除)。代价是传输量 +33%,只在启动预解码那一次。

## 安装(经 GitHub,推荐 —— 启动器可迁移)

在 profile 目录下一条命令(profile 默认用 pnpm;`pnpm add` 会替你写 `dependencies`):

```sh
pnpm add "git+https://github.com/shouerlind/dsh-kachi.git#v0.1.3"
```

**再往同一个 `package.json` 的 `dsh.profile.bundles` 数组里加一行** `"dsh-kachi"`,然后重启 dsh。

这一步不能省也不能由 pnpm 代劳 —— profile 的 `cordis.yml` 自己写着:插件树的组合顺序是
「`package.json` 的 `dsh.profile.bundles` 中每个 bundle → `cordis.patch.yml` → `--patch` 覆盖层」,
bundle 才是登记点。(`dsh plugin --profile <name> add <spec>` 只是把参数转发给 pnpm,同样只改 dependencies。)

两点注意:

- **用显式 https 并钉 tag**:`git+https://github.com/shouerlind/dsh-kachi.git#v0.1.3`。
  `github:shouerlind/dsh-kachi` 简写现在**也能装上**(2026-09-10 实测:npm 11.17.0 / Node 24.19.0,
  本机无 SSH 密钥仍成功解析到 `dsh-kachi`),但它没有版本钉子 —— `npm-package-arg` 对简写只给出
  `fetchSpec: null` 加一组候选 URL(https / ssh / git),协议由 npm 自己挑,装到的是**默认分支当时的状态**:
  同样的命令,不同时间装出不同版本。(简写曾在本机失败过,原因不是简写本身,而是当时仓库**私有** ——
  匿名 https 读不到、又无 SSH 密钥;转为公开后这个前提就消失了。)
  别被磁盘上的形态骗到:`pnpm add` 会把显式 `git+https://github.com/…` **规范化成 `github:` 简写**写回
  `package.json`(committish 保留,lockfile 钉到具体提交 + 完整性哈希)。所以在 profile 里看到简写形态
  不代表装错 —— 判据是有没有 `#v0.1.3` 这个钉子。
- **不要动 profile 的 `cordis.patch.yml`**。本包自带 `dsh.bundle.patch`,挂进 `dsh.profile.bundles` 后
  bundle 层会自动应用它的 insert;再手写一条 `id: dsh-kachi` 的 insert 会插两次,启动即崩:
  `duplicate loader entry id: dsh-kachi`。该文件保持 `[]` 即可。

装到哪个 dsh 由你决定,关键是**来源必须非本地**:`file:` / `link:` 的本地包装不上启动器的插件迁移能力。
仓库已公开,装的那台机器**不需要**任何 GitHub 凭据。

> **产物已入库**:`lib/` 的 JS 产物随源码提交,所以 git 依赖装出来就是可用的(不依赖安装期构建脚本)。

<details>
<summary>备用:从 Release 的 tgz 安装</summary>

1. 到 [Releases](https://github.com/shouerlind/dsh-kachi/releases) 下载 `dsh-kachi-<版本>.tgz`,放到**不含空格**的路径(如 `~/.dsh/pkgs/`)。
2. 同上面步骤 1,但依赖写成 `"dsh-kachi": "file:<tgz 的绝对路径>"`。
3. `pnpm install` 后重启 dsh。

</details>

> **勿动 `cordis.patch.yml`**:本包自带 `dsh.bundle.patch`(即包内 `cordis.patch.yml`),
> 只要挂进 `dsh.profile.bundles`,bundle 层就会自动应用它的 insert(与 `dsh-cost-meter`
> 等同构)。profile 的 `cordis.patch.yml` 再手写一条 `id: dsh-kachi` 的 insert,
> 等于同一 id 插两次,启动即崩:`duplicate loader entry id: dsh-kachi`。
> 该文件保持 `[]` 即可。
>
> 另外:不要在含空格的路径上用 `dsh plugin --profile <p> add .` —— dsh 会把路径按空格拆开,
> 并重置 `cordis.patch.yml`(细节见 [NOTES.md](NOTES.md))。

## 从源码构建

需要 Node ≥ 20。

```sh
git clone https://github.com/shouerlind/dsh-kachi.git
cd dsh-kachi
npm install
npm run build      # 产物 lib/index.js(host 半)+ lib/client.js(浏览器半)
npm run check:dist # 改了源码后自查:产物是否与源码一致(产物已入库)
npm pack           # 得到 dsh-kachi-<版本>.tgz,按上面「安装」步骤装进 profile
```

开发期热更:`file:` 依赖换成 `link:` 协议指向本仓库,重建 `lib/` 后 profile 直接可见(详见 [NOTES.md](NOTES.md))。

## 测试

```sh
npm test        # vitest
npm run typecheck
```

## 声明

`assets/sounds/` 内音频为 Nintendo Switch 系统音的 rip,**仅限个人自用**,不得再分发、转售或商用;代码部分同仓库现有许可。
