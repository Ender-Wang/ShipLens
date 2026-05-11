package com.shiplens.jetbrains.core.semantics

import com.shiplens.jetbrains.core.SortKey
import com.shiplens.jetbrains.core.TagInfo

internal data class PickFirstReleaseResult(
  val picked: TagInfo?,
  /** All candidates left after filtering, sorted ascending by the chosen key. */
  val candidates: List<TagInfo>,
)

/**
 * Apply ShipLens' "first release" rules to the set of containing tags.
 * Pure logic, mirror of @shiplens/core's `semantics/pickFirstRelease.ts`.
 */
internal fun pickFirstRelease(
  containingTagNames: List<String>,
  tagIndex: Map<String, TagInfo>,
  exclude: List<String> = emptyList(),
  sortBy: SortKey = SortKey.COMMITTER_DATE,
): PickFirstReleaseResult {
  val candidates = containingTagNames
    .asSequence()
    .mapNotNull { tagIndex[it] }
    .filter { meta -> exclude.none { pat -> Glob.matches(meta.name, pat) } }
    .sortedWith(compare(sortBy))
    .toList()

  return PickFirstReleaseResult(picked = candidates.firstOrNull(), candidates = candidates)
}

private fun compare(@Suppress("UNUSED_PARAMETER") sortBy: SortKey): Comparator<TagInfo> {
  // v0.1: only committerDate is implemented. Other keys fall through to the
  // same comparison and are tracked for a later iteration.
  return compareBy { it.committerDate }
}
