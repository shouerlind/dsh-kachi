# dsh-kachi

dsh(deepseek harness)的音效插件:为 dsh 的所有操作与 agent 状态变化播放任天堂 Switch 系统同款音效——「事事有回应」。包名 `dsh-kachi`(dsh- 前缀 + Switch 按键声「カチッ」)。

## 功能

- **三级通知分级**:介入级(后台标签页也响)/ 前台级(仅页面可见时响)/ 静默级(不发声)。
- **后台重要通知白名单**:权限审批请求、agent 提问、回合错误、任务完成。
- **设置页**:分级说明、13 个槽位全包选音(默认 Switch 音 / 备选 pack)、逐项试听。
- **全站交互音**:所有按钮/可点击项点击=按键音、悬停与键盘焦点=菜单移动音;二级面板的开启 / 选项移动 / 关闭另有专属音。经无源 DOM 委托实现,新区域零维护(见 [docs/adr/0001](docs/adr/0001-dsh-ui-sounds-dom-delegation.md))。
- **连接状态音**:断线重试=警示音,重连成功=恢复音(以 `ctx.connection.state` 为源,不靠 journal 重放的启发式)。

## 安装(经 GitHub,推荐 —— 启动器可迁移)

1. 编辑你的 dsh profile 的 `package.json`(`<home>/profiles/<profile>/package.json`),改两处:

   - `dependencies` 里加依赖:

     ```json
     "dsh-kachi": "github:shouerlind/dsh-kachi"
     ```

   - `dsh.profile.bundles` 数组末尾加一项:

     ```json
     "dsh-kachi"
     ```

2. 在 profile 目录里执行包管理器安装(dsh profile 默认 pnpm):`pnpm install`。
3. 重启 dsh,打开 web 界面,点击页面任意处应听到开机音。

装到哪个 dsh 由你决定,关键是**来源必须非本地**:`file:` / `link:` 的本地包装不上启动器的
插件迁移能力,所以依赖写 `github:`(或 registry / 其他 git 来源),不管是你手改 profile,
还是用启动器装。

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
