package com.shiplens.jetbrains.core

import com.shiplens.jetbrains.core.git.GitExecException
import com.shiplens.jetbrains.core.git.blameLine
import com.shiplens.jetbrains.core.git.tagsContaining
import com.shiplens.jetbrains.core.semantics.pickFirstRelease
import java.io.File

/**
 * The single function the editor shell calls per cursor change. Composes
 * blame → containing-tags → first-release picking, mapping every failure mode
 * onto a [LineReleaseResult] variant rather than throwing — so the UI never
 * has to translate exceptions.
 *
 * Mirror of `@shiplens/core`'s `resolve.ts`.
 */
fun resolveLineRelease(req: ResolveRequest): LineReleaseResult {
  val tagInclude = req.options.tagInclude.ifEmpty { "*" }

  // VSCode-side normalizes file paths via realpath because of macOS' /var → /private/var
  // symlink. JetBrains' VirtualFileSystem already gives us canonical paths, so no
  // explicit realpath here — but we still defensively resolve to absolute.
  val filePath = File(req.filePath).absoluteFile.canonicalPath
  val repoRoot = File(req.repoRoot).absoluteFile.canonicalPath

  val blame = try {
    blameLine(repoRoot = repoRoot, filePath = filePath, line = req.line, followRenames = req.options.followRenames)
  } catch (e: GitExecException) {
    return LineReleaseResult.NotTracked(reason = shortReason(e))
  }

  if (blame == null) return LineReleaseResult.Uncommitted

  val repoState = RepoStateCache.get(repoRoot, tagInclude)

  val containing = try {
    tagsContaining(
      repoRoot = repoRoot,
      sha = blame.sha,
      pattern = if (tagInclude != "*") tagInclude else null,
    )
  } catch (e: GitExecException) {
    return if (repoState.meta.isShallow) LineReleaseResult.LimitedHistory(blame.sha)
    else LineReleaseResult.NotTracked(shortReason(e))
  }

  if (containing.isEmpty()) {
    return if (repoState.meta.isShallow) LineReleaseResult.LimitedHistory(blame.sha)
    else LineReleaseResult.Unreleased(
      sha = blame.sha,
      summary = blame.summary,
      author = blame.author,
      authorTime = blame.authorTime,
    )
  }

  val pick = pickFirstRelease(
    containingTagNames = containing,
    tagIndex = repoState.tagIndex,
    exclude = req.options.tagExclude,
    sortBy = req.options.sortBy,
  )

  val picked = pick.picked ?: return LineReleaseResult.Unreleased(
    // Every candidate was filtered out (e.g., only pre-release tags contain it).
    sha = blame.sha,
    summary = blame.summary,
    author = blame.author,
    authorTime = blame.authorTime,
  )

  return LineReleaseResult.Released(
    sha = blame.sha,
    summary = blame.summary,
    author = blame.author,
    authorTime = blame.authorTime,
    tag = picked.name,
    tagCommitSha = picked.commitSha,
    tagDate = picked.committerDate,
    otherTagCount = (pick.candidates.size - 1).coerceAtLeast(0),
  )
}

private fun shortReason(err: GitExecException): String {
  val text = err.stderr.trim().ifEmpty { err.message.orEmpty() }
  return if (text.length > 200) text.substring(0, 200) + "…" else text
}
