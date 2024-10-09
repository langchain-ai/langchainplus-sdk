[**langsmith**](../../README.md) • **Docs**

***

[langsmith](../../README.md) / [schemas](../README.md) / FeedbackConfig

# Interface: FeedbackConfig

Represents the configuration for feedback.
This determines how the LangSmith service interprets feedback
values of the associated key.

## Properties

### categories?

> `optional` **categories**: `null` \| [`FeedbackCategory`](FeedbackCategory.md)[]

The categories for categorical feedback.
Each category can be a string or an object with additional properties.

If feedback is categorical, this defines the valid categories the server will accept.
Not applicable to continuous or freeform feedback types.

#### Defined in

[src/schemas.ts:370](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L370)

***

### max?

> `optional` **max**: `null` \| `number`

The maximum value for continuous feedback.

#### Defined in

[src/schemas.ts:361](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L361)

***

### min?

> `optional` **min**: `null` \| `number`

The minimum value for continuous feedback.

#### Defined in

[src/schemas.ts:356](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L356)

***

### type

> **type**: `"continuous"` \| `"categorical"` \| `"freeform"`

The type of feedback.
- "continuous": Feedback with a continuous numeric.
- "categorical": Feedback with a categorical value (classes)
- "freeform": Feedback with a freeform text value (notes).

#### Defined in

[src/schemas.ts:351](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/schemas.ts#L351)
