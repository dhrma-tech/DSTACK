import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { ModelError, type DStackConfig, type JsonObject, type ModelChunk, type ModelRequest, type ModelResponse, type Provider, type SkillManifest, type ToolCall } from "@dstack/shared";
import { shortHash } from "./utils.js";

export class FakeProvider implements Provider {
  private readonly responses: Array<{ text: string; toolCalls: ToolCall[] }> = [];
  enqueue(text: string, toolCalls: ToolCall[] = []): void {
    this.responses.push({ text, toolCalls });
  }
  hashFor(request: ModelRequest): string {
    return shortHash(`${request.systemPrompt}\n${request.userMessage}`, 16);
  }
  async *generate(): AsyncIterableIterator<ModelChunk> {
    const response = this.responses.shift();
    if (!response) throw new ModelError("FakeProvider has no queued response");
    for (const toolCall of response.toolCalls) yield { type: "tool-call", toolCall };
    if (response.text) yield { type: "text", text: response.text };
    yield { type: "done" };
  }
  async countTokens(input: string): Promise<number> {
    return Math.ceil(input.length / 4);
  }
}

export class GeminiProvider implements Provider {
  private readonly client: GoogleGenerativeAI;
  constructor(apiKey: string | null) {
    if (!apiKey) throw new ModelError("GEMINI_API_KEY is required for live Gemini runs");
    this.client = new GoogleGenerativeAI(apiKey);
  }
  async *generate(request: ModelRequest): AsyncIterableIterator<ModelChunk> {
    const model = this.client.getGenerativeModel({ model: request.model, systemInstruction: request.systemPrompt });
    const requestPayload = {
      contents: [{ role: "user", parts: [{ text: request.userMessage }] }],
      tools: [{ functionDeclarations: request.tools.map((tool) => ({ name: tool.name, description: tool.description, parameters: toGeminiSchema(tool.parameters) })) }],
      generationConfig: { temperature: request.temperature, maxOutputTokens: request.maxOutputTokens, responseMimeType: request.responseMimeType }
    } as unknown as Parameters<typeof model.generateContentStream>[0];
    const stream = await model.generateContentStream(requestPayload);
    for await (const chunk of stream.stream) {
      const text = chunk.text();
      if (text) yield { type: "text", text };
      for (const call of chunk.functionCalls() ?? []) {
        yield { type: "tool-call", toolCall: { id: `${call.name}-${Date.now()}`, name: call.name, input: normalizeArgs(call.args) } };
      }
    }
    yield { type: "done" };
  }
  async countTokens(input: string, modelName: string): Promise<number> {
    const model = this.client.getGenerativeModel({ model: modelName });
    return (await model.countTokens(input)).totalTokens;
  }
}

export class ModelRouter {
  constructor(private readonly config: DStackConfig, private readonly overrideProvider: Provider | null = null) {}
  resolve(skill: SkillManifest, cliModel: string | null): { provider: Provider; model: string } {
    return { provider: this.overrideProvider ?? new GeminiProvider(this.config.geminiApiKey), model: cliModel ?? this.config.skillOverrides[skill.name]?.model ?? skill.model };
  }
}

export class StreamHandler {
  async collect(chunks: AsyncIterableIterator<ModelChunk>): Promise<ModelResponse> {
    let text = "";
    const toolCalls: ToolCall[] = [];
    for await (const chunk of chunks) {
      if (chunk.type === "text" && chunk.text) text += chunk.text;
      if (chunk.type === "tool-call" && chunk.toolCall) toolCalls.push(chunk.toolCall);
    }
    return { text, toolCalls, inputTokens: 0, outputTokens: Math.ceil(text.length / 4), stopReason: "stop" };
  }
}

function normalizeArgs(args: unknown): JsonObject {
  return typeof args === "object" && args !== null && !Array.isArray(args) ? args as JsonObject : {};
}
function toGeminiSchema(schema: JsonObject): JsonObject {
  return Object.keys(schema).length > 0 ? schema : { type: SchemaType.OBJECT, properties: {} };
}
