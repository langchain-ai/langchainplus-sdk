[**langsmith**](../../README.md) • **Docs**

***

[langsmith](../../README.md) / [client](../README.md) / ClientConfig

# Interface: ClientConfig

## Properties

### anonymizer()?

> `optional` **anonymizer**: (`values`) => [`KVMap`](../../schemas/type-aliases/KVMap.md)

#### Parameters

• **values**: [`KVMap`](../../schemas/type-aliases/KVMap.md)

#### Returns

[`KVMap`](../../schemas/type-aliases/KVMap.md)

#### Defined in

[src/client.ts:71](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L71)

***

### apiKey?

> `optional` **apiKey**: `string`

#### Defined in

[src/client.ts:67](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L67)

***

### apiUrl?

> `optional` **apiUrl**: `string`

#### Defined in

[src/client.ts:66](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L66)

***

### autoBatchTracing?

> `optional` **autoBatchTracing**: `boolean`

#### Defined in

[src/client.ts:74](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L74)

***

### callerOptions?

> `optional` **callerOptions**: `AsyncCallerParams`

#### Defined in

[src/client.ts:68](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L68)

***

### fetchOptions?

> `optional` **fetchOptions**: `RequestInit`

#### Defined in

[src/client.ts:76](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L76)

***

### hideInputs?

> `optional` **hideInputs**: `boolean` \| (`inputs`) => [`KVMap`](../../schemas/type-aliases/KVMap.md)

#### Defined in

[src/client.ts:72](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L72)

***

### hideOutputs?

> `optional` **hideOutputs**: `boolean` \| (`outputs`) => [`KVMap`](../../schemas/type-aliases/KVMap.md)

#### Defined in

[src/client.ts:73](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L73)

***

### pendingAutoBatchedRunLimit?

> `optional` **pendingAutoBatchedRunLimit**: `number`

#### Defined in

[src/client.ts:75](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L75)

***

### timeout\_ms?

> `optional` **timeout\_ms**: `number`

#### Defined in

[src/client.ts:69](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L69)

***

### webUrl?

> `optional` **webUrl**: `string`

#### Defined in

[src/client.ts:70](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L70)
