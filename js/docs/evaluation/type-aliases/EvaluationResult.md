[**langsmith**](../../README.md) • **Docs**

***

[langsmith](../../README.md) / [evaluation](../README.md) / EvaluationResult

# Type Alias: EvaluationResult

> **EvaluationResult**: `object`

Represents the result of an evaluation.

## Type declaration

### comment?

> `optional` **comment**: `string`

A comment associated with the evaluation result.

### correction?

> `optional` **correction**: `Record`\<`string`, `unknown`\>

A correction record associated with the evaluation result.

### evaluatorInfo?

> `optional` **evaluatorInfo**: `Record`\<`string`, `unknown`\>

Information about the evaluator.

### feedbackConfig?

> `optional` **feedbackConfig**: [`FeedbackConfig`](../../schemas/interfaces/FeedbackConfig.md)

The feedback config associated with the evaluation result.
If set, this will be used to define how a feedback key
should be interpreted.

### key

> **key**: `string`

The key associated with the evaluation result.

### score?

> `optional` **score**: [`ScoreType`](../../schemas/type-aliases/ScoreType.md)

The score of the evaluation result.

### sourceRunId?

> `optional` **sourceRunId**: `string`

The source run ID of the evaluation result.
If set, a link to the source run will be available in the UI.

### targetRunId?

> `optional` **targetRunId**: `string`

The target run ID of the evaluation result.
If this is not set, the target run ID is assumed to be
the root of the trace.

### value?

> `optional` **value**: [`ValueType`](../../schemas/type-aliases/ValueType.md)

The value of the evaluation result.

## Defined in

[src/evaluation/evaluator.ts:29](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/evaluation/evaluator.ts#L29)
