import { createClient, type RedisClientType } from "redis";

const globalForRedis = globalThis as unknown as {
  redis: RedisClientType | undefined;
};

function getRedisUrl() {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not set");
  }
  return url;
}

async function createRedisClient() {
  const client = createClient({ url: getRedisUrl() }) as RedisClientType;
  client.on("error", (error) => {
    console.error("[redis]", error);
  });
  await client.connect();
  return client;
}

export async function getRedis() {
  globalForRedis.redis ??= await createRedisClient();
  return globalForRedis.redis;
}
