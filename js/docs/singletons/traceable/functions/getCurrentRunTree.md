[**langsmith**](../../../README.md) • **Docs**

***

[langsmith](../../../README.md) / [singletons/traceable](../README.md) / getCurrentRunTree

# Function: getCurrentRunTree()

> **getCurrentRunTree**(): [`RunTree`](../../../run_trees/classes/RunTree.md)

Return the current run tree from within a traceable-wrapped function.
Will throw an error if called outside of a traceable function.

## Returns

[`RunTree`](../../../run_trees/classes/RunTree.md)

The run tree for the given context.

## Defined in

[src/singletons/traceable.ts:48](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/singletons/traceable.ts#L48)
