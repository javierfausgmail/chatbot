# Changelog

All notable changes to this project will be documented in this file.

## [3.1.1] - 2026-05-19

### Added

- Stable zero-vendor-lockin baseline for future project development.
- OpenAI-compatible model provider through `@ai-sdk/openai-compatible`.
- Local upload storage under `public/uploads` for development and self-hosted deployments.
- Sidebar UI action to rename existing chats.
- Server action to update chat titles with authentication and ownership checks.
- Expanded setup documentation for `.env.local`, Docker services, development, debugging, linting, and standalone deployment.
- GitHub Release-ready documentation for reproducible downloads.

### Changed

- Default model configuration now uses a configurable OpenAI-compatible provider instead of Vercel AI Gateway.
- Request IP and request hints are resolved locally instead of using Vercel Functions helpers.
- Telemetry registration is disabled by default in this zero-vendor-lockin release.
- Next.js config now exports standalone output without BotID wrapping.
- CI configuration no longer expects Vercel Blob credentials.

### Removed

- Vercel AI Gateway runtime usage and model capability calls to `ai-gateway.vercel.sh`.
- Vercel Blob dependency for uploads.
- Vercel Functions dependency for IP/geolocation helpers.
- Vercel OTel integration.
- BotID integration.
- Vercel-specific upload secrets from CI.

### Notes

- Local upload URLs work for local/self-hosted serving. Cloud multimodal providers may still require publicly reachable URLs or inline file payloads.
- Redis remains optional. Without `REDIS_URL`, resumable streams are skipped.
