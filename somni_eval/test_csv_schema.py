import unittest
from pathlib import Path

from csv_schema import load_questions


QUESTIONS_PATH = Path(__file__).resolve().parent.parent / "docs" / "somni_questions_master_110.csv"


class QuestionSetTests(unittest.TestCase):
    def test_master_question_sets_are_explicit_and_stable(self) -> None:
        core = load_questions(QUESTIONS_PATH, question_set="core")
        extensions = load_questions(QUESTIONS_PATH, question_set="extensions")
        all_rows = load_questions(QUESTIONS_PATH, question_set="all")

        self.assertEqual(len(core), 110)
        self.assertEqual(len(extensions), 7)
        self.assertEqual(len(all_rows), 117)
        self.assertEqual([row.question_id for row in extensions[:2]], ["Q116", "Q117"])
        self.assertEqual(extensions[0].sequence_id, "seq1")
        self.assertEqual(extensions[1].sequence_id, "seq1")


if __name__ == "__main__":
    unittest.main()
