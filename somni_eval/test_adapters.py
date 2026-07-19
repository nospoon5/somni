import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

sys.path.insert(0, str(Path(__file__).parent))

from adapters import (  # noqa: E402
    AdapterResult,
    PersonaSession,
    SomniApiAdapter,
    _best_message_part,
    _combine_sse_messages,
)


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


class ReadOnlyEvaluationTransportTests(unittest.TestCase):
    def setUp(self) -> None:
        self.secret = "stage-seven-evaluation-secret-value"
        self.config = SimpleNamespace(
            transport=SimpleNamespace(
                base_url="https://somni.test",
                supabase_url="https://project.supabase.co",
                supabase_anon_key="anon-key",
                send_eval_mode_header=True,
                eval_secret=self.secret,
                persona_accounts={},
            )
        )

    def test_chat_request_authenticates_evaluation_mode(self) -> None:
        adapter = SomniApiAdapter(self.config)
        response = Mock()
        response.status_code = 200
        response.iter_lines.return_value = [
            "event: done",
            'data: {"message":"Complete answer."}',
            "",
        ]
        adapter._http.post = Mock(return_value=response)

        result = adapter._post_chat("session-cookie", "Question", 30)

        self.assertEqual(result.response_text, "Complete answer.")
        headers = adapter._http.post.call_args.kwargs["headers"]
        self.assertEqual(headers["x-eval-mode"], "true")
        self.assertEqual(headers["x-somni-eval-secret"], self.secret)

    def test_send_question_never_patches_the_test_fixture(self) -> None:
        adapter = SomniApiAdapter(self.config)
        adapter._session_cache["gentle"] = PersonaSession(
            cookie_header="session-cookie",
            user_id="approved-user",
        )
        adapter._http.patch = Mock()
        adapter._post_chat = Mock(return_value=AdapterResult(response_text="Answer."))

        adapter.send_question("gentle", "My 4-month-old wakes often", 30)

        adapter._http.patch.assert_not_called()

    def test_linked_questions_send_bounded_prior_turns_without_database_writes(self) -> None:
        adapter = SomniApiAdapter(self.config)
        adapter._session_cache["gentle"] = PersonaSession(
            cookie_header="session-cookie",
            user_id="approved-user",
        )
        adapter._http.patch = Mock()
        responses = [
            AdapterResult(response_text="Try a darker room."),
            AdapterResult(response_text="Now shift the morning gradually."),
        ]
        adapter._post_chat = Mock(side_effect=responses)

        adapter.send_question("gentle", "My baby wakes at 5am.", 30, "conversation-1")
        adapter.send_question(
            "gentle",
            "The darker room did not help.",
            30,
            "conversation-1",
        )

        second_call = adapter._post_chat.call_args_list[1]
        self.assertEqual(
            second_call.args[4],
            [
                {"role": "user", "content": "My baby wakes at 5am."},
                {"role": "assistant", "content": "Try a darker room."},
            ],
        )
        adapter._http.patch.assert_not_called()


if __name__ == "__main__":
    unittest.main()
