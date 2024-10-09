[**langsmith**](../../README.md) • **Docs**

***

[langsmith](../../README.md) / [traceable](../README.md) / traceable

# Function: traceable()

> **traceable**\<`Func`\>(`wrappedFunc`, `config`?): [`TraceableFunction`](../type-aliases/TraceableFunction.md)\<`Func`\>

Higher-order function that takes function as input and returns a
"TraceableFunction" - a wrapped version of the input that
automatically handles tracing. If the returned traceable function calls any
traceable functions, those are automatically traced as well.

The returned TraceableFunction can accept a run tree or run tree config as
its first argument. If omitted, it will default to the caller's run tree,
or will be treated as a root run.

## Type Parameters

• **Func** *extends* (...`args`) => `any`

## Parameters

• **wrappedFunc**: `Func`

Targeted function to be traced

• **config?**: `Partial`\<[`RunTreeConfig`](../../run_trees/interfaces/RunTreeConfig.md)\> & `object`

Additional metadata such as name, tags or providing
    a custom LangSmith client instance

## Returns

[`TraceableFunction`](../type-aliases/TraceableFunction.md)\<`Func`\>

## Defined in

[src/traceable.ts:276](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/traceable.ts#L276)
