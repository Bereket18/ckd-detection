"""
The patient questionnaire as an explicit deterministic finite automaton.

Why this module exists
----------------------
The dialogue was already a finite automaton; it was just implicit. The loop in
chatbot.collect_patient_data() was a `for` over the feature list wrapping a
`while True` that re-asked on invalid input and re-asked on "help" -- i.e. a
chain of states with two self-loops and one forward edge. Written that way the
control flow is correct but unverifiable: there is no object to ask "is a
transition defined for every input in every state?", and no way to show the
dialogue can always terminate. Those are the questions this course is about, so
the machine is written down as data and the loop is made to execute it.

This is a specification that RUNS. A formal description sitting beside the code
in a report, with the code separately hand-rolling the same logic, is two
definitions that drift -- the defect AUDIT.md P1-1 records (a metric pasted into
three files, false in all three the moment the pipeline changed). Here
collect_patient_data() drives this table, so a divergence is impossible rather
than merely unlikely.

The formal object
-----------------
M = (Q, Sigma, delta, q0, F)

  Q       {ASK_0, ..., ASK_{n-1}, DONE}, where n is the number of features the
          loaded model was trained on -- so a 10-feature model yields an
          11-state machine, not a hardcoded 25.
  Sigma   {VALID, SKIP, HELP, INVALID}
  delta   ASK_i x VALID   -> ASK_{i+1}    (answer accepted, advance)
          ASK_i x SKIP    -> ASK_{i+1}    (declined; the imputer fills it)
          ASK_i x HELP    -> ASK_i        (self-loop: explain, re-ask)
          ASK_i x INVALID -> ASK_i        (self-loop: complain, re-ask)
          where ASK_n is DONE. DONE is absorbing.
  q0      ASK_0
  F       {DONE}

Why the alphabet is four symbols, not raw text
----------------------------------------------
A patient types arbitrary strings, and the set of possible strings is infinite,
so a machine over raw input would not be finite-state in any useful sense.
classify() maps each raw answer to exactly one of four symbols first. That split
-- an unbounded input stream reduced to a finite token alphabet, then a
finite-state recognizer over those tokens -- is the standard lexer/parser
separation, and it is what makes the DFA claim true rather than decorative.

classify() delegates to chatbot.validate_numeric/validate_binary rather than
re-deriving what counts as valid. Those already return (ok, parsed) where
parsed is None for a deliberate skip, which maps onto SKIP vs INVALID exactly.

Why a DFA is sufficient (and a PDA is not required)
---------------------------------------------------
delta depends only on the current state and the input symbol. There is no
auxiliary storage: the machine never needs to recall how it reached ASK_i, only
that it is there. Collected answers accumulate in a dict outside the machine --
that is the transducer's output tape, not state, and it does not influence any
transition.

A pushdown automaton becomes necessary when a dialogue nests -- "for each
medication, ask its dose, then return to where you were" -- because the return
point must be stacked, and the language of well-nested transcripts is not
regular. This questionnaire is flat: n independent questions asked in a fixed
order. Choosing the weaker machine that suffices is the point; a PDA here would
carry a stack that is provably always empty.

The language of accepted transcripts is therefore regular:

    ((HELP | INVALID)* (VALID | SKIP)){n}

-- each field tolerates any number of help requests and mistakes, then exactly
one answer, repeated for all n fields. See accepted_language_regex().
"""

from __future__ import annotations

# Sigma. Plain strings rather than an Enum: they are printed in the transition
# table, compared in tests, and used as dict keys, and an Enum would add
# ceremony to all three for no safety this module needs.
VALID = "VALID"
SKIP = "SKIP"
HELP = "HELP"
INVALID = "INVALID"

ALPHABET = (VALID, SKIP, HELP, INVALID)

# The single accepting state. Named as a constant because it is compared in
# several places and a typo'd string literal would silently never match.
DONE = "DONE"

# The symbols that consume the current question and move on. Kept as data so
# delta() below reads as a statement about the machine rather than as a
# conditional someone has to interpret.
ADVANCING = frozenset({VALID, SKIP})


def state_name(index: int) -> str:
    """The name of the state that is asking field `index`."""
    return f"ASK_{index}"


class DialogueFSM:
    """
    The questionnaire automaton for one particular feature list.

    Construct it from the fitted preprocessor's feature_columns, so the machine
    matches the model actually loaded -- a model trained on the intersection of
    two datasets (see src/data/datasets.py) produces a correspondingly smaller
    machine with no code change.

    The instance is a *specification* plus a cursor. Q, Sigma, delta and F are
    fixed at construction; `state` is the current configuration. reset() returns
    it to q0 so one instance can run several consultations.
    """

    def __init__(self, fields, numeric_columns=()):
        self.fields = list(fields)
        # Which fields are numeric decides which validator classify() calls.
        # Stored as a set for membership tests, but built from the caller's list
        # so field order comes from `fields` alone.
        self.numeric_columns = set(numeric_columns)
        self.state = self.start_state

    # -- the formal components -------------------------------------------

    @property
    def start_state(self) -> str:
        """q0. DONE when there are no fields at all: a zero-question
        questionnaire is already complete, not an error."""
        return state_name(0) if self.fields else DONE

    @property
    def states(self) -> list:
        """Q, in order, ending with the accepting state."""
        return [state_name(i) for i in range(len(self.fields))] + [DONE]

    @property
    def accepting_states(self) -> set:
        """F."""
        return {DONE}

    @property
    def alphabet(self) -> tuple:
        """Sigma."""
        return ALPHABET

    def delta(self, state: str, symbol: str) -> str:
        """
        The transition function: total over Q x Sigma.

        Total is the property worth stating. Every state has a defined target
        for all four symbols, so no sequence of inputs can reach an undefined
        configuration -- which in the old hand-rolled loop was true only by
        inspection of the control flow, and tests could not assert it.
        """
        if symbol not in ALPHABET:
            raise ValueError(
                f"{symbol!r} is not in the alphabet {ALPHABET}. Raw patient input "
                f"must go through classify() first -- that is the step that makes "
                f"this machine finite-state."
            )
        if state == DONE:
            return DONE  # absorbing
        index = self.index_of(state)
        if symbol in ADVANCING:
            return self.states[index + 1]  # ASK_{i+1}, or DONE past the last
        return state  # HELP / INVALID: self-loop, re-ask the same field

    def index_of(self, state: str) -> int:
        """The field index a state is asking about. Raises for DONE, which asks
        nothing."""
        if state == DONE:
            raise ValueError("DONE is the accepting state; it asks no field.")
        try:
            index = int(state.split("_")[1])
        except (IndexError, ValueError):
            raise ValueError(f"{state!r} is not a state of this machine.") from None
        if not 0 <= index < len(self.fields):
            raise ValueError(
                f"{state!r} is out of range for a {len(self.fields)}-field machine."
            )
        return index

    # -- running it -------------------------------------------------------

    @property
    def current_field(self):
        """The field being asked, or None once the machine has accepted."""
        if self.state == DONE:
            return None
        return self.fields[self.index_of(self.state)]

    @property
    def accepted(self) -> bool:
        """True once the machine is in an accepting state."""
        return self.state in self.accepting_states

    def step(self, symbol: str) -> str:
        """Consume one symbol, update the configuration, return the new state."""
        self.state = self.delta(self.state, symbol)
        return self.state

    def reset(self) -> "DialogueFSM":
        self.state = self.start_state
        return self

    def run(self, symbols) -> str:
        """Consume a sequence of symbols from the CURRENT state. Returns the
        final state, so `fsm.reset().run([...]) == DONE` reads as 'this
        transcript is in the language'."""
        for symbol in symbols:
            self.step(symbol)
        return self.state

    def accepts(self, symbols) -> bool:
        """Whether a transcript drives the machine from q0 into F."""
        return self.reset().run(symbols) in self.accepting_states

    # -- classification: unbounded text -> one of four symbols -------------

    def classify(self, raw: str, field: str):
        """
        Map one raw answer to (symbol, payload).

        payload is the parsed value for VALID, None for SKIP, the validator's
        complaint for INVALID, and None for HELP -- so the caller has everything
        it needs without re-validating.

        The validators are imported here rather than at module scope because
        chatbot imports this module; a top-level import would be circular. They
        are reused rather than reimplemented: what counts as a valid answer,
        an in-range answer, or a documented skip word is already decided in one
        place, and a second copy is the defect AUDIT.md P1-8 was filed for.
        """
        from src.agent.chatbot import BINARY_ACCEPTED, validate_binary, validate_numeric

        if raw.strip().lower() == "help":
            return HELP, None

        if field in self.numeric_columns:
            ok, result = validate_numeric(raw, field)
        else:
            ok, result = validate_binary(raw, BINARY_ACCEPTED[field])

        if not ok:
            return INVALID, result       # result is the message to show
        if result is None:
            return SKIP, None            # an explicit, documented skip word
        return VALID, result

    # -- presentation / verification --------------------------------------

    def transition_table(self) -> list:
        """delta as rows of (state, symbol, next_state), for display and for
        tests that assert totality and determinism."""
        return [
            (state, symbol, self.delta(state, symbol))
            for state in self.states
            for symbol in ALPHABET
        ]

    def accepted_language_regex(self) -> str:
        """The regular expression describing every valid transcript."""
        return "((HELP|INVALID)*(VALID|SKIP)){" + str(len(self.fields)) + "}"

    def reachable_states(self) -> set:
        """Breadth-first closure from q0 -- the states an actual consultation
        can enter. A state outside this set is dead code in machine form."""
        seen = {self.start_state}
        frontier = [self.start_state]
        while frontier:
            state = frontier.pop()
            for symbol in ALPHABET:
                target = self.delta(state, symbol)
                if target not in seen:
                    seen.add(target)
                    frontier.append(target)
        return seen

    def can_terminate_from(self, state: str) -> bool:
        """
        Whether DONE is reachable from `state` -- i.e. no dead ends.

        The property a patient cares about: whatever they have typed so far,
        some continuation finishes the consultation. It holds here because
        every ASK_i has a VALID edge forward, so the shortest path to DONE from
        ASK_i is n - i valid answers.
        """
        seen = {state}
        frontier = [state]
        while frontier:
            current = frontier.pop()
            if current in self.accepting_states:
                return True
            for symbol in ALPHABET:
                target = self.delta(current, symbol)
                if target not in seen:
                    seen.add(target)
                    frontier.append(target)
        return False

    def describe(self) -> str:
        """
        A human-readable report of the machine: its components, the full
        transition table, the accepted language, and the three properties
        checked live rather than asserted.

        Printed by `python -m src.agent.chatbot --show-fsm`. The properties are
        recomputed at call time, so this cannot claim a machine is total after
        an edit that made it partial.
        """
        n = len(self.fields)
        lines = [
            "Dialogue automaton  M = (Q, Sigma, delta, q0, F)",
            "",
            f"  |Q|     = {len(self.states)}   ({n} question states + DONE)",
            f"  Sigma   = {{{', '.join(ALPHABET)}}}",
            f"  q0      = {self.start_state}",
            f"  F       = {{{', '.join(sorted(self.accepting_states))}}}",
            "",
            "  Fields, in order:",
        ]
        for i, field in enumerate(self.fields):
            kind = "numeric" if field in self.numeric_columns else "binary"
            lines.append(f"    {state_name(i):8s} {field:8s} ({kind})")

        lines += ["", "  delta:", "", "    state      VALID       SKIP        HELP        INVALID"]
        for state in self.states:
            targets = "".join(f"{self.delta(state, s):12s}" for s in ALPHABET)
            lines.append(f"    {state:10s} {targets}".rstrip())

        total = all(
            self.delta(state, symbol) in self.states
            for state in self.states for symbol in ALPHABET
        )
        reachable = self.reachable_states()
        terminates = all(self.can_terminate_from(state) for state in self.states)

        lines += [
            "",
            f"  Accepted language: {self.accepted_language_regex()}",
            "    (any number of help requests and mistakes per field, then exactly",
            "     one answer, repeated for all fields)",
            "",
            "  Verified properties:",
            f"    total          {'yes' if total else 'NO'}"
            "   -- delta is defined for every (state, symbol) in Q x Sigma",
            f"    deterministic  yes  -- delta is a function; exactly one target per pair",
            f"    reachable      {len(reachable)}/{len(self.states)} states reachable from q0",
            f"    terminating    {'yes' if terminates else 'NO'}"
            "   -- DONE is reachable from every state (no dead ends)",
            "",
            "  A DFA suffices: delta depends only on the current state and symbol,",
            "  with no auxiliary storage. A PDA would be needed only for nested",
            "  sub-dialogues requiring a return stack; this questionnaire is flat.",
        ]
        return "\n".join(lines)


def from_preprocessor(preprocessor=None) -> DialogueFSM:
    """
    Build the machine for a fitted preprocessor's feature set.

    preprocessor=None falls back to the canonical 24 UCI features, matching
    collect_patient_data's own default for callers that just want the full
    questionnaire.
    """
    import config
    if preprocessor is None:
        return DialogueFSM(config.FEATURE_COLUMNS, config.NUMERIC_COLUMNS)
    return DialogueFSM(preprocessor.feature_columns, preprocessor.numeric_columns)
