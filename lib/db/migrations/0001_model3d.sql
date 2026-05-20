CREATE TABLE IF NOT EXISTS "Model3DJob" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chatId" uuid NOT NULL REFERENCES "Chat"("id"),
  "userId" uuid NOT NULL REFERENCES "User"("id"),
  "documentId" uuid NOT NULL,
  "title" text NOT NULL,
  "prompt" text NOT NULL,
  "provider" varchar NOT NULL,
  "status" varchar NOT NULL DEFAULT 'queued',
  "units" varchar NOT NULL DEFAULT 'mm',
  "printable" boolean NOT NULL DEFAULT true,
  "sourceJobId" uuid,
  "sceneJson" json NOT NULL,
  "error" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "completedAt" timestamp
);

CREATE TABLE IF NOT EXISTS "Model3DFile" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "jobId" uuid NOT NULL REFERENCES "Model3DJob"("id"),
  "format" varchar NOT NULL,
  "pathname" text NOT NULL,
  "url" text NOT NULL,
  "size" json,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
