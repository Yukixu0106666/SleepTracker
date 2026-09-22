# SleepTracker 数据工程 MVP

当前实现：使用 Python 标准库和 SQLite 的离线 ELT，可加载合成 JSONL 事件、保留 raw、校验和隔离坏数据、按事件去重、生成每日用户汇总。无需云账号。

这只是数据管道的第一阶段；没有实现微服务拆分、手机自动采集、Airflow 调度或任何 SaaS/云端部署。完整目标和分阶段验收见 [架构方案](../docs/data-engineering-architecture.md)。

在项目根目录运行：

```bash
python3 data-platform/pipeline.py --input data-platform/fixtures/sleep_events.jsonl --warehouse data-platform/output/warehouse.sqlite
python3 -m unittest discover -s data-platform/tests -v
```

示例输入应输出 3 条 raw、0 条 rejected、3 条 staging 和 3 条 daily 汇总。重复运行计数不变。通过 Python 查询结果：

```bash
python3 -c 'import sqlite3; db = sqlite3.connect("data-platform/output/warehouse.sqlite"); print(db.execute("SELECT * FROM daily_sleep ORDER BY user_id, sleep_date").fetchall()); db.close()'
```

## 数据契约 v1

每行是一个 JSON 对象，示例见 `fixtures/sleep_events.jsonl`，全部为合成数据。

| 字段 | 语义 |
| --- | --- |
| schema_version | 整数 1 |
| event_type | `sleep.completed` |
| event_id | 全局唯一且重试时保持不变的事件 ID |
| user_id | 不直接标识个人的用户 ID；云端必须由认证服务确定 |
| session.start / end | 含时区的 ISO-8601 时间 |
| session.duration | 小时，兼容现有 `SleepSession`；与时间差容许 0.02 小时误差 |

会话长度限定为 `(0, 24]` 小时，属于本管道的数据质量规则。每日指标按**结束时间的 UTC 日期**分组，汇总会话时长；不表示经过重叠区间合并的实际睡眠时长。跨设备重叠会话和本地睡眠日留待后续处理。

## 重跑与错误处理

- 先 load raw，再 transform。规范化 JSON 的 SHA-256 用于消除完全重复的输入。
- 每次从所有 raw 重建 staging 和 mart，支持迟到事件；写入在一个事务内提交。
- 相同 event_id、相同标准化会话只计一次；相同 ID 的不同有效会话全部隔离，避免静默覆盖。
- 无效 JSON、版本、时间和时长保留在 raw，原因记录在 `rejected_events`。隔离不会使整个批次失败，调用方应检查输出计数并设置告警策略。
- 当前没有更新/删除事件协议、增量水位、分布式并发、用户身份验证或保留期限处理。SQLite 全量重建仅用于本地验证，不应用作生产数据仓库。
- 无效输入会原样留在 raw；只使用合成或已获准处理的数据。姓名、健康档案和聊天正文不属于这个事件契约。

公开的 `Sleep_health_and_lifestyle_dataset.csv` 是横截面研究数据，不包含真实产品事件时间线，不能当作用户留存、订阅或推荐转化的来源。
