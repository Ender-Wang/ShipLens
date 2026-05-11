package com.shiplens.jetbrains.statusbar

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.editor.event.CaretEvent
import com.intellij.openapi.editor.event.CaretListener
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.fileEditor.FileEditorManagerEvent
import com.intellij.openapi.fileEditor.FileEditorManagerListener
import com.intellij.openapi.fileEditor.TextEditor
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.wm.StatusBar
import com.intellij.openapi.wm.StatusBarWidget
import com.intellij.openapi.wm.StatusBarWidgetFactory
import com.intellij.openapi.wm.impl.status.EditorBasedWidget
import com.intellij.util.Alarm
import com.intellij.util.messages.MessageBusConnection
import com.shiplens.jetbrains.core.LineReleaseResult
import com.shiplens.jetbrains.core.ResolveRequest
import com.shiplens.jetbrains.core.git.findRepoRoot
import com.shiplens.jetbrains.core.resolveLineRelease
import com.shiplens.jetbrains.settings.ShipLensSettings

/**
 * Status bar widget that mirrors the VSCode extension's status bar item.
 * Listens to caret movement on the active text editor; debounces; runs
 * resolveLineRelease on a background thread; updates the widget on EDT.
 */
internal class ShipLensStatusBarWidget(project: Project) :
  EditorBasedWidget(project),
  StatusBarWidget.MultipleTextValuesPresentation {

  companion object {
    const val ID: String = "ShipLensStatusBarWidget"
    private val LOG = Logger.getInstance(ShipLensStatusBarWidget::class.java)
  }

  private val alarm = Alarm(Alarm.ThreadToUse.SWING_THREAD, this)
  private val executor = ApplicationManager.getApplication()
  private var current: StatusDisplay? = null
  private var lastQueryKey: String? = null
  /** Monotonic id used to drop stale async results. */
  private var currentRequestId: Long = 0
  private val caretListener = WidgetCaretListener()
  private var bus: MessageBusConnection? = null

  override fun ID(): String = ID

  override fun getPresentation(): StatusBarWidget.WidgetPresentation = this

  override fun getSelectedValue(): String? = current?.text

  override fun getTooltipText(): String? = current?.tooltipHtml

  override fun install(statusBar: StatusBar) {
    super.install(statusBar)
    val proj = project ?: return

    bus = proj.messageBus.connect(this).also { conn ->
      conn.subscribe(FileEditorManagerListener.FILE_EDITOR_MANAGER, object : FileEditorManagerListener {
        override fun selectionChanged(event: FileEditorManagerEvent) = scheduleRefresh()
      })
    }
    attachCaretListenerToActiveEditor()
    scheduleRefresh(0)
  }

  override fun dispose() {
    bus?.disconnect()
    bus = null
    Disposer.dispose(alarm)
    super.dispose()
  }

  private fun attachCaretListenerToActiveEditor() {
    val proj = project ?: return
    val editor = (FileEditorManager.getInstance(proj).selectedEditor as? TextEditor)?.editor ?: return
    editor.caretModel.addCaretListener(caretListener, this)
  }

  private fun scheduleRefresh(delayOverrideMs: Int? = null) {
    val delay = delayOverrideMs ?: ShipLensSettings.get().debounceMs
    alarm.cancelAllRequests()
    alarm.addRequest({ refreshNow() }, delay)
  }

  private fun refreshNow() {
    val proj = project ?: return
    val editor = (FileEditorManager.getInstance(proj).selectedEditor as? TextEditor)?.editor

    if (editor == null) {
      hideAndForget()
      return
    }

    val virtualFile = editor.virtualFile ?: run { hideAndForget(); return }
    if (virtualFile.fileSystem.protocol != "file") {
      hideAndForget()
      return
    }

    val filePath = virtualFile.path
    val line = editor.caretModel.primaryCaret.logicalPosition.line + 1 // IDE is 0-based; git is 1-based
    val docStamp = editor.document.modificationStamp
    val queryKey = "$filePath::$line::$docStamp"
    if (queryKey == lastQueryKey) return
    lastQueryKey = queryKey

    val requestId = ++currentRequestId
    val settings = ShipLensSettings.get()

    executor.executeOnPooledThread {
      val repoRoot = findRepoRoot(filePath)
      if (repoRoot == null) {
        // Not in a git repo — clear the widget.
        ApplicationManager.getApplication().invokeLater {
          if (requestId == currentRequestId) hideAndForget()
        }
        return@executeOnPooledThread
      }

      val result: LineReleaseResult = try {
        resolveLineRelease(
          ResolveRequest(
            repoRoot = repoRoot,
            filePath = filePath,
            line = line,
            options = settings.toResolveOptions(),
          ),
        )
      } catch (e: Throwable) {
        LOG.warn("ShipLens resolve failed: ${e.message}", e)
        LineReleaseResult.NotTracked(e.message ?: "unknown")
      }

      ApplicationManager.getApplication().invokeLater {
        if (requestId != currentRequestId) return@invokeLater
        current = formatResult(result)
        myStatusBar?.updateWidget(ID)
      }
    }
  }

  private fun hideAndForget() {
    current = null
    lastQueryKey = null
    myStatusBar?.updateWidget(ID)
  }

  private inner class WidgetCaretListener : CaretListener {
    override fun caretPositionChanged(event: CaretEvent) = scheduleRefresh()
  }
}

/** Factory wired in plugin.xml. */
internal class ShipLensStatusBarWidgetFactory : StatusBarWidgetFactory {
  override fun getId(): String = ShipLensStatusBarWidget.ID
  override fun getDisplayName(): String = "ShipLens"
  override fun isAvailable(project: Project): Boolean = true
  override fun createWidget(project: Project): StatusBarWidget = ShipLensStatusBarWidget(project)
  override fun canBeEnabledOn(statusBar: StatusBar): Boolean = true
  override fun isConfigurable(): Boolean = true
}
