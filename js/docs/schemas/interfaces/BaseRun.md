[**langsmith**](../../README.md) • **Docs**

***

[langsmith](../../README.md) / [schemas](../README.md) / BaseRun

# Interface: BaseRun

A run can represent either a trace (root run)
or a child run (~span).

## Extended by

- [`Run`](Run.md)
- [`RunCreate`](RunCreate.md)
- [`RunWithAnnotationQueueInfo`](RunWithAnnotationQueueInfo.md)

## Properties

### dotted\_order?

> `optional` **dotted\_order**: `string`

The dotted order for the run.

This is a string composed of {time}{run-uuid}.* so that a trace can be
sorted in the order it was executed.

Example:
- Parent: 20230914T223155647Z1b64098b-4ab7-43f6-afee-992304f198d8
- Children:
   - 20230914T223155647Z1b64098b-4ab7-43f6-afee-992304f198d8.20230914T223155649Z809ed3a2-0172-4f4d-8a02-a64e9b7a0f8a
  - 20230915T223155647Z1b64098b-4ab7-43f6-afee-992304f198d8.20230914T223155650Zc8d9f4c5-6c5a-4b2d-9b1c-3d9d7a7c5c7c

#### Defined in

[src/schemas.ts:128](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L128)

***

### end\_time?

> `optional` **end\_time**: `number`

The epoch time at which the run ended, if applicable.

#### Defined in

[src/schemas.ts:84](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L84)

***

### error?

> `optional` **error**: `string`

Error message, captured if the run faces any issues.

#### Defined in

[src/schemas.ts:90](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L90)

***

### events?

> `optional` **events**: [`KVMap`](../type-aliases/KVMap.md)[]

Events like 'start', 'end' linked to the run.

#### Defined in

[src/schemas.ts:96](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L96)

***

### extra?

> `optional` **extra**: [`KVMap`](../type-aliases/KVMap.md)

Any additional metadata or settings for the run.

#### Defined in

[src/schemas.ts:87](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L87)

***

### id?

> `optional` **id**: `string`

Optionally, a unique identifier for the run.

#### Defined in

[src/schemas.ts:72](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L72)

***

### inputs

> **inputs**: [`KVMap`](../type-aliases/KVMap.md)

Inputs that were used to initiate the run.

#### Defined in

[src/schemas.ts:99](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L99)

***

### name

> **name**: `string`

A human-readable name for the run.

#### Defined in

[src/schemas.ts:75](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L75)

***

### outputs?

> `optional` **outputs**: [`KVMap`](../type-aliases/KVMap.md)

Outputs produced by the run, if any.

#### Defined in

[src/schemas.ts:102](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L102)

***

### parent\_run\_id?

> `optional` **parent\_run\_id**: `string`

ID of a parent run, if this run is part of a larger operation.

#### Defined in

[src/schemas.ts:108](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L108)

***

### reference\_example\_id?

> `optional` **reference\_example\_id**: `string`

ID of an example that might be related to this run.

#### Defined in

[src/schemas.ts:105](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L105)

***

### run\_type

> **run\_type**: `string`

Specifies the type of run (tool, chain, llm, etc.).

#### Defined in

[src/schemas.ts:81](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L81)

***

### serialized?

> `optional` **serialized**: `object`

Serialized state of the run for potential future use.

#### Defined in

[src/schemas.ts:93](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L93)

***

### start\_time?

> `optional` **start\_time**: `number`

The epoch time at which the run started, if available.

#### Defined in

[src/schemas.ts:78](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L78)

***

### tags?

> `optional` **tags**: `string`[]

Tags for further categorizing or annotating the run.

#### Defined in

[src/schemas.ts:111](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L111)

***

### trace\_id?

> `optional` **trace\_id**: `string`

Unique ID assigned to every run within this nested trace. *

#### Defined in

[src/schemas.ts:114](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L114)
