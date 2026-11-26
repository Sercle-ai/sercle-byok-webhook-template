# Sercle BYOK Webhook(Vercel 版)

一个很小、可审计的 webhook,部署到**你自己的** Vercel 账号上,让 Sercle 用
**你自己持有**的 key 来加密你团队的敏感数据——Sercle 看不到这把 key,也不会
存它,如果你以后撤销访问,Sercle 也就没法再解密你的数据了。

这是 Sercle "Bring Your Own Key"(BYOK)功能的其中一种方案,跟 AWS/GCP/Azure
的 key vault 是平行的选项。如果你的团队现在没有哪个云账号特别想用,或者就是
想要最简单、最便宜的路——不用碰 IAM、不用进云控制台,几分钟、两个值就够了——
选这个。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FSercle-ai%2Fsercle%2Ftree%2Fmain%2Fbyok-templates%2Fvercel-webhook-kek&env=ROOT_KEY,AUTH_TOKEN&envDescription=%E8%BF%99%E4%B8%AA%20webhook%20%E9%9C%80%E8%A6%81%E7%9A%84%E4%B8%A4%E4%B8%AA%E5%AF%86%E9%92%A5%EF%BC%8C%E7%94%9F%E6%88%90%E5%91%BD%E4%BB%A4%E8%A7%81%20README&envLink=https%3A%2F%2Fgithub.com%2FSercle-ai%2Fsercle%2Ftree%2Fmain%2Fbyok-templates%2Fvercel-webhook-kek%23%E8%AE%BE%E7%BD%AE%E6%AD%A5%E9%AA%A4&project-name=sercle-byok-webhook&repository-name=sercle-byok-webhook)

## 工作原理

Sercle 自己手里拿着一把很小的"数据密钥",真正用来加密你团队数据的就是它。
不是 Sercle 自己保护这把密钥,而是这个 webhook 来保护——Sercle 每次只是把这把
数据密钥发过来,请你**包裹**(加密)或者**解包**(解密)一下,用的是只存在于
你自己 Vercel 项目环境变量里的根密钥。这把根密钥,以及它保护的数据,从来不会
以任何人(除了你)能读懂的形式离开你自己的基础设施。

```
Sercle 服务器                              你的 Vercel 项目(这个 webhook)
───────────────                          ──────────────────────────────────
"帮我包裹这把数据密钥" ──POST /api/wrap──▶  用 ROOT_KEY 加密 ──▶ 包裹后的密文
"帮我解开这个"        ──POST /api/unwrap─▶ 用 ROOT_KEY 解密 ──▶ 明文数据密钥
```

撤销访问是立即生效的,而且完全由你决定:删掉这个 Vercel 项目、轮换
`ROOT_KEY`、或者改掉 `AUTH_TOKEN`——这三件事任做一件,Sercle 从下一次请求
开始就再也没法解密这把 key 保护的任何东西了。

## 设置步骤

1. 点上面的 **Deploy with Vercel**,会把这个模板 fork 到你自己的 Vercel
   账号下。
2. 部署过程会提示你填两个环境变量,生成方式如下:
   ```bash
   # ROOT_KEY —— 真正保护你数据的那把 key,要像保护密码一样保护它
   openssl rand -base64 32

   # AUTH_TOKEN —— 只是用来证明请求确实来自 Sercle,随便一个随机字符串就行
   openssl rand -hex 32
   ```
3. 完成部署,记下项目的 URL,类似
   `https://sercle-byok-webhook-yourteam.vercel.app`。
4. 回到 Sercle,进 **团队设置 → 安全 → Bring Your Own Key**,选
   **自定义 webhook**,填入:
   - **Webhook URL**:第 3 步拿到的那个地址
   - **Auth token**:第 2 步的 `AUTH_TOKEN` 值(是**同一个值**——这是
     Sercle 用来向你的 webhook 证明身份的,不是另外一个密钥)
5. 点 **测试连接**。Sercle 会带着这个 token 调一次 `GET /api/health`,
   确认 `ROOT_KEY` 配置正确,之后才会真正依赖这个 webhook。

就这些——不用碰云厂商的 IAM,也不用进任何控制台配权限。Vercel 的免费额度
完全够用。

## Sercle 能做什么、不能做什么

- Sercle 只能请这个 webhook **一次包裹/解开一把数据密钥**。它从来不会要
  `ROOT_KEY` 本身,而且也没有任何一个接口会把它交出去(`/api/wrap` 和
  `/api/unwrap` 来回传递的永远是"数据密钥"本身,加密或不加密的形式,从不是
  根密钥)。
- Sercle 没法从 Vercel 的后台、你团队的账单、或任何其他地方读到
  `ROOT_KEY`——它只是一个环境变量,作用域限定在只有你能控制的一个项目里。
- 如果这个 webhook 不可达了(被删除、下线、`AUTH_TOKEN` 被改了),Sercle
  下一次想解密你的数据就会直接失败,并给出明确的错误——**不会**退回去用
  Sercle 自己掌握的某把 key。

## 接口说明

| 方法 | 路径 | 认证 | 请求体 | 返回 |
|---|---|---|---|---|
| `POST` | `/api/wrap` | `Authorization: Bearer <AUTH_TOKEN>` | `{ "plaintext": "<base64>" }` | `{ "wrapped": "<base64>" }` |
| `POST` | `/api/unwrap` | `Authorization: Bearer <AUTH_TOKEN>` | `{ "wrapped": "<base64>" }` | `{ "plaintext": "<base64>" }` |
| `GET` | `/api/health` | `Authorization: Bearer <AUTH_TOKEN>` | — | `{ "ok": true }` |

包裹后的格式是 `base64(iv(12字节) || authTag(16字节) || ciphertext)`——
就是标准的 AES-256-GCM,没有任何特殊之处。可以直接看 `lib/crypto.ts`,
不到 60 行。

## 诚实说一句安全上的取舍

这个方案比 AWS/GCP/Azure 的 key vault 好配置得多,但这份简单是有代价的:
它依赖一个长期存在的共享密钥(`AUTH_TOKEN`),而不是云厂商那种身份联合
机制——云厂商那边撤销访问只需要改一条 IAM 策略,完全不涉及共享密钥。
如果你的团队已经有、或者愿意花时间搭一个云端 KMS,那条路在"访问撤销"这个
保证上更强。这个模板适合的是:想要 BYOK 带来的隐私收益、但不想承担那份搭建
成本,并且能接受这个取舍的团队。
