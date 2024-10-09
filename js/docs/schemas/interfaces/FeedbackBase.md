[**langsmith**](../../README.md) • **Docs**

***

[langsmith](../../README.md) / [schemas](../README.md) / FeedbackBase

# Interface: FeedbackBase

## Extended by

- [`FeedbackCreate`](FeedbackCreate.md)
- [`Feedback`](Feedback.md)

## Properties

### comment

> **comment**: `null` \| `string`

#### Defined in

[src/schemas.ts:303](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L303)

***

### correction

> **correction**: `null` \| `string` \| `object`

#### Defined in

[src/schemas.ts:304](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L304)

***

### created\_at

> **created\_at**: `string`

#### Defined in

[src/schemas.ts:297](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L297)

***

### feedback\_source

> **feedback\_source**: `null` \| [`KVMap`](../type-aliases/KVMap.md) \| [`APIFeedbackSource`](APIFeedbackSource.md) \| [`ModelFeedbackSource`](ModelFeedbackSource.md)

#### Defined in

[src/schemas.ts:305](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L305)

***

### key

> **key**: `string`

#### Defined in

[src/schemas.ts:300](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L300)

***

### modified\_at

> **modified\_at**: `string`

#### Defined in

[src/schemas.ts:298](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L298)

***

### run\_id

> **run\_id**: `string`

#### Defined in

[src/schemas.ts:299](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L299)

***

### score

> **score**: [`ScoreType`](../type-aliases/ScoreType.md)

#### Defined in

[src/schemas.ts:301](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L301)

***

### value

> **value**: [`ValueType`](../type-aliases/ValueType.md)

#### Defined in

[src/schemas.ts:302](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L302)
