package com.shiplens.jetbrains.core.git

import com.shiplens.jetbrains.core.TagInfo

/**
 * Names of tags whose tip-or-pointed-commit contains [sha]. One subprocess.
 * Pattern is passed to `git tag` (an fnmatch glob, e.g. `v*`).
 */
internal fun tagsContaining(repoRoot: String, sha: String, pattern: String? = null): List<String> {
  val args = mutableListOf("tag", "--contains", sha)
  if (!pattern.isNullOrBlank() && pattern != "*") args.add(pattern)
  return runGit(args, cwd = repoRoot)
    .splitToSequence('\n')
    .map { it.trim() }
    .filter { it.isNotEmpty() }
    .toList()
}

private const val FIELD_SEP = "\u001f" // ASCII unit separator
private val FORMAT = listOf(
  "%(refname:short)",
  "%(*objectname)",
  "%(objectname)",
  "%(*committerdate:iso-strict)",
  "%(committerdate:iso-strict)",
).joinToString(FIELD_SEP)

/**
 * Snapshot of all tag metadata in the repo, optionally filtered by a glob.
 * One subprocess regardless of tag count, so safe to call eagerly.
 *
 * Annotated tags expose `*objectname` / `*committerdate` (the pointed-to
 * commit). Lightweight tags ARE the commit, so `objectname` / `committerdate`
 * already refer to it. We pick whichever is non-empty.
 */
internal fun loadAllTagInfo(repoRoot: String, pattern: String? = null): List<TagInfo> {
  val refspec = if (!pattern.isNullOrBlank() && pattern != "*") "refs/tags/$pattern" else "refs/tags/"
  val out = runGit(listOf("for-each-ref", "--format=$FORMAT", refspec), cwd = repoRoot)

  val tags = mutableListOf<TagInfo>()
  for (line in out.split('\n')) {
    if (line.isEmpty()) continue
    val parts = line.split(FIELD_SEP)
    if (parts.size < 5) continue
    val name = parts[0]
    val starObject = parts[1]
    val obj = parts[2]
    val starDate = parts[3]
    val date = parts[4]
    val commitSha = (if (starObject.isNotBlank()) starObject else obj).trim()
    val committerDate = (if (starDate.isNotBlank()) starDate else date).trim()
    if (name.isBlank() || commitSha.isBlank()) continue
    tags.add(TagInfo(name = name, commitSha = commitSha, committerDate = committerDate))
  }
  return tags
}
