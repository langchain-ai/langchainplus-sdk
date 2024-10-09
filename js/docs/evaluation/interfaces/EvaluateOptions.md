[**langsmith**](../../README.md) • **Docs**

***

[langsmith](../../README.md) / [evaluation](../README.md) / EvaluateOptions

# Interface: EvaluateOptions

## Properties

### client?

> `optional` **client**: [`Client`](../../client/classes/Client.md)

The LangSmith client to use.

#### Default

```ts
undefined
```

#### Defined in

[src/evaluation/\_runner.ts:112](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/evaluation/_runner.ts#L112)

***

### data

> **data**: `DataT`

The dataset to evaluate on. Can be a dataset name, a list of
examples, or a generator of examples.

#### Defined in

[src/evaluation/\_runner.ts:78](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/evaluation/_runner.ts#L78)

***

### description?

> `optional` **description**: `string`

A free-form description of the experiment.

#### Defined in

[src/evaluation/\_runner.ts:102](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/evaluation/_runner.ts#L102)

***

### evaluators?

> `optional` **evaluators**: `EvaluatorT`[]

A list of evaluators to run on each example.

#### Default

```ts
undefined
```

#### Defined in

[src/evaluation/\_runner.ts:83](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/evaluation/_runner.ts#L83)

***

### experimentPrefix?

> `optional` **experimentPrefix**: `string`

A prefix to provide for your experiment name.

#### Default

```ts
undefined
```

#### Defined in

[src/evaluation/\_runner.ts:98](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/evaluation/_runner.ts#L98)

***

### maxConcurrency?

> `optional` **maxConcurrency**: `number`

The maximum number of concurrent evaluations to run.

#### Default

```ts
undefined
```

#### Defined in

[src/evaluation/\_runner.ts:107](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/evaluation/_runner.ts#L107)

***

### metadata?

> `optional` **metadata**: [`KVMap`](../../schemas/type-aliases/KVMap.md)

Metadata to attach to the experiment.

#### Default

```ts
undefined
```

#### Defined in

[src/evaluation/\_runner.ts:93](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/evaluation/_runner.ts#L93)

***

### numRepetitions?

> `optional` **numRepetitions**: `number`

The number of repetitions to perform. Each example
will be run this many times.

#### Default

```ts
1
```

#### Defined in

[src/evaluation/\_runner.ts:118](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/evaluation/_runner.ts#L118)

***

### summaryEvaluators?

> `optional` **summaryEvaluators**: `SummaryEvaluatorT`[]

A list of summary evaluators to run on the entire dataset.

#### Default

```ts
undefined
```

#### Defined in

[src/evaluation/\_runner.ts:88](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/evaluation/_runner.ts#L88)
