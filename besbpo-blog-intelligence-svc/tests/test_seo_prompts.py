"""Run with: python3 -m unittest tests.test_seo_prompts -v"""
import unittest

from app.services.seo_prompts import build_seo_prompt, parse_seo_response


class BuildSeoPromptTests(unittest.TestCase):
    def test_includes_title_and_body(self):
        prompt = build_seo_prompt("My Title", None, "Body text.")
        self.assertIn("My Title", prompt)
        self.assertIn("Body text.", prompt)

    def test_includes_existing_excerpt_when_given(self):
        prompt = build_seo_prompt("T", "An existing excerpt.", "B")
        self.assertIn("An existing excerpt.", prompt)

    def test_omits_excerpt_line_when_none(self):
        prompt = build_seo_prompt("T", None, "B")
        self.assertNotIn("Existing excerpt:", prompt)


class ParseSeoResponseTests(unittest.TestCase):
    def test_parses_a_well_formed_response(self):
        raw = '{"meta_title": "A Title", "meta_description": "A description."}'
        title, description = parse_seo_response(raw)
        self.assertEqual(title, "A Title")
        self.assertEqual(description, "A description.")

    def test_strips_markdown_code_fences(self):
        raw = '```json\n{"meta_title": "T", "meta_description": "D"}\n```'
        title, description = parse_seo_response(raw)
        self.assertEqual(title, "T")
        self.assertEqual(description, "D")

    def test_truncates_an_overlong_meta_title(self):
        long_title = "A " * 40  # way over 60 chars
        raw = f'{{"meta_title": "{long_title.strip()}", "meta_description": "D"}}'
        title, _ = parse_seo_response(raw)
        self.assertLessEqual(len(title), 60)

    def test_truncates_an_overlong_meta_description(self):
        long_desc = "word " * 40  # way over 155 chars
        raw = f'{{"meta_title": "T", "meta_description": "{long_desc.strip()}"}}'
        _, description = parse_seo_response(raw)
        self.assertLessEqual(len(description), 155)

    def test_raises_value_error_for_invalid_json(self):
        with self.assertRaises(ValueError):
            parse_seo_response("not json")

    def test_raises_value_error_for_missing_meta_title(self):
        with self.assertRaises(ValueError):
            parse_seo_response('{"meta_description": "D"}')

    def test_raises_value_error_for_empty_meta_title(self):
        with self.assertRaises(ValueError):
            parse_seo_response('{"meta_title": "  ", "meta_description": "D"}')

    def test_raises_value_error_for_missing_meta_description(self):
        with self.assertRaises(ValueError):
            parse_seo_response('{"meta_title": "T"}')


if __name__ == "__main__":
    unittest.main()
