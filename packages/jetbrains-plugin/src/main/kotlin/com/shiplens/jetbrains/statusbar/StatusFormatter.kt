package com.shiplens.jetbrains.statusbar

import com.shiplens.jetbrains.core.LineReleaseResult
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import org.jetbrains.annotations.Nls

/** What the status bar shows: short text + HTML tooltip. */
internal data class StatusDisplay(@param:Nls val text: String, @param:Nls val tooltipHtml: String)

private const val SHIP = "🚢"

/**
 * Map a [LineReleaseResult] to a status-bar text + HTML tooltip.
 * Mirrors the VSCode extension's `format.ts`.
 */
internal fun formatResult(result: LineReleaseResult): StatusDisplay = when (result) {
  is LineReleaseResult.Released -> StatusDisplay(
    text = "$SHIP ${result.tag}",
    tooltipHtml = htmlBlock(
      "<b>ShipLens</b> — first release: <code>${esc(result.tag)}</code>",
      "",
      "<b>Commit</b>: <code>${shortSha(result.sha)}</code>" +
        if (!result.summary.isNullOrBlank()) " — ${esc(result.summary)}" else "",
      result.author?.let { "<b>Author</b>: ${esc(it)}" },
      result.authorTime?.let { "<b>Authored</b>: ${formatDate(it)}" },
      "",
      "<b>Tag points to</b>: <code>${shortSha(result.tagCommitSha)}</code>",
      "<b>Tag dated</b>: ${formatDate(result.tagDate)}",
      if (result.otherTagCount > 0)
        "<i>Also contained in ${result.otherTagCount} other tag${if (result.otherTagCount == 1) "" else "s"}.</i>"
      else null,
    ),
  )

  is LineReleaseResult.Unreleased -> StatusDisplay(
    text = "$SHIP Unreleased",
    tooltipHtml = htmlBlock(
      "<b>ShipLens</b> — this commit is not part of any release tag yet.",
      "",
      "<b>Commit</b>: <code>${shortSha(result.sha)}</code>" +
        if (!result.summary.isNullOrBlank()) " — ${esc(result.summary)}" else "",
      result.author?.let { "<b>Author</b>: ${esc(it)}" },
      result.authorTime?.let { "<b>Authored</b>: ${formatDate(it)}" },
    ),
  )

  LineReleaseResult.Uncommitted -> StatusDisplay(
    text = "$SHIP Uncommitted",
    tooltipHtml = "<b>ShipLens</b> — this line has uncommitted changes in the working tree.",
  )

  is LineReleaseResult.LimitedHistory -> StatusDisplay(
    text = "$SHIP Limited history",
    tooltipHtml = htmlBlock(
      "<b>ShipLens</b> — repository has shallow history; cannot reliably determine the first release.",
      "",
      "<b>Commit</b>: <code>${shortSha(result.sha)}</code>",
      "",
      "Run <code>git fetch --unshallow</code> to enable full lookups.",
    ),
  )

  is LineReleaseResult.NotTracked -> StatusDisplay(
    text = "$SHIP —",
    tooltipHtml = htmlBlock(
      "<b>ShipLens</b> — file is not tracked by git, or git query failed.",
      "",
      "<i>${esc(result.reason)}</i>",
    ),
  )
}

private fun htmlBlock(vararg lines: String?): String {
  val body = lines.filterNotNull().joinToString("<br>")
  return "<html>$body</html>"
}

private fun shortSha(sha: String): String = sha.take(8)

private fun formatDate(iso: String): String = try {
  val instant = Instant.parse(iso)
  DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").withZone(ZoneId.systemDefault()).format(instant)
} catch (_: Exception) {
  iso
}

private fun esc(s: String): String = s
  .replace("&", "&amp;")
  .replace("<", "&lt;")
  .replace(">", "&gt;")
