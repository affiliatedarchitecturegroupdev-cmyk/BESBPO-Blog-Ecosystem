"""Run with: python3 -m unittest tests.test_tagging_prompts -v"""
import unittest

from app.services.tagging_prompts import build_tagging_prompt, parse_tagging_response


class BuildTaggingPromptTests(unittest.TestCase):
    def test_includes_the_title_and_body(self):
        prompt = build_tagging_prompt("My Title", "My body text.", ["logistics"])
        self.assertIn("My Title", prompt)
        self.assertIn("My body text.", prompt)

    def test_includes_all_known_divisions(self):
        prompt = build_tagging_prompt("T", "B", ["logistics", "construction", "bpo"])
        self.assertIn("logistics", prompt)
        self.assertIn("construction", prompt)
        self.assertIn("bpo", prompt)

    def test_requests_json_only_output(self):
        prompt = build_tagging_prompt("T", "B", ["logistics"])
        self.assertIn("JSON", prompt)
        self.assertIn("division_tags", prompt)


class ParseTaggingResponseTests(unittest.TestCase):
    KNOWN = ["logistics", "construction", "bpo"]

    def test_parses_a_well_formed_response(self):
        raw = '{"division_tags": ["logistics"], "free_form_tags": ["case-study"], "confidence": 0.85}'
        tags, free_form, confidence = parse_tagging_response(raw, self.KNOWN)
        self.assertEqual(tags, ["logistics"])
        self.assertEqual(free_form, ["case-study"])
        self.assertAlmostEqual(confidence, 0.85)

    def test_strips_markdown_code_fences(self):
        raw = '```json\n{"division_tags": ["bpo"], "free_form_tags": [], "confidence": 0.7}\n```'
        tags, _, _ = parse_tagging_response(raw, self.KNOWN)
        self.assertEqual(tags, ["bpo"])

    def test_filters_out_hallucinated_divisions_not_in_known_list(self):
        raw = '{"division_tags": ["logistics", "made-up-division"], "free_form_tags": [], "confidence": 0.9}'
        tags, _, _ = parse_tagging_response(raw, self.KNOWN)
        self.assertEqual(tags, ["logistics"])

    def test_clamps_confidence_above_one(self):
        raw = '{"division_tags": [], "free_form_tags": [], "confidence": 5.0}'
        _, _, confidence = parse_tagging_response(raw, self.KNOWN)
        self.assertEqual(confidence, 1.0)

    def test_clamps_confidence_below_zero(self):
        raw = '{"division_tags": [], "free_form_tags": [], "confidence": -2.0}'
        _, _, confidence = parse_tagging_response(raw, self.KNOWN)
        self.assertEqual(confidence, 0.0)

    def test_defaults_confidence_when_missing(self):
        raw = '{"division_tags": ["logistics"], "free_form_tags": []}'
        _, _, confidence = parse_tagging_response(raw, self.KNOWN)
        self.assertEqual(confidence, 0.5)

    def test_raises_value_error_for_invalid_json(self):
        with self.assertRaises(ValueError):
            parse_tagging_response("not json at all", self.KNOWN)

    def test_raises_value_error_when_top_level_is_not_an_object(self):
        with self.assertRaises(ValueError):
            parse_tagging_response("[1, 2, 3]", self.KNOWN)

    def test_raises_value_error_when_division_tags_is_not_a_list(self):
        with self.assertRaises(ValueError):
            parse_tagging_response('{"division_tags": "logistics"}', self.KNOWN)

    def test_ignores_non_string_items_in_free_form_tags(self):
        raw = '{"division_tags": [], "free_form_tags": ["ok", 123, null], "confidence": 0.5}'
        _, free_form, _ = parse_tagging_response(raw, self.KNOWN)
        self.assertEqual(free_form, ["ok"])


if __name__ == "__main__":
    unittest.main()
