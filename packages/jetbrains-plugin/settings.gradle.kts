pluginManagement {
  repositories {
    gradlePluginPortal()
  }
}

plugins {
  // Auto-provisions any JDK toolchain that's not already installed. Saves
  // contributors from a `brew install --cask temurin@17` step.
  id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

rootProject.name = "shiplens-jetbrains"
