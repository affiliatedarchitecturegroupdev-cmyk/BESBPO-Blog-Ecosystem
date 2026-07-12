"""Executable tests for app.common.anthropic_response.extract_text.
Run with: python3 -m unittest tests.test_anthropic_response -v
"""
import unittest

from app.common.anthropic_response import extract_text


class ExtractTextTests(unittest.TestCase):
    def test_extracts_a_single_text_block(self):
        data = {"content": [{"type": "text", "text": "hello world"}]}
        self.assertEqual(extract_text(data), "hello world")

    def test_concatenates_multiple_text_blocks(self):
        data = {
            "content": [
                {"type": "text", "text": "part one. "},
                {"type": "text", "text": "part two."},
            ]
        }
        self.assertEqual(extract_text(data), "part one. part two.")

    def test_ignores_non_text_blocks(self):
        data = {
            "content": [
                {"type": "tool_use", "id": "x", "name": "foo", "input": {}},
                {"type": "text", "text": "the actual answer"},
            ]
        }
        self.assertEqual(extract_text(data), "the actual answer")

    def test_returns_empty_string_for_no_content(self):
        self.assertEqual(extract_text({"content": []}), "")

    def test_returns_empty_string_for_missing_content_key(self):
        self.assertEqual(extract_text({}), "")

    def test_handles_a_realistic_full_response_shape(self):
        # Shaped like a real Anthropic Messages API response.
        data = {
            "id": "msg_01XYZ",
            "type": "message",
            "role": "assistant",
            "model": "claude-sonnet-5",
            "content": [{"type": "text", "text": '{"division_tags": ["logistics"]}'}],
            "stop_reason": "end_turn",
            "usage": {"input_tokens": 120, "output_tokens": 15},
        }
        self.assertEqual(extract_text(data), '{"division_tags": ["logistics"]}')


if __name__ == "__main__":
    unittest.main()
