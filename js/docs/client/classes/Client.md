[**langsmith**](../../README.md) • **Docs**

***

[langsmith](../../README.md) / [client](../README.md) / Client

# Class: Client

## Constructors

### new Client()

> **new Client**(`config`): [`Client`](Client.md)

#### Parameters

• **config**: [`ClientConfig`](../interfaces/ClientConfig.md) = `{}`

#### Returns

[`Client`](Client.md)

#### Defined in

[src/client.ts:437](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L437)

## Methods

### \_logEvaluationFeedback()

> **\_logEvaluationFeedback**(`evaluatorResponse`, `run`?, `sourceInfo`?): `Promise`\<[[`EvaluationResult`](../../evaluation/type-aliases/EvaluationResult.md)[], [`Feedback`](../../schemas/interfaces/Feedback.md)[]]\>

#### Parameters

• **evaluatorResponse**: [`EvaluationResult`](../../evaluation/type-aliases/EvaluationResult.md) \| `EvaluationResults`

• **run?**: [`Run`](../../schemas/interfaces/Run.md)

• **sourceInfo?**

#### Returns

`Promise`\<[[`EvaluationResult`](../../evaluation/type-aliases/EvaluationResult.md)[], [`Feedback`](../../schemas/interfaces/Feedback.md)[]]\>

#### Defined in

[src/client.ts:3062](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L3062)

***

### \_selectEvalResults()

> **\_selectEvalResults**(`results`): [`EvaluationResult`](../../evaluation/type-aliases/EvaluationResult.md)[]

#### Parameters

• **results**: [`EvaluationResult`](../../evaluation/type-aliases/EvaluationResult.md) \| `EvaluationResults`

#### Returns

[`EvaluationResult`](../../evaluation/type-aliases/EvaluationResult.md)[]

#### Defined in

[src/client.ts:3050](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L3050)

***

### addRunsToAnnotationQueue()

> **addRunsToAnnotationQueue**(`queueId`, `runIds`): `Promise`\<`void`\>

Add runs to an annotation queue with the specified queue ID.

#### Parameters

• **queueId**: `string`

The ID of the annotation queue

• **runIds**: `string`[]

The IDs of the runs to be added to the annotation queue

#### Returns

`Promise`\<`void`\>

#### Defined in

[src/client.ts:3269](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L3269)

***

### batchIngestRuns()

> **batchIngestRuns**(`runs`): `Promise`\<`void`\>

Batch ingest/upsert multiple runs in the Langsmith system.

#### Parameters

• **runs**

• **runs.runCreates?**: [`RunCreate`](../../schemas/interfaces/RunCreate.md)[]

• **runs.runUpdates?**: [`RunUpdate`](../../schemas/interfaces/RunUpdate.md)[]

#### Returns

`Promise`\<`void`\>

#### Defined in

[src/client.ts:825](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L825)

***

### clonePublicDataset()

> **clonePublicDataset**(`tokenOrUrl`, `options`?): `Promise`\<`void`\>

Clone a public dataset to your own langsmith tenant. 
This operation is idempotent. If you already have a dataset with the given name, 
this function will do nothing.

#### Parameters

• **tokenOrUrl**: `string`

The token of the public dataset to clone.

• **options?** = `{}`

Additional options for cloning the dataset.

• **options.datasetName?**: `string`

The name of the dataset to create in your tenant. Defaults to the name of the public dataset.

• **options.sourceApiUrl?**: `string`

The URL of the langsmith server where the data is hosted. Defaults to the API URL of your current client.

#### Returns

`Promise`\<`void`\>

#### Defined in

[src/client.ts:3799](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L3799)

***

### createAnnotationQueue()

> **createAnnotationQueue**(`options`): `Promise`\<[`AnnotationQueue`](../../schemas/interfaces/AnnotationQueue.md)\>

Create an annotation queue on the LangSmith API.

#### Parameters

• **options**

The options for creating an annotation queue

• **options.description?**: `string`

The description of the annotation queue

• **options.name**: `string`

The name of the annotation queue

• **options.queueId?**: `string`

The ID of the annotation queue

#### Returns

`Promise`\<[`AnnotationQueue`](../../schemas/interfaces/AnnotationQueue.md)\>

The created AnnotationQueue object

#### Defined in

[src/client.ts:3169](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L3169)

***

### createChatExample()

> **createChatExample**(`input`, `generations`, `options`): `Promise`\<[`Example`](../../schemas/interfaces/Example.md)\>

#### Parameters

• **input**: [`KVMap`](../../schemas/type-aliases/KVMap.md)[] \| [`LangChainBaseMessage`](../../schemas/interfaces/LangChainBaseMessage.md)[]

• **generations**: `undefined` \| [`KVMap`](../../schemas/type-aliases/KVMap.md) \| [`LangChainBaseMessage`](../../schemas/interfaces/LangChainBaseMessage.md)

• **options**: [`CreateExampleOptions`](../type-aliases/CreateExampleOptions.md)

#### Returns

`Promise`\<[`Example`](../../schemas/interfaces/Example.md)\>

#### Defined in

[src/client.ts:2440](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L2440)

***

### createCommit()

> **createCommit**(`promptIdentifier`, `object`, `options`?): `Promise`\<`string`\>

#### Parameters

• **promptIdentifier**: `string`

• **object**: `any`

• **options?**

• **options.parentCommitHash?**: `string`

#### Returns

`Promise`\<`string`\>

#### Defined in

[src/client.ts:3552](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L3552)

***

### createComparativeExperiment()

> **createComparativeExperiment**(`__namedParameters`): `Promise`\<[`ComparativeExperiment`](../../schemas/interfaces/ComparativeExperiment.md)\>

#### Parameters

• **\_\_namedParameters**

• **\_\_namedParameters.createdAt?**: `Date`

• **\_\_namedParameters.description?**: `string`

• **\_\_namedParameters.experimentIds**: `string`[]

• **\_\_namedParameters.id?**: `string`

• **\_\_namedParameters.metadata?**: `Record`\<`string`, `unknown`\>

• **\_\_namedParameters.name**: `string`

• **\_\_namedParameters.referenceDatasetId?**: `string`

#### Returns

`Promise`\<[`ComparativeExperiment`](../../schemas/interfaces/ComparativeExperiment.md)\>

#### Defined in

[src/client.ts:2973](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L2973)

***

### createDataset()

> **createDataset**(`name`, `__namedParameters`): `Promise`\<[`Dataset`](../../schemas/interfaces/Dataset.md)\>

#### Parameters

• **name**: `string`

• **\_\_namedParameters** = `{}`

• **\_\_namedParameters.dataType?**: [`DataType`](../../schemas/type-aliases/DataType.md)

• **\_\_namedParameters.description?**: `string`

• **\_\_namedParameters.inputsSchema?**: [`KVMap`](../../schemas/type-aliases/KVMap.md)

• **\_\_namedParameters.metadata?**: `RecordStringAny`

• **\_\_namedParameters.outputsSchema?**: [`KVMap`](../../schemas/type-aliases/KVMap.md)

#### Returns

`Promise`\<[`Dataset`](../../schemas/interfaces/Dataset.md)\>

#### Defined in

[src/client.ts:1946](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L1946)

***

### createExample()

> **createExample**(`inputs`, `outputs`, `__namedParameters`): `Promise`\<[`Example`](../../schemas/interfaces/Example.md)\>

#### Parameters

• **inputs**: [`KVMap`](../../schemas/type-aliases/KVMap.md)

• **outputs**: [`KVMap`](../../schemas/type-aliases/KVMap.md)

• **\_\_namedParameters**: [`CreateExampleOptions`](../type-aliases/CreateExampleOptions.md)

#### Returns

`Promise`\<[`Example`](../../schemas/interfaces/Example.md)\>

#### Defined in

[src/client.ts:2323](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L2323)

***

### createExamples()

> **createExamples**(`props`): `Promise`\<[`Example`](../../schemas/interfaces/Example.md)[]\>

#### Parameters

• **props**

• **props.datasetId?**: `string`

• **props.datasetName?**: `string`

• **props.exampleIds?**: `string`[]

• **props.inputs**: [`KVMap`](../../schemas/type-aliases/KVMap.md)[]

• **props.metadata?**: [`KVMap`](../../schemas/type-aliases/KVMap.md)[]

• **props.outputs?**: [`KVMap`](../../schemas/type-aliases/KVMap.md)[]

• **props.sourceRunIds?**: `string`[]

• **props.splits?**: (`string` \| `string`[])[]

#### Returns

`Promise`\<[`Example`](../../schemas/interfaces/Example.md)[]\>

#### Defined in

[src/client.ts:2375](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L2375)

***

### createFeedback()

> **createFeedback**(`runId`, `key`, `__namedParameters`): `Promise`\<[`Feedback`](../../schemas/interfaces/Feedback.md)\>

#### Parameters

• **runId**: `null` \| `string`

• **key**: `string`

• **\_\_namedParameters**

• **\_\_namedParameters.comment?**: `string`

• **\_\_namedParameters.comparativeExperimentId?**: `string`

• **\_\_namedParameters.correction?**: `object`

• **\_\_namedParameters.eager?**: `boolean`

• **\_\_namedParameters.feedbackConfig?**: [`FeedbackConfig`](../../schemas/interfaces/FeedbackConfig.md)

• **\_\_namedParameters.feedbackId?**: `string`

• **\_\_namedParameters.feedbackSourceType?**: [`FeedbackSourceType`](../type-aliases/FeedbackSourceType.md) = `"api"`

• **\_\_namedParameters.projectId?**: `string`

• **\_\_namedParameters.score?**: [`ScoreType`](../../schemas/type-aliases/ScoreType.md)

• **\_\_namedParameters.sourceInfo?**: `object`

• **\_\_namedParameters.sourceRunId?**: `string`

• **\_\_namedParameters.value?**: [`ValueType`](../../schemas/type-aliases/ValueType.md)

#### Returns

`Promise`\<[`Feedback`](../../schemas/interfaces/Feedback.md)\>

#### Defined in

[src/client.ts:2740](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L2740)

***

### createLLMExample()

> **createLLMExample**(`input`, `generation`, `options`): `Promise`\<[`Example`](../../schemas/interfaces/Example.md)\>

#### Parameters

• **input**: `string`

• **generation**: `undefined` \| `string`

• **options**: [`CreateExampleOptions`](../type-aliases/CreateExampleOptions.md)

#### Returns

`Promise`\<[`Example`](../../schemas/interfaces/Example.md)\>

#### Defined in

[src/client.ts:2432](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L2432)

***

### createPresignedFeedbackToken()

> **createPresignedFeedbackToken**(`runId`, `feedbackKey`, `options`): `Promise`\<[`FeedbackIngestToken`](../../schemas/interfaces/FeedbackIngestToken.md)\>

Creates a presigned feedback token and URL.

The token can be used to authorize feedback metrics without
needing an API key. This is useful for giving browser-based
applications the ability to submit feedback without needing
to expose an API key.

#### Parameters

• **runId**: `string`

The ID of the run.

• **feedbackKey**: `string`

The feedback key.

• **options** = `{}`

Additional options for the token.

• **options.expiration?**: `string` \| [`TimeDelta`](../../schemas/interfaces/TimeDelta.md)

The expiration time for the token.

• **options.feedbackConfig?**: [`FeedbackConfig`](../../schemas/interfaces/FeedbackConfig.md)

#### Returns

`Promise`\<[`FeedbackIngestToken`](../../schemas/interfaces/FeedbackIngestToken.md)\>

A promise that resolves to a FeedbackIngestToken.

#### Defined in

[src/client.ts:2930](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L2930)

***

### createProject()

> **createProject**(`__namedParameters`): `Promise`\<[`TracerSession`](../../schemas/interfaces/TracerSession.md)\>

#### Parameters

• **\_\_namedParameters**

• **\_\_namedParameters.description?**: `null` \| `string` = `null`

• **\_\_namedParameters.metadata?**: `null` \| `RecordStringAny` = `null`

• **\_\_namedParameters.projectExtra?**: `null` \| `RecordStringAny` = `null`

• **\_\_namedParameters.projectName**: `string`

• **\_\_namedParameters.referenceDatasetId?**: `null` \| `string` = `null`

• **\_\_namedParameters.upsert?**: `boolean` = `false`

#### Returns

`Promise`\<[`TracerSession`](../../schemas/interfaces/TracerSession.md)\>

#### Defined in

[src/client.ts:1594](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L1594)

***

### createPrompt()

> **createPrompt**(`promptIdentifier`, `options`?): `Promise`\<[`Prompt`](../../schemas/interfaces/Prompt.md)\>

#### Parameters

• **promptIdentifier**: `string`

• **options?**

• **options.description?**: `string`

• **options.isPublic?**: `boolean`

• **options.readme?**: `string`

• **options.tags?**: `string`[]

#### Returns

`Promise`\<[`Prompt`](../../schemas/interfaces/Prompt.md)\>

#### Defined in

[src/client.ts:3502](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L3502)

***

### createRun()

> **createRun**(`run`): `Promise`\<`void`\>

#### Parameters

• **run**: `CreateRunParams`

#### Returns

`Promise`\<`void`\>

#### Defined in

[src/client.ts:779](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L779)

***

### deleteAnnotationQueue()

> **deleteAnnotationQueue**(`queueId`): `Promise`\<`void`\>

Delete an annotation queue with the specified queue ID.

#### Parameters

• **queueId**: `string`

The ID of the annotation queue to delete

#### Returns

`Promise`\<`void`\>

#### Defined in

[src/client.ts:3250](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L3250)

***

### deleteDataset()

> **deleteDataset**(`__namedParameters`): `Promise`\<`void`\>

#### Parameters

• **\_\_namedParameters**

• **\_\_namedParameters.datasetId?**: `string`

• **\_\_namedParameters.datasetName?**: `string`

#### Returns

`Promise`\<`void`\>

#### Defined in

[src/client.ts:2183](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L2183)

***

### deleteExample()

> **deleteExample**(`exampleId`): `Promise`\<`void`\>

#### Parameters

• **exampleId**: `string`

#### Returns

`Promise`\<`void`\>

#### Defined in

[src/client.ts:2550](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L2550)

***

### deleteFeedback()

> **deleteFeedback**(`feedbackId`): `Promise`\<`void`\>

#### Parameters

• **feedbackId**: `string`

#### Returns

`Promise`\<`void`\>

#### Defined in

[src/client.ts:2867](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L2867)

***

### deleteProject()

> **deleteProject**(`__namedParameters`): `Promise`\<`void`\>

#### Parameters

• **\_\_namedParameters**

• **\_\_namedParameters.projectId?**: `string`

• **\_\_namedParameters.projectName?**: `string`

#### Returns

`Promise`\<`void`\>

#### Defined in

[src/client.ts:1869](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L1869)

***

### deletePrompt()

> **deletePrompt**(`promptIdentifier`): `Promise`\<`void`\>

#### Parameters

• **promptIdentifier**: `string`

#### Returns

`Promise`\<`void`\>

#### Defined in

[src/client.ts:3651](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L3651)

***

### diffDatasetVersions()

> **diffDatasetVersions**(`__namedParameters`): `Promise`\<[`DatasetDiffInfo`](../../schemas/interfaces/DatasetDiffInfo.md)\>

#### Parameters

• **\_\_namedParameters**

• **\_\_namedParameters.datasetId?**: `string`

• **\_\_namedParameters.datasetName?**: `string`

• **\_\_namedParameters.fromVersion**: `string` \| `Date`

• **\_\_namedParameters.toVersion**: `string` \| `Date`

#### Returns

`Promise`\<[`DatasetDiffInfo`](../../schemas/interfaces/DatasetDiffInfo.md)\>

#### Defined in

[src/client.ts:2049](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L2049)

***

### ~~evaluateRun()~~

> **evaluateRun**(`run`, `evaluator`, `__namedParameters`): `Promise`\<[`Feedback`](../../schemas/interfaces/Feedback.md)\>

#### Parameters

• **run**: `string` \| [`Run`](../../schemas/interfaces/Run.md)

• **evaluator**: [`RunEvaluator`](../../evaluation/interfaces/RunEvaluator.md)

• **\_\_namedParameters** = `...`

• **\_\_namedParameters.loadChildRuns**: `boolean`

• **\_\_namedParameters.referenceExample?**: [`Example`](../../schemas/interfaces/Example.md)

• **\_\_namedParameters.sourceInfo?**: [`KVMap`](../../schemas/type-aliases/KVMap.md)

#### Returns

`Promise`\<[`Feedback`](../../schemas/interfaces/Feedback.md)\>

#### Deprecated

This method is deprecated and will be removed in future LangSmith versions, use `evaluate` from `langsmith/evaluation` instead.

#### Defined in

[src/client.ts:2699](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L2699)

***

### getDatasetUrl()

> **getDatasetUrl**(`__namedParameters`): `Promise`\<`string`\>

#### Parameters

• **\_\_namedParameters**

• **\_\_namedParameters.datasetId?**: `string`

• **\_\_namedParameters.datasetName?**: `string`

#### Returns

`Promise`\<`string`\>

#### Defined in

[src/client.ts:1788](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L1788)

***

### getHostUrl()

> **getHostUrl**(): `string`

#### Returns

`string`

#### Defined in

[src/client.ts:492](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L492)

***

### getProjectUrl()

> **getProjectUrl**(`__namedParameters`): `Promise`\<`string`\>

#### Parameters

• **\_\_namedParameters**

• **\_\_namedParameters.projectId?**: `string`

• **\_\_namedParameters.projectName?**: `string`

#### Returns

`Promise`\<`string`\>

#### Defined in

[src/client.ts:1773](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L1773)

***

### getPrompt()

> **getPrompt**(`promptIdentifier`): `Promise`\<`null` \| [`Prompt`](../../schemas/interfaces/Prompt.md)\>

#### Parameters

• **promptIdentifier**: `string`

#### Returns

`Promise`\<`null` \| [`Prompt`](../../schemas/interfaces/Prompt.md)\>

#### Defined in

[src/client.ts:3476](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L3476)

***

### getRunFromAnnotationQueue()

> **getRunFromAnnotationQueue**(`queueId`, `index`): `Promise`\<[`RunWithAnnotationQueueInfo`](../../schemas/interfaces/RunWithAnnotationQueueInfo.md)\>

Get a run from an annotation queue at the specified index.

#### Parameters

• **queueId**: `string`

The ID of the annotation queue

• **index**: `number`

The index of the run to retrieve

#### Returns

`Promise`\<[`RunWithAnnotationQueueInfo`](../../schemas/interfaces/RunWithAnnotationQueueInfo.md)\>

A Promise that resolves to a RunWithAnnotationQueueInfo object

#### Throws

If the run is not found at the given index or for other API-related errors

#### Defined in

[src/client.ts:3296](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L3296)

***

### getRunStats()

> **getRunStats**(`__namedParameters`): `Promise`\<`any`\>

#### Parameters

• **\_\_namedParameters**

• **\_\_namedParameters.dataSourceType?**: `string`

• **\_\_namedParameters.endTime?**: `string`

• **\_\_namedParameters.error?**: `boolean`

• **\_\_namedParameters.filter?**: `string`

• **\_\_namedParameters.id?**: `string`[]

• **\_\_namedParameters.isRoot?**: `boolean`

• **\_\_namedParameters.parentRun?**: `string`

• **\_\_namedParameters.projectIds?**: `string`[]

• **\_\_namedParameters.projectNames?**: `string`[]

• **\_\_namedParameters.query?**: `string`

• **\_\_namedParameters.referenceExampleIds?**: `string`[]

• **\_\_namedParameters.runType?**: `string`

• **\_\_namedParameters.startTime?**: `string`

• **\_\_namedParameters.trace?**: `string`

• **\_\_namedParameters.traceFilter?**: `string`

• **\_\_namedParameters.treeFilter?**: `string`

#### Returns

`Promise`\<`any`\>

#### Defined in

[src/client.ts:1266](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L1266)

***

### getRunUrl()

> **getRunUrl**(`__namedParameters`): `Promise`\<`string`\>

#### Parameters

• **\_\_namedParameters**

• **\_\_namedParameters.projectOpts?**: `ProjectOptions`

• **\_\_namedParameters.run?**: [`Run`](../../schemas/interfaces/Run.md)

• **\_\_namedParameters.runId?**: `string`

#### Returns

`Promise`\<`string`\>

#### Defined in

[src/client.ts:1008](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L1008)

***

### hasDataset()

> **hasDataset**(`__namedParameters`): `Promise`\<`boolean`\>

#### Parameters

• **\_\_namedParameters**

• **\_\_namedParameters.datasetId?**: `string`

• **\_\_namedParameters.datasetName?**: `string`

#### Returns

`Promise`\<`boolean`\>

#### Defined in

[src/client.ts:2027](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L2027)

***

### hasProject()

> **hasProject**(`__namedParameters`): `Promise`\<`boolean`\>

#### Parameters

• **\_\_namedParameters**

• **\_\_namedParameters.projectId?**: `string`

• **\_\_namedParameters.projectName?**: `string`

#### Returns

`Promise`\<`boolean`\>

#### Defined in

[src/client.ts:1682](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L1682)

***

### indexDataset()

> **indexDataset**(`__namedParameters`): `Promise`\<`void`\>

#### Parameters

• **\_\_namedParameters**

• **\_\_namedParameters.datasetId?**: `string`

• **\_\_namedParameters.datasetName?**: `string`

• **\_\_namedParameters.tag?**: `string`

#### Returns

`Promise`\<`void`\>

#### Defined in

[src/client.ts:2219](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L2219)

***

### likePrompt()

> **likePrompt**(`promptIdentifier`): `Promise`\<[`LikePromptResponse`](../../schemas/interfaces/LikePromptResponse.md)\>

#### Parameters

• **promptIdentifier**: `string`

#### Returns

`Promise`\<[`LikePromptResponse`](../../schemas/interfaces/LikePromptResponse.md)\>

#### Defined in

[src/client.ts:3421](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L3421)

***

### listAnnotationQueues()

> **listAnnotationQueues**(`options`): `AsyncIterableIterator`\<[`AnnotationQueue`](../../schemas/interfaces/AnnotationQueue.md)\>

List the annotation queues on the LangSmith API.

#### Parameters

• **options** = `{}`

The options for listing annotation queues

• **options.limit?**: `number`

The maximum number of queues to return

• **options.name?**: `string`

The name of the queue to filter by

• **options.nameContains?**: `string`

The substring that the queue name should contain

• **options.queueIds?**: `string`[]

The IDs of the queues to filter by

#### Returns

`AsyncIterableIterator`\<[`AnnotationQueue`](../../schemas/interfaces/AnnotationQueue.md)\>

An iterator of AnnotationQueue objects

#### Defined in

[src/client.ts:3127](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L3127)

***

### listCommits()

> **listCommits**(`promptOwnerAndName`): `AsyncIterableIterator`\<[`PromptCommit`](../../schemas/interfaces/PromptCommit.md)\>

#### Parameters

• **promptOwnerAndName**: `string`

#### Returns

`AsyncIterableIterator`\<[`PromptCommit`](../../schemas/interfaces/PromptCommit.md)\>

#### Defined in

[src/client.ts:3433](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L3433)

***

### listDatasets()

> **listDatasets**(`__namedParameters`): `AsyncIterable`\<[`Dataset`](../../schemas/interfaces/Dataset.md)\>

#### Parameters

• **\_\_namedParameters** = `{}`

• **\_\_namedParameters.datasetIds?**: `string`[]

• **\_\_namedParameters.datasetName?**: `string`

• **\_\_namedParameters.datasetNameContains?**: `string`

• **\_\_namedParameters.limit?**: `number` = `100`

• **\_\_namedParameters.metadata?**: `RecordStringAny`

• **\_\_namedParameters.offset?**: `number` = `0`

#### Returns

`AsyncIterable`\<[`Dataset`](../../schemas/interfaces/Dataset.md)\>

#### Defined in

[src/client.ts:2109](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L2109)

***

### listDatasetSplits()

> **listDatasetSplits**(`__namedParameters`): `Promise`\<`string`[]\>

#### Parameters

• **\_\_namedParameters**

• **\_\_namedParameters.asOf?**: `string` \| `Date`

• **\_\_namedParameters.datasetId?**: `string`

• **\_\_namedParameters.datasetName?**: `string`

#### Returns

`Promise`\<`string`[]\>

#### Defined in

[src/client.ts:2605](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L2605)

***

### listExamples()

> **listExamples**(`__namedParameters`): `AsyncIterable`\<[`Example`](../../schemas/interfaces/Example.md)\>

#### Parameters

• **\_\_namedParameters** = `{}`

• **\_\_namedParameters.asOf?**: `string` \| `Date`

• **\_\_namedParameters.datasetId?**: `string`

• **\_\_namedParameters.datasetName?**: `string`

• **\_\_namedParameters.exampleIds?**: `string`[]

• **\_\_namedParameters.filter?**: `string`

• **\_\_namedParameters.inlineS3Urls?**: `boolean`

• **\_\_namedParameters.limit?**: `number`

• **\_\_namedParameters.metadata?**: [`KVMap`](../../schemas/type-aliases/KVMap.md)

• **\_\_namedParameters.offset?**: `number`

• **\_\_namedParameters.splits?**: `string`[]

#### Returns

`AsyncIterable`\<[`Example`](../../schemas/interfaces/Example.md)\>

#### Defined in

[src/client.ts:2467](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L2467)

***

### listFeedback()

> **listFeedback**(`__namedParameters`): `AsyncIterable`\<[`Feedback`](../../schemas/interfaces/Feedback.md)\>

#### Parameters

• **\_\_namedParameters** = `{}`

• **\_\_namedParameters.feedbackKeys?**: `string`[]

• **\_\_namedParameters.feedbackSourceTypes?**: [`FeedbackSourceType`](../type-aliases/FeedbackSourceType.md)[]

• **\_\_namedParameters.runIds?**: `string`[]

#### Returns

`AsyncIterable`\<[`Feedback`](../../schemas/interfaces/Feedback.md)\>

#### Defined in

[src/client.ts:2884](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L2884)

***

### listPresignedFeedbackTokens()

> **listPresignedFeedbackTokens**(`runId`): `AsyncIterable`\<[`FeedbackIngestToken`](../../schemas/interfaces/FeedbackIngestToken.md)\>

Retrieves a list of presigned feedback tokens for a given run ID.

#### Parameters

• **runId**: `string`

The ID of the run.

#### Returns

`AsyncIterable`\<[`FeedbackIngestToken`](../../schemas/interfaces/FeedbackIngestToken.md)\>

An async iterable of FeedbackIngestToken objects.

#### Defined in

[src/client.ts:3037](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L3037)

***

### listProjects()

> **listProjects**(`__namedParameters`): `AsyncIterable`\<[`TracerSession`](../../schemas/interfaces/TracerSession.md)\>

#### Parameters

• **\_\_namedParameters** = `{}`

• **\_\_namedParameters.metadata?**: `RecordStringAny`

• **\_\_namedParameters.name?**: `string`

• **\_\_namedParameters.nameContains?**: `string`

• **\_\_namedParameters.projectIds?**: `string`[]

• **\_\_namedParameters.referenceDatasetId?**: `string`

• **\_\_namedParameters.referenceDatasetName?**: `string`

• **\_\_namedParameters.referenceFree?**: `boolean`

#### Returns

`AsyncIterable`\<[`TracerSession`](../../schemas/interfaces/TracerSession.md)\>

#### Defined in

[src/client.ts:1818](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L1818)

***

### listPrompts()

> **listPrompts**(`options`?): `AsyncIterableIterator`\<[`Prompt`](../../schemas/interfaces/Prompt.md)\>

#### Parameters

• **options?**

• **options.isArchived?**: `boolean`

• **options.isPublic?**: `boolean`

• **options.query?**: `string`

• **options.sortField?**: [`PromptSortField`](../../schemas/type-aliases/PromptSortField.md)

#### Returns

`AsyncIterableIterator`\<[`Prompt`](../../schemas/interfaces/Prompt.md)\>

#### Defined in

[src/client.ts:3448](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L3448)

***

### listRuns()

> **listRuns**(`props`): `AsyncIterable`\<[`Run`](../../schemas/interfaces/Run.md)\>

List runs from the LangSmith server.

#### Parameters

• **props**: `ListRunsParams`

#### Returns

`AsyncIterable`\<[`Run`](../../schemas/interfaces/Run.md)\>

- The runs.

#### Examples

```ts
// List all runs in a project
const projectRuns = client.listRuns({ projectName: "<your_project>" });
```

```ts
// List LLM and Chat runs in the last 24 hours
const todaysLLMRuns = client.listRuns({
  projectName: "<your_project>",
  start_time: new Date(Date.now() - 24 * 60 * 60 * 1000),
  run_type: "llm",
});
```

```ts
// List traces in a project
const rootRuns = client.listRuns({
  projectName: "<your_project>",
  execution_order: 1,
});
```

```ts
// List runs without errors
const correctRuns = client.listRuns({
  projectName: "<your_project>",
  error: false,
});
```

```ts
// List runs by run ID
const runIds = [
  "a36092d2-4ad5-4fb4-9c0d-0dba9a2ed836",
  "9398e6be-964f-4aa4-8ae9-ad78cd4b7074",
];
const selectedRuns = client.listRuns({ run_ids: runIds });
```

```ts
// List all "chain" type runs that took more than 10 seconds and had `total_tokens` greater than 5000
const chainRuns = client.listRuns({
  projectName: "<your_project>",
  filter: 'and(eq(run_type, "chain"), gt(latency, 10), gt(total_tokens, 5000))',
});
```

```ts
// List all runs called "extractor" whose root of the trace was assigned feedback "user_score" score of 1
const goodExtractorRuns = client.listRuns({
  projectName: "<your_project>",
  filter: 'eq(name, "extractor")',
  traceFilter: 'and(eq(feedback_key, "user_score"), eq(feedback_score, 1))',
});
```

```ts
// List all runs that started after a specific timestamp and either have "error" not equal to null or a "Correctness" feedback score equal to 0
const complexRuns = client.listRuns({
  projectName: "<your_project>",
  filter: 'and(gt(start_time, "2023-07-15T12:34:56Z"), or(neq(error, null), and(eq(feedback_key, "Correctness"), eq(feedback_score, 0.0))))',
});
```

```ts
// List all runs where `tags` include "experimental" or "beta" and `latency` is greater than 2 seconds
const taggedRuns = client.listRuns({
  projectName: "<your_project>",
  filter: 'and(or(has(tags, "experimental"), has(tags, "beta")), gt(latency, 2))',
});
```

#### Defined in

[src/client.ts:1160](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L1160)

***

### listSharedExamples()

> **listSharedExamples**(`shareToken`, `options`?): `Promise`\<[`Example`](../../schemas/interfaces/Example.md)[]\>

Get shared examples.

#### Parameters

• **shareToken**: `string`

The share token to get examples for. A share token is the UUID (or LangSmith URL, including UUID) generated when explicitly marking an example as public.

• **options?**

Additional options for listing the examples.

• **options.exampleIds?**: `string`[]

A list of example IDs to filter by.

#### Returns

`Promise`\<[`Example`](../../schemas/interfaces/Example.md)[]\>

The shared examples.

#### Defined in

[src/client.ts:1547](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L1547)

***

### listSharedRuns()

> **listSharedRuns**(`shareToken`, `__namedParameters`): `Promise`\<[`Run`](../../schemas/interfaces/Run.md)[]\>

#### Parameters

• **shareToken**: `string`

• **\_\_namedParameters** = `{}`

• **\_\_namedParameters.runIds?**: `string`[]

#### Returns

`Promise`\<[`Run`](../../schemas/interfaces/Run.md)[]\>

#### Defined in

[src/client.ts:1415](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L1415)

***

### logEvaluationFeedback()

> **logEvaluationFeedback**(`evaluatorResponse`, `run`?, `sourceInfo`?): `Promise`\<[`EvaluationResult`](../../evaluation/type-aliases/EvaluationResult.md)[]\>

#### Parameters

• **evaluatorResponse**: [`EvaluationResult`](../../evaluation/type-aliases/EvaluationResult.md) \| `EvaluationResults`

• **run?**: [`Run`](../../schemas/interfaces/Run.md)

• **sourceInfo?**

#### Returns

`Promise`\<[`EvaluationResult`](../../evaluation/type-aliases/EvaluationResult.md)[]\>

#### Defined in

[src/client.ts:3101](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L3101)

***

### promptExists()

> **promptExists**(`promptIdentifier`): `Promise`\<`boolean`\>

#### Parameters

• **promptIdentifier**: `string`

#### Returns

`Promise`\<`boolean`\>

#### Defined in

[src/client.ts:3416](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L3416)

***

### pullPromptCommit()

> **pullPromptCommit**(`promptIdentifier`, `options`?): `Promise`\<[`PromptCommit`](../../schemas/interfaces/PromptCommit.md)\>

#### Parameters

• **promptIdentifier**: `string`

• **options?**

• **options.includeModel?**: `boolean`

#### Returns

`Promise`\<[`PromptCommit`](../../schemas/interfaces/PromptCommit.md)\>

#### Defined in

[src/client.ts:3676](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L3676)

***

### pushPrompt()

> **pushPrompt**(`promptIdentifier`, `options`?): `Promise`\<`string`\>

#### Parameters

• **promptIdentifier**: `string`

• **options?**

• **options.description?**: `string`

• **options.isPublic?**: `boolean`

• **options.object?**: `any`

• **options.parentCommitHash?**: `string`

• **options.readme?**: `string`

• **options.tags?**: `string`[]

#### Returns

`Promise`\<`string`\>

#### Defined in

[src/client.ts:3747](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L3747)

***

### readAnnotationQueue()

> **readAnnotationQueue**(`queueId`): `Promise`\<[`AnnotationQueue`](../../schemas/interfaces/AnnotationQueue.md)\>

Read an annotation queue with the specified queue ID.

#### Parameters

• **queueId**: `string`

The ID of the annotation queue to read

#### Returns

`Promise`\<[`AnnotationQueue`](../../schemas/interfaces/AnnotationQueue.md)\>

The AnnotationQueue object

#### Defined in

[src/client.ts:3206](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L3206)

***

### readDataset()

> **readDataset**(`__namedParameters`): `Promise`\<[`Dataset`](../../schemas/interfaces/Dataset.md)\>

#### Parameters

• **\_\_namedParameters**

• **\_\_namedParameters.datasetId?**: `string`

• **\_\_namedParameters.datasetName?**: `string`

#### Returns

`Promise`\<[`Dataset`](../../schemas/interfaces/Dataset.md)\>

#### Defined in

[src/client.ts:1992](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L1992)

***

### readDatasetOpenaiFinetuning()

> **readDatasetOpenaiFinetuning**(`__namedParameters`): `Promise`\<`any`[]\>

#### Parameters

• **\_\_namedParameters**

• **\_\_namedParameters.datasetId?**: `string`

• **\_\_namedParameters.datasetName?**: `string`

#### Returns

`Promise`\<`any`[]\>

#### Defined in

[src/client.ts:2084](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L2084)

***

### readDatasetSharedSchema()

> **readDatasetSharedSchema**(`datasetId`?, `datasetName`?): `Promise`\<[`DatasetShareSchema`](../../schemas/interfaces/DatasetShareSchema.md)\>

#### Parameters

• **datasetId?**: `string`

• **datasetName?**: `string`

#### Returns

`Promise`\<[`DatasetShareSchema`](../../schemas/interfaces/DatasetShareSchema.md)\>

#### Defined in

[src/client.ts:1446](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L1446)

***

### readExample()

> **readExample**(`exampleId`): `Promise`\<[`Example`](../../schemas/interfaces/Example.md)\>

#### Parameters

• **exampleId**: `string`

#### Returns

`Promise`\<[`Example`](../../schemas/interfaces/Example.md)\>

#### Defined in

[src/client.ts:2461](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L2461)

***

### readFeedback()

> **readFeedback**(`feedbackId`): `Promise`\<[`Feedback`](../../schemas/interfaces/Feedback.md)\>

#### Parameters

• **feedbackId**: `string`

#### Returns

`Promise`\<[`Feedback`](../../schemas/interfaces/Feedback.md)\>

#### Defined in

[src/client.ts:2860](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L2860)

***

### readProject()

> **readProject**(`__namedParameters`): `Promise`\<[`TracerSessionResult`](../../schemas/interfaces/TracerSessionResult.md)\>

#### Parameters

• **\_\_namedParameters**

• **\_\_namedParameters.includeStats?**: `boolean`

• **\_\_namedParameters.projectId?**: `string`

• **\_\_namedParameters.projectName?**: `string`

#### Returns

`Promise`\<[`TracerSessionResult`](../../schemas/interfaces/TracerSessionResult.md)\>

#### Defined in

[src/client.ts:1730](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L1730)

***

### readRun()

> **readRun**(`runId`, `__namedParameters`): `Promise`\<[`Run`](../../schemas/interfaces/Run.md)\>

#### Parameters

• **runId**: `string`

• **\_\_namedParameters** = `...`

• **\_\_namedParameters.loadChildRuns**: `boolean`

#### Returns

`Promise`\<[`Run`](../../schemas/interfaces/Run.md)\>

#### Defined in

[src/client.ts:996](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L996)

***

### readRunSharedLink()

> **readRunSharedLink**(`runId`): `Promise`\<`undefined` \| `string`\>

#### Parameters

• **runId**: `string`

#### Returns

`Promise`\<`undefined` \| `string`\>

#### Defined in

[src/client.ts:1396](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L1396)

***

### readSharedDataset()

> **readSharedDataset**(`shareToken`): `Promise`\<[`Dataset`](../../schemas/interfaces/Dataset.md)\>

#### Parameters

• **shareToken**: `string`

#### Returns

`Promise`\<[`Dataset`](../../schemas/interfaces/Dataset.md)\>

#### Defined in

[src/client.ts:1523](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L1523)

***

### shareDataset()

> **shareDataset**(`datasetId`?, `datasetName`?): `Promise`\<[`DatasetShareSchema`](../../schemas/interfaces/DatasetShareSchema.md)\>

#### Parameters

• **datasetId?**: `string`

• **datasetName?**: `string`

#### Returns

`Promise`\<[`DatasetShareSchema`](../../schemas/interfaces/DatasetShareSchema.md)\>

#### Defined in

[src/client.ts:1475](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L1475)

***

### shareRun()

> **shareRun**(`runId`, `__namedParameters`): `Promise`\<`string`\>

#### Parameters

• **runId**: `string`

• **\_\_namedParameters** = `{}`

• **\_\_namedParameters.shareId?**: `string`

#### Returns

`Promise`\<`string`\>

#### Defined in

[src/client.ts:1354](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L1354)

***

### similarExamples()

> **similarExamples**(`inputs`, `datasetId`, `limit`, `filter`): `Promise`\<[`ExampleSearch`](../../schemas/interfaces/ExampleSearch.md)[]\>

Lets you run a similarity search query on a dataset.

Requires the dataset to be indexed. Please see the `indexDataset` method to set up indexing.

#### Parameters

• **inputs**: [`KVMap`](../../schemas/type-aliases/KVMap.md)

The input on which to run the similarity search. Must have the
                   same schema as the dataset.

• **datasetId**: `string`

The dataset to search for similar examples.

• **limit**: `number`

The maximum number of examples to return. Will return the top `limit` most
                   similar examples in order of most similar to least similar. If no similar
                   examples are found, random examples will be returned.

• **filter** = `{}`

A filter string to apply to the search. Only examples will be returned that
                   match the filter string. Some examples of filters

                   - eq(metadata.mykey, "value")
                   - and(neq(metadata.my.nested.key, "value"), neq(metadata.mykey, "value"))
                   - or(eq(metadata.mykey, "value"), eq(metadata.mykey, "othervalue"))

• **filter.filter?**: `string`

#### Returns

`Promise`\<[`ExampleSearch`](../../schemas/interfaces/ExampleSearch.md)[]\>

A list of similar examples.

#### Example

```ts
dataset_id = "123e4567-e89b-12d3-a456-426614174000"
inputs = {"text": "How many people live in Berlin?"}
limit = 5
examples = await client.similarExamples(inputs, dataset_id, limit)
```

#### Defined in

[src/client.ts:2287](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L2287)

***

### unlikePrompt()

> **unlikePrompt**(`promptIdentifier`): `Promise`\<[`LikePromptResponse`](../../schemas/interfaces/LikePromptResponse.md)\>

#### Parameters

• **promptIdentifier**: `string`

#### Returns

`Promise`\<[`LikePromptResponse`](../../schemas/interfaces/LikePromptResponse.md)\>

#### Defined in

[src/client.ts:3427](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L3427)

***

### unshareDataset()

> **unshareDataset**(`datasetId`): `Promise`\<`void`\>

#### Parameters

• **datasetId**: `string`

#### Returns

`Promise`\<`void`\>

#### Defined in

[src/client.ts:1508](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L1508)

***

### unshareRun()

> **unshareRun**(`runId`): `Promise`\<`void`\>

#### Parameters

• **runId**: `string`

#### Returns

`Promise`\<`void`\>

#### Defined in

[src/client.ts:1381](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L1381)

***

### updateAnnotationQueue()

> **updateAnnotationQueue**(`queueId`, `options`): `Promise`\<`void`\>

Update an annotation queue with the specified queue ID.

#### Parameters

• **queueId**: `string`

The ID of the annotation queue to update

• **options**

The options for updating the annotation queue

• **options.description?**: `string`

The new description for the annotation queue

• **options.name**: `string`

The new name for the annotation queue

#### Returns

`Promise`\<`void`\>

#### Defined in

[src/client.ts:3224](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L3224)

***

### updateDataset()

> **updateDataset**(`props`): `Promise`\<[`Dataset`](../../schemas/interfaces/Dataset.md)\>

Update a dataset

#### Parameters

• **props**

The dataset details to update

• **props.datasetId?**: `string`

• **props.datasetName?**: `string`

• **props.description?**: `string`

• **props.name?**: `string`

#### Returns

`Promise`\<[`Dataset`](../../schemas/interfaces/Dataset.md)\>

The updated dataset

#### Defined in

[src/client.ts:2153](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L2153)

***

### updateDatasetSplits()

> **updateDatasetSplits**(`__namedParameters`): `Promise`\<`void`\>

#### Parameters

• **\_\_namedParameters**

• **\_\_namedParameters.datasetId?**: `string`

• **\_\_namedParameters.datasetName?**: `string`

• **\_\_namedParameters.exampleIds**: `string`[]

• **\_\_namedParameters.remove?**: `boolean` = `false`

• **\_\_namedParameters.splitName**: `string`

#### Returns

`Promise`\<`void`\>

#### Defined in

[src/client.ts:2645](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L2645)

***

### updateExample()

> **updateExample**(`exampleId`, `update`): `Promise`\<`object`\>

#### Parameters

• **exampleId**: `string`

• **update**: [`ExampleUpdate`](../../schemas/interfaces/ExampleUpdate.md)

#### Returns

`Promise`\<`object`\>

#### Defined in

[src/client.ts:2567](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L2567)

***

### updateExamples()

> **updateExamples**(`update`): `Promise`\<`object`\>

#### Parameters

• **update**: [`ExampleUpdateWithId`](../../schemas/interfaces/ExampleUpdateWithId.md)[]

#### Returns

`Promise`\<`object`\>

#### Defined in

[src/client.ts:2588](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L2588)

***

### updateFeedback()

> **updateFeedback**(`feedbackId`, `__namedParameters`): `Promise`\<`void`\>

#### Parameters

• **feedbackId**: `string`

• **\_\_namedParameters**

• **\_\_namedParameters.comment?**: `null` \| `string`

• **\_\_namedParameters.correction?**: `null` \| `object`

• **\_\_namedParameters.score?**: `null` \| `number` \| `boolean`

• **\_\_namedParameters.value?**: `null` \| `string` \| `number` \| `boolean` \| `object`

#### Returns

`Promise`\<`void`\>

#### Defined in

[src/client.ts:2818](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L2818)

***

### updateProject()

> **updateProject**(`projectId`, `__namedParameters`): `Promise`\<[`TracerSession`](../../schemas/interfaces/TracerSession.md)\>

#### Parameters

• **projectId**: `string`

• **\_\_namedParameters**

• **\_\_namedParameters.description?**: `null` \| `string` = `null`

• **\_\_namedParameters.endTime?**: `null` \| `string` = `null`

• **\_\_namedParameters.metadata?**: `null` \| `RecordStringAny` = `null`

• **\_\_namedParameters.name?**: `null` \| `string` = `null`

• **\_\_namedParameters.projectExtra?**: `null` \| `RecordStringAny` = `null`

#### Returns

`Promise`\<[`TracerSession`](../../schemas/interfaces/TracerSession.md)\>

#### Defined in

[src/client.ts:1639](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L1639)

***

### updatePrompt()

> **updatePrompt**(`promptIdentifier`, `options`?): `Promise`\<`Record`\<`string`, `any`\>\>

#### Parameters

• **promptIdentifier**: `string`

• **options?**

• **options.description?**: `string`

• **options.isArchived?**: `boolean`

• **options.isPublic?**: `boolean`

• **options.readme?**: `string`

• **options.tags?**: `string`[]

#### Returns

`Promise`\<`Record`\<`string`, `any`\>\>

#### Defined in

[src/client.ts:3596](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L3596)

***

### updateRun()

> **updateRun**(`runId`, `run`): `Promise`\<`void`\>

#### Parameters

• **runId**: `string`

• **run**: [`RunUpdate`](../../schemas/interfaces/RunUpdate.md)

#### Returns

`Promise`\<`void`\>

#### Defined in

[src/client.ts:950](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L950)

***

### uploadCsv()

> **uploadCsv**(`__namedParameters`): `Promise`\<[`Dataset`](../../schemas/interfaces/Dataset.md)\>

#### Parameters

• **\_\_namedParameters**: `UploadCSVParams`

#### Returns

`Promise`\<[`Dataset`](../../schemas/interfaces/Dataset.md)\>

#### Defined in

[src/client.ts:1904](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L1904)

***

### getDefaultClientConfig()

> `static` **getDefaultClientConfig**(): `object`

#### Returns

`object`

##### apiKey?

> `optional` **apiKey**: `string`

##### apiUrl

> **apiUrl**: `string`

##### hideInputs?

> `optional` **hideInputs**: `boolean`

##### hideOutputs?

> `optional` **hideOutputs**: `boolean`

##### webUrl?

> `optional` **webUrl**: `string`

#### Defined in

[src/client.ts:468](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L468)
