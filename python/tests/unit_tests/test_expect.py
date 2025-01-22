from unittest import mock

from langsmith import expect
from langsmith._expect import ls_client


def _is_none(x: object) -> bool:
    return x is None


@mock.patch.object(ls_client, "Client", autospec=True)
def test_expect_explicit_none(mock_client: mock.Mock) -> None:
    expect(None).against(_is_none)
    expect(None).to_be_none()
    expect.score(1).to_equal(1)
    expect.score(1).to_be_less_than(2)
    expect.score(1).to_be_greater_than(0)
    expect.score(1).to_be_between(0, 2)
    expect.score(1).to_be_approximately(1, 2)
    expect({1, 2}).to_contain(1)


@mock.patch.object(ls_client, "Client", autospec=True)
def test_embedding_distance_with_bedrock(mock_client: mock.Mock) -> None:
    # Mock the bedrock encoder function
    def mock_bedrock_encoder(texts):
        return [[0.1, 0.2, 0.3] for _ in texts]

    # Test with bedrock encoder
    config = {"encoder": mock_bedrock_encoder, "metric": "cosine"}
    matcher = expect.embedding_distance(
        prediction="hello",
        reference="hi",
        config=config,
    )
    matcher.to_be_less_than(1.0)
    matcher.to_be_greater_than(0.0)
    matcher.to_be_between(0.0, 1.0)
    matcher.to_be_approximately(0.5, precision=1)
    matcher.to_equal(0.5)
    matcher.to_be_none()
    matcher.to_contain(0.5)
