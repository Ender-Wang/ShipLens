plugins {
  id("org.jetbrains.kotlin.jvm") version "2.2.0"
  id("org.jetbrains.intellij.platform") version "2.16.0"
}

group = providers.gradleProperty("pluginGroup").get()
version = providers.gradleProperty("pluginVersion").get()

repositories {
  mavenCentral()
  intellijPlatform {
    defaultRepositories()
  }
}

dependencies {
  intellijPlatform {
    val localIde = providers.gradleProperty("localIdePath").orNull?.takeIf { it.isNotBlank() }
    if (localIde != null) {
      // Use the user's locally-installed IDE — saves the platform download.
      local(file(localIde))
    } else {
      // Fall back to downloading the platform from JetBrains (slower, larger).
      create(
        providers.gradleProperty("platformType").get(),
        providers.gradleProperty("platformVersion").get(),
      )
    }
    // Bundled IntelliJ git plugin — gives us Git4Idea APIs if we want them later.
    // For v0.1 we shell out via ProcessBuilder, mirroring @shiplens/core, but
    // declaring the dependency keeps the door open without rebuilding.
    bundledPlugin("Git4Idea")
  }
}

intellijPlatform {
  pluginConfiguration {
    name = providers.gradleProperty("pluginName")
    version = providers.gradleProperty("pluginVersion")

    ideaVersion {
      sinceBuild = providers.gradleProperty("sinceBuild")
      untilBuild = providers.gradleProperty("untilBuild")
    }
  }

  publishing {
    // Reads from environment so secrets stay out of the repo.
    // Set JETBRAINS_MARKETPLACE_TOKEN before running `publishPlugin`.
    token = providers.environmentVariable("JETBRAINS_MARKETPLACE_TOKEN")
  }
}

kotlin {
  jvmToolchain(providers.gradleProperty("javaVersion").get().toInt())
}

tasks {
  wrapper {
    gradleVersion = "9.5"
  }
}
