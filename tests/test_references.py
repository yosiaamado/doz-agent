"""Every cross-reference inside plugins/ points at something that loads.

A renamed skill or a renumbered section otherwise fails silently: the reader
follows a dead pointer and explores from scratch. Pattern taken from
Pomerado's mint-authoring tests ("names only skills that load").

Run from the repo root: python -m unittest discover -s tests
"""
import glob
import os
import re
import unittest

from test_plugin_structure import PLUGIN, ROOT, agent_files, frontmatter, skill_files

# `fe-base §11`, `fe-base` §11, frontend-patterns §2
SECTION_REF = re.compile(r"`?\b([a-z][a-z0-9]*(?:-[a-z0-9]+)+|[a-z]+)`?\s§(\d+)")
NAMED_REF = re.compile(r"\bdoz-agent:([a-z0-9-]+)")


def plugin_texts():
    for path in glob.glob(os.path.join(PLUGIN, "**", "*.md"), recursive=True):
        yield path, open(path, encoding="utf-8").read()


def names():
    skills = {frontmatter(p)[0]["name"]: p for p in skill_files()}
    agents = {frontmatter(p)[0]["name"] for p in agent_files()}
    return skills, agents


def sections(skill_path):
    text = open(skill_path, encoding="utf-8").read()
    return set(re.findall(r"^#{2,3} (\d+)\.", text, re.M))


class ReferenceTest(unittest.TestCase):
    def test_every_named_skill_or_agent_exists(self):
        skills, agents = names()
        for path, text in plugin_texts():
            for name in set(NAMED_REF.findall(text)):
                with self.subTest(file=os.path.relpath(path, ROOT), ref=name):
                    self.assertIn(name, skills.keys() | agents, "rename the reference or restore the skill/agent")

    def test_every_section_reference_has_its_heading(self):
        skills, _ = names()
        for path, text in plugin_texts():
            for name, number in set(SECTION_REF.findall(text)):
                if name not in skills:
                    continue  # "SKILL.md §3", "the §6" and similar local references
                with self.subTest(file=os.path.relpath(path, ROOT), ref=f"{name} §{number}"):
                    self.assertIn(number, sections(skills[name]),
                                  f"no '## {number}.' heading in {name}; renumbering breaks this pointer")


if __name__ == "__main__":
    unittest.main()
