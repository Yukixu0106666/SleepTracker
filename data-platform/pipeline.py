"""Local ELT reference implementation; Python standard library only."""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
import sqlite3


SCHEMA = """
CREATE TABLE IF NOT EXISTS raw_events (
    fingerprint TEXT PRIMARY KEY, payload TEXT NOT NULL,
    loaded_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rejected_events (
    fingerprint TEXT PRIMARY KEY, reason TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS stg_sleep_sessions (
    event_id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
    started_at TEXT NOT NULL, ended_at TEXT NOT NULL,
    sleep_date TEXT NOT NULL, duration_hours REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS daily_sleep (
    user_id TEXT NOT NULL, sleep_date TEXT NOT NULL,
    session_count INTEGER NOT NULL, total_hours REAL NOT NULL,
    PRIMARY KEY (user_id, sleep_date)
);
"""


def timestamp(value):
    if not isinstance(value, str):
        raise ValueError("timestamp must be an ISO-8601 string")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timestamp must include timezone")
    return parsed.astimezone(timezone.utc)


def validate(payload):
    event = json.loads(payload)
    if not isinstance(event, dict):
        raise ValueError("event must be an object")
    if type(event.get("schema_version")) is not int or event["schema_version"] != 1:
        raise ValueError("unsupported schema_version")
    if event.get("event_type") != "sleep.completed":
        raise ValueError("unsupported event_type")
    for key in ("event_id", "user_id"):
        if not isinstance(event.get(key), str) or not event[key].strip():
            raise ValueError(f"missing {key}")
    session = event.get("session")
    if not isinstance(session, dict):
        raise ValueError("missing session")
    start, end = timestamp(session.get("start")), timestamp(session.get("end"))
    hours = (end - start).total_seconds() / 3600
    if not 0 < hours <= 24:
        raise ValueError("session must be longer than zero and at most 24 hours")
    duration = session.get("duration")
    if type(duration) not in (int, float) or not abs(duration - hours) <= 0.02:
        raise ValueError("duration must match timestamps in hours within 0.02")
    return (event["event_id"], event["user_id"], start.isoformat(),
            end.isoformat(), end.date().isoformat(), hours)


def run(source, warehouse):
    warehouse = Path(warehouse)
    warehouse.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(warehouse)
    try:
        connection.executescript(SCHEMA)
        with connection:
            for line in Path(source).read_text().splitlines():
                if not line.strip():
                    continue
                # Canonical JSON makes whitespace/key-order-only retries identical.
                try:
                    payload = json.dumps(json.loads(line), sort_keys=True, separators=(",", ":"))
                except ValueError:
                    payload = line
                fingerprint = hashlib.sha256(payload.encode()).hexdigest()
                connection.execute("INSERT OR IGNORE INTO raw_events VALUES (?, ?, ?)",
                                   (fingerprint, payload, datetime.now(timezone.utc).isoformat()))

            # Rebuild from immutable raw input: late arrivals and reruns are deterministic.
            connection.execute("DELETE FROM rejected_events")
            connection.execute("DELETE FROM stg_sleep_sessions")
            candidates = {}
            for fingerprint, payload in connection.execute(
                    "SELECT fingerprint, payload FROM raw_events ORDER BY fingerprint"):
                try:
                    row = validate(payload)
                    candidates.setdefault(row[0], []).append((fingerprint, row))
                except (ValueError, TypeError, OverflowError) as error:
                    connection.execute("INSERT INTO rejected_events VALUES (?, ?)",
                                       (fingerprint, str(error)))
            for entries in candidates.values():
                # Conflicting IDs never silently overwrite a previously accepted session.
                if len({row for _, row in entries}) > 1:
                    connection.executemany("INSERT INTO rejected_events VALUES (?, ?)",
                                           [(fp, "conflicting event_id") for fp, _ in entries])
                else:
                    connection.execute("INSERT INTO stg_sleep_sessions VALUES (?, ?, ?, ?, ?, ?)",
                                       entries[0][1])
            connection.execute("DELETE FROM daily_sleep")
            connection.execute("""
                INSERT INTO daily_sleep
                SELECT user_id, sleep_date, COUNT(*), SUM(duration_hours)
                FROM stg_sleep_sessions GROUP BY user_id, sleep_date
            """)
        return {table: connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
                for table in ("raw_events", "rejected_events", "stg_sleep_sessions", "daily_sleep")}
    finally:
        connection.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--warehouse", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(run(args.input, args.warehouse), indent=2))
