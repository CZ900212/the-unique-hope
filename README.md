# The Unique Hope

当前激活的应用是仓库根目录下的单体 `Next.js` 项目，采用 T3 风格技术栈：

- `Next.js 15` App Router
- `tRPC 11`
- `Auth.js / NextAuth`
- `Drizzle ORM`
- `Postgres`
- `Tailwind CSS 4`

## 项目结构

- `src/app`: App Router 页面与 Route Handlers
- `src/server`: tRPC、认证、数据库与服务层
- `src/components`: 前端组件
- `src/lib`: 领域模型、表单与通用工具
- `scripts`: 数据迁移、种子数据等脚本

仓库里仍保留了 `frontend/`、`backend/` 等旧目录作为迁移归档参考；当前唯一的发版/部署目标是仓库根目录的 Next.js 服务。

## 本地启动

1. 安装依赖

```bash
npm install
```

2. 准备环境变量

```bash
cp .env.example .env
```

至少需要确认这些值：

- `DATABASE_URL`
- `AUTH_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_DEFAULT_LOCALE`
- `SEED_ADMIN_PASSWORD`（首次执行 `npm run seed` 前请改成唯一密码）

3. 初始化数据库

```bash
npm run db:push
```

如需演示数据或初始管理员：

```bash
npm run seed
```

说明：

- `.env.example` 默认关闭 `SEED_DEMO_DATA`，避免把演示账号带进正式环境
- 已存在账号的密码默认不会被重置；只有设置 `SEED_RESET_EXISTING_PASSWORDS=true` 时才会轮换
- `RATE_LIMIT_TRUST_FORWARD_HEADERS` 只应在可信反向代理会重写转发 IP 头时开启

4. 启动开发服务器

```bash
npm run dev
```

默认访问地址：

- 应用首页: [http://localhost:3000](http://localhost:3000)
- 管理员登录: [http://localhost:3000/admin/login](http://localhost:3000/admin/login)
- 健康检查: [http://localhost:3000/api/health](http://localhost:3000/api/health)

## 常用脚本

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run db:generate
npm run db:migrate
npm run db:push
npm run db:studio
npm run seed
npm run admin:reset-password -- --identifier admin@theuniquehope.org
npm run import:student-inquiries:check -- --input scripts/student-inquiries.example.json
npm run import:student-inquiries -- --input imports/student-inquiries.json
```

学生咨询导入说明：

- 先执行 `npm run db:push`，把新的学生咨询表结构同步到数据库
- 先用 `npm run import:student-inquiries:check -- --input scripts/student-inquiries.example.json` 看示例格式
- 把受保护的 JSON 文件放在仓库根目录的 `imports/` 下，或通过 `--input <path>` / `STUDENT_INQUIRIES_FILE` 指定路径
- 正式导入前，可先运行 `npm run import:student-inquiries:check -- --input <你的文件路径>` 做预检查；这一步不会写数据库
- 预检查通过后，再运行 `npm run import:student-inquiries -- --input <你的文件路径>` 正式导入
- `imports/` 已加入 `.gitignore`，避免把原始报名资料提交进仓库
- 每条记录至少需要：`sourceChannel`、`sourceSerial`、`sourceSubmittedAt`、`studentName`、`gender`、`school`、`grade`、`englishScore`
- `sourceSerial` 必须写成字符串，保留外部系统里的原始编号；不要写成 JSON 数字，避免大号编号精度丢失或前导零被吃掉
- 如需从原始 IP 导入，请先在 `.env` 里设置 `STUDENT_INQUIRIES_IP_HASH_KEY`
- IP 不会以明文写入数据库；脚本会把 `sourceIp` 转成带密钥的 HMAC-SHA256 摘要后保存
- 如果上游已经做过预处理，可以直接提供 `sourceIpHash`，格式必须是 `hmac-sha256:<64位十六进制>`
- 去重与更新规则使用 `sourceChannel + sourceSerial`，避免不同来源的同号记录互相覆盖

## 质量检查

建议在提交前至少运行：

```bash
npm run lint
npm run typecheck
npm run test
```

## 上传与密码重置

- 课程截图上传优先使用 `BLOB_READ_WRITE_TOKEN`；`VERCEL_BLOB_READ_WRITE_TOKEN` 仅在一次兼容过渡期内继续接受
- 密码重置邮件依赖 `RESEND_API_KEY` 与 `PASSWORD_RESET_FROM_EMAIL`
- admin 使用专用入口 `/admin/login` 登录，不通过公开成员登录页
- admin 不再提供公开网页找回密码；需要时请使用 `npm run admin:reset-password -- --identifier <email|username>`

未配置邮件时，非生产环境会返回密码重置预览链接用于本地调试。

## 部署

生产部署请优先参考 [DEPLOYMENT.md](./DEPLOYMENT.md)。

当前发布面以仓库根目录应用为准，执行路径是根目录的 `npm run build` 与 `npm run start`。

旧的 `frontend/`、`backend/`、`frontend/dist` 以及相关本地归档 QA 流程仅保留作历史参考，不再作为生产 shipping target。
