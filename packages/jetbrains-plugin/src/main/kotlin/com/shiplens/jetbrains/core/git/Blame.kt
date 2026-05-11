package com.shiplens.jetbrains.core.git

import com.shiplens.jetbrains.core.BlameLineInfo
import java.io.File
import java.time.Instant

private val ZERO_SHA = Regex("^0+$")

/**
 * Blame a single line. Returns `null` if the line is uncommitted (working-tree
 * edit, blame returns the all-zero sentinel SHA) so callers can map that to
 * the `Uncommitted` UI state without inspecting the SHA themselves.
 *
 * Mirrors `@shiplens/core`'s `git/blame.ts`, including the deliberate omission
 * of an explicit ref (working-tree blame is what the user sees in the editor).
 */
internal fun blameLine(
  repoRoot: String,
  filePath: String,
  line: Int,
  followRenames: Boolean = false,
): BlameLineInfo? {
  require(line >= 1) { "blameLine: line must be a positive integer, got $line" }

  val rel = File(repoRoot).toPath().relativize(File(filePath).toPath()).toString()

  val args = mutableListOf("blame", "--porcelain", "-L", "$line,$line")
  if (followRenames) args.add("--follow")
  args.add("--")
  args.add(rel)

  val stdout = runGit(args, cwd = repoRoot)
  return parsePorcelainBlame(stdout)
}

/** Parse single-line porcelain blame output. */
private fun parsePorcelainBlame(stdout: String): BlameLineInfo? {
  val lines = stdout.split('\n')
  if (lines.isEmpty() || lines[0].isEmpty()) return null

  val sha = lines[0].split(' ').firstOrNull().orEmpty()
  if (sha.isEmpty() || ZERO_SHA.matches(sha)) return null

  var summary: String? = null
  var author: String? = null
  var authorTime: String? = null

  for (i in 1 until lines.size) {
    val ln = lines[i]
    if (ln.startsWith("\t")) break // body line — end of headers
    when {
      ln.startsWith("summary ") -> summary = ln.removePrefix("summary ")
      ln.startsWith("author ") -> author = ln.removePrefix("author ")
      ln.startsWith("author-time ") -> {
        val epoch = ln.removePrefix("author-time ").trim().toLongOrNull()
        if (epoch != null) authorTime = Instant.ofEpochSecond(epoch).toString()
      }
    }
  }

  return BlameLineInfo(sha = sha, summary = summary, author = author, authorTime = authorTime)
}
