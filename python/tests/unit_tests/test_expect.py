from unittest import mock

from langsmith import expect


def _is_none(x: object) -> bool:
    return x is None


@mock.patch("langsmith.client.requests.Session")
def test_expect_explicit_none(mock_session_cls: mock.Mock) -> None:
    expect(None).against(_is_none)
    expect(None).to_be_none()
    expect.score(1).to_equal(1)
    expect.score(1).to_be_less_than(2)
    expect.score(1).to_be_greater_than(0)
    expect.score(1).to_be_between(0, 2)
    expect.score(1).to_be_approximately(1, 2)
    expect.score({1, 2}).to_contain(1)
