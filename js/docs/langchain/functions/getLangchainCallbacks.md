[**langsmith**](../../README.md) • **Docs**

***

[langsmith](../../README.md) / [langchain](../README.md) / getLangchainCallbacks

# Function: getLangchainCallbacks()

> **getLangchainCallbacks**(`currentRunTree`?): `Promise`\<`undefined` \| `CallbackManager`\>

Converts the current run tree active within a traceable-wrapped function
into a LangChain compatible callback manager. This is useful to handoff tracing
from LangSmith to LangChain Runnables and LLMs.

## Parameters

• **currentRunTree?**: [`RunTree`](../../run_trees/classes/RunTree.md)

Current RunTree from within a traceable-wrapped function. If not provided, the current run tree will be inferred from AsyncLocalStorage.

## Returns

`Promise`\<`undefined` \| `CallbackManager`\>

Callback manager used by LangChain Runnable objects.

## Defined in

[src/langchain.ts:32](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/langchain.ts#L32)
