ALTER TABLE "Model3DJob" ADD COLUMN IF NOT EXISTS "externalJobId" text;
ALTER TABLE "Model3DJob" ADD COLUMN IF NOT EXISTS "providerData" json;
