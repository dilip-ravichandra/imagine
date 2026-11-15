import json

import pytest

from ai_engine.training import adapter as A
from tests.adapter_fixture import REV, approve, good_tally, make_adapter, make_approved


def T(n, adapted, base):
    return dict(adapted_better=adapted, base_better=base, tie=n - adapted - base, unrated=0, rated=n,
                not_worse_fraction=(n - base) / n if n else None)


# ---- tally
def test_tally_by_steps_maps_blind_votes_and_separates_steps():
    key = [dict(pair="a|steps1|seed1", A="base", B="adapted"), dict(pair="b|steps1|seed1", A="adapted", B="base"),
           dict(pair="a|steps4|seed1", A="base", B="adapted"), dict(pair="c|steps4|seed1", A="base", B="adapted")]
    rows = [dict(pair="a|steps1|seed1", better_A_B_tie="B"),   # adapted
            dict(pair="b|steps1|seed1", better_A_B_tie="B"),   # base
            dict(pair="a|steps4|seed1", better_A_B_tie="tie"),
            dict(pair="c|steps4|seed1", better_A_B_tie="")]    # unrated
    t = A.tally_by_steps(rows, key)
    assert (t[1]["adapted_better"], t[1]["base_better"], t[1]["rated"]) == (1, 1, 2)
    assert (t[4]["tie"], t[4]["unrated"], t[4]["rated"]) == (1, 1, 1)


# ---- rule boundaries
@pytest.mark.parametrize("n,adapted,base,ok", [(40, 28, 12, True),    # exactly 70% not-worse? (40-12)/40 = 70%
                                               (40, 27, 13, False),   # 67.5%
                                               (39, 39, 0, False),    # one pair short
                                               (41, 30, 12, True)])
def test_rule_boundaries_per_steps(n, adapted, base, ok):
    passed, reasons = A.evaluate_rule({30: T(n, adapted, base)}, 0)
    assert passed is ok, reasons


def test_every_required_steps_must_pass_independently():
    good, bad = T(40, 40, 0), T(40, 10, 30)
    assert A.evaluate_rule({30: good}, 0)[0]
    assert not A.evaluate_rule({30: bad}, 0)[0]
    assert not A.evaluate_rule({1: good}, 0)[0]            # missing a required step count
    assert not A.evaluate_rule({}, 0)[0]


def test_new_failures_counted_only_when_base_was_fine():
    recs = [dict(prompt_id="a", steps=1, seed=1, variant="base", status="ok"),
            dict(prompt_id="a", steps=1, seed=1, variant="adapted", status="filtered"),     # counts
            dict(prompt_id="b", steps=1, seed=1, variant="base", status="filtered"),
            dict(prompt_id="b", steps=1, seed=1, variant="adapted", status="filtered"),     # base failed too: does not count
            dict(prompt_id="c", steps=1, seed=1, variant="base", status="ok"),
            dict(prompt_id="c", steps=1, seed=1, variant="adapted", status="ok")]
    assert A.new_failures(recs) == 1
    assert not A.evaluate_rule({30: good_tally()}, 1)[0]


# ---- write_approval
def test_write_approval_refuses_and_writes_nothing(tmp_path):
    d = make_adapter(tmp_path)
    for kw in (dict(confirmed=False), dict(reviewer="  "), dict(failures=1),
               dict(per={30: T(40, 5, 30)})):
        with pytest.raises(A.AdapterRejected):
            approve(d, **kw)
        assert not (d / A.APPROVAL_FILE).exists()


def test_write_approval_binds_to_the_adapter_hash(tmp_path):
    d = make_adapter(tmp_path)
    doc = approve(d)
    assert doc["adapter_sha256"] == json.loads((d / "adaptation.json").read_text())["adapter_sha256"]
    assert doc["passed"] and doc["artifacts_confirmed"] and doc["reviewer"] == "R. Viewer"


def test_cannot_approve_an_invalid_adapter(tmp_path):
    d = make_adapter(tmp_path, status="started")
    with pytest.raises(A.DataError):
        approve(d)


# ---- load_approved_adapter (what the API calls)
def test_approved_adapter_loads(tmp_path):
    d = make_approved(tmp_path)
    info = A.load_approved_adapter(d, REV)
    assert info["sha256"] and info["bytes"] == len(b"lora-weights") and info["base_revision"] == REV


def test_unapproved_adapter_is_rejected(tmp_path):
    d = make_adapter(tmp_path)
    with pytest.raises(A.AdapterRejected, match="not been approved"):
        A.load_approved_adapter(d, REV)


def test_unpinned_or_mismatched_revision_is_rejected(tmp_path):
    d = make_approved(tmp_path)
    for rev in (None, "", "main", "d" * 40):
        with pytest.raises(A.AdapterRejected):
            A.load_approved_adapter(d, rev)


def test_tampered_weights_are_rejected_even_if_approved(tmp_path):
    d = make_approved(tmp_path)
    (d / A.LORA_WEIGHT_NAME).write_bytes(b"swapped after approval")
    with pytest.raises(A.AdapterRejected, match="hash"):
        A.load_approved_adapter(d, REV)


def test_approval_copied_from_another_adapter_is_rejected(tmp_path):
    good = make_approved(tmp_path, name="good", weights=b"good")
    other = make_adapter(tmp_path, name="other", weights=b"other")
    (other / A.APPROVAL_FILE).write_text((good / A.APPROVAL_FILE).read_text())
    with pytest.raises(A.AdapterRejected, match="different adapter"):
        A.load_approved_adapter(other, REV)


@pytest.mark.parametrize("edit", [dict(passed=False), dict(artifacts_confirmed=False), dict(schema="old")])
def test_non_passing_approval_records_are_rejected(tmp_path, edit):
    d = make_approved(tmp_path)
    a = json.loads((d / A.APPROVAL_FILE).read_text())
    a.update(edit)
    (d / A.APPROVAL_FILE).write_text(json.dumps(a))
    with pytest.raises(A.AdapterRejected):
        A.load_approved_adapter(d, REV)


def test_hand_edited_tallies_that_fail_the_rule_are_rejected(tmp_path):
    d = make_approved(tmp_path)
    a = json.loads((d / A.APPROVAL_FILE).read_text())
    a["per_steps"]["30"]["rated"] = 12  # claims passed:true but the recorded numbers do not satisfy the rule
    (d / A.APPROVAL_FILE).write_text(json.dumps(a))
    with pytest.raises(A.AdapterRejected, match="no longer satisfies"):
        A.load_approved_adapter(d, REV)


def test_tightening_the_rule_invalidates_old_approvals(tmp_path, monkeypatch):
    d = make_approved(tmp_path)
    monkeypatch.setattr(A, "RULE", dict(A.RULE, min_rated_pairs_per_steps=500))
    with pytest.raises(A.AdapterRejected):
        A.load_approved_adapter(d, REV)


def test_garbled_metadata_gives_a_safe_message_without_paths(tmp_path):
    d = make_approved(tmp_path)
    (d / "adaptation.json").write_text("{not json")
    with pytest.raises(A.AdapterRejected) as e:
        A.load_approved_adapter(d, REV)
    assert str(tmp_path) not in str(e.value) and "unreadable" in str(e.value)


def test_no_rejection_message_leaks_the_adapter_path(tmp_path):
    for build in (lambda: make_adapter(tmp_path, name="a1"),                         # unapproved
                  lambda: make_adapter(tmp_path, name="a2", status="failed"),        # bad status
                  lambda: tmp_path / "does_not_exist"):                              # missing
        d = build()
        with pytest.raises(A.AdapterRejected) as e:
            A.load_approved_adapter(d, REV)
        assert str(tmp_path) not in str(e.value)
