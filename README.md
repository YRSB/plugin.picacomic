# 哔咔漫画 Rulia 插件

在 Rulia 中浏览哔咔漫画（Picacomic）的第三方插件。

## 安装

从本仓库右侧 Releases 下载最新 `picacomic.vX.Y.Z.zip` 安装。

装好后在 Rulia 插件设置里填写 Token 后使用（获取办法见下方）。

## 配置

| 配置项 | 说明 |
| --- | --- |
| Token | 哔咔登录 Token，必填，获取办法见下方 |
| API 地址 | 默认 `https://picaapi.picacomic.com`，末尾不要加斜杠，分流失效时可更换 |
| 分流 | 请求头 `app-channel`，默认 `3`，可选 `1`、`2`、`3` |

## 获取 Token

插件只用 Token 鉴权，不再使用账号密码登录。用浏览器手动获取一次，填到插件设置里：

1. 用浏览器打开 `https://manhuabika.com`，选 Web 端访问入口。
2. 若弹出线路测速，选一条能连通的线路进站。
3. 用哔咔账号密码登录。
4. 按 `F12` 打开开发者工具，切到 Application（应用）→ Local Storage（本地存储）→ `https://manhuabika.com`，复制 `token` 的值；或在 Console（控制台）执行 `localStorage.getItem('token')` 后复制。
5. 把 Token 填到 Rulia 插件设置里。

注意 Token 会过期，过期后插件会明确提示，重新取一次即可。

## 参考

- https://github.com/RuliaReader/plugin.example
- https://github.com/RuliaReader/package.types
- https://github.com/venera-app/venera-configs

## 开发

修改后可用 Node 做语法检查：

```powershell
node --check index.js
```

## 免责

本插件仅做接口对接学习使用，请遵守哔咔服务条款与当地法律法规。
