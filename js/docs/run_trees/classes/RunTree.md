[**langsmith**](../../README.md) • **Docs**

***

[langsmith](../../README.md) / [run\_trees](../README.md) / RunTree

# Class: RunTree

A run can represent either a trace (root run)
or a child run (~span).

## Implements

- [`BaseRun`](../../schemas/interfaces/BaseRun.md)

## Constructors

### new RunTree()

> **new RunTree**(`originalConfig`): [`RunTree`](RunTree.md)

#### Parameters

• **originalConfig**: [`RunTreeConfig`](../interfaces/RunTreeConfig.md)

#### Returns

[`RunTree`](RunTree.md)

#### Defined in

[src/run\_trees.ts:175](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L175)

## Properties

### child\_execution\_order

> **child\_execution\_order**: `number`

#### Defined in

[src/run\_trees.ts:173](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L173)

***

### child\_runs

> **child\_runs**: [`RunTree`](RunTree.md)[]

#### Defined in

[src/run\_trees.ts:156](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L156)

***

### client

> **client**: [`Client`](../../client/classes/Client.md)

#### Defined in

[src/run\_trees.ts:166](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L166)

***

### dotted\_order

> **dotted\_order**: `string`

The dotted order for the run.

This is a string composed of {time}{run-uuid}.* so that a trace can be
sorted in the order it was executed.

Example:
- Parent: 20230914T223155647Z1b64098b-4ab7-43f6-afee-992304f198d8
- Children:
   - 20230914T223155647Z1b64098b-4ab7-43f6-afee-992304f198d8.20230914T223155649Z809ed3a2-0172-4f4d-8a02-a64e9b7a0f8a
  - 20230915T223155647Z1b64098b-4ab7-43f6-afee-992304f198d8.20230914T223155650Zc8d9f4c5-6c5a-4b2d-9b1c-3d9d7a7c5c7c

#### Implementation of

[`BaseRun`](../../schemas/interfaces/BaseRun.md).[`dotted_order`](../../schemas/interfaces/BaseRun.md#dotted_order)

#### Defined in

[src/run\_trees.ts:169](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L169)

***

### end\_time?

> `optional` **end\_time**: `number`

The epoch time at which the run ended, if applicable.

#### Implementation of

[`BaseRun`](../../schemas/interfaces/BaseRun.md).[`end_time`](../../schemas/interfaces/BaseRun.md#end_time)

#### Defined in

[src/run\_trees.ts:158](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L158)

***

### error?

> `optional` **error**: `string`

Error message, captured if the run faces any issues.

#### Implementation of

[`BaseRun`](../../schemas/interfaces/BaseRun.md).[`error`](../../schemas/interfaces/BaseRun.md#error)

#### Defined in

[src/run\_trees.ts:161](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L161)

***

### events?

> `optional` **events**: [`KVMap`](../../schemas/type-aliases/KVMap.md)[]

Events like 'start', 'end' linked to the run.

#### Implementation of

[`BaseRun`](../../schemas/interfaces/BaseRun.md).[`events`](../../schemas/interfaces/BaseRun.md#events)

#### Defined in

[src/run\_trees.ts:167](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L167)

***

### execution\_order

> **execution\_order**: `number`

#### Defined in

[src/run\_trees.ts:172](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L172)

***

### extra

> **extra**: [`KVMap`](../../schemas/type-aliases/KVMap.md)

Any additional metadata or settings for the run.

#### Implementation of

[`BaseRun`](../../schemas/interfaces/BaseRun.md).[`extra`](../../schemas/interfaces/BaseRun.md#extra)

#### Defined in

[src/run\_trees.ts:159](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L159)

***

### id

> **id**: `string`

Optionally, a unique identifier for the run.

#### Implementation of

[`BaseRun`](../../schemas/interfaces/BaseRun.md).[`id`](../../schemas/interfaces/BaseRun.md#id)

#### Defined in

[src/run\_trees.ts:151](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L151)

***

### inputs

> **inputs**: [`KVMap`](../../schemas/type-aliases/KVMap.md)

Inputs that were used to initiate the run.

#### Implementation of

[`BaseRun`](../../schemas/interfaces/BaseRun.md).[`inputs`](../../schemas/interfaces/BaseRun.md#inputs)

#### Defined in

[src/run\_trees.ts:163](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L163)

***

### name

> **name**: `string`

A human-readable name for the run.

#### Implementation of

[`BaseRun`](../../schemas/interfaces/BaseRun.md).[`name`](../../schemas/interfaces/BaseRun.md#name)

#### Defined in

[src/run\_trees.ts:152](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L152)

***

### outputs?

> `optional` **outputs**: [`KVMap`](../../schemas/type-aliases/KVMap.md)

Outputs produced by the run, if any.

#### Implementation of

[`BaseRun`](../../schemas/interfaces/BaseRun.md).[`outputs`](../../schemas/interfaces/BaseRun.md#outputs)

#### Defined in

[src/run\_trees.ts:164](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L164)

***

### parent\_run?

> `optional` **parent\_run**: [`RunTree`](RunTree.md)

#### Defined in

[src/run\_trees.ts:155](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L155)

***

### project\_name

> **project\_name**: `string`

#### Defined in

[src/run\_trees.ts:154](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L154)

***

### reference\_example\_id?

> `optional` **reference\_example\_id**: `string`

ID of an example that might be related to this run.

#### Implementation of

[`BaseRun`](../../schemas/interfaces/BaseRun.md).[`reference_example_id`](../../schemas/interfaces/BaseRun.md#reference_example_id)

#### Defined in

[src/run\_trees.ts:165](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L165)

***

### run\_type

> **run\_type**: `string`

Specifies the type of run (tool, chain, llm, etc.).

#### Implementation of

[`BaseRun`](../../schemas/interfaces/BaseRun.md).[`run_type`](../../schemas/interfaces/BaseRun.md#run_type)

#### Defined in

[src/run\_trees.ts:153](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L153)

***

### serialized

> **serialized**: `object`

Serialized state of the run for potential future use.

#### Implementation of

[`BaseRun`](../../schemas/interfaces/BaseRun.md).[`serialized`](../../schemas/interfaces/BaseRun.md#serialized)

#### Defined in

[src/run\_trees.ts:162](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L162)

***

### start\_time

> **start\_time**: `number`

The epoch time at which the run started, if available.

#### Implementation of

[`BaseRun`](../../schemas/interfaces/BaseRun.md).[`start_time`](../../schemas/interfaces/BaseRun.md#start_time)

#### Defined in

[src/run\_trees.ts:157](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L157)

***

### tags?

> `optional` **tags**: `string`[]

Tags for further categorizing or annotating the run.

#### Implementation of

[`BaseRun`](../../schemas/interfaces/BaseRun.md).[`tags`](../../schemas/interfaces/BaseRun.md#tags)

#### Defined in

[src/run\_trees.ts:160](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L160)

***

### trace\_id

> **trace\_id**: `string`

Unique ID assigned to every run within this nested trace. *

#### Implementation of

[`BaseRun`](../../schemas/interfaces/BaseRun.md).[`trace_id`](../../schemas/interfaces/BaseRun.md#trace_id)

#### Defined in

[src/run\_trees.ts:168](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L168)

***

### tracingEnabled?

> `optional` **tracingEnabled**: `boolean`

#### Defined in

[src/run\_trees.ts:171](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L171)

## Methods

### createChild()

> **createChild**(`config`): [`RunTree`](RunTree.md)

#### Parameters

• **config**: [`RunTreeConfig`](../interfaces/RunTreeConfig.md)

#### Returns

[`RunTree`](RunTree.md)

#### Defined in

[src/run\_trees.ts:238](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L238)

***

### end()

> **end**(`outputs`?, `error`?, `endTime`?): `Promise`\<`void`\>

#### Parameters

• **outputs?**: [`KVMap`](../../schemas/type-aliases/KVMap.md)

• **error?**: `string`

• **endTime?**: `number` = `...`

#### Returns

`Promise`\<`void`\>

#### Defined in

[src/run\_trees.ts:298](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L298)

***

### patchRun()

> **patchRun**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Defined in

[src/run\_trees.ts:377](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L377)

***

### postRun()

> **postRun**(`excludeChildRuns`): `Promise`\<`void`\>

#### Parameters

• **excludeChildRuns**: `boolean` = `true`

#### Returns

`Promise`\<`void`\>

#### Defined in

[src/run\_trees.ts:358](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L358)

***

### toHeaders()

> **toHeaders**(`headers`?): `object`

#### Parameters

• **headers?**: `HeadersLike`

#### Returns

`object`

##### baggage

> **baggage**: `string`

##### langsmith-trace

> **langsmith-trace**: `string`

#### Defined in

[src/run\_trees.ts:506](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L506)

***

### toJSON()

> **toJSON**(): [`RunCreate`](../../schemas/interfaces/RunCreate.md)

#### Returns

[`RunCreate`](../../schemas/interfaces/RunCreate.md)

#### Defined in

[src/run\_trees.ts:399](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L399)

***

### fromDottedOrder()

> `static` **fromDottedOrder**(`dottedOrder`): `undefined` \| [`RunTree`](RunTree.md)

#### Parameters

• **dottedOrder**: `string`

#### Returns

`undefined` \| [`RunTree`](RunTree.md)

#### Defined in

[src/run\_trees.ts:460](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L460)

***

### fromHeaders()

> `static` **fromHeaders**(`headers`, `inheritArgs`?): `undefined` \| [`RunTree`](RunTree.md)

#### Parameters

• **headers**: `HeadersLike` \| `Record`\<`string`, `string` \| `string`[]\>

• **inheritArgs?**: [`RunTreeConfig`](../interfaces/RunTreeConfig.md)

#### Returns

`undefined` \| [`RunTree`](RunTree.md)

#### Defined in

[src/run\_trees.ts:464](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L464)

***

### fromRunnableConfig()

> `static` **fromRunnableConfig**(`parentConfig`, `props`): [`RunTree`](RunTree.md)

#### Parameters

• **parentConfig**: [`RunnableConfigLike`](../interfaces/RunnableConfigLike.md)

• **props**: [`RunTreeConfig`](../interfaces/RunTreeConfig.md)

#### Returns

[`RunTree`](RunTree.md)

#### Defined in

[src/run\_trees.ts:403](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/run_trees.ts#L403)
