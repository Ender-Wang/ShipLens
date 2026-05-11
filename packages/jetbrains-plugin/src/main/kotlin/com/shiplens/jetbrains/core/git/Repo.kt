package com.shiplens.jetbrains.core.git

import com.shiplens.jetbrains.core.RepoMeta
import java.io.File

/**
 * Locate the repo containing [filePath], or `null` if it isn't tracked by git.
 * Resolves symlinks via `--show-toplevel`, which returns a canonical path
 * (matches `@shiplens/core`'s behavior).
 */
internal fun findRepoRoot(filePath: String): String? {
  val dir = File(filePath).parentFile?.absolutePath ?: return null
  return try {
    val out = runGit(listOf("rev-parse", "--show-toplevel"), cwd = dir).trim()
    out.takeIf { it.isNotEmpty() }
  } catch (_: GitExecException) {
    null
  }
}

internal fun isShallowRepo(repoRoot: String): Boolean {
  return try {
    runGit(listOf("rev-parse", "--is-shallow-repository"), cwd = repoRoot).trim() == "true"
  } catch (_: GitExecException) {
    false
  }
}

internal fun loadRepoMeta(repoRoot: String): RepoMeta = RepoMeta(root = repoRoot, isShallow = isShallowRepo(repoRoot))
