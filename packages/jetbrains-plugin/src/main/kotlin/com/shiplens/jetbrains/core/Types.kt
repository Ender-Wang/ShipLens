package com.shiplens.jetbrains.core

/**
 * Mirror of `@shiplens/core` types. Discriminated-union style via sealed class,
 * which is the Kotlin idiom for what TS does with `kind` strings.
 */
sealed class LineReleaseResult {
  data class Released(
    val sha: String,
    val tag: String,
    val tagCommitSha: String,
    val tagDate: String,
    val otherTagCount: Int,
    val summary: String? = null,
    val author: String? = null,
    val authorTime: String? = null,
  ) : LineReleaseResult()

  data class Unreleased(
    val sha: String,
    val summary: String? = null,
    val author: String? = null,
    val authorTime: String? = null,
  ) : LineReleaseResult()

  data object Uncommitted : LineReleaseResult()

  data class LimitedHistory(val sha: String) : LineReleaseResult()

  data class NotTracked(val reason: String) : LineReleaseResult()
}

/** How candidate tags are ordered before picking the first. v0.1 only implements `committerDate`. */
enum class SortKey { COMMITTER_DATE, TAG_DATE, TOPOLOGICAL, SEMVER }

data class TagInfo(
  /** Short ref name, e.g. `v1.2.0`. */
  val name: String,
  /** Commit SHA the tag ultimately points to (peeled for annotated tags). */
  val commitSha: String,
  /** Committer date of the pointed-to commit, ISO-8601. */
  val committerDate: String,
)

data class BlameLineInfo(
  val sha: String,
  val summary: String? = null,
  val author: String? = null,
  val authorTime: String? = null,
)

data class RepoMeta(
  val root: String,
  val isShallow: Boolean,
)

data class ResolveOptions(
  val tagInclude: String = "*",
  val tagExclude: List<String> = DEFAULT_TAG_EXCLUDE,
  val sortBy: SortKey = SortKey.COMMITTER_DATE,
  val followRenames: Boolean = false,
) {
  companion object {
    /** Mirrors the VSCode extension's package.json default `shiplens.tagExclude`. */
    val DEFAULT_TAG_EXCLUDE: List<String> = listOf(
      "*-rc*", "*-beta*", "*-alpha*", "*-pre*", "*-dev*", "*-snapshot*",
      "rescue/*",
    )
  }
}

data class ResolveRequest(
  val repoRoot: String,
  /** Absolute path. */
  val filePath: String,
  /** 1-based line number. */
  val line: Int,
  val options: ResolveOptions = ResolveOptions(),
)
