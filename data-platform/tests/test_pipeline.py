import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pipeline import run


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.source = Path(self.temp.name) / "events.jsonl"
        self.db = Path(self.temp.name) / "warehouse.sqlite"
        self.event = json.loads((Path(__file__).resolve().parents[1] /
                                "fixtures/sleep_events.jsonl").read_text().splitlines()[0])

    def ingest(self, events):
        self.source.write_text("\n".join(json.dumps(event) for event in events))
        return run(self.source, self.db)

    def test_retry_and_late_arrival(self):
        first = self.ingest([self.event, self.event])
        self.assertEqual(first["stg_sleep_sessions"], 1)
        self.assertEqual(first, self.ingest([self.event]))
        late = {**self.event, "event_id": "late", "session": {
            "start": "2026-09-11T14:00:00Z", "end": "2026-09-11T15:00:00Z", "duration": 1}}
        self.ingest([late])
        with sqlite3.connect(self.db) as db:
            self.assertEqual(db.execute("SELECT session_count, total_hours FROM daily_sleep").fetchone(), (2, 9))

    def test_invalid_data_is_retained_and_quarantined(self):
        bad = {**self.event, "session": {**self.event["session"], "duration": 1}}
        result = self.ingest([bad, ["not an object"]])
        self.assertEqual(result["raw_events"], 2)
        self.assertEqual(result["rejected_events"], 2)
        self.assertEqual(result["daily_sleep"], 0)

    def test_conflicting_id_removes_ambiguous_session(self):
        self.ingest([self.event])
        result = self.ingest([{**self.event, "user_id": "another-user"}])
        self.assertEqual(result["rejected_events"], 2)
        self.assertEqual(result["stg_sleep_sessions"], 0)

    def test_bad_json_does_not_abort_batch(self):
        self.source.write_text("bad json\n" + json.dumps(self.event))
        result = run(self.source, self.db)
        self.assertEqual(result["rejected_events"], 1)
        self.assertEqual(result["stg_sleep_sessions"], 1)

    def test_timezone_is_normalized_before_daily_grouping(self):
        event = {**self.event, "session": {
            "start": "2026-09-10T18:00:00-04:00", "end": "2026-09-10T23:00:00-04:00", "duration": 5}}
        self.ingest([event])
        with sqlite3.connect(self.db) as db:
            self.assertEqual(db.execute("SELECT sleep_date FROM daily_sleep").fetchone()[0], "2026-09-11")


if __name__ == "__main__":
    unittest.main()
