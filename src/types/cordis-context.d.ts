/**
 * 0.1.2-rc.1 发布物的类型缺口:`connection` 服务在运行时存在
 * (gateway 的 inject 即 ['typert', 'connection']),但公开 d.ts 未把它
 * 挂到 cordis Context。此处按 dsh-client-connection 的公开面补齐。
 */
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'

declare module '@deepseek-ai/cordis' {
    interface Context {
        connection: ConnectionHandle
    }
}
