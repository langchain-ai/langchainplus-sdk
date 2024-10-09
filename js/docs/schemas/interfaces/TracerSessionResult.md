[**langsmith**](../../README.md) • **Docs**

***

[langsmith](../../README.md) / [schemas](../README.md) / TracerSessionResult

# Interface: TracerSessionResult

## Extends

- [`TracerSession`](TracerSession.md)

## Properties

### completion\_tokens?

> `optional` **completion\_tokens**: `number`

#### Defined in

[src/schemas.ts:34](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L34)

***

### description?

> `optional` **description**: `string`

#### Inherited from

[`TracerSession`](TracerSession.md).[`description`](TracerSession.md#description)

#### Defined in

[src/schemas.ts:11](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L11)

***

### end\_time?

> `optional` **end\_time**: `number`

#### Inherited from

[`TracerSession`](TracerSession.md).[`end_time`](TracerSession.md#end_time)

#### Defined in

[src/schemas.ts:9](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L9)

***

### extra?

> `optional` **extra**: [`KVMap`](../type-aliases/KVMap.md)

Extra metadata for the project.

#### Inherited from

[`TracerSession`](TracerSession.md).[`extra`](TracerSession.md#extra)

#### Defined in

[src/schemas.ts:15](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L15)

***

### feedback\_stats?

> `optional` **feedback\_stats**: `Record`\<`string`, `unknown`\>

#### Defined in

[src/schemas.ts:38](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L38)

***

### id

> **id**: `string`

#### Inherited from

[`TracerSession`](TracerSession.md).[`id`](TracerSession.md#id)

#### Defined in

[src/schemas.ts:5](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L5)

***

### last\_run\_start\_time?

> `optional` **last\_run\_start\_time**: `number`

#### Defined in

[src/schemas.ts:36](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L36)

***

### latency\_p50?

> `optional` **latency\_p50**: `number`

#### Defined in

[src/schemas.ts:26](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L26)

***

### latency\_p99?

> `optional` **latency\_p99**: `number`

#### Defined in

[src/schemas.ts:28](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L28)

***

### name?

> `optional` **name**: `string`

#### Inherited from

[`TracerSession`](TracerSession.md).[`name`](TracerSession.md#name)

#### Defined in

[src/schemas.ts:13](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L13)

***

### prompt\_tokens?

> `optional` **prompt\_tokens**: `number`

#### Defined in

[src/schemas.ts:32](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L32)

***

### reference\_dataset\_id?

> `optional` **reference\_dataset\_id**: `string`

#### Inherited from

[`TracerSession`](TracerSession.md).[`reference_dataset_id`](TracerSession.md#reference_dataset_id)

#### Defined in

[src/schemas.ts:17](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L17)

***

### run\_count?

> `optional` **run\_count**: `number`

#### Defined in

[src/schemas.ts:24](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L24)

***

### run\_facets?

> `optional` **run\_facets**: [`KVMap`](../type-aliases/KVMap.md)[]

#### Defined in

[src/schemas.ts:40](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L40)

***

### start\_time

> **start\_time**: `number`

#### Inherited from

[`TracerSession`](TracerSession.md).[`start_time`](TracerSession.md#start_time)

#### Defined in

[src/schemas.ts:7](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L7)

***

### tenant\_id

> **tenant\_id**: `string`

#### Inherited from

[`TracerSession`](TracerSession.md).[`tenant_id`](TracerSession.md#tenant_id)

#### Defined in

[src/schemas.ts:3](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L3)

***

### total\_tokens?

> `optional` **total\_tokens**: `number`

#### Defined in

[src/schemas.ts:30](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L30)
