[**langsmith**](../../README.md) • **Docs**

***

[langsmith](../../README.md) / [evaluation](../README.md) / RunEvaluator

# Interface: RunEvaluator

## Methods

### evaluateRun()

> **evaluateRun**(`run`, `example`?, `options`?): `Promise`\<[`EvaluationResult`](../type-aliases/EvaluationResult.md) \| `EvaluationResults`\>

#### Parameters

• **run**: [`Run`](../../schemas/interfaces/Run.md)

• **example?**: [`Example`](../../schemas/interfaces/Example.md)

• **options?**: `Partial`\<[`RunTreeConfig`](../../run_trees/interfaces/RunTreeConfig.md)\>

#### Returns

`Promise`\<[`EvaluationResult`](../type-aliases/EvaluationResult.md) \| `EvaluationResults`\>

#### Defined in

[src/evaluation/evaluator.ts:86](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/evaluation/evaluator.ts#L86)
