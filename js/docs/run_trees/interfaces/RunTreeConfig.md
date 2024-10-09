[**langsmith**](../../README.md) • **Docs**

***

[langsmith](../../README.md) / [run\_trees](../README.md) / RunTreeConfig

# Interface: RunTreeConfig

## Properties

### child\_execution\_order?

> `optional` **child\_execution\_order**: `number`

#### Defined in

[src/run\_trees.ts:53](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L53)

***

### child\_runs?

> `optional` **child\_runs**: [`RunTree`](../classes/RunTree.md)[]

#### Defined in

[src/run\_trees.ts:38](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L38)

***

### client?

> `optional` **client**: [`Client`](../../client/classes/Client.md)

#### Defined in

[src/run\_trees.ts:49](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L49)

***

### dotted\_order?

> `optional` **dotted\_order**: `string`

#### Defined in

[src/run\_trees.ts:56](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L56)

***

### end\_time?

> `optional` **end\_time**: `number`

#### Defined in

[src/run\_trees.ts:40](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L40)

***

### error?

> `optional` **error**: `string`

#### Defined in

[src/run\_trees.ts:44](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L44)

***

### execution\_order?

> `optional` **execution\_order**: `number`

#### Defined in

[src/run\_trees.ts:52](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L52)

***

### extra?

> `optional` **extra**: [`KVMap`](../../schemas/type-aliases/KVMap.md)

#### Defined in

[src/run\_trees.ts:41](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L41)

***

### id?

> `optional` **id**: `string`

#### Defined in

[src/run\_trees.ts:34](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L34)

***

### inputs?

> `optional` **inputs**: [`KVMap`](../../schemas/type-aliases/KVMap.md)

#### Defined in

[src/run\_trees.ts:46](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L46)

***

### metadata?

> `optional` **metadata**: [`KVMap`](../../schemas/type-aliases/KVMap.md)

#### Defined in

[src/run\_trees.ts:42](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L42)

***

### name

> **name**: `string`

#### Defined in

[src/run\_trees.ts:32](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L32)

***

### on\_end()?

> `optional` **on\_end**: (`runTree`) => `void`

#### Parameters

• **runTree**: [`RunTree`](../classes/RunTree.md)

#### Returns

`void`

#### Defined in

[src/run\_trees.ts:51](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L51)

***

### outputs?

> `optional` **outputs**: [`KVMap`](../../schemas/type-aliases/KVMap.md)

#### Defined in

[src/run\_trees.ts:47](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L47)

***

### parent\_run?

> `optional` **parent\_run**: [`RunTree`](../classes/RunTree.md)

#### Defined in

[src/run\_trees.ts:36](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L36)

***

### parent\_run\_id?

> `optional` **parent\_run\_id**: `string`

#### Defined in

[src/run\_trees.ts:37](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L37)

***

### project\_name?

> `optional` **project\_name**: `string`

#### Defined in

[src/run\_trees.ts:35](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L35)

***

### reference\_example\_id?

> `optional` **reference\_example\_id**: `string`

#### Defined in

[src/run\_trees.ts:48](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L48)

***

### run\_type?

> `optional` **run\_type**: `string`

#### Defined in

[src/run\_trees.ts:33](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L33)

***

### serialized?

> `optional` **serialized**: `object`

#### Defined in

[src/run\_trees.ts:45](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L45)

***

### start\_time?

> `optional` **start\_time**: `number`

#### Defined in

[src/run\_trees.ts:39](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L39)

***

### tags?

> `optional` **tags**: `string`[]

#### Defined in

[src/run\_trees.ts:43](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L43)

***

### trace\_id?

> `optional` **trace\_id**: `string`

#### Defined in

[src/run\_trees.ts:55](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L55)

***

### tracingEnabled?

> `optional` **tracingEnabled**: `boolean`

#### Defined in

[src/run\_trees.ts:50](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L50)
