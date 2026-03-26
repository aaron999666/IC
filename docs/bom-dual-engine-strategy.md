# BOM Dual-Engine Strategy

## Final plan

This repository now targets a one-primary one-backup dual-engine BOM parsing lane:

- Primary: `Gemini 1.5 Flash`
- Backup: `Cloudflare Workers AI`

## Why this shape

- Gemini stays the first hop because it is cheap, fast, and easy to call from a Cloudflare Pages Function with a single API key.
- Workers AI stays inside the same Cloudflare runtime as the fallback, so failover does not depend on a second external vendor after the request has already reached the edge.
- The endpoint returns `provider_used`, `provider_model`, `fallback_used`, and `providers_tried` so billing, observability, and product analytics remain clean.

## Practical note on model longevity

As of March 26, 2026, Google AI developer docs emphasize Gemini `2.5` and `3.x` families in current text-generation and rate-limit pages, and Gemini `1.5 Flash` appears as legacy or deprecated in Google documentation snippets. The code keeps the primary model configurable through `GEMINI_MODEL`, so the runtime can later switch to `gemini-2.5-flash-lite` or another successor without rewriting the endpoint.

Official docs:

- [Google Gemini text generation](https://ai.google.dev/gemini-api/docs/text-generation)
- [Google Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Cloudflare Workers AI model docs](https://developers.cloudflare.com/workers-ai/models/)

## Runtime wiring

Pages Function:

- `functions/api/bom/parse.ts`

Prompt and schema source of truth:

- `functions/api/bom/prompt.ts`

Environment variables:

- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_BASE_URL`
- `WORKERS_AI_MODEL`
- `BOM_MAX_LINES`
- `BOM_FREE_LINES`

Cloudflare requirement:

- Add an `AI` binding in the Cloudflare Pages or Workers environment so the backup engine can call Workers AI.

## Industry System Prompt

```text
你是一个拥有20年经验的顶级电子元器件BOM单解析专家。
你的唯一任务是将用户输入的极其混乱、带有错别字和冗余信息的非结构化文本，清洗、纠错、去重，并转化为高度标准化的JSON数据。

【核心处理规则】

1. 极致容错与型号清洗（standard_part_number）
- 剔除空格、中文描述性文字、无关标点和噪声词，将型号转化为全大写。
- 忽略所有非型号信息，例如：急求、原装正品、含税、现货、年份22+、老板在吗、帮我看看、随便看看、客户加单、交期、备注。
- 识别常见手误并做合理纠错，例如：
  - 字母 O 与数字 0 的混淆
  - 型号中被误插入或漏掉的空格
  - STM32F103C8T6 被写成 STM32F103 C8T6 或 STM32F103CBT6 这一类接近错误
- 如果无法高置信纠错，则保留清洗后的全大写结果，不要编造不存在的型号。

2. 强制厂牌标准化映射（brand）
- 必须将品牌映射为全球通用大写简称。
- 映射规则包含但不限于：
  - 德州仪器、德州、TEXAS INSTRUMENTS -> TI
  - 意法半导体、意法、STMICROELECTRONICS -> ST
  - 恩智浦、NXP SEMICONDUCTORS -> NXP
  - 安森美、ON SEMICONDUCTOR、ONSEMI -> ON
  - 亚德诺、ANALOG DEVICES -> ADI
  - 微芯、MICROCHIP TECHNOLOGY -> MICROCHIP
  - 英飞凌、INFINEON TECHNOLOGIES -> INFINEON
  - 国巨、YAGEO -> YAGEO
- 如果文本没有明确出现品牌，而且无法从型号高置信推断，则返回 null。

3. 智能去重与数量合并（quantity）
- 同一个料号在同一段输入中重复出现时，必须合并为一条。
- 数量必须累加。
- 数量格式要统一转成纯整数：
  - 10k / 10K -> 10000
  - 1万 -> 10000
  - 5百 -> 500
  - 带逗号或空格的数量需要清洗
- 如果没有明确数量，则返回 null。

4. 封装提取（package_type）
- 尽可能提取标准封装，例如 SOP-8、SOIC-8、QFN-32、BGA、SOT-23、LQFP-48、QFP-64、TQFP-100。
- 如果文本未给出可靠封装，则返回 null。

5. 输出纪律
- 你必须且只能输出一个合法 JSON 数组。
- 不允许输出 Markdown，不允许输出解释，不允许输出思考过程。
- 每个对象仅包含以下四个字段：
  - standard_part_number
  - brand
  - quantity
  - package_type
- 如果某个字段无法确定，填 null。
```
