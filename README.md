# dsh-context-reminder

对话结束后看一眼上下文占用：到 30% 就弹一次提醒，问你要不要压缩；选了「暂不」只压住这一档，之后每多 10 个百分点（40%、50%……）再问一次。

## 它做了什么

| 一半 | 内容 |
|---|---|
| **Host** | 什么都不做。这一半只为让 Loader 有一条可扫描的入口——`dsh.client` 声明与 `./client` 导出才是浏览器那半被组合进 Web 客户端的依据。 |
| **Client** | 在输入框下方（`conversation.composer.dock`）挂一个平时不画任何东西的座位。它监视当前会话的回合边界与 `contextPressure` 投影：一回合跑完、占用越过 30% 时弹出一个对话框，标题写明当前百分比，正文提示压缩是有损的（较早的对话会变成摘要），底部是「压缩上下文」与「暂不」。 |

- 「压缩上下文」执行的就是宿主命令 `/compact`（`ctx.remote.commands.execute`），成功即关窗，失败在对话框里显示原因，可以再点一次。
- 占用数字和输入框下方圆环同源：都用 `contextPressure` 的 `projectedTokens`（缺失时退回 `pressureTokens`）除以 `contextWindow`，取整并封顶 100，所以弹窗里的百分比与屏幕上看到的一致。
- 只对**本回合结束后**的占用做判断；刚打开一个历史会话（占用已经很高）不会自己弹，得等下一次回合结束。
- 占用回落到 30% 以下（压缩过、换了会话、清空历史）会解除抑制，下次再涨上去会重新从 30% 开始提醒。
- 每个会话各自记录已提醒到的档位，互不影响。

### 提醒档位

| 占用 | 行为 |
|---|---|
| < 30% | 不提醒 |
| 30% ~ 39% | 弹一次（档位 30） |
| 40% ~ 49% | 若已过档位 30，再弹一次（档位 40） |
| 50% 及以上 | 每跨一档再弹一次（50、60……） |

同一档只弹一次：第一次弹出时就记下档位，无论你点「暂不」还是按 Esc 关掉，都不会在同一档反复打扰。

## 安装（本机）

profile 用 pnpm 的 `link:` 协议——**改完 `lib/` 刷新页面就生效**，不用重装：

```json
"dsh-context-reminder": "link:S:/local/repos/dsh-plugins/dsh-context-reminder"
```

首次接线：

```powershell
cd S:\local\app\deepseek-harness\content
node --import tsx/esm apps/cli/src/bin.ts plugin --profile web add S:\local\repos\dsh-plugins\dsh-context-reminder
```

装完重启 DSH，浏览器再刷新一次。卸载用包名 `dsh-context-reminder`。

## 安装（别人）

`lib/` 提交进仓库，安装时不需要构建：

```powershell
dsh plugin --profile web add github:hm-dsh-plugins/dsh-context-reminder
```

## 开发

```powershell
npm install
npm run build     # src/ → lib/（构建产物要提交）
npm run smoke     # 档位规则 + 浏览器 bundle 的接线
```
