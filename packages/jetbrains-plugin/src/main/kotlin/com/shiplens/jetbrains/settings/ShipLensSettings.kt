package com.shiplens.jetbrains.settings

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.RoamingType
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.util.xmlb.XmlSerializerUtil
import com.shiplens.jetbrains.core.ResolveOptions

@Service(Service.Level.APP)
@State(
  name = "ShipLensSettings",
  storages = [Storage(value = "shiplens.xml", roamingType = RoamingType.PER_OS)],
)
class ShipLensSettings : PersistentStateComponent<ShipLensSettings.State> {

  data class State(
    var tagInclude: String = "*",
    var tagExclude: MutableList<String> = ResolveOptions.DEFAULT_TAG_EXCLUDE.toMutableList(),
    var debounceMs: Int = 150,
    var followRenames: Boolean = false,
  )

  private var state = State()

  override fun getState(): State = state

  override fun loadState(other: State) {
    XmlSerializerUtil.copyBean(other, state)
  }

  fun toResolveOptions(): ResolveOptions = ResolveOptions(
    tagInclude = state.tagInclude.ifBlank { "*" },
    tagExclude = state.tagExclude.toList(),
    followRenames = state.followRenames,
  )

  val debounceMs: Int get() = state.debounceMs.coerceIn(0, 2000)

  companion object {
    fun get(): ShipLensSettings = ApplicationManager.getApplication().getService(ShipLensSettings::class.java)
  }
}
