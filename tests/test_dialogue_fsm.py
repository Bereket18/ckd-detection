"""
Tests for the dialogue automaton (src/agent/dialogue_fsm.py).

These are the tests that could not exist before. The questionnaire was a `for`
over the feature list wrapping a `while True`, which is the same machine but not
an object -- there was nothing to ask "is a transition defined for every input in
every state?" or "can this dialogue always terminate?". Those properties are the
subject of the course this project is submitted for, and they are asserted below
against the running machine rather than described in a report beside it.

The properties, and why each one matters to a patient rather than only to a
formalism:

  totality       no sequence of answers can reach an undefined configuration,
                 so the questionnaire cannot get stuck on unexpected input
  determinism    the same answer in the same place always does the same thing
  reachability   every state is one a real consultation can enter (no dead code
                 in machine form)
  termination    DONE is reachable from every state, so whatever has been typed
                 so far, some continuation finishes the consultation
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

import pytest

import config
from src.agent import dialogue_fsm
from src.agent.chatbot import SKIP_ANSWERS
from src.agent.dialogue_fsm import (
    ADVANCING, ALPHABET, DONE, DialogueFSM, HELP, INVALID, SKIP, VALID,
)
from src.data.load_tabular import fetch_uci_ckd
from src.data.preprocess import prepare_tabular


@pytest.fixture
def machine():
    """The canonical 24-field questionnaire, so |Q| == 25."""
    return DialogueFSM(config.FEATURE_COLUMNS, config.NUMERIC_COLUMNS)


@pytest.fixture
def tiny():
    """A 2-field machine: small enough to enumerate transcripts exhaustively."""
    return DialogueFSM(["age", "htn"], ["age"])


# ---------------------------------------------------------------------------
# The formal object
# ---------------------------------------------------------------------------

def test_the_state_count_is_one_more_than_the_field_count(machine):
    """|Q| = n question states + the accepting state."""
    assert len(machine.states) == len(config.FEATURE_COLUMNS) + 1
    assert machine.states[-1] == DONE


def test_q0_is_the_first_question_and_f_is_exactly_done(machine):
    assert machine.start_state == "ASK_0"
    assert machine.state == "ASK_0"
    assert machine.accepting_states == {DONE}
    assert not machine.accepted


def test_the_alphabet_is_the_four_symbols(machine):
    assert machine.alphabet == ALPHABET
    assert set(ALPHABET) == {VALID, SKIP, HELP, INVALID}


# ---------------------------------------------------------------------------
# Totality and determinism
# ---------------------------------------------------------------------------

def test_delta_is_total_over_q_cross_sigma(machine):
    """
    The property the hand-rolled loop could not be checked for: every state has a
    defined target for all four symbols, so no input sequence reaches an
    undefined configuration.
    """
    rows = machine.transition_table()
    assert len(rows) == len(machine.states) * len(ALPHABET)
    for state, symbol, target in rows:
        assert target in machine.states, (state, symbol, target)


def test_delta_is_deterministic(machine):
    """Exactly one target per (state, symbol) -- delta is a function, so the
    transition table has no duplicate left-hand sides."""
    pairs = [(state, symbol) for state, symbol, _ in machine.transition_table()]
    assert len(pairs) == len(set(pairs))
    # And calling it twice cannot give two answers.
    for state in machine.states:
        for symbol in ALPHABET:
            assert machine.delta(state, symbol) == machine.delta(state, symbol)


def test_a_symbol_outside_the_alphabet_is_refused(machine):
    """
    Raw text must go through classify() first; that reduction is what makes the
    machine finite-state. Accepting an arbitrary string here would quietly make
    the DFA claim false, so it raises and says why.
    """
    with pytest.raises(ValueError, match="not in the alphabet"):
        machine.delta("ASK_0", "62")


def test_advancing_symbols_move_forward_and_the_others_self_loop(machine):
    for index, state in enumerate(machine.states[:-1]):
        for symbol in ADVANCING:
            assert machine.delta(state, symbol) == machine.states[index + 1]
        for symbol in (HELP, INVALID):
            assert machine.delta(state, symbol) == state


def test_the_accepting_state_is_absorbing(machine):
    for symbol in ALPHABET:
        assert machine.delta(DONE, symbol) == DONE


# ---------------------------------------------------------------------------
# Reachability and termination
# ---------------------------------------------------------------------------

def test_every_state_is_reachable_from_q0(machine):
    """A state outside the reachable closure would be dead code in machine
    form -- a question no consultation can ever ask."""
    assert machine.reachable_states() == set(machine.states)


def test_done_is_reachable_from_every_state(machine):
    """
    No dead ends. Whatever a patient has typed so far, some continuation finishes
    the consultation -- concretely, n - i more valid answers from ASK_i.
    """
    for state in machine.states:
        assert machine.can_terminate_from(state), state


def test_the_shortest_accepting_transcript_is_one_answer_per_field(machine):
    n = len(config.FEATURE_COLUMNS)
    assert machine.accepts([VALID] * n)
    assert not machine.accepts([VALID] * (n - 1))
    # An extra symbol is harmless: DONE absorbs it.
    assert machine.accepts([VALID] * (n + 3))


def test_help_and_invalid_never_advance_however_many_arrive(tiny):
    """The two self-loops, which is what the `while True` used to express."""
    tiny.run([HELP] * 50 + [INVALID] * 50)
    assert tiny.state == "ASK_0"
    assert tiny.current_field == "age"
    assert not tiny.accepted


def test_a_skip_advances_exactly_like_a_valid_answer(tiny):
    """
    Skipping is a first-class transition, not an error path. The imputer fills
    the field, and the machine moves on -- so SKIP and VALID must be
    indistinguishable to delta.
    """
    assert tiny.reset().run([SKIP, SKIP]) == DONE
    assert tiny.reset().run([SKIP, VALID]) == DONE
    assert tiny.reset().run([VALID, SKIP]) == DONE


def test_the_accepted_language_is_the_documented_regular_expression(tiny):
    """
    L(M) = ((HELP|INVALID)*(VALID|SKIP)){n} -- any number of help requests and
    mistakes per field, then exactly one answer, repeated for every field.
    Checked by enumerating transcripts rather than by trusting the string.
    """
    assert tiny.accepted_language_regex() == "((HELP|INVALID)*(VALID|SKIP)){2}"

    accepted = [
        [VALID, VALID],
        [HELP, VALID, INVALID, SKIP],
        [INVALID, INVALID, INVALID, VALID, HELP, VALID],
    ]
    rejected = [
        [],
        [VALID],
        [HELP, HELP],
        [INVALID, VALID, HELP],
    ]
    for transcript in accepted:
        assert tiny.accepts(transcript), transcript
    for transcript in rejected:
        assert not tiny.accepts(transcript), transcript


def test_reset_returns_the_machine_to_q0_so_one_instance_serves_many_runs(tiny):
    tiny.run([VALID, VALID])
    assert tiny.accepted
    assert tiny.reset().state == "ASK_0"
    assert not tiny.accepted


def test_a_zero_field_machine_is_already_accepting():
    """The degenerate case: a questionnaire with no questions is complete, not an
    error. It keeps from_preprocessor total over every feature set."""
    empty = DialogueFSM([], [])
    assert empty.start_state == DONE
    assert empty.accepted
    assert empty.current_field is None
    assert empty.states == [DONE]


def test_done_asks_no_field_and_says_so(machine):
    machine.run([VALID] * len(config.FEATURE_COLUMNS))
    assert machine.current_field is None
    with pytest.raises(ValueError, match="accepting state"):
        machine.index_of(DONE)


def test_a_state_outside_the_machine_is_rejected(tiny):
    with pytest.raises(ValueError, match="out of range"):
        tiny.index_of("ASK_9")
    with pytest.raises(ValueError, match="not a state"):
        tiny.index_of("SOMEWHERE")


# ---------------------------------------------------------------------------
# classify(): unbounded text -> one of four symbols
#
# This is the lexical stage, and it is what makes the DFA claim true rather than
# decorative: the set of strings a patient can type is infinite, so the machine
# runs over tokens, not over raw input.
# ---------------------------------------------------------------------------

def test_classify_maps_a_valid_number_to_valid_and_parses_it(machine):
    assert machine.classify("62", "age") == (VALID, 62.0)


def test_classify_maps_a_valid_binary_answer_to_valid(machine):
    assert machine.classify("YES", "htn") == (VALID, "yes")


@pytest.mark.parametrize("answer", sorted(SKIP_ANSWERS))
def test_classify_maps_every_documented_skip_word_to_skip(answer, machine):
    assert machine.classify(answer, "age") == (SKIP, None)
    assert machine.classify(answer, "htn") == (SKIP, None)


def test_classify_maps_help_to_help_whatever_the_field(machine):
    assert machine.classify("help", "age") == (HELP, None)
    assert machine.classify("  HELP ", "htn") == (HELP, None)


def test_classify_maps_unparseable_text_to_invalid_with_the_message(machine):
    symbol, payload = machine.classify("sixty-two", "age")
    assert symbol == INVALID
    assert "age" in payload


def test_classify_maps_an_out_of_range_number_to_invalid(machine):
    """
    su is a 0-5 urinalysis scale. "23" is numeric but impossible -- the real bug
    fixed in commit b8c5ee8. The range check lives in validate_numeric and is
    reused here rather than reimplemented, so the two cannot disagree.
    """
    symbol, payload = machine.classify("23", "su")
    assert symbol == INVALID
    assert "range" in payload.lower()


def test_classify_maps_a_wrong_binary_option_to_invalid(machine):
    symbol, payload = machine.classify("maybe", "htn")
    assert symbol == INVALID
    assert "yes/no" in payload


def test_classify_only_ever_returns_a_symbol_from_the_alphabet(machine):
    """Totality of the lexer, which is what lets step() assume its input is in
    Sigma. Every one of these must land somewhere, none may raise."""
    for raw in ["62", "yes", "unknown", "help", "", "   ", "!!", "1e9", "-5", "NaN"]:
        for field in ("age", "htn"):
            symbol, _ = machine.classify(raw, field)
            assert symbol in ALPHABET, (raw, field, symbol)


# ---------------------------------------------------------------------------
# The machine sizes itself to the loaded model
# ---------------------------------------------------------------------------

def test_from_preprocessor_builds_a_machine_for_a_reduced_feature_set():
    """
    A model trained on the intersection of two datasets asks only the questions
    it can use. The state count therefore comes from the fitted preprocessor, not
    from a hardcoded 25 -- which is what made a reduced-feature model usable
    through the only interface this project has.
    """
    numeric = ["age", "bp", "sc", "hemo"]
    binary = ["htn", "dm"]
    preprocessor = prepare_tabular(
        fetch_uci_ckd(), numeric_columns=numeric, binary_columns=binary
    )[-1]

    reduced = dialogue_fsm.from_preprocessor(preprocessor)
    assert reduced.fields == numeric + binary
    assert len(reduced.states) == 7
    assert reduced.accepted_language_regex().endswith("{6}")
    # And it is still a well-formed machine, not just a shorter list.
    assert reduced.reachable_states() == set(reduced.states)
    assert all(reduced.can_terminate_from(s) for s in reduced.states)
    # The numeric/binary split travels with it, so classify() picks the right
    # validator for a field of either kind.
    assert reduced.classify("maybe", "htn")[0] == INVALID
    assert reduced.classify("62", "age") == (VALID, 62.0)


def test_from_preprocessor_falls_back_to_the_canonical_questionnaire():
    """None means "no model loaded yet", which must still describe the full
    questionnaire rather than an empty machine."""
    default = dialogue_fsm.from_preprocessor(None)
    assert default.fields == list(config.FEATURE_COLUMNS)
    assert default.numeric_columns == set(config.NUMERIC_COLUMNS)


# ---------------------------------------------------------------------------
# describe() -- the artifact shown to a reader
# ---------------------------------------------------------------------------

def test_describe_recomputes_the_properties_rather_than_asserting_them(machine):
    """
    `--show-fsm` prints this, and a report will quote it. It must therefore be
    derived from the live machine: a claim of "total: yes" baked in as a string
    would survive an edit that made delta partial.
    """
    text = machine.describe()
    assert "total          yes" in text
    assert "terminating    yes" in text
    assert f"reachable      25/25" in text
    assert machine.accepted_language_regex() in text
    # Every state appears as a row of the printed table.
    for state in machine.states:
        assert state in text
    # And the DFA-sufficiency argument travels with it.
    assert "PDA" in text
