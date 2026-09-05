/**
 * 0.1.2-rc.1 发布物的类型缺口(运行时服务均存在、官方插件在用,但公开
 * d.ts 未挂载到 cordis Context)。此处按运行时校验过的形态本地补齐:
 *  - connection:dsh-api-gateway 的 inject 即 ['typert', 'connection'];
 *  - slots:ui-chat/cost-meter 经 ctx.slots.inject/register 注册槽位。
 */
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'

declare module '@deepseek-ai/cordis' {
    interface Context {
        connection: ConnectionHandle
        slots: {
            /** 声明对某槽位的贡献;callback 返回 register 的产物,随调用方 fiber 拆除。 */
            inject(key: string, callback: () => unknown): () => void
            /** 向已声明的槽位贡献一个组件与其注入面。 */
            register(options: Record<string, unknown>, component: unknown): unknown
        }
    }
}

/** 插件设置行使用的 locale namespace(slots.register 的 locale 契约)。 */
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        'dsh-kachi': 'title'
    }
}
