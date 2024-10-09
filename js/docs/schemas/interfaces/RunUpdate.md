[**langsmith**](../../README.md) • **Docs**

***

[langsmith](../../README.md) / [schemas](../README.md) / RunUpdate

# Interface: RunUpdate

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

[src/schemas.ts:227](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L227)

***

### end\_time?

> `optional` **end\_time**: `number`

#### Defined in

[src/schemas.ts:202](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L202)

***

### error?

> `optional` **error**: `string`

#### Defined in

[src/schemas.ts:205](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L205)

***

### events?

> `optional` **events**: [`KVMap`](../type-aliases/KVMap.md)[]

#### Defined in

[src/schemas.ts:210](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L210)

***

### extra?

> `optional` **extra**: [`KVMap`](../type-aliases/KVMap.md)

#### Defined in

[src/schemas.ts:203](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L203)

***

### id?

> `optional` **id**: `string`

#### Defined in

[src/schemas.ts:201](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L201)

***

### inputs?

> `optional` **inputs**: [`KVMap`](../type-aliases/KVMap.md)

#### Defined in

[src/schemas.ts:206](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L206)

***

### outputs?

> `optional` **outputs**: [`KVMap`](../type-aliases/KVMap.md)

#### Defined in

[src/schemas.ts:207](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L207)

***

### parent\_run\_id?

> `optional` **parent\_run\_id**: `string`

#### Defined in

[src/schemas.ts:208](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L208)

***

### reference\_example\_id?

> `optional` **reference\_example\_id**: `string`

#### Defined in

[src/schemas.ts:209](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L209)

***

### session\_id?

> `optional` **session\_id**: `string`

#### Defined in

[src/schemas.ts:211](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L211)

***

### tags?

> `optional` **tags**: `string`[]

#### Defined in

[src/schemas.ts:204](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L204)

***

### trace\_id?

> `optional` **trace\_id**: `string`

Unique ID assigned to every run within this nested trace. *

#### Defined in

[src/schemas.ts:213](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L213)
