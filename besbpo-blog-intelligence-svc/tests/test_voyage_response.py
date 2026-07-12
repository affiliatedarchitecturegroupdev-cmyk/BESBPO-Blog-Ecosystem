"""Executable tests for app.common.voyage_response.extract_embedding.
Run with: python3 -m unittest tests.test_voyage_response -v
"""
import unittest

from app.common.voyage_response import extract_embedding


class ExtractEmbeddingTests(unittest.TestCase):
    def test_extracts_the_embedding_vector(self):
        data = {"data": [{"embedding": [0.1, 0.2, 0.3], "index": 0}]}
        self.assertEqual(extract_embedding(data), [0.1, 0.2, 0.3])

    def test_returns_the_first_item_when_multiple_present(self):
        # This client only ever sends one input per request (see
        # embedding_client.py's `input: [text]`), so only the first result
        # should ever matter — but confirm that assumption explicitly.
        data = {
            "data": [
                {"embedding": [1.0, 2.0], "index": 0},
                {"embedding": [3.0, 4.0], "index": 1},
            ]
        }
        self.assertEqual(extract_embedding(data), [1.0, 2.0])

    def test_raises_value_error_for_empty_data(self):
        with self.assertRaises(ValueError):
            extract_embedding({"data": []})

    def test_raises_value_error_for_missing_data_key(self):
        with self.assertRaises(ValueError):
            extract_embedding({})

    def test_handles_a_realistic_full_response_shape(self):
        data = {
            "object": "list",
            "data": [{"object": "embedding", "embedding": [0.01] * 1024, "index": 0}],
            "model": "voyage-3.5",
            "usage": {"total_tokens": 42},
        }
        result = extract_embedding(data)
        self.assertEqual(len(result), 1024)


if __name__ == "__main__":
    unittest.main()
