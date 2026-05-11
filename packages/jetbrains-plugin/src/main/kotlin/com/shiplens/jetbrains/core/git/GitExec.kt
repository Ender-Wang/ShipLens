package com.shiplens.jetbrains.core.git

import java.io.File
import java.nio.charset.StandardCharsets
import java.util.concurrent.TimeUnit

/**
 * Errors thrown by [runGit]. Distinguishes "git executed and returned non-zero"
 * (most common) from "git couldn't even start" (binary missing or timed out).
 */
class GitExecException(
  val args: List<String>,
  val cwd: String,
  val exitCode: Int?,
  val stderr: String,
  val stdout: String,
) : RuntimeException(buildMessage(args, cwd, exitCode, stderr, stdout)) {
  companion object {
    private fun buildMessage(args: List<String>, cwd: String, exitCode: Int?, stderr: String, stdout: String): String {
      val tail = stderr.trim().ifEmpty { stdout.trim() }.ifEmpty { "<no output>" }
      return "git ${args.joinToString(" ")} (cwd=$cwd) exited with $exitCode: $tail"
    }
  }
}

/**
 * Run `git <args>` in [cwd], returning stdout. Stable wrapper used by every
 * other function in this package — never call `ProcessBuilder` directly.
 */
internal fun runGit(
  args: List<String>,
  cwd: String,
  timeoutMs: Long = 10_000,
): String {
  val pb = ProcessBuilder(listOf("git") + args)
    .directory(File(cwd))
    .redirectErrorStream(false)

  val process = try {
    pb.start()
  } catch (e: Exception) {
    throw GitExecException(args, cwd, null, e.message.orEmpty(), "")
  }

  val stdoutBuffer = StringBuilder()
  val stderrBuffer = StringBuilder()
  val stdoutThread = Thread {
    process.inputStream.bufferedReader(StandardCharsets.UTF_8).use { it.copyTo(stdoutBuffer) }
  }.apply { isDaemon = true; start() }
  val stderrThread = Thread {
    process.errorStream.bufferedReader(StandardCharsets.UTF_8).use { it.copyTo(stderrBuffer) }
  }.apply { isDaemon = true; start() }

  val finished = process.waitFor(timeoutMs, TimeUnit.MILLISECONDS)
  if (!finished) {
    process.destroyForcibly()
    throw GitExecException(args, cwd, null, "timed out after ${timeoutMs}ms", "")
  }

  // Drain readers; threads exit on EOF.
  stdoutThread.join(500)
  stderrThread.join(500)

  val exit = process.exitValue()
  if (exit != 0) {
    throw GitExecException(args, cwd, exit, stderrBuffer.toString(), stdoutBuffer.toString())
  }
  return stdoutBuffer.toString()
}

private fun java.io.Reader.copyTo(out: StringBuilder) {
  val buf = CharArray(8192)
  while (true) {
    val n = read(buf)
    if (n == -1) break
    out.append(buf, 0, n)
  }
}
