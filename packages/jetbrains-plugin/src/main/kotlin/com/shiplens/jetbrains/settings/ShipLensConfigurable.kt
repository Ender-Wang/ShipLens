package com.shiplens.jetbrains.settings

import com.intellij.openapi.options.Configurable
import com.intellij.ui.components.JBCheckBox
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBTextField
import com.intellij.util.ui.FormBuilder
import com.intellij.util.ui.JBUI
import javax.swing.JComponent
import javax.swing.JPanel

/**
 * Settings UI under Preferences → Tools → ShipLens.
 *
 * Kept minimal for v0.1: only the fields the user is likely to tweak. The
 * tagExclude list is rendered as a comma-separated string in the field; for
 * power users who want array-style editing, a future revision can swap in
 * [com.intellij.ui.CollectionListModel] backed list editor.
 */
class ShipLensConfigurable : Configurable {
  private val settings get() = ShipLensSettings.get().state

  private val tagIncludeField = JBTextField()
  private val tagExcludeField = JBTextField()
  private val debounceField = JBTextField()
  private val followRenamesCheck = JBCheckBox("Follow file renames in `git blame` (slower on rename-heavy histories)")

  override fun getDisplayName(): String = "ShipLens"

  override fun createComponent(): JComponent {
    val panel: JPanel = FormBuilder.createFormBuilder()
      .addLabeledComponent(JBLabel("Tag include glob:"), tagIncludeField, 1, false)
      .addTooltip("Pattern passed to `git tag --contains`. Use `v*` to limit to versioned tags, or a project-specific prefix.")
      .addLabeledComponent(JBLabel("Tag exclude globs (comma-separated):"), tagExcludeField, 1, false)
      .addTooltip("Patterns dropped after the include filter. Defaults cover common pre-release suffixes and the `rescue/*` namespace.")
      .addLabeledComponent(JBLabel("Debounce (ms):"), debounceField, 1, false)
      .addTooltip("Delay between cursor movement and the next query.")
      .addComponent(followRenamesCheck)
      .addComponentFillVertically(JPanel(), 0)
      .panel

    panel.border = JBUI.Borders.empty(10)
    reset()
    return panel
  }

  override fun isModified(): Boolean {
    val s = settings
    return tagIncludeField.text.trim() != s.tagInclude ||
      excludeListFromField() != s.tagExclude.toList() ||
      (debounceField.text.toIntOrNull() ?: -1) != s.debounceMs ||
      followRenamesCheck.isSelected != s.followRenames
  }

  override fun apply() {
    val s = settings
    s.tagInclude = tagIncludeField.text.trim().ifBlank { "*" }
    s.tagExclude = excludeListFromField().toMutableList()
    s.debounceMs = (debounceField.text.toIntOrNull() ?: 150).coerceIn(0, 2000)
    s.followRenames = followRenamesCheck.isSelected
  }

  override fun reset() {
    val s = settings
    tagIncludeField.text = s.tagInclude
    tagExcludeField.text = s.tagExclude.joinToString(", ")
    debounceField.text = s.debounceMs.toString()
    followRenamesCheck.isSelected = s.followRenames
  }

  private fun excludeListFromField(): List<String> =
    tagExcludeField.text
      .splitToSequence(',')
      .map { it.trim() }
      .filter { it.isNotEmpty() }
      .toList()
}
