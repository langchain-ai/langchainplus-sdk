[**langsmith**](../../README.md) • **Docs**

***

[langsmith](../../README.md) / [wrappers](../README.md) / wrapSDK

# Function: wrapSDK()

> **wrapSDK**\<`T`\>(`sdk`, `options`?): `T`

Wrap an arbitrary SDK, enabling automatic LangSmith tracing.
Method signatures are unchanged.

Note that this will wrap and trace ALL SDK methods, not just
LLM completion methods. If the passed SDK contains other methods,
we recommend using the wrapped instance for LLM calls only.

## Type Parameters

• **T** *extends* `object`

## Parameters

• **sdk**: `T`

An arbitrary SDK instance.

• **options?**: `Partial`\<[`RunTreeConfig`](../../run_trees/interfaces/RunTreeConfig.md) & `object`\>

LangSmith options.

## Returns

`T`

## Defined in

[src/wrappers/generic.ts:57](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/wrappers/generic.ts#L57)
