const memoryCache = new Map()
const pendingSets = new Map()
const tagsManifest = { items: {} }
const DEBUG = process.env.DEBUG_CACHE === 'true'

function log(method, info) {
  if (!DEBUG) return
  console.log(`[MyHandler:${method}]`, info)
}

function isTagStale(tags = [], entryTimestamp) {
  if (!tags?.length) return false

  for (const tag of tags) {
    const revalidatedAt = tagsManifest.items[tag]?.revalidatedAt || 0
    if (revalidatedAt && entryTimestamp < revalidatedAt) {
      return true
    }
  }
  return false
}

/** @implements {import('./types').CacheHandler} */
const MyHandler = {
  async get(cacheKey, softTags) {
    log('get', { key: cacheKey, softTags: softTags?.length })

    await pendingSets.get(cacheKey)
    const privateEntry = memoryCache.get(cacheKey)

    if (!privateEntry) {
      log('get:miss', { key: cacheKey })
      return undefined
    }

    const entry = privateEntry.entry
    if (
      performance.timeOrigin + performance.now() >
      entry.timestamp + entry.revalidate * 1000
    ) {
      return undefined
    }

    if (
      isTagStale(entry.tags, entry.timestamp) ||
      isTagStale(softTags, entry.timestamp)
    ) {
      return undefined
    }

    const [returnStream, newSaved] = entry.value.tee()
    entry.value = newSaved

    log('get:hit', { key: cacheKey })
    return {
      ...entry,
      value: returnStream,
    }
  },

  async set(cacheKey, pendingEntry) {
    log('set', { key: cacheKey })

    let resolvePending = () => { }
    const pendingPromise = new Promise((resolve) => {
      resolvePending = resolve
    })
    pendingSets.set(cacheKey, pendingPromise)

    const entry = await pendingEntry
    let size = 0

    try {
      const [value, clonedValue] = entry.value.tee()
      entry.value = value
      const reader = clonedValue.getReader()

      while (true) {
        const { done, value: chunk } = await reader.read()
        if (done) break
        size += Buffer.from(chunk).byteLength
      }

      if (!entry.tags || !Array.isArray(entry.tags)) {
        throw new Error('Cache entry must have tags array')
      }
      if (typeof entry.timestamp !== 'number') {
        entry.timestamp = Date.now()
      }
      if (typeof entry.expire !== 'number' || entry.expire <= 0) {
        throw new Error('Cache entry must have positive expire time')
      }
      if (typeof entry.revalidate !== 'number' || entry.revalidate <= 0) {
        throw new Error('Cache entry must have positive revalidate time')
      }

      memoryCache.set(cacheKey, {
        entry,
        isErrored: false,
        errorRetryCount: 0,
        size,
      })

      log('set:success', { key: cacheKey, size })
    } catch (err) {
      log('set:error', { key: cacheKey, error: err.message })
      memoryCache.set(cacheKey, {
        entry,
        isErrored: true,
        errorRetryCount: (memoryCache.get(cacheKey)?.errorRetryCount || 0) + 1,
        size,
      })
    } finally {
      resolvePending()
      pendingSets.delete(cacheKey)
    }
  },

  async expireTags(...tags) {
    log('expireTags', { tags, count: tags.length })

    const now = Date.now()
    for (const tag of tags) {
      if (!tagsManifest.items[tag]) {
        tagsManifest.items[tag] = {}
      }
      tagsManifest.items[tag].revalidatedAt = now
    }

    log('expireTags:complete', { tags })
  },

  async receiveExpiredTags(...tags) {
    log('receiveExpiredTags', { tags, count: tags.length })
    return this.expireTags(...tags)
  },
}

module.exports = MyHandler 