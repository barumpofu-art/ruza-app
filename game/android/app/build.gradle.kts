plugins {
  id("com.android.application")
}

// The APK is a thin WebView shell: the game itself is the web app one directory
// up, copied in as assets so there is only ever one copy of the source.
val gameAssets = layout.buildDirectory.dir("gameAssets")

val copyGameAssets by tasks.registering(Copy::class) {
  from(rootProject.file("..")) {
    include(
      "index.html", "app.css", "manifest.webmanifest", "sw.js",
      "icon.svg", "icon-maskable.svg",
      "icon-192.png", "icon-512.png", "icon-maskable-512.png",
      "js/**"
    )
  }
  into(gameAssets)
}

android {
  namespace = "app.kgosi.cadre"
  compileSdk = 34

  defaultConfig {
    applicationId = "app.kgosi.cadre"
    minSdk = 24
    targetSdk = 34
    // CI passes these from game/VERSION so the package, the title screen and
    // the release tag all say the same thing. A local build is just "dev".
    versionCode = (project.findProperty("kgosiVersionCode") as String?)?.toInt() ?: 1
    versionName = (project.findProperty("kgosiVersionName") as String?) ?: "dev"
  }

  buildTypes {
    debug {
      isMinifyEnabled = false
    }
    release {
      isMinifyEnabled = false
      proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  sourceSets["main"].assets.srcDir(gameAssets)

  buildFeatures {
    buildConfig = false
  }
}

tasks.named("preBuild") { dependsOn(copyGameAssets) }
tasks.matching { it.name.startsWith("merge") && it.name.endsWith("Assets") }.configureEach {
  dependsOn(copyGameAssets)
}
