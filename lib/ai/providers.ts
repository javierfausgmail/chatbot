import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { isTestEnvironment } from "../constants";
import { titleModel } from "./models";

const providerName =
  process.env.OPENAI_COMPATIBLE_PROVIDER_NAME ?? "openai-compatible";

const baseURL =
  process.env.OPENAI_COMPATIBLE_BASE_URL ?? "http://localhost:1234/v1";

const apiKey =
  process.env.OPENAI_COMPATIBLE_API_KEY ?? "not-needed";

const openAICompatibleProvider = createOpenAICompatible({
  name: providerName,
  baseURL,
  apiKey,
  includeUsage: true,
});

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment) {
    const { customProvider } = require("ai");
    const { chatModel, titleModel } = require("./models.mock");

    const testProvider = customProvider({
      languageModels: {
        "chat-model": chatModel,
        "title-model": titleModel,
      },
    });

    return testProvider.languageModel(modelId);
  }

  const realModelId =
    modelId === "chat-model"
      ? process.env.CHAT_MODEL_ID
      : modelId;

  if (!realModelId) {
    throw new Error("CHAT_MODEL_ID no está definido en .env.local");
  }

  return openAICompatibleProvider.chatModel(realModelId);
}

export function getTitleModel() {
  if (isTestEnvironment) {
    const { customProvider } = require("ai");
    const { titleModel } = require("./models.mock");

    const testProvider = customProvider({
      languageModels: {
        "title-model": titleModel,
      },
    });

    return testProvider.languageModel("title-model");
  }

  const realTitleModelId =
    process.env.TITLE_MODEL_ID ??
    process.env.CHAT_MODEL_ID ??
    titleModel.id;

  return openAICompatibleProvider.chatModel(realTitleModelId);
}
