from pyperf._runner import Runner

from bench.create_run_tree import create_run_trees
from bench.dumps_json import (
    DeeplyNestedModel,
    DeeplyNestedModelV1,
    create_nested_instance,
)
from langsmith.client import _dumps_json


class MyClass:
    def __init__(self):
        self.vals = {}


benchmarks = (
    (
        "create_20_000_run_trees",
        create_run_trees,
        20_000,
    ),
    (
        "dumps_class_nested_py_branch_and_leaf_200x250",
        lambda x: _dumps_json({"input": x}),
        create_nested_instance(
            200, 250, branch_constructor=MyClass, leaf_constructor=MyClass
        ),
    ),
    (
        "dumps_class_nested_py_leaf_200x250",
        lambda x: _dumps_json({"input": x}),
        create_nested_instance(200, 250, leaf_constructor=MyClass),
    ),
    (
        "dumps_dataclass_nested_200x250",
        lambda x: _dumps_json({"input": x}),
        create_nested_instance(200, 250),
    ),
    (
        "dumps_pydantic_nested_200x250",
        lambda x: _dumps_json({"input": x}),
        create_nested_instance(200, 250, branch_constructor=DeeplyNestedModel),
    ),
    (
        "dumps_pydanticv1_nested_200x250",
        lambda x: _dumps_json({"input": x}),
        create_nested_instance(200, 250, branch_constructor=DeeplyNestedModelV1),
    ),
)


r = Runner()

for name, fn, input_ in benchmarks:
    r.bench_func(name, fn, input_)
