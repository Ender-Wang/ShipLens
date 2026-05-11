package com.shiplens.jetbrains.editor

import com.intellij.openapi.fileEditor.FileEditorManagerEvent
import com.intellij.openapi.fileEditor.FileEditorManagerListener
import com.intellij.openapi.wm.WindowManager
import com.shiplens.jetbrains.statusbar.ShipLensStatusBarWidget

/**
 * Project-level listener — when the active file editor changes, re-attach
 * the caret listener (the StatusBarWidget itself only sees its initial editor).
 *
 * IDEA exposes editor switches through the FileEditorManager bus; nudging the
 * status bar to re-evaluate is enough — the widget's selectionChanged hook
 * picks up the new editor and re-binds.
 */
class ShipLensFileEditorListener : FileEditorManagerListener {
  override fun selectionChanged(event: FileEditorManagerEvent) {
    val project = event.manager.project
    val statusBar = WindowManager.getInstance().getStatusBar(project) ?: return
    statusBar.updateWidget(ShipLensStatusBarWidget.ID)
  }
}
