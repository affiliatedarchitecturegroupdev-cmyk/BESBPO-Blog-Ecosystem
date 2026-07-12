"""Run with: python3 -m unittest tests.test_summarisation_prompts -v"""
import unittest

from app.services.summarisation_prompts import build_summarisation_prompt, clean_summarisation_response


class BuildSummarisationPromptTests(unittest.TestCase):
    def test_includes_the_body(self):
        prompt = build_summarisation_prompt("The article body.", 240)
        self.assertIn("The article body.", prompt)

    def test_includes_the_character_limit(self):
        prompt = build_summarisation_prompt("Body", 180)
        self.assertIn("180", prompt)


class CleanSummarisationResponseTests(unittest.TestCase):
    def test_returns_short_text_unchanged(self):
        result = clean_summarisation_response("A short summary.", 240)
        self.assertEqual(result, "A short summary.")

    def test_strips_wrapping_double_quotes(self):
        result = clean_summarisation_response('"A quoted summary."', 240)
        self.assertEqual(result, "A quoted summary.")

    def test_strips_wrapping_single_quotes(self):
        result = clean_summarisation_response("'A quoted summary.'", 240)
        self.assertEqual(result, "A quoted summary.")

    def test_does_not_strip_mismatched_quotes(self):
        result = clean_summarisation_response("\"Not matching'", 240)
        self.assertEqual(result, "\"Not matching'")

    def test_truncates_overlong_text_at_a_word_boundary(self):
        long_text = "word " * 100  # 500 chars, way over the limit
        result = clean_summarisation_response(long_text.strip(), 50)
        self.assertLessEqual(len(result), 50)
        self.assertTrue(result.endswith("…"))
        self.assertNotIn("  ", result)  # no broken mid-word artifacts

    def test_handles_a_single_word_longer_than_the_limit(self):
        result = clean_summarisation_response("supercalifragilisticexpialidocious", 10)
        self.assertLessEqual(len(result), 10)


if __name__ == "__main__":
    unittest.main()
