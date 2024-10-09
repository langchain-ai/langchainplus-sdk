[**langsmith**](../../../README.md) • **Docs**

***

[langsmith](../../../README.md) / [evaluation/langchain](../README.md) / getLangchainStringEvaluator

# Function: ~~getLangchainStringEvaluator()~~

> **getLangchainStringEvaluator**(`type`, `options`): `Promise`\<(`run`, `example`) => `Promise`\<`object`\>\>

## Parameters

• **type**: `"criteria"` \| `"labeled_criteria"`

Type of string evaluator, one of "criteria" or "labeled_criteria

• **options**: `EmbeddingDistanceEvalChainInput` & `object` & `object`

Options for loading the evaluator

## Returns

`Promise`\<(`run`, `example`) => `Promise`\<`object`\>\>

Evaluator consumable by `evaluate`

## Deprecated

Use `evaluate` instead.

This utility function loads a LangChain string evaluator and returns a function
which can be used by newer `evaluate` function.

## Defined in

[src/evaluation/langchain.ts:40](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/evaluation/langchain.ts#L40)
