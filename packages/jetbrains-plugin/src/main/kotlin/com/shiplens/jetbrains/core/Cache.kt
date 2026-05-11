package com.shiplens.jetbrains.core

import com.shiplens.jetbrains.core.git.loadAllTagInfo
import com.shiplens.jetbrains.core.git.loadRepoMeta
import java.util.concurrent.ConcurrentHashMap

/**
 * Per-repo state cache: shallow flag + tag metadata index. Tag listings are
 * relatively cheap but happen on every line query, so caching is worthwhile.
 * The TTL guards against stale data after the user pulls or fetches.
 */
internal data class RepoCacheEntry(
  val meta: RepoMeta,
  val tagIndex: Map<String, TagInfo>,
  val loadedAt: Long,
)

internal object RepoStateCache {
  private const val TTL_MS = 60_000L
  private val cache = ConcurrentHashMap<String, RepoCacheEntry>()

  fun get(repoRoot: String, tagInclude: String? = null): RepoCacheEntry {
    val cached = cache[repoRoot]
    val now = System.currentTimeMillis()
    if (cached != null && now - cached.loadedAt < TTL_MS) {
      return cached
    }

    val meta = loadRepoMeta(repoRoot)
    val tags = loadAllTagInfo(repoRoot, tagInclude)
    val entry = RepoCacheEntry(
      meta = meta,
      tagIndex = tags.associateBy { it.name },
      loadedAt = now,
    )
    cache[repoRoot] = entry
    return entry
  }

  fun invalidate(repoRoot: String? = null) {
    if (repoRoot != null) cache.remove(repoRoot) else cache.clear()
  }
}
