[**langsmith**](../../README.md) • **Docs**

***

[langsmith](../../README.md) / [schemas](../README.md) / FeedbackCreate

# Interface: FeedbackCreate

## Extends

- [`FeedbackBase`](FeedbackBase.md)

## Properties

### comment

> **comment**: `null` \| `string`

#### Inherited from

[`FeedbackBase`](FeedbackBase.md).[`comment`](FeedbackBase.md#comment)

#### Defined in

[src/schemas.ts:303](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L303)

***

### correction

> **correction**: `null` \| `string` \| `object`

#### Inherited from

[`FeedbackBase`](FeedbackBase.md).[`correction`](FeedbackBase.md#correction)

#### Defined in

[src/schemas.ts:304](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L304)

***

### created\_at

> **created\_at**: `string`

#### Inherited from

[`FeedbackBase`](FeedbackBase.md).[`created_at`](FeedbackBase.md#created_at)

#### Defined in

[src/schemas.ts:297](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L297)

***

### feedback\_source

> **feedback\_source**: `null` \| [`KVMap`](../type-aliases/KVMap.md) \| [`APIFeedbackSource`](APIFeedbackSource.md) \| [`ModelFeedbackSource`](ModelFeedbackSource.md)

#### Inherited from

[`FeedbackBase`](FeedbackBase.md).[`feedback_source`](FeedbackBase.md#feedback_source)

#### Defined in

[src/schemas.ts:305](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L305)

***

### id

> **id**: `string`

#### Defined in

[src/schemas.ts:309](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L309)

***

### key

> **key**: `string`

#### Inherited from

[`FeedbackBase`](FeedbackBase.md).[`key`](FeedbackBase.md#key)

#### Defined in

[src/schemas.ts:300](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L300)

***

### modified\_at

> **modified\_at**: `string`

#### Inherited from

[`FeedbackBase`](FeedbackBase.md).[`modified_at`](FeedbackBase.md#modified_at)

#### Defined in

[src/schemas.ts:298](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L298)

***

### run\_id

> **run\_id**: `string`

#### Inherited from

[`FeedbackBase`](FeedbackBase.md).[`run_id`](FeedbackBase.md#run_id)

#### Defined in

[src/schemas.ts:299](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L299)

***

### score

> **score**: [`ScoreType`](../type-aliases/ScoreType.md)

#### Inherited from

[`FeedbackBase`](FeedbackBase.md).[`score`](FeedbackBase.md#score)

#### Defined in

[src/schemas.ts:301](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L301)

***

### value

> **value**: [`ValueType`](../type-aliases/ValueType.md)

#### Inherited from

[`FeedbackBase`](FeedbackBase.md).[`value`](FeedbackBase.md#value)

#### Defined in

[src/schemas.ts:302](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L302)
