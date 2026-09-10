# dsh-kachi

(工作目录名为 `ns-notify`,仓库与 npm 包名均为 `dsh-kachi`。)

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues (repo `shouerlind/dsh-kachi`), via the `gh` CLI. See `docs/agents/issue-tracker.md`.

> `gh` 在本机需要显式指定配置目录:`GH_CONFIG_DIR="C:\Users\kona\AppData\Roaming\GitHub CLI"`(OAuth 令牌存于 Windows 凭据管理器),否则报未登录。

### Triage labels

Default five-label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
