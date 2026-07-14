import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).parent))

from adapters import _best_message_part, _combine_sse_messages  # noqa: E402


class SseFinalMessageTests(unittest.TestCase):
    def test_prefers_longer_stream_when_done_message_is_not_a_replacement(self) -> None:
        streamed = "A complete streamed answer with useful detail."
        done = "Short final."

        self.assertEqual(_best_message_part(streamed, done), streamed)

    def test_forces_done_message_when_server_marks_replacement(self) -> None:
        streamed = "It's completely understandable that this is hard. Useful answer."
        done = "Useful answer."

        self.assertEqual(_best_message_part(streamed, done, force_done=True), done)

    def test_combines_replaced_and_normal_message_indexes_correctly(self) -> None:
        combined = _combine_sse_messages(
            {1: "Long draft one.", 2: "Streamed two."},
            {1: "Final one.", 2: "Done two."},
            {1},
        )

        self.assertEqual(combined, "Final one.\n\nStreamed two.")


if __name__ == "__main__":
    unittest.main()
