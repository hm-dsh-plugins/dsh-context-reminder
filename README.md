# dsh-context-reminder

对话结束后看一眼上下文占用：越过起点（默认 25%）就弹一次提醒，问你要不要压缩；选了「暂不」只压住这一档，之后每多一个步长（默认 10 个百分点，35%、45%……）再问一次。起点和步长都在设置里改。

## 它做了什么

| 一半 | 内容 |
|---|---|
| **Host** | 只声明配置：两个 volatile 字段（起点、步长），设置页据此生成表单。不跑任何逻辑。 |
| **Client** | 在输入框下方（`conversation.composer.dock`）挂一个平时不画任何东西的座位。它监视当前会话的回合边界与 `contextPressure` 投影：一回合跑完、占用越过起点时弹出一个对话框，标题写明当前百分比，正文提示压缩是有损的（较早的对话会变成摘要），底部是「压缩上下文」与「暂不」。 |

- 「压缩上下文」执行的就是宿主命令 `/compact`（`ctx.remote.commands.execute`），成功即关窗，失败在对话框里显示原因，可以再点一次。
- 占用数字和输入框下方圆环同源：都用 `contextPressure` 的 `projectedTokens`（缺失时退回 `pressureTokens`）除以 `contextWindow`，取整并封顶 100，所以弹窗里的百分比与屏幕上看到的一致。
- 只对**本回合结束后**的占用做判断；刚打开一个历史会话（占用已经很高）不会自己弹，得等下一次回合结束。
- 占用回落到起点以下（压缩过、换了会话、清空历史）会解除抑制，下次再涨上去会重新从起点开始提醒。
- 每个会话各自记录已提醒到的档位，互不影响。

### 提醒档位

下表按默认的 25% / 10 点：

| 占用 | 行为 |
|---|---|
| < 25% | 不提醒 |
| 25% ~ 34% | 弹一次（档位 25） |
| 35% ~ 44% | 若已过档位 25，再弹一次（档位 35） |
| 45% 及以上 | 每跨一档再弹一次（45、55……） |

同一档只弹一次：第一次弹出时就记下档位，无论你点「暂不」还是按 Esc 关掉，都不会在同一档反复打扰。

档位从起点起算，而不是从 0 起算，所以起点不必是步长的整数倍：起点 50、步长 5 得到的是 50、55、60……。

## 配置

| 字段 | 含义 | 范围 | 默认 |
|---|---|---|---|
| `startPercent` | 第一次提醒的占用 | 1 ~ 99 | 25 |
| `stepPercent` | 之后每跨多少个百分点再提醒 | 1 ~ 50 | 10 |

定在包的 `Config` 里（`cordis.patch.yml` 只把条目接进 profile，不带默认值），所以设置页里这个插件的条目就是这两个数。

浏览器那半通过 `settings.describe()` 读回自己命名空间的值；读不到（设置服务不可用、调用失败、字段缺失或越界）就用默认值，不会自己猜一个区间。

改完设置要刷新页面——座位在挂载时读一次，之后不再轮询。

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

## 版本号

包版本是 `yyyy.MM.dd-x`：`x` 是当天第几次发布，跨天从 1 重新开始。

```powershell
npm run bump    # 改成今天该发的版本
```

`-x` 在 semver 里是预发布标识，发布 npm 时要带 `--tag latest`，否则这个版本不会被默认安装。

## 开发

```powershell
npm install
npm run build     # src/ → lib/（构建产物要提交）
npm run smoke     # 档位规则、配置读取、浏览器 bundle 的接线
```
