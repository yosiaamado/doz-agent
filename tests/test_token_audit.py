"""Test untuk plugins/skills/engineering/token-audit/scripts/token_audit.py.

Jalankan dari root repo: python3 -m unittest discover -s tests
"""
import json
import os
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT_DIR = os.path.join(ROOT, "plugins", "skills", "engineering", "token-audit", "scripts")
SCRIPT = os.path.join(SCRIPT_DIR, "token_audit.py")
sys.path.insert(0, SCRIPT_DIR)

import token_audit as ta  # noqa: E402


def cr(text):
    return ta.parse_findings(f"CR-1 src/app/page.tsx:10: 🔴 blocking: {text}", "code-reviewer", 1)[0]["category"]


class CategoryTest(unittest.TestCase):
    def test_label_blocking_tidak_dianggap_lock(self):
        self.assertEqual(cr("tombol simpan memakai warna yang salah."), "lain")

    def test_trace_tidak_dianggap_race(self):
        self.assertEqual(cr("traceId tidak ikut di response."), "kontrak")

    def test_state_map_tertimpa(self):
        self.assertEqual(cr("setExpanded menimpa state map; expand modul kedua menghapus data modul pertama. "
                            "Saran: spread prev."), "state-update")

    def test_css_cascade(self):
        self.assertEqual(cr("warna hover tidak pernah terlihat karena inline style mengalahkan class."), "css-cascade")

    def test_authz_agregat_menang_atas_idor(self):
        self.assertEqual(cr("endpoint tree menampilkan item draft ke role tanpa permission modul asal."), "authz-agregat")

    def test_idor_biasa_tetap_idor(self):
        self.assertEqual(cr("GET /orders/{id} tanpa cek kepemilikan, user bisa membaca order milik user lain (IDOR)."),
                         "authorization/IDOR")

    def test_transaksi_tetap_terdeteksi(self):
        self.assertEqual(cr("dua update saldo tidak atomic, race saat request paralel."), "transaksi/concurrency")


def notification(agent_id, status, result=None):
    body = f"<task-id>{agent_id}</task-id><status>{status}</status>"
    if result is not None:
        body += f"<result>{result}</result>"
    return {"type": "user", "message": {"role": "user", "content": f"<task-notification>{body}</task-notification>"}}


def agent_call(tool_id, name, prompt, agent_id):
    return [
        {"type": "assistant", "message": {"content": [{"type": "tool_use", "id": tool_id, "name": "Agent", "input": {
            "subagent_type": "doz-agent:frontend-engineer", "name": name, "prompt": prompt}}]}},
        {"type": "user", "toolUseResult": {"status": "async_launched", "agentId": agent_id},
         "message": {"content": [{"type": "tool_result", "tool_use_id": tool_id, "content": "Async agent launched"}]}},
    ]


def send(tool_id, to, message):
    return {"type": "assistant", "message": {"content": [{"type": "tool_use", "id": tool_id, "name": "SendMessage",
                                                          "input": {"to": to, "message": message}}]}}


def labels(entries):
    calls = ta.collect_calls(entries)
    f = ta.analyse_failures([(c, None) for c in calls if c["report"] is not None])
    return f, f["status"]["frontend-engineer"]


class LabelTest(unittest.TestCase):
    def test_status_partial_dikenali(self):
        self.assertEqual(ta.STATUS.search("Status: partial: slice S2 belum").group(1), "partial")

    def test_lanjutan_setelah_maxturns_bukan_dikembalikan(self):
        entries = agent_call("t1", "fe-x", "Kerjakan slice S1", "a1") + [
            notification("a1", "completed", "Status: done\n## Ringkasan\nslice S1"),
            send("t2", "fe-x", "Kerjakan slice S2 di spec yang sama."),
            notification("a1", "Agent stopped at its 50-turn limit"),
            send("t3", "fe-x", "Lanjutkan sisa pekerjaan dan tulis laporan."),
            notification("a1", "completed", "Status: done\n## Ringkasan\nslice S2"),
        ]
        f, sts = labels(entries)
        self.assertEqual(sts, [("done", ""), (ta.MAXTURNS, "slice berikutnya"), ("done", "lanjutan-maxTurns")])
        self.assertEqual(f["returned"]["frontend-engineer"], 0)
        self.assertEqual(f["limit"]["frontend-engineer"], 1)

    def test_dipanggil_ulang_setelah_done_tetap_dikembalikan(self):
        entries = agent_call("t1", "fe-x", "Kerjakan slice S1", "a1") + [
            notification("a1", "completed", "Status: done\n## Ringkasan\npertama"),
            send("t2", "fe-x", "Peta AC → test belum ada, lengkapi laporanmu."),
            notification("a1", "completed", "Status: done\n## Ringkasan\nkedua"),
        ]
        f, sts = labels(entries)
        self.assertEqual(sts[1], ("done", "dikembalikan"))
        self.assertEqual(f["returned"]["frontend-engineer"], 1)

    def test_turn_di_batas_tanpa_status_dianggap_maxturns(self):
        c = {"type": "frontend-engineer", "prompt": "Kerjakan slice S1", "report": "sedang mengedit...", "run_turns": 50}
        f = ta.analyse_failures([(c, None)])
        self.assertEqual(f["status"]["frontend-engineer"], [(ta.MAXTURNS, "")])


class WindowsConsoleTest(unittest.TestCase):
    def test_output_cp1252_tidak_crash(self):
        entries = [
            {"type": "user", "timestamp": "2026-09-25T01:00:00Z", "cwd": "/x/proj",
             "message": {"role": "user", "content": "kerjain fitur"}},
            {"type": "assistant", "timestamp": "2026-09-25T01:00:05Z", "cwd": "/x/proj",
             "message": {"id": "m1", "model": "claude-sonnet-5", "content": [{"type": "text", "text": "selesai"}],
                         "usage": {"input_tokens": 10, "output_tokens": 20, "cache_read_input_tokens": 1000,
                                   "cache_creation_input_tokens": 500}}},
        ]
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "t.jsonl")
            with open(path, "w", encoding="utf-8") as fh:
                fh.write("\n".join(json.dumps(e) for e in entries))
            env = dict(os.environ, PYTHONIOENCODING="cp1252", CLAUDE_CONFIG_DIR=d)
            p = subprocess.run([sys.executable, SCRIPT, "--transcript", path, "--no-log"],
                               capture_output=True, env=env)
        self.assertEqual(p.returncode, 0, p.stderr.decode("utf-8", "replace"))
        self.assertIn("≈", p.stdout.decode("utf-8"))


if __name__ == "__main__":
    unittest.main()
