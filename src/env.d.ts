/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly MAILJET_API_KEY: string;
  readonly MAILJET_API_SECRET: string;
  readonly LIST_ID: string;
}
