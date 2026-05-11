package com.shiplens.jetbrains.core.semantics

import java.util.concurrent.ConcurrentHashMap
import java.util.regex.Pattern

/**
 * Tiny fnmatch-style glob matcher, mirror of @shiplens/core's `semantics/glob.ts`.
 * Supports: `*` (any run), `?` (single char), `[...]` (character class).
 */
internal object Glob {
  private val cache = ConcurrentHashMap<String, Pattern>()

  fun matches(name: String, pattern: String): Boolean = compile(pattern).matcher(name).matches()

  private fun compile(pattern: String): Pattern = cache.computeIfAbsent(pattern) { translate(it) }

  private fun translate(pattern: String): Pattern {
    val sb = StringBuilder("^")
    var i = 0
    while (i < pattern.length) {
      when (val ch = pattern[i]) {
        '*' -> sb.append(".*")
        '?' -> sb.append('.')
        '[' -> {
          val close = pattern.indexOf(']', i + 1)
          if (close == -1) {
            sb.append("\\[")
          } else {
            sb.append('[').append(pattern.substring(i + 1, close).replace("\\", "\\\\")).append(']')
            i = close
          }
        }

        '\\', '^', '$', '.', '+', '|', '(', ')', '{', '}' -> sb.append('\\').append(ch)
        else -> sb.append(ch)
      }
      i++
    }
    sb.append('$')
    return Pattern.compile(sb.toString())
  }
}
