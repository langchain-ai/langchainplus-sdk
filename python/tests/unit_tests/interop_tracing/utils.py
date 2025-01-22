from __future__ import annotations

import json
import uuid
from collections import deque
from typing import (
    Dict,
    List,
    Literal,
    Optional,
    Sequence,
    Tuple,
    TypedDict,
    Union,
    overload,
)
from unittest.mock import MagicMock

import pytest

from langsmith import Client


def _get_mock_client() -> Client:
    """Get a mock client."""
    mock_session = MagicMock()
    client = Client(session=mock_session, api_key="test")
    return client


@pytest.fixture
def mock_client() -> Client:
    return _get_mock_client()


class Request(TypedDict, total=False):
    verb: str
    path: str


def _extract_requests(mock_client: Client) -> List[Request]:
    """Extract run information from the create run calls"""
    calls: List[Request] = []
    for call in mock_client.session.request.mock_calls:  # type: ignore
        if not call.args:
            continue

        if not len(call.args) == 2:
            continue

        verb = call.args[0]
        path = call.args[1]
        kwargs = call.kwargs

        if "data" in call.kwargs:
            kwargs = call.kwargs
            kwargs["data"] = json.loads(kwargs["data"])

        calls.append(
            {
                "verb": verb,
                "path": path,
                **kwargs,
            }
        )

    return calls


class Span(TypedDict):
    """Tracing span."""

    id: str
    parent_id: Optional[str]
    name: str
    tags: List[str]
    metadata: dict
    run_type: Optional[str]
    inputs: Optional[dict]
    outputs: Optional[dict]


def _extract_lineage_information(requests: Sequence[Request]) -> List[Span]:
    spans: List[Span] = []
    for request in requests:
        if request["verb"] != "POST":
            continue
        if not request["path"].endswith("/runs/batch"):
            raise ValueError(f"Unrecognized path {request['path']}")
        if "data" not in request:
            raise ValueError("No data in request")

        if "post" not in request["data"]:  # type: ignore
            raise ValueError("No post data in request")

        post_data = request["data"]["post"]  # type: ignore
        for item in post_data:
            span: Span = {
                "id": item["id"],
                "parent_id": item.get("parent_run_id"),
                "name": item["name"],
                "tags": item.get("tags", []),
                "metadata": item.get("metadata", {}),
                "run_type": item.get("run_type"),
                "inputs": item.get("inputs"),
                "outputs": item.get("outputs"),
            }

            spans.append(span)

    return spans


def extract_spans(mock_client: Client) -> List[Span]:
    """Extract lineage information from the mock client."""
    if not mock_client.tracing_queue:
        raise AssertionError()
    mock_client.tracing_queue.join()
    calls = _extract_requests(mock_client)
    return _extract_lineage_information(calls)


class SpanTree:
    def __init__(self, spans: List[Span]) -> None:
        """Build a span tree from the spans.

        This will consturct a tree from the spans. The tree is represented as a list of
        nodes, where each node is a dictionary with the following keys:

        - id: The id of the node
        - parent_id: The id of the parent node
        - name: The name of the node
        - tags: The tags of the node
        - metadata: The metadata of the node
        - run_type: The run type of the node
        - inputs: The inputs of the node
        - outputs: The outputs of the node

        During the construction of the tree, we assert that the tree has no cycles.

        We will also attempt to check that the spans themselves are valid (e.g.,
        that the ids are UUIDs).
        """
        for span in spans:
            assert_is_valid_span(span)
        self.spans = spans

        # assert no duplicate ids
        ids = [node["id"] for node in spans]
        assert len(ids) == len(set(ids)), "Duplicate ids found"

        self.child_id_to_parent_id = {node["id"]: node["parent_id"] for node in spans}
        # Invert to calculate parent id to child id
        self.parent_id_to_child_ids: Dict[str, List[str]] = {}
        for child_id, parent_id in self.child_id_to_parent_id.items():
            if parent_id is None:
                continue
            if parent_id not in self.parent_id_to_child_ids:
                self.parent_id_to_child_ids[parent_id] = [child_id]
            else:
                self.parent_id_to_child_ids[parent_id].append(child_id)
        self.assert_no_cycles()

    def assert_no_cycles(self) -> None:
        """Assert that the tree has no cycles."""
        # Start from root node
        root_nodes = self.get_root_nodes()
        visited = set()
        for root_node in root_nodes:
            # Assert only one root node
            stack = [root_node]
            while stack:
                node = stack.pop()
                if node["id"] in visited:
                    raise ValueError("Cycle detected")
                visited.add(node["id"])
                children = self.get_children(node)
                stack.extend(children)

    def get_root_nodes(self) -> List[Span]:
        """Return all nodes that do not have a parent."""
        return [node for node in self.spans if node["parent_id"] is None]

    def get_children(self, node: Span) -> List[Span]:
        """Return all nodes that have the given node as a parent."""
        child_ids = self.parent_id_to_child_ids.get(node["id"], [])
        return [child for child in self.spans if child["id"] in child_ids]

    @overload
    def get_breadth_first_traversal(
        self,
        *,
        include_level: Literal[False] = False,
        attributes: Optional[Sequence[str]] = None,
    ) -> List[dict]: ...

    @overload
    def get_breadth_first_traversal(
        self,
        *,
        include_level: Literal[True],
        attributes: Optional[Sequence[str]] = None,
    ) -> List[Tuple[dict, int]]: ...

    def get_breadth_first_traversal(
        self, *, include_level: bool = False, attributes: Optional[Sequence[str]] = None
    ) -> Union[List[Tuple[dict, int]], List[dict]]:
        """Return a list of nodes in breadth-first order.

        This is a LEVEL order traversal

        Args:
            include_level: Whether to include the level of the node in the output.
            attributes: optional list of attributes to project from the spans.

        Returns:
            A list of nodes in the order they were added. If include_level is True,
            the list will contain tuples of the form (node, level), where level is the
            depth from the root node.
        """
        # First we assert there's only a single root node
        root_nodes = self.get_root_nodes()
        assert (
            len(root_nodes) == 1
        ), f"Expected a single root node. Found {len(root_nodes)}"  # noqa: E501
        root_node = root_nodes[0]
        # Then we create a list to hold the nodes
        nodes_and_level = []
        # Then we create a queue to hold the nodes we need to visit

        # Track of node and its level
        queue = deque([(root_node, 0)])
        # While there are nodes to visit
        while queue:
            # Pop the first node from the queue
            node, level = queue.popleft()
            # Add the node to the list
            nodes_and_level.append((node, level))
            # Get the children of the node
            children = self.get_children(node)
            # Add the children to the queue
            for child in children:
                queue.append((child, level + 1))

        if attributes:
            repackaged = [
                ({prop: node[prop] for prop in attributes}, level_)  # type: ignore
                for node, level_ in nodes_and_level
            ]
        else:
            repackaged = nodes_and_level  # type: ignore

        if include_level:
            return repackaged
        else:
            return [node for node, _ in repackaged]


def extract_span_tree(mock_client: Client) -> SpanTree:
    spans = extract_spans(mock_client)
    return SpanTree(spans)


def assert_is_valid_span(span: Span):
    """Assert that the span is valid."""
    assert isinstance(span["id"], str)
    try:
        uuid.UUID(span["id"])
    except ValueError:
        raise AssertionError(f"Invalid span id {span['id']}, should be a UUID")
    assert isinstance(span["name"], str)

    if span.get("parent_id") is not None:
        assert isinstance(span["parent_id"], str)
        try:
            uuid.UUID(span["parent_id"])
        except ValueError:
            raise AssertionError(
                f"Invalid parent id {span['parent_id']}, should be a UUID"
            )

    assert isinstance(span.get("tags", []), list)
    assert isinstance(span.get("metadata", {}), dict)
    inputs = span.get("inputs")
    assert inputs is not None and inputs != {}, f"Span should have inputs. {span}"
