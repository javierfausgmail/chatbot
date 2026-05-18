export const DEFAULT_CHAT_MODEL = "chat-model";

export const titleModel = {
  id: "title-model",
  name: "Title Model",
  provider: "openai-compatible",
  description: "Modelo usado para generar títulos de chat",
};

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
};

export const chatModels: ChatModel[] = [
  {
    id: "chat-model",
    name: "OpenAI-compatible Chat Model",
    provider: "openai-compatible",
    description:
      "Modelo configurado mediante OPENAI_COMPATIBLE_BASE_URL y CHAT_MODEL_ID",
  },
];

export async function getCapabilities(): Promise<
  Record<string, ModelCapabilities>
> {
  return {
    "chat-model": {
      tools: true,
      vision: false,
      reasoning: false,
    },
  };
}

export const isDemo = process.env.IS_DEMO === "1";

export type GatewayModelWithCapabilities = ChatModel & {
  capabilities: ModelCapabilities;
};

export async function getAllGatewayModels(): Promise<
  GatewayModelWithCapabilities[]
> {
  return [];
}

export function getActiveModels(): ChatModel[] {
  return chatModels;
}

export const allowedModelIds = new Set(chatModels.map((m) => m.id));

export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }

    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>,
);
