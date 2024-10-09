[**langsmith**](../../README.md) • **Docs**

***

[langsmith](../../README.md) / [schemas](../README.md) / Example

# Interface: Example

## Extends

- [`BaseExample`](BaseExample.md)

## Properties

### created\_at

> **created\_at**: `string`

#### Defined in

[src/schemas.ts:238](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L238)

***

### dataset\_id

> **dataset\_id**: `string`

#### Inherited from

[`BaseExample`](BaseExample.md).[`dataset_id`](BaseExample.md#dataset_id)

#### Defined in

[src/schemas.ts:59](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L59)

***

### id

> **id**: `string`

#### Defined in

[src/schemas.ts:237](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L237)

***

### inputs

> **inputs**: [`KVMap`](../type-aliases/KVMap.md)

#### Inherited from

[`BaseExample`](BaseExample.md).[`inputs`](BaseExample.md#inputs)

#### Defined in

[src/schemas.ts:60](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L60)

***

### metadata?

> `optional` **metadata**: [`KVMap`](../type-aliases/KVMap.md)

#### Inherited from

[`BaseExample`](BaseExample.md).[`metadata`](BaseExample.md#metadata)

#### Defined in

[src/schemas.ts:62](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L62)

***

### modified\_at

> **modified\_at**: `string`

#### Defined in

[src/schemas.ts:239](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L239)

***

### outputs?

> `optional` **outputs**: [`KVMap`](../type-aliases/KVMap.md)

#### Inherited from

[`BaseExample`](BaseExample.md).[`outputs`](BaseExample.md#outputs)

#### Defined in

[src/schemas.ts:61](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L61)

***

### runs

> **runs**: [`Run`](Run.md)[]

#### Defined in

[src/schemas.ts:241](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L241)

***

### source\_run\_id?

> `optional` **source\_run\_id**: `string`

#### Overrides

[`BaseExample`](BaseExample.md).[`source_run_id`](BaseExample.md#source_run_id)

#### Defined in

[src/schemas.ts:240](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L240)
