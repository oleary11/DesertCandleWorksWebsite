import { redis } from "./redis";

const CONTAINERS_KEY = "containers";
const CONTAINERS_INDEX_KEY = "containers:index";

export interface Container {
  id: string; // e.g., "8oz_amber_jar"
  name: string; // e.g., "8oz Amber Jar"
  capacityWaterOz: number; // water capacity at pour level
  shape: string; // e.g., "Round", "Square", "Bottle"
  supplier?: string; // supplier name
  costPerUnit: number; // cost per container
  notes?: string; // optional notes
}

/**
 * Get all containers
 */
export async function getAllContainers(): Promise<Container[]> {
  try {
    const containerIds = await redis.smembers(CONTAINERS_INDEX_KEY);
    if (!containerIds || containerIds.length === 0) return [];

    const containers: Container[] = [];
    for (const id of containerIds) {
      const data = await redis.get(`${CONTAINERS_KEY}:${id}`);
      if (data) {
        containers.push(data as Container);
      }
    }

    return containers.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Failed to get containers:", error);
    return [];
  }
}

/**
 * Get a single container by ID
 */
export async function getContainer(id: string): Promise<Container | null> {
  try {
    const data = await redis.get(`${CONTAINERS_KEY}:${id}`);
    if (!data) return null;
    return data as Container;
  } catch (error) {
    console.error(`Failed to get container ${id}:`, error);
    return null;
  }
}

/**
 * Create or update a container
 */
export async function upsertContainer(container: Container): Promise<void> {
  try {
    await redis.set(`${CONTAINERS_KEY}:${container.id}`, container);
    await redis.sadd(CONTAINERS_INDEX_KEY, container.id);
  } catch (error) {
    console.error(`Failed to upsert container ${container.id}:`, error);
    throw error;
  }
}

/**
 * Delete a container
 */
export async function deleteContainer(id: string): Promise<void> {
  try {
    await redis.del(`${CONTAINERS_KEY}:${id}`);
    await redis.srem(CONTAINERS_INDEX_KEY, id);
  } catch (error) {
    console.error(`Failed to delete container ${id}:`, error);
    throw error;
  }
}
