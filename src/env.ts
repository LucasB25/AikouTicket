import path from 'node:path';
import { config } from 'dotenv';
import { z } from 'zod';

config({
	path: path.join(__dirname, '../.env'),
});

const envSchema = z.object({
	TOKEN: z.string(),

	CLIENT_ID: z.string(),

	LOGSBOT: z.string(),

	DATABASE_URL: z.string(),
});

type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);

for (const key in env) {
	if (!(key in env)) {
		throw new Error(`Missing env variable: ${key}`);
	}
}
