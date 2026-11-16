"""Resident context may only grow on purpose.

Every description is loaded into every session, and an agent's body is
re-read on every one of its turns. This test fails when either total
exceeds the budget in context_budget.json. To grow it, raise the number
in the same commit and say why in the CHANGELOG entry. Shrinking needs
no change, but lower the budget so the saving is kept.
Pattern taken from t3code's agent-context budget check (MIT).

Run from the repo root: python -m unittest discover -s tests
"""
import json
import os
import unittest

from test_plugin_structure import ROOT, agent_files, frontmatter, skill_files, unquote

BUDGET_FILE = os.path.join(ROOT, "tests", "context_budget.json")


def measure():
    descriptions = 0
    for path in skill_files() + agent_files():
        fields, _ = frontmatter(path)
        descriptions += len(unquote(fields.get("description", ""))[0])
    bodies = 0
    for path in agent_files():
        text = open(path, encoding="utf-8").read()
        bodies += len(text.split("\n---", 1)[1]) if text.startswith("---") else len(text)
    return {"description_chars": descriptions, "agent_body_chars": bodies}


class ContextBudgetTest(unittest.TestCase):
    def test_resident_context_stays_within_budget(self):
        budget = json.load(open(BUDGET_FILE, encoding="utf-8"))
        actual = measure()
        for key, value in actual.items():
            with self.subTest(metric=key):
                self.assertLessEqual(
                    value, budget[key],
                    f"{key} is {value}, budget {budget[key]}: trim, or raise the budget "
                    "and give the reason in CHANGELOG.md")


if __name__ == "__main__":
    print(json.dumps(measure(), indent=2))
