# The Unique Hope 当前网站技术报告

报告日期：2026-05-10  
报告范围：本地仓库、自动检查结果、线上公网健康检查、腾讯云服务器只读检查  
生产域名：<https://uniquehopeclub.com>  
生产服务器：Tencent Cloud CVM `175.24.177.186`  
当前应用版本：`0.2.0`

## 1. 总体结论

The Unique Hope 目前已经从早期的静态页面、独立前端、独立后端结构，迁移为一个以仓库根目录为准的 Next.js 单体应用。当前代码库的主要发布对象是根目录应用，不再是旧的 `frontend/`、`backend/` 或根目录静态 HTML 页面。

从本次检查结果看：

- 本地代码的静态质量检查、类型检查、单元/接口测试、生产构建和依赖安全检查均通过。
- 线上网站目前可访问，公网首页返回 `200`，公网健康检查返回 `200`，数据库状态为 `ok`，上传存储状态为 `configured`。
- 腾讯云服务器上的 `the-unique-hope.service` 正在运行，服务器本机健康检查也返回 `200`。
- 本地端到端浏览器测试没有跑起来，原因是本机缺少测试用 Docker 数据库容器 `unique_hope-postgres`。这属于本地测试环境缺口，不等同于线上功能失败。
- 当前本地工作区存在大量未提交改动，报告中对“当前本地仓库”和“线上正在运行的版本”做了区分。

整体判断：网站主流程已进入可上线/可维护的 Next.js 应用形态，线上服务当前健康；主要短板集中在本地 E2E 环境、部署版本可追踪性、以及上线前完整人工浏览器验收。

## 2. 当前网站形态

### 2.1 应用结构

当前激活的应用是仓库根目录下的 Next.js 项目，主要目录如下：

- `src/app`：页面、布局和 API Route Handlers
- `src/components`：首页、登录、报名、三类门户、通知、预约等界面组件
- `src/server`：认证、数据库、tRPC、业务服务
- `src/lib`：领域规则、表单校验、语言文案、导航和通用工具
- `drizzle`：Postgres 数据库迁移
- `scripts`：种子数据、管理员密码重置、学生咨询导入等运维脚本
- `tests/e2e`：端到端浏览器测试

旧结构中的静态页面、旧前端项目、旧后端项目已经在当前工作区中大规模删除或被替换。当前发布面应以根目录应用为准。

### 2.2 公开路由与门户

当前构建结果显示这些页面和接口会作为动态路由发布：

- `/`：公开首页
- `/signup`：公开报名
- `/login`：学生/老师登录
- `/admin/login`：管理员专用登录
- `/forgot-password`：密码重置请求
- `/reset-password`：密码重置确认
- `/student`：学生门户
- `/teacher`：老师门户
- `/admin`：管理员门户
- `/api/health`：健康检查
- `/api/trpc/[trpc]`：主要业务 API
- `/api/auth/[...nextauth]`：认证接口
- `/api/password-reset/request`：请求重置密码
- `/api/password-reset/confirm`：确认重置密码
- `/api/uploads/lesson-evidence`：老师上传课程截图
- `/api/uploads/lesson-evidence/[lessonId]`：受保护的课程截图读取
- `/api/notifications/push/drain`：浏览器推送发送队列处理

## 3. 技术栈

当前主要技术栈如下：

- 应用框架：Next.js `16.2.4`
- 前端：React `19.2.5`
- 语言：TypeScript `6.0.3`
- API：tRPC `11.17.0`
- 登录认证：Auth.js / NextAuth `5.0.0-beta.31`
- 数据库访问：Drizzle ORM `0.45.2`
- 数据库：Postgres
- 样式：Tailwind CSS `4.2.4`
- 表单与输入校验：Zod `4.4.1`
- 密码哈希：bcryptjs
- 文件上传解析：busboy
- 文件类型识别：file-type
- 上传存储：Vercel Blob 或服务器本地文件存储
- 浏览器推送：Web Push / VAPID
- 单元与接口测试：Vitest
- 浏览器测试：Playwright
- Node.js 要求：`>=24 <25`
- 包管理器：npm `11.13.0`

## 4. 核心业务功能

### 4.1 公开访问与报名

网站提供公开首页和学生/老师报名入口。报名时会创建用户、角色档案和对应报名记录。

学生报名记录包含：

- 学生姓名
- 年龄
- 电话
- 联系方式
- 用户名
- 密码
- 可选邮箱

老师报名记录包含：

- 姓名
- 性别
- 学校
- 年级
- 英语水平说明
- 用户名
- 密码
- 可选邮箱

报名接口带有限流保护，避免同一电话、用户名或可信 IP 在短时间内反复提交。

### 4.2 登录与角色隔离

系统有三类角色：

- `student`
- `teacher`
- `admin`

学生和老师使用普通登录入口 `/login`。管理员使用专用入口 `/admin/login`，不通过公开成员登录页进入后台。

后端 API 使用角色保护：学生只能访问学生功能，老师只能访问老师功能，管理员只能访问管理功能。服务端会重新从数据库确认当前会话和角色，避免仅依赖浏览器状态。

### 4.3 管理员门户

管理员门户承担主要运营工作：

- 查看待审核学生和老师
- 批准或拒绝报名
- 查看已审核报名
- 创建学生和老师配对
- 查看配对列表
- 搜索配对
- 查看配对详情
- 查看课程进度
- 查看预约记录
- 查看学生反馈，包括不对老师公开的私密反馈
- 在没有教学历史时删除配对并回收到待配对池

管理员配对规则比较严格：学生和老师的报名都必须先通过审核，且双方都还处于待匹配状态，才能创建配对。

### 4.4 老师门户

老师门户主要支持教学记录和与学生协调：

- 查看自己的匹配学生
- 查看 20 周课程进度
- 更新会议链接
- 发起或回应课程预约
- 保存课程状态
- 上传课程截图
- 写课程笔记
- 控制课程笔记公开性
- 查看学生公开反馈

课程截图上传支持图片文件校验，只接受 JPEG、PNG、WebP。上传会检查文件大小、真实文件类型和上传权限。

### 4.5 学生门户

学生门户主要支持学习过程跟进：

- 查看匹配老师
- 查看课程进度
- 查看会议链接
- 查看老师上传的课程截图
- 查看老师共享笔记
- 发起或回应课程预约
- 在课程完成后提交反馈
- 选择反馈是否公开给老师

学生反馈只在课程状态满足条件时允许提交。私密反馈不会出现在老师视图，但管理员可在配对详情中查看。

### 4.6 课程与进度

系统默认课程周期为 20 周。每周课程可以记录状态：

- 待完成
- 已授课
- 老师请假
- 学生请假
- 生病

课程记录可关联截图、笔记和学生反馈。管理员门户可以汇总查看每组配对的整体进度。

### 4.7 预约、日历与通知

当前预约功能已经从“按周绑定”调整为更贴近真实课程安排的“按具体时间预约”。预约包含：

- 预约开始时间
- 时长
- 状态
- 发起人
- 取消发起人
- 拒绝或取消原因
- 响应时间

预约状态包括：

- pending
- confirmed
- declined
- cancellation_pending
- cancelled

学生和老师都可以发起预约，也可以确认、拒绝或请求取消。拒绝或请求取消时需要填写原因。

通知体系包含站内通知和浏览器推送：

- 预约请求
- 预约回应
- 配对创建
- 老师发布课程内容
- 学生提交公开反馈
- 会议链接更新

浏览器推送不是直接同步发送，而是先写入发送队列，再由受保护的 drain 接口处理。这种方式更适合服务器定时任务和失败重试。

## 5. 数据结构概览

当前数据库表以 `unique_hope_` 为前缀，主要包括：

- 用户与登录：
  - `user`
  - `account`
  - `session`
  - `verification_token`
  - `user_credential`
  - `password_reset_token`
- 角色档案：
  - `profile`
- 报名与咨询：
  - `student_signup`
  - `teacher_signup`
  - `student_inquiry`
- 配对与课程：
  - `pairing`
  - `lesson`
  - `lesson_note`
  - `feedback`
  - `lesson_appointment`
- 通知与推送：
  - `user_notification`
  - `browser_push_subscription`
  - `notification_push_delivery`
- 安全与限流：
  - `request_rate_limit`

数据库中有明确的唯一索引和外键关系，例如：

- 一个用户对应一个角色档案
- 用户邮箱唯一
- 用户名唯一
- 一个老师只能在一个配对中
- 一个学生只能在一个配对中
- 每个配对每周只有一条课程记录
- 浏览器推送 endpoint 唯一
- 推送发送队列避免同一通知对同一订阅重复入队

## 6. 安全与权限设计

### 6.1 身份认证

系统使用 Credentials 登录方式，密码通过 bcrypt 哈希保存。登录时支持邮箱或用户名识别，但会按角色查找账号，避免学生、老师、管理员入口混用。

登录成功后会清理对应的限流记录，减少正常用户因为早期失败尝试被持续阻断的情况。

### 6.2 角色权限

服务端 API 分为公开接口、登录后接口和角色专用接口。角色专用接口会检查当前用户实际角色：

- 学生接口只允许 `student`
- 老师接口只允许 `teacher`
- 管理接口只允许 `admin`

课程截图读取也做了二次权限判断：只有管理员、该配对老师、该配对学生能访问对应截图。

### 6.3 限流

系统对这些场景做了限流：

- 登录
- 学生报名
- 老师报名
- 请求密码重置
- 确认密码重置

限流主体使用带密钥摘要，避免把手机号、用户名、IP 等敏感信息直接作为可反推数据保存。

### 6.4 密码重置

学生和老师支持密码重置。管理员不走公开网页找回密码，而是通过运维脚本手动重置。

密码重置设计中包含：

- token 哈希保存
- 有效期
- 使用后失效
- 请求限流
- 确认限流
- 邮件发送失败时对外尽量不暴露账号存在性

生产邮件发送依赖邮件服务配置。未配置时，生产环境会返回不可用或需要人工处理。

### 6.5 文件上传安全

课程截图上传有多层检查：

- 必须是老师
- 必须有匹配配对
- 请求必须是 multipart/form-data
- 文件大小受 `MAX_UPLOAD_MB` 控制
- 文件类型只允许 JPEG、PNG、WebP
- 会检查文件真实签名，不只相信浏览器上报的 MIME
- 上传失败会尽量清理已写入的新文件
- 旧截图只有在新记录成功保存后才删除

### 6.6 健康检查

`/api/health` 会检查数据库连通性，并报告上传存储是否配置。线上当前返回：

- database: `ok`
- blob: `configured`

本地在没有数据库和上传存储配置时会返回 503，这符合当前本地环境状态。

## 7. 部署与运维

### 7.1 生产目标

默认生产目标是 Tencent Cloud CVM：

- Host: `175.24.177.186`
- User: `ubuntu`
- Deploy path: `/home/ubuntu/the-unique-hope`
- Service: `the-unique-hope.service`
- Public URL: <https://uniquehopeclub.com>

当前项目文档明确要求腾讯云部署走手动流程，不使用 `npm run deploy:tencent` 或 `scripts/deploy-tencent-cloud.sh`。

### 7.2 标准发布流程

推荐发布流程：

1. 本地运行必要检查：lint、typecheck、tests、build，必要时跑浏览器测试。
2. 从根目录 Next.js 应用创建发布包。
3. 用 `scp` 上传到腾讯云服务器。
4. SSH 到服务器并解压到 `/home/ubuntu/the-unique-hope`，保留服务器上的 `.env` 和 `.env.local`。
5. 在服务器运行 `npm ci`。
6. 只有在确认需要时才执行数据库结构更新。
7. 在服务器运行 `npm run build`。
8. 重启 `the-unique-hope.service`。
9. 检查服务器本机健康接口和公网健康接口。

### 7.3 Vercel 兼容

项目仍保留 Vercel 部署说明：

- Framework: Next.js
- Root directory: repository root
- Install command: `npm install`
- Build command: `npm run build`

但上传体积限制要特别注意。Vercel Functions 有较低的请求体限制，因此上传截图时 `MAX_UPLOAD_MB` 不能超过平台限制。腾讯云长运行 Node 服务可以使用本地文件存储，更适合较稳定的文件上传。

### 7.4 生产环境变量类别

报告不记录任何密钥值。生产环境变量大致分为这些类别：

- 认证：站点 URL、Auth secret、host trust
- 数据库：Postgres 连接地址
- 前端公开配置：应用名称、站点 URL、默认语言、推送公钥
- 限流：限流哈希密钥、可信代理设置
- 上传：Blob token 或本地存储目录
- 邮件：密码重置邮件 API key 和发件地址
- Web Push：VAPID 公私钥、subject、drain secret
- 种子数据：管理员初始账号、是否允许 demo 数据

生产环境必须保证密钥只存在于服务器环境中，不进入仓库、不进入浏览器 bundle。

## 8. 本地检查结果

本次本地检查结果如下：

| 检查项 | 结果 | 说明 |
| --- | --- | --- |
| `npm run lint` | 通过 | ESLint 检查通过 |
| `npm run typecheck` | 通过 | TypeScript 检查通过 |
| `npm run test` | 通过 | 29 个测试文件，140 个测试全部通过 |
| `npm run build` | 通过 | Next.js 生产构建成功 |
| `npm audit` | 通过 | 0 个已知 npm 漏洞 |
| `npm audit --omit=dev` | 通过 | 生产依赖 0 个已知 npm 漏洞 |
| `npm run test:e2e` | 未跑通 | 缺少 Docker 容器 `unique_hope-postgres` |
| 本地生产启动 | 通过 | `next start` 可在 `127.0.0.1:3101` 启动 |
| 本地首页 | 通过 | `/` 返回 `200` |
| 本地登录页 | 通过 | `/login` 返回 `200` |
| 本地健康检查 | 返回 `503` | 本机数据库不可用，上传存储未配置 |

本地 npm 命令多次出现警告：

```text
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.
```

该警告没有导致本次 lint、typecheck、test、build 或 audit 失败，但建议后续清理 npm 环境配置，避免未来 npm 大版本升级时产生问题。

## 9. 线上检查结果

本次线上只读检查结果如下：

| 检查项 | 结果 | 说明 |
| --- | --- | --- |
| 公网首页 `https://uniquehopeclub.com/` | `200 OK` | Nginx 后接 Next.js，首页可访问 |
| 公网健康检查 `https://uniquehopeclub.com/api/health` | `200 OK` | database `ok`，blob `configured` |
| 服务器本机健康检查 `http://127.0.0.1:3000/api/health` | `200 OK` | database `ok`，blob `configured` |
| systemd 服务 | active | `the-unique-hope.service` 正在运行 |
| 服务启动时间 | 2026-05-07 19:52:02 CST | 检查时已连续运行约 2 天 |
| 服务内存 | 约 134 MB | systemd 状态显示 |
| 服务进程 | `npm run start` -> `next start` | Next.js `16.2.4` |
| 服务器部署目录版本 | `0.2.0` | 与本地 package version 一致 |
| 服务器部署目录 git 状态 | 不可用 | `/home/ubuntu/the-unique-hope` 不是 git 仓库 |

线上服务日志中看到一次 Next.js Server Action 版本不匹配警告：

```text
Error: Failed to find Server Action "x". This request might be from an older or newer deployment.
```

这类警告通常与旧页面、旧客户端请求或部署切换期间的缓存请求有关。本次健康检查仍然正常，暂未看到它导致服务不可用。但建议持续观察日志，若频繁出现，需要检查部署切换、缓存和客户端版本一致性。

## 10. 测试覆盖现状

当前测试覆盖已经比较全面，主要包括：

- 表单工具
- 领域规则
- 语言与 locale 解析
- 导航安全回跳
- 种子数据策略
- 管理员配对规则
- 公共报名
- 登录限流
- 密码重置
- 限流实现
- 课程截图上传和读取
- 本地/Blob 上传存储辅助逻辑
- 课程反馈策略
- 老师课程记录保存
- 管理员进度汇总
- 预约请求与回应
- 通知推送队列
- 数据库迁移 SQL 关键片段
- 公开页面 E2E
- 登录后学生/老师/管理员门户 E2E

其中最重要的端到端浏览器测试文件是：

- `tests/e2e/public.spec.ts`
- `tests/e2e/authenticated-portals.spec.ts`

`authenticated-portals.spec.ts` 覆盖了管理员登录、等待池审核、配对、老师查看学生、学生查看学习路径、老师发起预约、学生确认、老师保存课程、学生提交反馈、管理员查看私密反馈等关键流程。

当前缺口是本地 E2E 运行依赖 Docker 数据库容器。缺少 `unique_hope-postgres` 时，Playwright 的 web server 准备脚本会直接退出。

## 11. 当前风险与缺口

### 11.1 本地 E2E 环境未就绪

本地端到端浏览器测试没有完整跑通，阻塞原因是测试数据库容器不存在：

```text
Expected Docker container 'unique_hope-postgres' to exist before running Playwright tests.
```

影响：无法在当前本机确认完整浏览器流程是否与当前本地代码完全一致。

建议：补齐本地 Postgres Docker 容器，或调整 E2E 准备脚本支持自动创建测试容器。

### 11.2 本地健康检查失败

本地生产服务可以启动，首页和登录页可访问，但 `/api/health` 返回 503：

```json
{
  "ok": false,
  "service": "the-unique-hope",
  "checks": {
    "blob": "not_configured",
    "database": "error"
  }
}
```

影响：这说明本地运行环境没有连上可用数据库，且上传存储未配置。它不代表线上故障，因为线上健康检查已返回正常。

建议：为本地开发准备稳定的 `.env`、Postgres 和上传存储模拟配置。

### 11.3 线上部署版本不可直接追踪 commit

服务器 `/home/ubuntu/the-unique-hope` 不是 git 仓库，因此无法在服务器上直接用 `git log` 确认当前部署来自哪个 commit。

影响：出现线上问题时，定位“线上实际运行代码”和“本地仓库代码”的对应关系会更困难。

建议：发布时写入一个 `release.json` 或构建信息文件，记录 commit、构建时间、发布人和版本号；也可以在健康检查中增加只读版本字段。

### 11.4 本地工作区有大量未提交改动

当前本地分支是 `codex/web-push-ready`，工作区有大量修改、删除和新增文件。主要变化包括：

- 删除旧静态页面
- 删除旧 frontend/backend 结构
- 修改根目录 Next.js 应用
- 新增预约、通知、Web Push、受保护上传读取等文件
- 新增多条 Drizzle 迁移

影响：在提交前需要做一次清晰的变更整理，避免把无关文件或临时状态混入发布。

建议：提交前先做一次面向发布的 code review 和变更清单确认。

### 11.5 线上日志有一次 Server Action 警告

线上服务日志中出现一次 Server Action 找不到的警告。当前健康检查正常，但仍建议观察。

建议：如果该日志重复出现，应检查旧客户端缓存、部署切换过程、Next.js build 产物是否完全替换，以及 Nginx/浏览器缓存策略。

### 11.6 Web Push 需要定时 drain

浏览器推送采用队列模式，需要定时调用 `/api/notifications/push/drain`。如果 drain 没有被 cron 或 systemd timer 定期执行，站内通知仍可用，但浏览器后台推送可能不会及时送达。

建议：确认腾讯云服务器已经设置定时任务，并且 `WEB_PUSH_DRAIN_SECRET` 只保存在服务器环境。

## 12. 下一步建议

优先级从高到低：

1. 补齐本地 E2E 测试数据库环境，重新运行 `npm run test:e2e`。
2. 做一次真实浏览器人工验收，重点走 `/signup`、`/login`、`/student`、`/teacher`、`/admin` 和预约/通知/上传流程。
3. 给线上健康检查或发布包增加构建版本信息，解决线上部署不可追踪 commit 的问题。
4. 检查腾讯云 Web Push drain 定时任务是否实际存在并可成功调用。
5. 清理本地 npm 的 `http-proxy` 过期配置警告。
6. 在提交前整理当前大量未提交改动，确认旧文件删除、新文件新增和迁移文件都属于本次发布范围。
7. 继续观察线上 systemd 日志，确认 Server Action 警告是否只是偶发旧请求。

## 13. 发布前建议检查清单

正式发布或再次热更新前，建议至少完成：

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm audit`
- `npm run test:e2e`
- 本地或测试环境浏览器手动走通：
  - 公开首页
  - 学生报名
  - 老师报名
  - 学生登录
  - 老师登录
  - 管理员登录
  - 管理员审核报名
  - 管理员创建配对
  - 老师发起预约
  - 学生确认预约
  - 老师保存课程和上传截图
  - 学生查看截图并提交反馈
  - 管理员查看进度和反馈
  - 通知中心读取/标记已读
  - Web Push 订阅和 drain
- 部署后检查：
  - `http://127.0.0.1:3000/api/health`
  - `https://uniquehopeclub.com/api/health`
  - `systemctl status the-unique-hope.service`
  - 最近服务日志

## 14. 附录：本次检查证据摘要

### 14.1 本地自动检查

```text
npm run lint
Result: passed

npm run typecheck
Result: passed

npm run test
Result: 29 test files passed, 140 tests passed

npm run build
Result: passed

npm audit
Result: found 0 vulnerabilities

npm audit --omit=dev
Result: found 0 vulnerabilities
```

### 14.2 本地 E2E 阻塞原因

```text
npm run test:e2e
Result: failed to start Playwright webServer
Reason: Expected Docker container 'unique_hope-postgres' to exist before running Playwright tests.
```

### 14.3 本地生产服务检查

```text
next start --hostname 127.0.0.1 --port 3101
Result: Ready

GET /
Result: 200

GET /login
Result: 200

GET /api/health
Result: 503
Reason: local database error, upload storage not configured
```

### 14.4 线上健康检查

```text
GET https://uniquehopeclub.com/
Result: 200 OK

GET https://uniquehopeclub.com/api/health
Result: 200 OK
checks.database: ok
checks.blob: configured

GET http://127.0.0.1:3000/api/health on Tencent Cloud server
Result: 200 OK
checks.database: ok
checks.blob: configured
```

### 14.5 腾讯云服务状态

```text
Service: the-unique-hope.service
Status: active
Started: 2026-05-07 19:52:02 CST
Process: npm run start -> next start
Next.js: 16.2.4
Approx memory: 134 MB
Package version in deploy directory: 0.2.0
Deploy directory git status: not a git repository
```

## 15. 最终评价

The Unique Hope 当前已经具备比较完整的生产应用结构：前端页面、后端接口、认证、数据库、上传、通知、测试和部署文档都已经集中到一个清晰的 Next.js 应用中。线上服务当前健康，核心基础设施可用。

现阶段最需要补齐的是发布工程上的确定性：让本地 E2E 能稳定运行，让线上部署能追踪到具体 commit，让 Web Push drain 和服务日志监控形成固定运维流程。完成这些后，网站的上线信心会明显提高，也更容易在后续迭代中快速定位问题。
