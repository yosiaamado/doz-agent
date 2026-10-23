"""Structural guards for plugins/: the rules in CLAUDE.md that a script can check.

Run from the repo root: python -m unittest discover -s tests
"""
import glob
import json
import os
import re
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLUGIN = os.path.join(ROOT, "plugins")
AGENTS = os.path.join(PLUGIN, "agents")

# Claude Code re-attaches a skill truncated at 20,000 characters after compaction.
SKILL_MAX_CHARS = 20_000
DESCRIPTION_MAX_CHARS = 400


def frontmatter(path):
    text = open(path, encoding="utf-8").read()
    match = re.match(r"^---\r?\n(.*?)\r?\n---\r?\n", text, re.S)
    if not match:
        return None, text
    fields = {}
    for line in match.group(1).splitlines():
        top = re.match(r"^([A-Za-z][\w-]*):\s?(.*)$", line)
        if top:
            fields[top.group(1)] = top.group(2)
    return fields, text


def unquote(value):
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        return value[1:-1], True
    return value, False


def skill_files():
    return sorted(glob.glob(os.path.join(PLUGIN, "skills", "*", "*", "SKILL.md")))


def agent_files():
    return sorted(glob.glob(os.path.join(AGENTS, "*.md")))


class SkillSizeTest(unittest.TestCase):
    def test_every_skill_fits_the_compaction_limit(self):
        for path in skill_files():
            size = len(open(path, encoding="utf-8").read())
            with self.subTest(skill=os.path.relpath(path, ROOT)):
                self.assertLess(size, SKILL_MAX_CHARS, "move one-step material into references/")


class DescriptionTest(unittest.TestCase):
    def test_descriptions_are_triggers_only_and_yaml_safe(self):
        for path in skill_files() + agent_files():
            fields, _ = frontmatter(path)
            with self.subTest(file=os.path.relpath(path, ROOT)):
                self.assertIsNotNone(fields, "missing frontmatter")
                self.assertTrue(fields.get("name"), "missing name")
                raw = fields.get("description", "")
                description, quoted = unquote(raw)
                self.assertTrue(description.startswith("Use when"), "description must start with 'Use when'")
                self.assertLessEqual(len(description), DESCRIPTION_MAX_CHARS)
                if not quoted:
                    self.assertNotIn(": ", description, "unquoted ': ' breaks YAML")
                    self.assertNotIn(" #", description, "unquoted ' #' starts a YAML comment")


class LayoutTest(unittest.TestCase):
    def test_every_skill_area_is_registered_in_plugin_json(self):
        manifest = json.load(open(os.path.join(PLUGIN, ".claude-plugin", "plugin.json"), encoding="utf-8"))
        registered = {os.path.normpath(p) for p in manifest.get("skills", [])}
        areas = {os.path.normpath(os.path.join(".", "skills", d))
                 for d in os.listdir(os.path.join(PLUGIN, "skills"))
                 if os.path.isdir(os.path.join(PLUGIN, "skills", d))}
        self.assertEqual(areas - registered, set(), "add the area folder to the skills array")

    def test_agents_are_flat(self):
        subdirs = [d for d in os.listdir(AGENTS) if os.path.isdir(os.path.join(AGENTS, d))]
        self.assertEqual(subdirs, [], "agent subfolders change the agent's scoped name")

    def test_every_agent_has_a_turn_limit(self):
        for path in agent_files():
            fields, _ = frontmatter(path)
            with self.subTest(agent=os.path.basename(path)):
                self.assertTrue(fields.get("maxTurns"), "set maxTurns and a ~70% checkpoint")


if __name__ == "__main__":
    unittest.main()
