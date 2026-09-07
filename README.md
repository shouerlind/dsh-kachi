# dsh-kachi

dsh(deepseek harness)的音效插件:为 dsh 的所有操作与 agent 状态变化播放任天堂 Switch 系统同款音效——「事事有回应」。包名 `dsh-kachi`(dsh- 前缀 + Switch 按键声「カチッ」)。

## 功能

- **三级通知分级**:介入级(后台标签页也响)/ 前台级(仅页面可见时响)/ 静默级(不发声)。
- **后台重要通知白名单**:权限审批请求、agent 提问、回合错误、任务完成。
- **设置页**:分级说明、13 个槽位全包选音(默认 Switch 音 / 备选 pack)、逐项试听。
- **composer 交互音**:二级面板悬停 / 点击 / 关闭,经无源 DOM 委托实现(见 [docs/adr/0001](docs/adr/0001-dsh-ui-sounds-dom-delegation.md))。

## 安装(从 Release 下载,推荐)

1. 到 [Releases](https://github.com/shouerlind/dsh-kachi/releases) 下载最新版的 `dsh-kachi-<版本>.tgz`,放到一个**不含空格**的路径(如 `~/.dsh/pkgs/`)。
2. 编辑你的 dsh profile 的 `package.json`(`~/.dsh/profiles/<profile>/package.json`),在 `dependencies` 里加:

   ```json
   "dsh-kachi": "file:<tgz 的绝对路径>"
   ```

3. 编辑同目录的 `cordis.patch.yml`,加一条 bundle patch(已有多条 insert 就追加到列表尾部):

   ```yaml
   - insert:
       - id: dsh-kachi
         name: dsh-kachi
   ```

4. 在 profile 目录里执行包管理器安装(dsh profile 默认 pnpm):`pnpm install`。
5. 重启 dsh,打开 web 界面,点击页面任意处应听到开机音。

> 注意:不要在含空格的路径上用 `dsh plugin --profile <p> add .` —— dsh 0.1.2-rc.1 会把路径按空格拆开,并重置 `cordis.patch.yml`。所以上面走手工步骤(细节见 [NOTES.md](NOTES.md))。

## 从源码构建

需要 Node ≥ 20。

```sh
git clone https://github.com/shouerlind/dsh-kachi.git
cd dsh-kachi
npm install
npm run build   # 产物 lib/index.js(host 半)+ lib/client.js(浏览器半)
npm pack        # 得到 dsh-kachi-<版本>.tgz,按上面「安装」步骤装进 profile
```

开发期热更:`file:` 依赖换成 `link:` 协议指向本仓库,重建 `lib/` 后 profile 直接可见(详见 [NOTES.md](NOTES.md))。

## 测试

```sh
npm test        # vitest
npm run typecheck
```

## 声明

`assets/sounds/` 内音频为 Nintendo Switch 系统音的 rip,**仅限个人自用**,不得再分发、转售或商用;代码部分同仓库现有许可。
