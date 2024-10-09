[**langsmith**](../../README.md) • **Docs**

***

[langsmith](../../README.md) / [evaluation](../README.md) / StringEvaluator

# Class: StringEvaluator

## Implements

- [`RunEvaluator`](../interfaces/RunEvaluator.md)

## Constructors

### new StringEvaluator()

> **new StringEvaluator**(`params`): [`StringEvaluator`](StringEvaluator.md)

#### Parameters

• **params**: `StringEvaluatorParams`

#### Returns

[`StringEvaluator`](StringEvaluator.md)

#### Defined in

[src/evaluation/string\_evaluator.ts:37](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/evaluation/string_evaluator.ts#L37)

## Methods

### evaluateRun()

> **evaluateRun**(`run`, `example`?): `Promise`\<[`EvaluationResult`](../type-aliases/EvaluationResult.md)\>

#### Parameters

• **run**: [`Run`](../../schemas/interfaces/Run.md)

• **example?**: [`Example`](../../schemas/interfaces/Example.md)

#### Returns

`Promise`\<[`EvaluationResult`](../type-aliases/EvaluationResult.md)\>

#### Implementation of

[`RunEvaluator`](../interfaces/RunEvaluator.md).[`evaluateRun`](../interfaces/RunEvaluator.md#evaluaterun)

#### Defined in

[src/evaluation/string\_evaluator.ts:46](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/evaluation/string_evaluator.ts#L46)
