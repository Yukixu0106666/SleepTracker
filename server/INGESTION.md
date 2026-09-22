# 睡眠采集：App → 持久化队列 → HTTP API → PostgreSQL

当前已实现此链路。采集 API 是独立 Node 服务，默认端口 8788；现有 Node / Cloudflare 推荐接口保持各自入口。尚未部署到公网，尚未连接 S3 或 Databricks。

## 1. 启动 PostgreSQL 与 API

需要 Node **22.18+**（建议使用本项目验证过的 Node 24）、npm，以及 Docker Desktop 或已有 PostgreSQL 16+。

在项目根目录执行：

```bash
npm install
npm install --prefix server
docker compose -f compose.ingestion.yml up -d --wait
cp .env.ingestion.example .env.ingestion
npm run db:migrate
npm run server:ingestion
```

数据库容器使用独立卷和回环端口 `54329`，容器密码仅供本机开发。已有 PostgreSQL 时跳过 Docker，创建一个专用数据库并将 `.env.ingestion` 的 `DATABASE_URL` 指向它。不要使用真实生产数据库运行开发迁移。

本机已安装 PostgreSQL 二进制时，可以用以下命令替换 Docker 步骤（两者选择一种，不要同时占用 54329 端口）：

```bash
npm run db:local
```

该脚本在项目 `.local/postgres` 新建独立开发实例，不修改已有 Homebrew 数据库；与示例 `DATABASE_URL` 相匹配。可以通过 `SLEEPTRACKER_PG_BIN` 指定 PostgreSQL 的 bin 目录。停止命令：`npm run db:local:stop`。

`GET http://127.0.0.1:8788/health` 会实际检查数据库连通性。API 返回确认前，数据库事务必须提交成功。

## 2. 签发个人凭证并连接 App

另开一个终端，在项目根目录运行：

```bash
npm run db:credential -- create
```

命令创建匿名用户，输出 `user_id` 和随机 `token`。token 仅在此时显示，数据库只保存 SHA-256 摘要，90 天过期。凭证不是共享 App 密钥，也不是完整的用户注册／找回密码系统。

在现有 `.env.local` **新增**一行，保留现有推荐 API 配置：

```dotenv
EXPO_PUBLIC_INGESTION_API_URL=http://localhost:8788
```

- iOS 模拟器／本机 Web：使用 `localhost`。
- Android 模拟器：使用 `http://10.0.2.2:8788`。
- 真机：开发时将服务绑定 `INGESTION_HOST=0.0.0.0`，地址改为电脑局域网 IP；设备和电脑需要在同一网络。平台如阻止明文 HTTP，请使用 HTTPS 开发代理。生产构建强制要求 HTTPS。
- Web：`INGESTION_CORS_ORIGIN` 必须匹配实际网页来源，例如 `http://localhost:8081`。

**不要把 token 或 DATABASE_URL 放入任何 `EXPO_PUBLIC_` 变量。**

本次新增了 `expo-crypto` 和 `expo-secure-store` 原生模块，现有自定义开发客户端需要重新构建：

```bash
npm run ios
# 或 npm run android
```

打开 App → 设置 → 云端上传，输入个人 token，点击“连接并上传睡眠记录”。界面明确说明会上传本机已有与新增记录；连接前仅保存在本机。iOS/Android 凭证存入 SecureStore；Web 使用 sessionStorage，关闭标签页后重新连接。

为同一用户续签／添加设备凭证：

```bash
npm run db:credential -- create <user_id>
npm run db:credential -- revoke <user_id>
```

`revoke` 撤销该用户的全部现有凭证。App 断开连接只停止上传并移除本机凭证，不撤销其他设备凭证、不删除服务端记录。已绑定的本机历史不允许改用其他用户或其他 API 地址，避免串账户上传。

## 3. 数据和接口契约

`GET /v1/me`：Bearer 鉴权，返回服务器确定的 `user_id`。

`POST /v1/events`：一次提交一条事件，需 `Authorization: Bearer <token>` 和 `Content-Type: application/json`。

```json
{
  "schema_version": 1,
  "event_id": "f1a8d70e-44fc-4876-bb25-d6f27dd534bb",
  "session_id": "e192cd8a-71da-4c6c-970b-93580d23b6e2",
  "event_type": "sleep.completed",
  "occurred_at": "2026-09-14T11:00:00.000Z",
  "timezone": "America/Toronto",
  "session": {
    "start": "2026-09-14T03:00:00.000Z",
    "end": "2026-09-14T11:00:00.000Z",
    "duration": 8
  }
}
```

客户端不得提交 `user_id`、姓名、头像、身高体重或聊天文本；未知字段被拒绝。时长单位为小时，时间必须含时区；服务端根据时间差计算保存时长，兼容客户端 0.02 小时的舍入误差。合法会话为 `(0,24]` 小时；不符合条件的旧记录保留本地并显示上传异常。

返回：

- `201 {event_id, status: "accepted"}`：新事件已提交。
- `200 {event_id, status: "duplicate"}`：相同事件已提交过。
- `400/413/415`：事件格式／大小／内容类型不合法。
- `401/403`：凭证或来源不合法。
- `409`：相同事件 ID 或会话 ID 对应冲突的数据。
- `503`：数据库暂时不可用，可以重试。

只有收到匹配 `event_id` 且状态为 `accepted` / `duplicate` 的响应，手机才删除上传队列项。网络失败、超时、无效确认以及服务端故障保留原事件 ID。

## 4. 可靠性设计

- **本地原子保存**：`sleepJournal.v1` 在一个 AsyncStorage 文档中同时保存历史和事件队列；进程内串行修改，上传期间新增／删除不会被确认响应覆盖。
- **旧数据迁移**：首次访问将旧 `sleepHistory` 转换成带 UUID 的历史和上传事件；原始旧键保留作迁移备份，页面统一读取新 journal。旧记录没有原时区，暂按迁移时设备时区标记。
- **重试**：启动、回到前台和前台每 15 秒检查；每批最多 50 条；单请求超时 10 秒；指数退避 5 秒至 1 小时。App 被系统终止时不承诺后台上传，下次打开继续。
- **阻塞记录**：永久错误保留并标记，避免一条坏记录阻塞其他有效记录；设置页可以更新凭证或立即重试。
- **数据库事务**：`sleep_sessions` 与 `event_outbox` 使用同一个 PostgreSQL 连接和事务写入。幂等键为 `(user_id, event_id)`；每个用户的每个会话写入串行化。
- **删除**：删除历史时同一 journal 写入 `sleep.deleted`，携带原会话 ID 和时间。服务端保存 revision=2 的逻辑删除标记，延迟到达的 revision=1 完成事件不能将其恢复。删除事件也保留在 outbox。
- **后续导出**：`event_outbox.exported_at IS NULL` 表示待导出；本次只保存待导出事件，没有运行 S3 导出任务。下一阶段消费者必须理解 `sleep.deleted`，现有离线 Python 管道目前只支持 `sleep.completed`。

逻辑删除用于保持业务统计正确，不等于隐私数据彻底擦除。后续接入真实用户服务时，需要统一制定原始事件、迁移备份、数据库备份的保留和擦除流程。当前服务还未提供云端历史下载／多设备双向合并、公开注册或生产限流。

## 5. 验证链路

```bash
npm run test:sync
TEST_DATABASE_URL=postgresql://sleeptracker:sleeptracker_dev@127.0.0.1:54329/sleeptracker npm run test:ingestion
npx tsc --noEmit
```

集成测试使用真实 PostgreSQL，在随机命名的独立 schema 中创建表，结束后删除该 schema；未配置 `TEST_DATABASE_URL` 时数据库测试会明确跳过。测试账号需具备创建 schema 的权限。

覆盖：离线恢复、稳定事件 ID、并发写入、确认响应丢失、错误确认、存储失败、相同事件重复提交、冲突回滚、用户隔离、撤销／过期凭证、删除先于完成事件、事务中途故障，以及真实队列→HTTP→PostgreSQL 的端到端往返。

手动验收：

1. App 连接后完成一条睡眠记录，确认待上传数量归零。
2. 关闭 API，再完成一条记录；本地历史可见、待上传数量增加。
3. 重启 API，回到 App 或点“立即重试”，确认数量归零。
4. 查询 `sleep_sessions` 和 `event_outbox`，确认新增数据。
5. 在 App 删除记录，确认服务端 `deleted_at` 有值、outbox 出现 `sleep.deleted`。

```sql
SELECT user_id, session_id, started_at, ended_at, duration_hours, deleted_at
FROM sleep_sessions ORDER BY updated_at DESC;

SELECT event_id, payload->>'event_type' AS event_type, received_at, exported_at
FROM event_outbox ORDER BY received_at DESC;
```

实现参考：[node-postgres 事务](https://node-postgres.com/features/transactions)、[Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)。依赖版本依据本项目 Expo 53 的本地兼容性清单选择。
