[**langsmith**](../../README.md) • **Docs**

***

[langsmith](../../README.md) / [run\_trees](../README.md) / RunnableConfigLike

# Interface: RunnableConfigLike

## Properties

### callbacks?

> `optional` **callbacks**: `any`

Callbacks for this call and any sub-calls (eg. a Chain calling an LLM).
Tags are passed to all callbacks, metadata is passed to handle*Start callbacks.

#### Defined in

[src/run\_trees.ts:77](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L77)

***

### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

Metadata for this call and any sub-calls (eg. a Chain calling an LLM).
Keys should be strings, values should be JSON-serializable.

#### Defined in

[src/run\_trees.ts:70](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L70)

***

### tags?

> `optional` **tags**: `string`[]

Tags for this call and any sub-calls (eg. a Chain calling an LLM).
You can use these to filter calls.

#### Defined in

[src/run\_trees.ts:64](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L64)
