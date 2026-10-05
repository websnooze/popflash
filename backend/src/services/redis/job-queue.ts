import {
  dathostCircuitRecordFailure,
  dathostCircuitRecordSuccess,
  redis,
  redisWorker,
  RedisKeys,
} from '../../lib/redis'

const MAX_JOB_ATTEMPTS = 5

export type JobPayload =
  | { type: 'load_fragstack_config'; matchId: string; attempt?: number }
  | { type: 'teardown_dathost'; serverId: string; matchId?: string; attempt?: number }

function delayMsForAttempt(attempt: number): number {
  return Math.min(60_000, 1000 * 2 ** Math.max(0, attempt - 1))
}

export async function enqueueJob(job: JobPayload, delayMs = 0): Promise<void> {
  const payload = JSON.stringify({ ...job, attempt: job.attempt ?? 1 })
  if (delayMs > 0) {
    await redis.zadd(RedisKeys.jobsDelayed, Date.now() + delayMs, payload)
  } else {
    await redis.lpush(RedisKeys.jobsQueue, payload)
  }
}

async function promoteDelayedJobs(): Promise<void> {
  const now = Date.now()
  const due = await redis.zrangebyscore(RedisKeys.jobsDelayed, 0, now)
  for (const item of due) {
    await redis.lpush(RedisKeys.jobsQueue, item)
    await redis.zrem(RedisKeys.jobsDelayed, item)
  }
}

async function processJob(raw: string): Promise<void> {
  const job = JSON.parse(raw) as JobPayload & { attempt?: number }
  const attempt = job.attempt ?? 1

  try {
    if (job.type === 'load_fragstack_config') {
      const { matchService } = await import('../match.service')
      await matchService.runLoadFragstackConfigJob(job.matchId)
    } else if (job.type === 'teardown_dathost') {
      const { matchService } = await import('../match.service')
      await matchService.runTeardownServerJob(job.serverId)
    }
    await dathostCircuitRecordSuccess()
  } catch (error) {
    console.error('[job-queue] job failed', job.type, error)
    await dathostCircuitRecordFailure()

    if (attempt < MAX_JOB_ATTEMPTS) {
      await enqueueJob({ ...job, attempt: attempt + 1 }, delayMsForAttempt(attempt + 1))
    }
  }
}

export function startJobWorker(): void {
  void (async function loop() {
    for (;;) {
      try {
        await promoteDelayedJobs()
        const result = await redisWorker.brpop(RedisKeys.jobsQueue, 2)
        if (!result) continue
        const [, payload] = result
        await processJob(payload)
      } catch (error) {
        console.error('[job-queue] worker loop error', error)
        await new Promise((r) => setTimeout(r, 1000))
      }
    }
  })()
}
