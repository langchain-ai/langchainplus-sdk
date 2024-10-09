[**langsmith**](../../README.md) • **Docs**

***

[langsmith](../../README.md) / [client](../README.md) / CreateExampleOptions

# Type Alias: CreateExampleOptions

> **CreateExampleOptions**: `object`

## Type declaration

### createdAt?

> `optional` **createdAt**: `Date`

The creation date of the example.

### datasetId?

> `optional` **datasetId**: `string`

The ID of the dataset to create the example in.

### datasetName?

> `optional` **datasetName**: `string`

The name of the dataset to create the example in (if dataset ID is not provided).

### exampleId?

> `optional` **exampleId**: `string`

A unique identifier for the example.

### metadata?

> `optional` **metadata**: [`KVMap`](../../schemas/type-aliases/KVMap.md)

Additional metadata associated with the example.

### sourceRunId?

> `optional` **sourceRunId**: `string`

The ID of the source run associated with this example.

### split?

> `optional` **split**: `string` \| `string`[]

The split(s) to assign the example to.

## Defined in

[src/client.ts:256](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L256)
