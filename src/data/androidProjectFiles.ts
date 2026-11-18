/**
 * Complete Native Android (Kotlin + Jetpack Compose) Source Files
 * Ready for direct commit to https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning
 */

export interface AndroidFile {
  path: string;
  language: string;
  description: string;
  content: string;
}

export const ANDROID_PROJECT_FILES: AndroidFile[] = [
  {
    path: 'app/build.gradle.kts',
    language: 'kotlin',
    description: 'App-level build.gradle.kts with Compose, Glance Widget, WorkManager, Jsoup, and canonical signing',
    content: `import java.util.Base64

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "ua.blackout.prewarning"
    compileSdk = 36

    defaultConfig {
        val appPkgEnv = System.getenv("ANDROID_APPLICATION_ID")?.trim()?.takeIf { it.isNotBlank() }
        applicationId = appPkgEnv ?: "com.ZTBlackoutPreWarning"
        minSdk = 26
        targetSdk = 36
        versionCode = (System.getenv("GITHUB_RUN_NUMBER")?.toIntOrNull() ?: 300) + 300
        val semverEnv = System.getenv("APP_VERSION_NAME")?.removePrefix("v")?.trim()?.takeIf { it.matches(Regex("^[0-9]+\\\\.[0-9]+\\\\.[0-9]+.*")) }
        versionName = semverEnv ?: "1.4.2"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    val keystoreFile = file("keystore/debug.keystore")
    keystoreFile.parentFile?.mkdirs()
    val embeddedKeystoreBase64 = "MIIKfgIBAzCCCjQGCSqGSIb3DQEHAaCCCiUEggohMIIKHTCCBGIGCSqGSIb3DQEHBqCCBFMwggRPAgEAMIIESAYJKoZIhvcNAQcBMFcGCSqGSIb3DQEFDTBKMCkGCSqGSIb3DQEFDDAcBAjtjDCg6BpdWQICCAAwDAYIKoZIhvcNAgkFADAdBglghkgBZQMEASoEEHDgjViu37hADeCmhc9Z4z+AggPgOoRU3izhNWuSrylTSkYfBDurT8eZkRxlqYSuwHmF5t8hw/OVUusNfJywNFQLQaZD8VgIG/DE+9HdIaen3rFMNCvFch9Wh/oGol0q+s61c8QmdObBoCERvJCDK5BMaXc9Qt6g8LvNuEqSP/sR8t8R014L8DAR3K3v74tieXJLNs4k4pZrp7Vuhi23GvVDD0tR/BlJeTnD86MFCDgY5Fe7y8bJjuhDMPlVooqdwS4qJ8/6o9W+uhutMRkX3hB480+DZCR2GQiV7akUBghnd7TmoTBVLV0Uj4L7l0D+lWVNzXMaAx/11dklGUvFgCirD0fpERSDWlrhxbYck5sw3HRKug4F/e5rla5To6/kJLl+0eQz5zMlr+Jxc72bqSZ9PT3foPQJ3ZU8v1TSkudYoZWk8ussDkIRwr4ZlrXf502/LHmGV9FV142cz9IWTcKwhm/rWG244hwREZv39kKnYIH6ISYlxlCv7FPXBXzYcXdR0q+Ln5BxQzD7KB6NcF9IrUxCGuVvT0JD4GzJZokcMRU4eF0c0E7YAYfjW8BIeqDkmqRXAmDmLgU9Plfp3no22l5ok39/4DqDzWCUeuOI+xw3Dcosyh8vLDNtbF5QzGUoZQDBA+y4KNpa2MOh69a3q4+k5x/pPbk/kusU3nfkT14u0gzBh+pBWfFWhXVDeZWvAY+SMKsH1NobiNTW9MIPgkkqIPIHu+jPNrd9Q7rBxDqYyZyW2ZqNc91SpBhedvkpdnMXo7pAjbwmw4fXpUa/t4O4TqyYhYQqYKGlRicwLNvVgg8g6+zPF+BHPvSruZPb6vlL5ixvBZurDgsQwmRdMMTY7V2tyTeK3FkjAfgdnX3W2P6/xWAY3qlvpZxPbZubs6SKGeYP9FldHJiWEC8GLEjUt8xdLRV97D0ctx2T/tZIGWPHaGcPj2CvD//C+TKTnfdIBGqqODtupC44qhJJ3ZMQa/yJIOlXurzRKf/Lk+w5erNwSp91Wi2gqoUzoo5WrvOMliq1bBLHKY5/f/hJuzN8+znv1irRYOHaP4dvNPl+y+wfa4dzb+JuaQPRVhOAlUKacajXqZW7/gYtAM18D2GwYp6iy9pX4r8BppRgj0E6B4uSFvmKTrIL/98QqTqEw+GFKMoaSdDsx2rTkDLpMLVCuKoozsHFEUn8wqKu8oUnu1Z1q1Z95GVggOLu7EeF8gdtDSOqhiVsCh8j7aqzfgx6etkQnqjFWX1poGPoEamnUe5WzBQbaZ1fOqQkEJ3Mihv9Cnt1KdTJguh/nnCGc3WYgRKrWwVdKIM4im6zHETNs7aQrGqkuwxkm2Ct0F1pK84wggWzBgkqhkiG9w0BBwGgggWkBIIFoDCCBZwwggWYBgsqhkiG9w0BDAoBAqCCBTEwggUtMFcGCSqGSIb3DQEFDTBKMCkGCSqGSIb3DQEFDDAcBAhqaRMiimxSoQICCAAwDAYIKoZIhvcNAgkFADAdBglghkgBZQMEASoEEAM8J/LV8oEKR8VhSToGMN4EggTQYwk1FGXjskeaP6ksR59K7rhvPto3sd+85Lzg8Wyzt8wnc3rzPMpY86s4/azSfiNVVo3kDF9kq1dy3t2apjHGSt5FrqE6UVcsbVh0q8SwqIT4e0Nq46OJvNdLYnZ+t0vGzIL0w5Hl9rU6XPpstk5c/WtosYGLXiKzz6OQ36/7lB0W/VQSQoyv0txAm3rxYxRZj+vWZJxxxAslSPcDp9KQreHErsNlH7osXrUCYT5mpbl92sSs4ggfztmyndbxtaKQZHOjf3p6wWystFUIH5c3jQcrbvqhpp0jeIHsfx/f5m3MXZeDlvVI0dGZ7eilQE/+Qp4PTawqTBgfDmABws4+rljN/bGVscBG1BW0mUoPMlI9ETZr+qo8dBz+fhqzhKcU+l80va4x8Guk/3fZSUW9sszKuCnR0ADkMcskQH39MT69A/60naxLM5qMWpQyo3IhSAuL048sL3EoCI9a2qcOAaPKMblHT8890SSWuZU8nK0dtyIsvltIQTFzKq/hCI8tAf8ME4MmGCZzJnS3CvqYgmc3qGYWbS4TXuh6juHMiYMyhqPb8IRTLDKCN3tOaEP+XzgOq6Er/KznLVaKWnf505C2zr5FKAAPuO1XXQ0qf63twcNkg8UV750hfj1f9dY8onwR1TDqUIBTyQFZ0G3husARIsBLLvIcyow6X4j+0noJfpoZNX35Kd6LmLU7qK3+Ap4dHceef4c6RXxZ/YfybsaRSFu+c97uJpKibbCuTuWJaWxWZSEBldkHUOEDyBRGOR6Wb6vZghcNo95B9RJxr8clUV/EMWojqKj4Ebd/VSsCi17hNNIh1aamcbR9oyB1Ww2cW8DZQsCeVyL18XfR2q27HMsxX15N57PKvktKFC/uQiLzSfl8fOmSbjVIRjtyYSMMkXmNeTl/EBKC2MiYioAyUYlzl9OdiRxL+IF7vVS28eRoPHxt1ct84wDKkbHQAVOGDzuaI2W/46UcPO7UaOKfyXYPc8laZcVU7DJUQ95WPDgoQJAjOImSKTYg+pislzxC0RjNDWMXJZ5ZI9isl6BWnoOGWsOlMcdl5pzOTenbfTjP8iYBOIaGXe0XMfXLFyBdyRBjPUmT+v6Z8Q9/QqlN1/O3zRHjARbA4zoByl8UEYmmYyktcKR7XhTpBX+76yba5K7FmVHcVfxJZJjhTK5dNdbWQApzZGu/LC7QeGy39g/HAj5X6d07in4kAlS5k8EAYhgHTFGawmJTQSbzvaciQg36M/yoSAKgDNNmCi3QAU7jkewFR2uQsxuQi4EG5gtc5V9lCRBLAn1eytt9RGjvnq1H7PeZCYKNq5cOUf6KmaR4GnkgtsDqJ1o5n3nDVi/kPlQMQwybEZ6Wm1CmGKC6e3RXDOJ9hs9y0wP76EZYTmkXWNK9vqwrQ7V4JFr+kmWBkke0ZccFWBALSY01QzVxn9qNG5LG8pgbQ9aSzCmHouhmr+soe1pYLGWaVKx4IPef9oSwYClZZeKEO/614ujGWz7fBvo/XIABkct/GZF1+6hWnhv+8gbll4h3qf4U7KYtyI9lN0DZM3GCIo/EysTBCxShIww0jVS75H7TocKjQRInlmcyuwgMfLG8KPM6pb+MiGANxPuMb+7ahmWL0JAmVkmMI4eMZRvACfo+JAwxVDAjBgkqhkiG9w0BCRUxFgQUAgsnuCcLqN05E5nbV6W3CoW5fBIwLQYJKoZIhvcNAQkUMSAeHgBhAG4AZAByAG8AaQBkAGQAZQBiAHUAZwBrAGUAeTBBMDEwDQYJYIZIAWUDBAIBBQAEIGY0xMSgUWl2f0r7L5rWAlA46U8BpUoCj8XJbJSvl/XYBAgNLIZJWUpLDgICCAA="
    keystoreFile.writeBytes(Base64.getDecoder().decode(embeddedKeystoreBase64))

    val uploadKeystorePath = System.getenv("UPLOAD_KEYSTORE_FILE")?.trim().orEmpty()
    val uploadKeystoreFile = if (uploadKeystorePath.isNotEmpty()) file(uploadKeystorePath) else file("keystore/upload-keystore.jks")
    val uploadStorePassword = System.getenv("UPLOAD_KEYSTORE_PASSWORD")?.trim()?.ifEmpty { null }
        ?: System.getenv("STORE_PASSWORD")?.trim().orEmpty()
    val uploadKeyAlias = System.getenv("UPLOAD_KEY_ALIAS")?.trim()?.ifEmpty { null }
        ?: System.getenv("KEY_ALIAS")?.trim()?.ifEmpty { null }
        ?: "upload"
    val uploadKeyPassword = System.getenv("UPLOAD_KEY_PASSWORD")?.trim()?.ifEmpty { null }
        ?: System.getenv("KEY_PASSWORD")?.trim()?.ifEmpty { null }
        ?: uploadStorePassword
    val hasUploadKeystore = uploadKeystoreFile.exists() && uploadStorePassword.isNotEmpty()

    signingConfigs {
        getByName("debug") {
            if (keystoreFile.exists()) {
                storeFile = keystoreFile
                storePassword = "android"
                keyAlias = "androiddebugkey"
                keyPassword = "android"
                enableV1Signing = true
                enableV2Signing = true
                enableV3Signing = true
                enableV4Signing = true
            }
        }
        create("upload") {
            if (hasUploadKeystore) {
                storeFile = uploadKeystoreFile
                storePassword = uploadStorePassword
                keyAlias = uploadKeyAlias
                keyPassword = uploadKeyPassword
                enableV1Signing = true
                enableV2Signing = true
                enableV3Signing = true
                enableV4Signing = true
            }
        }
    }

    buildTypes {
        release {
            isDebuggable = false
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = if (hasUploadKeystore) {
                signingConfigs.getByName("upload")
            } else {
                signingConfigs.getByName("debug")
            }
        }
        debug {
            // Keep identical applicationId ("com.ZTBlackoutPreWarning"), isDebuggable = false, and signingConfig so debug and release APKs can update each other in-place over v1.3.3 and preserve user settings
            isDebuggable = false
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

dependencies {
    // Core & Lifecycle
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)

    // Jetpack Compose & Material 3
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)
    implementation(libs.androidx.navigation.compose)

    // Android AppWidget (Jetpack Glance)
    implementation(libs.androidx.glance.appwidget)
    implementation(libs.androidx.glance.material3)

    // Background Processing & Alarms
    implementation(libs.androidx.work.runtime.ktx)

    // Preferences & Local Storage
    implementation(libs.androidx.datastore.preferences)

    // HTML Parsing for ztoe.com.ua
    implementation(libs.jsoup)

    // Coroutines
    implementation(libs.kotlinx.coroutines.android)

    // Testing
    testImplementation(libs.junit)
    // JVM unit tests only get stubbed android.jar org.json; the real implementation is needed to read spec/vectors/*.json
    testImplementation("org.json:json:20240303")
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
}`
  },
  {
    path: 'gradle/libs.versions.toml',
    language: 'toml',
    description: 'Version catalog with modern dependencies',
    content: `[versions]
agp = "8.7.3"
kotlin = "2.0.21"
coreKtx = "1.15.0"
junit = "4.13.2"
junitVersion = "1.2.1"
espressoCore = "3.6.1"
lifecycleRuntimeKtx = "2.8.7"
activityCompose = "1.9.3"
composeBom = "2024.12.01"
navigationCompose = "2.8.5"
glance = "1.1.1"
work = "2.10.0"
datastore = "1.1.1"
jsoup = "1.18.3"
coroutines = "1.9.0"

[libraries]
androidx-core-ktx = { group = "androidx.core", name = "core-ktx", version.ref = "coreKtx" }
junit = { group = "junit", name = "junit", version.ref = "junit" }
androidx-junit = { group = "androidx.test.ext", name = "junit", version.ref = "junitVersion" }
androidx-espresso-core = { group = "androidx.test.espresso", name = "espresso-core", version.ref = "espressoCore" }
androidx-lifecycle-runtime-ktx = { group = "androidx.lifecycle", name = "lifecycle-runtime-ktx", version.ref = "lifecycleRuntimeKtx" }
androidx-activity-compose = { group = "androidx.activity", name = "activity-compose", version.ref = "activityCompose" }
androidx-compose-bom = { group = "androidx.compose", name = "compose-bom", version.ref = "composeBom" }
androidx-compose-ui = { group = "androidx.compose.ui", name = "ui" }
androidx-compose-ui-graphics = { group = "androidx.compose.ui", name = "ui-graphics" }
androidx-compose-ui-tooling = { group = "androidx.compose.ui", name = "ui-tooling" }
androidx-compose-ui-tooling-preview = { group = "androidx.compose.ui", name = "ui-tooling-preview" }
androidx-compose-ui-test-manifest = { group = "androidx.compose.ui", name = "ui-test-manifest" }
androidx-compose-ui-test-junit4 = { group = "androidx.compose.ui", name = "ui-test-junit4" }
androidx-compose-material3 = { group = "androidx.compose.material3", name = "material3" }
androidx-compose-material-icons-extended = { group = "androidx.compose.material", name = "material-icons-extended" }
androidx-navigation-compose = { group = "androidx.navigation", name = "navigation-compose", version.ref = "navigationCompose" }
androidx-glance-appwidget = { group = "androidx.glance", name = "glance-appwidget", version.ref = "glance" }
androidx-glance-material3 = { group = "androidx.glance", name = "glance-material3", version.ref = "glance" }
androidx-work-runtime-ktx = { group = "androidx.work", name = "work-runtime-ktx", version.ref = "work" }
androidx-datastore-preferences = { group = "androidx.datastore", name = "datastore-preferences", version.ref = "datastore" }
jsoup = { group = "org.jsoup", name = "jsoup", version.ref = "jsoup" }
kotlinx-coroutines-android = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-android", version.ref = "coroutines" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
kotlin-compose = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }`
  },
  {
    path: 'app/src/main/AndroidManifest.xml',
    language: 'xml',
    description: 'Android manifest with notifications, exact alarms, boot receivers, and Glance widget',
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <!-- Permissions for Network, Notifications & Exact Background Warnings -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <!-- Exact pre-warnings need the "Alarms & reminders" special access (granted by the user, see ExactAlarmGate) -->
    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

    <application
        android:name=".BlackoutApp"
        android:allowBackup="true"
        android:dataExtractionRules="@xml/data_extraction_rules"
        android:fullBackupContent="@xml/backup_rules"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.ZTBlackoutPreWarning"
        tools:targetApi="35">

        <!-- Main UI Activity -->
        <activity
            android:name=".widget.WidgetConfigActivity"
            android:exported="true"
            android:theme="@style/Theme.ZTBlackoutPreWarning">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_CONFIGURE" />
            </intent-filter>
        </activity>

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTop"
            android:theme="@style/Theme.ZTBlackoutPreWarning">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Alarm BroadcastReceiver for Exact Pre-Warnings (1x per slot) & Widget Transition Redraws -->
        <receiver
            android:name=".notification.AlarmReceiver"
            android:enabled="true"
            android:exported="false">
            <intent-filter>
                <action android:name="ua.blackout.prewarning.ACTION_TRIGGER_BLACKOUT_ALERT" />
                <action android:name="ua.blackout.prewarning.ACTION_WIDGET_TRANSITION_UPDATE" />
                <action android:name="ua.blackout.prewarning.ACTION_MIDNIGHT_SYNC" />
            </intent-filter>
        </receiver>

        <!-- The user granted or revoked exact alarms: plan the alerts again -->
        <receiver
            android:name=".notification.ExactAlarmPermissionReceiver"
            android:enabled="true"
            android:exported="false">
            <intent-filter>
                <action android:name="android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED" />
            </intent-filter>
        </receiver>

        <!-- Boot & Time Change Receiver to Reschedule Workers and Alarms -->
        <receiver
            android:name=".worker.BootCompletedReceiver"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
                <action android:name="android.intent.action.TIME_SET" />
                <action android:name="android.intent.action.TIMEZONE_CHANGED" />
                <action android:name="android.intent.action.DATE_CHANGED" />
            </intent-filter>
        </receiver>

        <!-- Widget Toggle Action BroadcastReceiver -->
        <receiver
            android:name=".widget.WidgetToggleReceiver"
            android:enabled="true"
            android:exported="false">
            <intent-filter>
                <action android:name="ua.blackout.prewarning.ACTION_TOGGLE_WIDGET_NOTIFICATIONS" />
            </intent-filter>
        </receiver>

        <!-- Glance Home Screen Small (2x1) AppWidget Receiver -->
        <receiver
            android:name=".widget.BlackoutWidgetReceiver"
            android:label="@string/widget_small_name"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/blackout_widget_info" />
        </receiver>

        <!-- Glance Home Screen Big (4x2) AppWidget Receiver -->
        <receiver
            android:name=".widget.BlackoutBigWidgetReceiver"
            android:label="@string/widget_big_name"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/blackout_widget_big_info" />
        </receiver>

        <!-- Glance Home Screen Strip (4x1) AppWidget Receiver: drum chart with needle only -->
        <receiver
            android:name=".widget.BlackoutStripWidgetReceiver"
            android:label="@string/widget_strip_name"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/blackout_widget_strip_info" />
        </receiver>

        <!-- Glance Home Screen Minimal (2x2) AppWidget Receiver: queue, status, countdown, refresh; primary address only -->
        <receiver
            android:name=".widget.BlackoutMinimalWidgetReceiver"
            android:label="@string/widget_minimal_name"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/blackout_widget_minimal_info" />
        </receiver>

    </application>
</manifest>`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/data/model/Models.kt',
    language: 'kotlin',
    description: 'Data models for BlackoutSlot, DaySchedule, and UserSettings',
    content: `package ua.blackout.prewarning.data.model

enum class SlotStatus {
    POWER_ON,
    POWER_OFF
}

data class EmergencyOutageInfo(
    val id: String,
    val remName: String? = null,
    val settlementName: String? = null,
    val streetName: String? = null,
    val house: String? = null,
    val outageType: String,
    val startTime: String,
    val estimatedRestoreTime: String
)

data class SelectedAddressQuery(
    val remId: String,
    val settlementId: String,
    val streetId: String,
    val house: String
)

data class BlackoutSlot(
    val id: String, // Unique key: "\${date}_\${startHour}_\${queue}"
    val startHour: Int, // 0..23
    val endHour: Int, // 1..24
    val startMinute: Int = 0, // 0 or 30
    val endMinute: Int = 0, // 0 or 30
    val startTimeStr: String, // "14:00" or "14:30"
    val endTimeStr: String, // "18:00" or "15:00"
    val status: SlotStatus,
    val isEmergency: Boolean = false,
    /** Off because of the planned ztoe schedule (or repair works). With [isEmergency] both overlap on the drum. */
    val isPlanned: Boolean = status == SlotStatus.POWER_OFF && !isEmergency
) {
    val hour: Int get() = startHour
    val startStr: String get() = startTimeStr
    val endStr: String get() = endTimeStr
    val label: String get() = "$startTimeStr - $endTimeStr"

    constructor(
        hour: Int,
        startStr: String,
        endStr: String,
        status: SlotStatus,
        label: String = "$startStr - $endStr",
        isEmergency: Boolean = false
    ) : this(
        id = "slot_\${startStr}_$label",
        startHour = hour,
        endHour = if (endStr == "24:00") 24 else (endStr.substringBefore(":").toIntOrNull() ?: (hour + 1)),
        startMinute = startStr.substringAfter(":", "0").toIntOrNull() ?: 0,
        endMinute = endStr.substringAfter(":", "0").toIntOrNull() ?: 0,
        startTimeStr = startStr,
        endTimeStr = endStr,
        status = status,
        isEmergency = isEmergency
    )
}

data class DaySchedule(
    val dateStr: String,
    val dayLabel: String,
    val queue: String,
    val slots: List<BlackoutSlot>,
    val lastUpdated: String
)

// CRITICAL CONSTANTS — DO NOT MODIFY DEFAULT VALUES (advanceNoticeMinutes = 15, refreshIntervalMinutes = 30L) UNLESS EXPLICITLY REQUESTED
data class UserSettings(
    val cityUrl: String = "https://www.ztoe.com.ua/unhooking-search.php",
    val queue: String = "",
    val customQueueStatusText: String? = null,
    val selectedAddress: String? = null,
    val selectedAddressQuery: SelectedAddressQuery? = null,
    val activeEmergencyOutage: EmergencyOutageInfo? = null,
    val refreshIntervalMinutes: Long = 30L,
    val advanceNoticeMinutes: Int = 15,
    val notificationsEnabled: Boolean = true,
    val emergencyNotificationsEnabled: Boolean = true,
    val soundEnabled: Boolean = true,
    val vibrationEnabled: Boolean = true,
    val prevSoundEnabled: Boolean = true,
    val prevVibrationEnabled: Boolean = true,
    /** Notify when the estimated restoration of an emergency moves (ETA_CHANGED), all addresses (spec/NOTIFICATIONS.md 2.4). */
    val emergencyEtaAlerts: Boolean = true,
    /** Notify when an emergency ends (END), all addresses. The start always notifies. */
    val emergencyEndAlerts: Boolean = true,
    val themeMode: String = "SYSTEM", // "SYSTEM", "DARK", "LIGHT"
    val language: String = "SYSTEM" // "SYSTEM", "UK", "EN"
)`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/data/parser/ZtoeParser.kt',
    language: 'kotlin',
    description: 'Jsoup HTML parser for Zhytomyroblenergo with KYIV_ZONE, 48 half-hour slots and today/tomorrow schedule support',
    content: `package ua.blackout.prewarning.data.parser

import android.content.Context
import org.jsoup.Jsoup
import org.jsoup.nodes.Document
import org.jsoup.nodes.Element
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SlotStatus
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.UnknownHostException
import java.net.SocketTimeoutException
import java.net.ConnectException
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import ua.blackout.prewarning.data.KYIV_ZONE
import ua.blackout.prewarning.core.FetchFailure
import ua.blackout.prewarning.core.SiteNotice
import ua.blackout.prewarning.core.SiteState
import ua.blackout.prewarning.core.SiteStateResolver
import ua.blackout.prewarning.data.net.NetworkProbe
import javax.net.ssl.SSLException

enum class FetchStatus {
    SUCCESS,
    NO_INTERNET,
    NO_QUEUES_FOUND
}

data class ScheduleFetchResult(
    val todaySlots: List<BlackoutSlot>,
    val tomorrowSlots: List<BlackoutSlot>?,
    val hasTomorrowSchedule: Boolean,
    val status: FetchStatus = FetchStatus.SUCCESS,
    /** What the user is told about the site; derived from [status] unless set explicitly. */
    val siteState: SiteState = when (status) {
        FetchStatus.SUCCESS -> SiteState.AVAILABLE_WITH_TABLE
        FetchStatus.NO_QUEUES_FOUND -> SiteState.AVAILABLE_NO_TABLE
        FetchStatus.NO_INTERNET -> SiteState.SITE_UNREACHABLE
    },
    val failure: FetchFailure = FetchFailure.NONE,
    /** Text of the "УВАГА! ВАЖЛИВА ІНФОРМАЦІЯ!" notice when the page has no schedule table (core/SiteNotice). */
    val notice: String? = null
)

// =========================================================================================
// CRITICAL SECTION — DO NOT MODIFY UNLESS EXPLICITLY REQUESTED
// Real ZTOE HTML Table Parser & URL Validator for https://www.ztoe.com.ua/unhooking-search.php
// =========================================================================================
object ZtoeParser {
    private const val USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

    // Pre-compiled regexes to avoid repeated allocation during HTML refreshes
    private val leafTableRegex = Regex("(?is)<table\\\\b[^>]*>(?:(?!</?table\\\\b).)*</table>")
    private val trRegex = Regex("(?is)<tr\\\\b[^>]*>(.*?)</tr>")
    private val tdRegex = Regex("(?is)<t[dh]\\\\b([^>]*)>(.*?)</t[dh]>")
    private val dateHeaderRegex = Regex("""(?<!\\d)(\\d{1,2})[./-](\\d{1,2})(?:[./-](\\d{2,4}))?(?!\\d)""")
    private val pwAccidentsRegex = Regex("""pw_accidents\\s*=\\s*JSON\\.parse\\(\\s*'((?:\\\\'|[^'])*)'\\s*\\)""", RegexOption.IGNORE_CASE)

    private val DEFAULT_VALID_URLS = listOf(
        "https://www.ztoe.com.ua/unhooking-search.php",
        "https://example.com"
    )

    fun loadValidUrls(context: Context? = null): List<String> {
        if (context != null) {
            try {
                val jsonStr = context.assets.open("valid-urls.json").bufferedReader().use { it.readText() }
                val regex = Regex("\\"([^\\"]+)\\"")
                val matches = regex.findAll(jsonStr).map { it.groupValues[1].trim() }.filter { it.isNotEmpty() }.toList()
                if (matches.isNotEmpty()) {
                    return matches
                }
            } catch (_: Exception) {}
        }
        return DEFAULT_VALID_URLS
    }

    fun isValidUrl(url: String, context: Context? = null): Boolean {
        val trimmed = url.trim().removeSuffix("/")
        if (trimmed.isEmpty()) return false
        val validUrls = loadValidUrls(context).map { it.trim().removeSuffix("/") }
        return validUrls.any { it.equals(trimmed, ignoreCase = true) }
    }

    val ALL_QUEUES = listOf(
        "1.1", "1.2", "2.1", "2.2", "3.1", "3.2",
        "4.1", "4.2", "5.1", "5.2", "6.1", "6.2"
    )

    @Volatile
    private var cachedDocUrl: String? = null
    @Volatile
    private var cachedDoc: Document? = null
    @Volatile
    private var cachedDocDate: LocalDate? = null
    @Volatile
    private var cachedDocTimestampMs: Long = 0L
    @Volatile
    private var lastETag: String? = null
    @Volatile
    private var lastModifiedHeader: String? = null
    private const val DOC_MEMORY_CACHE_MS = 20_000L
    private val FULL_DATE_REGEX = Regex("""(?<!\\d)(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4})(?!\\d)""")
    private val SHORT_DATE_REGEX = Regex("""(?<!\\d)(\\d{1,2})\\.(\\d{1,2})(?!\\.\\d|\\d)""")

    private fun matchesTableDate(headerText: String, targetDate: LocalDate): Boolean {
        val fullMatches = FULL_DATE_REGEX.findAll(headerText).toList()
        if (fullMatches.isNotEmpty()) {
            return fullMatches.any { m ->
                val d = m.groupValues[1].toIntOrNull()
                val mo = m.groupValues[2].toIntOrNull()
                val y = m.groupValues[3].toIntOrNull()
                d == targetDate.dayOfMonth && mo == targetDate.monthValue && y == targetDate.year
            }
        }
        return SHORT_DATE_REGEX.findAll(headerText).any { m ->
            val d = m.groupValues[1].toIntOrNull()
            val mo = m.groupValues[2].toIntOrNull()
            d == targetDate.dayOfMonth && mo == targetDate.monthValue
        }
    }

    fun fetchFullSchedule(
        url: String,
        queue: String,
        context: Context? = null,
        forceNetwork: Boolean = false
    ): ScheduleFetchResult {
        val kyivZone = KYIV_ZONE
        val today = LocalDate.now(kyivZone)

        val cleanUrl = url.trim()
        val repo = if (context != null) {
            ua.blackout.prewarning.data.repository.ScheduleRepository(context.applicationContext)
        } else {
            null
        }

        // A failed refresh never erases a schedule that is still valid for today: alarms and screens keep
        // using it and the site state tells the user why it was not refreshed (spec/SITE_STATE.md).
        fun failed(failure: FetchFailure, status: FetchStatus): ScheduleFetchResult = ScheduleFetchResult(
            todaySlots = emptyList(),
            tomorrowSlots = null,
            hasTomorrowSchedule = false,
            status = status,
            siteState = SiteStateResolver.resolve(failure, hasTodayTable = false, networkValidated = NetworkProbe.isValidated(context)),
            failure = failure
        )

        fun noTable(doc: Document? = null): ScheduleFetchResult = ScheduleFetchResult(
            todaySlots = emptyList(),
            tomorrowSlots = null,
            hasTomorrowSchedule = false,
            status = FetchStatus.NO_QUEUES_FOUND,
            siteState = SiteState.AVAILABLE_NO_TABLE,
            notice = doc?.let { d -> runCatching { SiteNotice.extract(d.outerHtml()) }.getOrNull() }
        )

        if (!isValidUrl(url, context)) {
            repo?.clearScheduleCache() // a schedule from a non-whitelisted source is meaningless
            return noTable()
        }

        val trimmedQueue = queue.trim()

        return try {
            val nowMs = System.currentTimeMillis()
            val recentDoc = cachedDoc
            val canUseConditionalHeaders = !forceNetwork &&
                trimmedQueue.isNotEmpty() &&
                repo != null &&
                repo.hasValidTodayCache(trimmedQueue) &&
                repo.hasTomorrowSchedule(trimmedQueue)

            val doc: Document? = if (!forceNetwork && recentDoc != null && cachedDocUrl == cleanUrl && cachedDocDate == today && (nowMs - cachedDocTimestampMs) in 0 until DOC_MEMORY_CACHE_MS) {
                recentDoc
            } else {
                fetchDocumentWithWindows1251(
                    urlStr = cleanUrl,
                    sendConditionalHeaders = canUseConditionalHeaders,
                    context = context
                )?.also { fetched ->
                    cachedDocUrl = cleanUrl
                    cachedDoc = fetched
                    cachedDocDate = today
                    cachedDocTimestampMs = System.currentTimeMillis()
                }
            }

            // HTTP 304 Not Modified: reuse already-cached schedule with zero HTML transfer or Jsoup parsing
            if (doc == null && canUseConditionalHeaders && repo != null && repo.hasValidTodayCache(trimmedQueue)) {
                val cachedToday = repo.getTodaySlots(trimmedQueue)
                val cachedTomorrow = repo.getTomorrowSlots(trimmedQueue)
                return ScheduleFetchResult(
                    todaySlots = cachedToday,
                    tomorrowSlots = cachedTomorrow,
                    hasTomorrowSchedule = cachedTomorrow != null,
                    status = FetchStatus.SUCCESS
                )
            }

            val effectiveDoc = doc ?: return noTable()

            // Single-pass DOM table lookup for all 12 queues + single batched asynchronous SharedPreferences write
            val allQueueResults = parseAllQueuesSinglePass(effectiveDoc, today)
            if (repo != null && allQueueResults.isNotEmpty()) {
                try {
                    val batchMap = allQueueResults.mapValues { (_, r) ->
                        Pair(r.todaySlots, r.tomorrowSlots)
                    }
                    repo.saveAllSchedulesBatch(batchMap, trimmedQueue)
                } catch (_: Exception) {}
            }

            val hasTable = allQueueResults.isNotEmpty()
            if (!hasTable) return noTable(effectiveDoc)

            if (trimmedQueue.isEmpty()) {
                return ScheduleFetchResult(
                    todaySlots = emptyList(),
                    tomorrowSlots = null,
                    hasTomorrowSchedule = false,
                    status = FetchStatus.SUCCESS
                )
            }

            val finalRes = allQueueResults[trimmedQueue] ?: parseDocumentFull(effectiveDoc, trimmedQueue, today)
            // The page and its table are there even when this queue's row is missing
            finalRes.copy(siteState = SiteState.AVAILABLE_WITH_TABLE)
        } catch (e: UnknownHostException) {
            failed(FetchFailure.DNS, FetchStatus.NO_INTERNET)
        } catch (e: ConnectException) {
            failed(FetchFailure.CONNECT, FetchStatus.NO_INTERNET)
        } catch (e: SocketTimeoutException) {
            failed(FetchFailure.TIMEOUT, FetchStatus.NO_INTERNET)
        } catch (e: SSLException) {
            failed(FetchFailure.TLS, FetchStatus.NO_INTERNET)
        } catch (e: IOException) {
            failed(
                if (e.message?.startsWith("HTTP") == true) FetchFailure.HTTP_ERROR else FetchFailure.OTHER,
                FetchStatus.NO_INTERNET
            )
        } catch (e: Exception) {
            // The page arrived but could not be read as a schedule
            noTable()
        }
    }

    private fun findTodayAndTomorrowTables(
        doc: Document,
        today: LocalDate
    ): Pair<Element?, Element?> {
        val tomorrow = today.plusDays(1)
        val leafTables = doc.select("table").filter { table ->
            table.select("table").size == 1 && table.select("tr").size >= 12
        }

        var todayTable: Element? = null
        var tomorrowTable: Element? = null

        for (table in leafTables) {
            val rows = table.select("tr")
            val headerText = rows.take(2).joinToString(" ") { it.text() }
            val tableText = table.text()
            val hasQueues = tableText.contains("1.1") && tableText.contains("6.2")
            if (!hasQueues) continue

            val matchesToday = matchesTableDate(headerText, today)
            val matchesTomorrow = matchesTableDate(headerText, tomorrow)

            if (matchesToday && todayTable == null) {
                todayTable = table
            } else if (matchesTomorrow && tomorrowTable == null) {
                tomorrowTable = table
            }
        }
        return Pair(todayTable, tomorrowTable)
    }

    /**
     * Parses all 12 queues from the document in a single table-lookup pass, avoiding 12 redundant Jsoup DOM scans.
     */
    private fun parseAllQueuesSinglePass(
        doc: Document,
        today: LocalDate
    ): Map<String, ScheduleFetchResult> {
        val tomorrow = today.plusDays(1)
        val (todayTable, tomorrowTable) = findTodayAndTomorrowTables(doc, today)
        if (todayTable == null) return emptyMap()

        val results = LinkedHashMap<String, ScheduleFetchResult>(ALL_QUEUES.size)
        for (q in ALL_QUEUES) {
            val todaySlots = parseTableForQueue(todayTable, q, today) ?: continue
            val tomorrowSlots = if (tomorrowTable != null) {
                parseTableForQueue(tomorrowTable, q, tomorrow)
            } else {
                null
            }
            results[q] = ScheduleFetchResult(
                todaySlots = todaySlots,
                tomorrowSlots = tomorrowSlots,
                hasTomorrowSchedule = tomorrowSlots != null && tomorrowTable != null,
                status = FetchStatus.SUCCESS
            )
        }
        return results
    }

    fun parseDocumentFull(
        doc: Document,
        queue: String,
        today: LocalDate = LocalDate.now(KYIV_ZONE)
    ): ScheduleFetchResult {
        val tomorrow = today.plusDays(1)
        val (todayTable, tomorrowTable) = findTodayAndTomorrowTables(doc, today)

        if (todayTable == null) {
            return ScheduleFetchResult(
                todaySlots = emptyList(),
                tomorrowSlots = null,
                hasTomorrowSchedule = false,
                status = FetchStatus.NO_QUEUES_FOUND
            )
        }

        if (queue.isBlank()) {
            return ScheduleFetchResult(
                todaySlots = emptyList(),
                tomorrowSlots = null,
                hasTomorrowSchedule = false,
                status = FetchStatus.SUCCESS
            )
        }

        val todaySlots = parseTableForQueue(todayTable, queue, today)
        if (todaySlots == null) {
            return ScheduleFetchResult(
                todaySlots = emptyList(),
                tomorrowSlots = null,
                hasTomorrowSchedule = false,
                status = FetchStatus.NO_QUEUES_FOUND
            )
        }

        val tomorrowSlots = if (tomorrowTable != null) {
            parseTableForQueue(tomorrowTable, queue, tomorrow)
        } else {
            null
        }

        return ScheduleFetchResult(
            todaySlots = todaySlots,
            tomorrowSlots = tomorrowSlots,
            hasTomorrowSchedule = tomorrowSlots != null && tomorrowTable != null,
            status = FetchStatus.SUCCESS
        )
    }

    fun hasScheduleTableForDate(doc: Document, date: LocalDate): Boolean {
        val leafTables = doc.select("table").filter { table ->
            table.select("table").size == 1 && table.select("tr").size >= 12
        }

        return leafTables.any { table ->
            val hasQueues = table.text().contains("1.1") && table.text().contains("6.2")
            val headerText = table.select("tr").take(2).joinToString(" ") { it.text() }
            hasQueues && matchesTableDate(headerText, date)
        }
    }

    fun parseHtmlForDate(
        doc: Document,
        queue: String,
        date: LocalDate,
        dateIso: String = date.format(DateTimeFormatter.ISO_LOCAL_DATE)
    ): List<BlackoutSlot> {
        val leafTables = doc.select("table").filter { table ->
            table.select("table").size == 1 && table.select("tr").size >= 12
        }

        val matchingTable = leafTables.firstOrNull { table ->
            val hasQueues = table.text().contains("1.1") && table.text().contains("6.2")
            val headerText = table.select("tr").take(2).joinToString(" ") { it.text() }
            hasQueues && matchesTableDate(headerText, date)
        }

        if (matchingTable != null) {
            parseTableForQueue(matchingTable, queue, date)?.let { return it }
        }
        return generateFallbackSchedule(queue, dateIso)
    }

    fun fetchAndParse(url: String, queue: String, date: LocalDate): List<BlackoutSlot> {
        val result = fetchFullSchedule(url, queue)
        val today = LocalDate.now(KYIV_ZONE)
        return if (date == today) {
            result.todaySlots
        } else if (date == today.plusDays(1) && result.tomorrowSlots != null) {
            result.tomorrowSlots
        } else {
            generateFallbackSchedule(queue, date.format(DateTimeFormatter.ISO_LOCAL_DATE))
        }
    }

    private fun fetchDocumentWithWindows1251(
        urlStr: String,
        sendConditionalHeaders: Boolean = false,
        context: Context? = null
    ): Document? {
        val etagPrefs = context?.applicationContext?.getSharedPreferences("zt_schedule_cache_v2", Context.MODE_PRIVATE)
        val savedEtag = lastETag ?: etagPrefs?.getString("ztoe_last_etag", null)
        val url = URL(urlStr)
        val connection = url.openConnection() as HttpURLConnection
        return try {
            connection.setRequestProperty("User-Agent", USER_AGENT)
            connection.setRequestProperty("Accept-Encoding", "gzip")
            if (sendConditionalHeaders && (cachedDocUrl == urlStr || !savedEtag.isNullOrBlank())) {
                savedEtag?.takeIf { it.isNotBlank() }?.let { connection.setRequestProperty("If-None-Match", it) }
                lastModifiedHeader?.let { connection.setRequestProperty("If-Modified-Since", it) }
            }
            connection.connectTimeout = 8000
            connection.readTimeout = 8000
            connection.connect()
            val responseCode = connection.responseCode
            if (responseCode == HttpURLConnection.HTTP_NOT_MODIFIED) {
                return null
            }
            if (responseCode !in 200..299) {
                throw IOException("HTTP $responseCode")
            }
            connection.getHeaderField("ETag")?.takeIf { it.isNotBlank() }?.let {
                lastETag = it
                etagPrefs?.edit()?.putString("ztoe_last_etag", it)?.apply()
            }
            connection.getHeaderField("Last-Modified")?.takeIf { it.isNotBlank() }?.let { lastModifiedHeader = it }

            val contentType = connection.contentType?.lowercase() ?: ""
            val charset = if (contentType.contains("utf-8")) "UTF-8" else "windows-1251"
            val contentEncoding = connection.contentEncoding?.lowercase() ?: ""
            val rawStream = connection.inputStream
            val stream = if (contentEncoding.contains("gzip")) {
                java.util.zip.GZIPInputStream(rawStream)
            } else {
                rawStream
            }
            stream.use { input ->
                Jsoup.parse(input, charset, urlStr)
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun parseTableForQueue(table: Element, targetQueue: String, date: LocalDate): List<BlackoutSlot>? {
        val dateStr = date.format(DateTimeFormatter.ISO_LOCAL_DATE)
        val rows = table.select("tr")

        // Find the row containing this specific queue (e.g. "1.1") in its first 3 cells
        val targetRow = rows.firstOrNull { row ->
            val firstCells = row.select("td, th").take(3)
            firstCells.any { cell ->
                val txt = cell.text().trim()
                txt == targetQueue ||
                        txt == "Черга $targetQueue" ||
                        txt == "Черга $targetQueue." ||
                        txt.equals("$targetQueue черга", ignoreCase = true)
            }
        } ?: return null

        val tds = targetRow.select("td")
        if (tds.size < 24) {
            return null
        }

        // Filter out thin 3pt separator cells if any, then take the last 48 (or 24) schedule cells
        val validCells = tds.drop(1).filter { cell ->
            val style = cell.attr("style").lowercase().replace(" ", "")
            !style.contains("width:3pt") && !style.contains("width:1pt")
        }

        val slotCells = when {
            validCells.size >= 48 -> validCells.takeLast(48)
            tds.size >= 48 -> tds.takeLast(48)
            validCells.size >= 24 -> validCells.takeLast(24)
            else -> tds.takeLast(24)
        }

        val totalSlots = slotCells.size
        val minutesPerSlot = 1440 / totalSlots // 30 mins for 48 slots, 60 mins for 24 slots

        return slotCells.mapIndexed { index, cell ->
            val startTotalMin = index * minutesPerSlot
            val endTotalMin = (index + 1) * minutesPerSlot

            val startH = startTotalMin / 60
            val startM = startTotalMin % 60
            val endH = endTotalMin / 60
            val endM = endTotalMin % 60

            val startStr = String.format("%02d:%02d", startH, startM)
            val endStr = if (endH >= 24) "24:00" else String.format("%02d:%02d", endH, endM)

            val attr = (cell.attr("style") + " " + cell.attr("bgcolor") + " " + cell.className()).lowercase()
            val text = cell.text().trim().lowercase()

            val isOff = attr.contains("#ff3333") || attr.contains("#ff3b30") || attr.contains("#ff0000") ||
                    attr.contains("background:red") || attr.contains("background: red") ||
                    attr.contains("background-color:red") || attr.contains("background-color: red") ||
                    attr.contains("rgb(255, 51, 51)") || attr.contains("rgb(255,51,51)") ||
                    attr.contains("rgb(255, 0, 0)") || attr.contains("rgb(255,0,0)") ||
                    attr.contains("danger") || text.contains("вимк") || text.contains("відкл") || text == "в" || text == "-"

            val status = if (isOff) SlotStatus.POWER_OFF else SlotStatus.POWER_ON

            BlackoutSlot(
                id = "\${dateStr}_\${startStr}_Q$targetQueue",
                startHour = startH,
                endHour = endH,
                startMinute = startM,
                endMinute = endM,
                startTimeStr = startStr,
                endTimeStr = endStr,
                status = status
            )
        }
    }

    fun generateFallbackSchedule(queue: String, dateStr: String): List<BlackoutSlot> {
        val parts = queue.split(".")
        val group = parts.getOrNull(0)?.toIntOrNull() ?: 1
        val sub = parts.getOrNull(1)?.toIntOrNull() ?: 1
        val shift = ((group - 1) * 3 + (sub - 1) * 2) % 24

        // Generate 48 half-hour slots for uniform 30-min resolution
        return (0 until 48).map { index ->
            val startTotalMin = index * 30
            val endTotalMin = (index + 1) * 30
            val startH = startTotalMin / 60
            val startM = startTotalMin % 60
            val endH = endTotalMin / 60
            val endM = endTotalMin % 60

            val cycleHour = (startH + shift) % 24
            val isOff = (cycleHour in 2..5) || (cycleHour in 12..15) || (cycleHour in 20..23)

            val startStr = String.format("%02d:%02d", startH, startM)
            val endStr = if (endH >= 24) "24:00" else String.format("%02d:%02d", endH, endM)

            BlackoutSlot(
                id = "\${dateStr}_\${startStr}_Q$queue",
                startHour = startH,
                endHour = endH,
                startMinute = startM,
                endMinute = endM,
                startTimeStr = startStr,
                endTimeStr = endStr,
                status = if (isOff) SlotStatus.POWER_OFF else SlotStatus.POWER_ON
            )
        }
    }
}
// =========================================================================================
// END OF CRITICAL SECTION — DO NOT MODIFY UNLESS EXPLICITLY REQUESTED
// =========================================================================================`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/data/repository/AlertRegistry.kt',
    language: 'kotlin',
    description: 'Deduplication store ensuring notifications are fired STRICTLY ONCE per blackout slot',
    content: `package ua.blackout.prewarning.data.repository

import android.content.Context
import android.content.SharedPreferences

class AlertRegistry(context: Context) {
    private val appContext: Context = context.applicationContext
    private val prefs: SharedPreferences =
        appContext.getSharedPreferences("zt_notified_blackouts_v1", Context.MODE_PRIVATE)

    companion object {
        const val MAX_STORED_ENTRIES = 300
    }

    /**
     * Checks if this specific blackout slot or emergency transition key has already been notified.
     * Guarantees 100% adherence to "notification sent only once per blackout slot / state transition".
     */
    fun hasNotified(slotId: String): Boolean {
        return prefs.getBoolean("notified_$slotId", false)
    }

    fun hasFired(key: String): Boolean = hasNotified(key)

    fun markFired(key: String) = markNotified(key)

    /**
     * Marks the slot as notified with timestamp, prunes entries older than 7 days,
     * and bounds total stored entries to MAX_STORED_ENTRIES (300: up to 5 addresses share it).
     */
    fun markNotified(slotId: String) {
        val now = System.currentTimeMillis()
        val cutoff = now - 7L * 24L * 60L * 60L * 1000L
        val editor = prefs.edit()
        val timestampEntries = mutableListOf<Pair<String, Long>>()

        for ((key, value) in prefs.all) {
            if (key.startsWith("ts_") && value is Long) {
                val oldSlotId = key.removePrefix("ts_")
                if (value < cutoff) {
                    editor.remove(key)
                    editor.remove("notified_$oldSlotId")
                } else {
                    timestampEntries.add(oldSlotId to value)
                }
            }
        }

        if (timestampEntries.size >= MAX_STORED_ENTRIES) {
            val sortedOldestFirst = timestampEntries.sortedBy { it.second }
            val excessCount = (timestampEntries.size - MAX_STORED_ENTRIES) + 1
            for (i in 0 until excessCount.coerceAtMost(sortedOldestFirst.size)) {
                val evictSlotId = sortedOldestFirst[i].first
                editor.remove("ts_$evictSlotId")
                editor.remove("notified_$evictSlotId")
            }
        }

        editor
            .putBoolean("notified_$slotId", true)
            .putLong("ts_$slotId", now)
            .apply()
    }

    /**
     * When system clock is adjusted backward on mobile, clears notified flags for slots
     * whose alert time is now in the future again or whose recorded notification timestamp
     * is ahead of current wall-clock time.
     */
    fun resetFutureSlotsOnTimeChange(nowMs: Long, futureBlockIds: Set<String>) {
        val editor = prefs.edit()
        var modified = false
        for ((key, value) in prefs.all) {
            if (key.startsWith("ts_") && value is Long && value > nowMs) {
                val slotId = key.removePrefix("ts_")
                editor.remove(key)
                editor.remove("notified_$slotId")
                modified = true
            }
        }
        for (blockId in futureBlockIds) {
            if (prefs.contains("notified_$blockId") || prefs.contains("ts_$blockId")) {
                editor.remove("notified_$blockId")
                editor.remove("ts_$blockId")
                modified = true
            }
        }
        if (modified) {
            editor.apply()
        }
    }

    /**
     * Clears old history (e.g. from previous days)
     */
    fun clearHistory() {
        prefs.edit().clear().apply()
    }
}`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/notification/NotificationHelper.kt',
    language: 'kotlin',
    description: 'High-priority notification channel & builder with tap-to-open PendingIntent',
    content: `package ua.blackout.prewarning.notification

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import ua.blackout.prewarning.MainActivity
import ua.blackout.prewarning.R
import ua.blackout.prewarning.core.EmergencyEvent
import ua.blackout.prewarning.core.EmergencyDelivery
import ua.blackout.prewarning.core.EmergencyEventKind
import ua.blackout.prewarning.core.OutageEngine
import ua.blackout.prewarning.core.Span
import ua.blackout.prewarning.data.KYIV_ZONE
import ua.blackout.prewarning.data.model.UserSettings
import ua.blackout.prewarning.data.repository.AlertRegistry
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.data.repository.SubscriptionSync
import ua.blackout.prewarning.ui.AppStrings
import java.time.LocalDate
import java.time.LocalDateTime

object NotificationHelper {
    /** Intent extra of a notification tap: the subscription id to show on the main screen. */
    const val EXTRA_SUBSCRIPTION_ID = "ua.blackout.prewarning.SUBSCRIPTION_ID"

    const val CHANNEL_SOUND_VIBE = "zt_blackout_sound_vibe_v2"
    const val CHANNEL_SOUND_ONLY = "zt_blackout_sound_only_v2"
    const val CHANNEL_VIBE_ONLY = "zt_blackout_vibe_only_v2"
    const val CHANNEL_SILENT = "zt_blackout_silent_v2"

    // Emergency outages get their own channels so users can tune them separately in the system settings
    const val CHANNEL_EMERGENCY_SOUND_VIBE = "zt_emergency_sound_vibe_v1"
    const val CHANNEL_EMERGENCY_SOUND_ONLY = "zt_emergency_sound_only_v1"
    const val CHANNEL_EMERGENCY_VIBE_ONLY = "zt_emergency_vibe_only_v1"
    const val CHANNEL_EMERGENCY_SILENT = "zt_emergency_silent_v1"

    private val VIBRATION_PATTERN = longArrayOf(0, 400, 200, 400)

    fun createNotificationChannel(context: Context) {
        createNotificationChannels(context)
    }

    fun createNotificationChannels(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            val audioAttributes = AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                .build()

            // 1. Sound + Vibration
            val ch1 = NotificationChannel(
                CHANNEL_SOUND_VIBE,
                "Сповіщення (Звук + Вібрація)",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Сповіщення про відключення зі звуком та вібрацією"
                enableVibration(true)
                vibrationPattern = VIBRATION_PATTERN
                setSound(soundUri, audioAttributes)
            }

            // 2. Sound Only
            val ch2 = NotificationChannel(
                CHANNEL_SOUND_ONLY,
                "Сповіщення (Тільки звук)",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Сповіщення про відключення тільки зі звуком"
                enableVibration(false)
                vibrationPattern = longArrayOf(0)
                setSound(soundUri, audioAttributes)
            }

            // 3. Vibration Only (Sound OFF, Vibration ON)
            val ch3 = NotificationChannel(
                CHANNEL_VIBE_ONLY,
                "Сповіщення (Тільки вібрація)",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Сповіщення про відключення тільки з вібрацією (без звуку)"
                enableVibration(true)
                vibrationPattern = VIBRATION_PATTERN
                setSound(null, null)
            }

            // 4. Silent
            val ch4 = NotificationChannel(
                CHANNEL_SILENT,
                "Сповіщення (Без звуку і вібрації)",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Беззвучні сповіщення"
                enableVibration(false)
                vibrationPattern = longArrayOf(0)
                setSound(null, null)
            }

            fun emergencyChannel(id: String, name: String, importance: Int, sound: Boolean, vibrate: Boolean) =
                NotificationChannel(id, name, importance).apply {
                    description = "Сповіщення про аварійні відключення"
                    enableVibration(vibrate)
                    vibrationPattern = if (vibrate) VIBRATION_PATTERN else longArrayOf(0)
                    if (sound) setSound(soundUri, audioAttributes) else setSound(null, null)
                }

            manager.createNotificationChannels(
                listOf(
                    ch1, ch2, ch3, ch4,
                    emergencyChannel(CHANNEL_EMERGENCY_SOUND_VIBE, "Аварійні відключення (Звук + Вібрація)", NotificationManager.IMPORTANCE_HIGH, true, true),
                    emergencyChannel(CHANNEL_EMERGENCY_SOUND_ONLY, "Аварійні відключення (Тільки звук)", NotificationManager.IMPORTANCE_HIGH, true, false),
                    emergencyChannel(CHANNEL_EMERGENCY_VIBE_ONLY, "Аварійні відключення (Тільки вібрація)", NotificationManager.IMPORTANCE_HIGH, false, true),
                    emergencyChannel(CHANNEL_EMERGENCY_SILENT, "Аварійні відключення (Без звуку і вібрації)", NotificationManager.IMPORTANCE_LOW, false, false)
                )
            )
        }
    }

    fun triggerVibration(context: Context) {
        try {
            val vibrator: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vm?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            }

            if (vibrator == null || !vibrator.hasVibrator()) return

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                val effect = VibrationEffect.createWaveform(VIBRATION_PATTERN, -1)
                val attrs = VibrationAttributes.Builder()
                    .setUsage(VibrationAttributes.USAGE_ALARM)
                    .build()
                vibrator.vibrate(effect, attrs)
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val effect = VibrationEffect.createWaveform(VIBRATION_PATTERN, -1)
                val audioAttrs = AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .build()
                @Suppress("DEPRECATION")
                vibrator.vibrate(effect, audioAttrs)
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(VIBRATION_PATTERN, -1)
            }
        } catch (_: Exception) {}
    }

    /**
     * Posts the notifications for ledger events (start / restore time changed / end). Each event is
     * announced once: its key (\`spec/NOTIFICATIONS.md\`) is remembered in [AlertRegistry].
     * Callers only pass events produced by a confirmed fetch, so a failed request never reaches here.
     */
    fun postEmergencyEvents(
        context: Context,
        settings: UserSettings,
        addressKey: String,
        events: List<EmergencyEvent>,
        // Default: the primary address (mirrored settings); another subscription passes its own (spec/SUBSCRIPTIONS.md 8.4)
        addressLine: String? = settings.selectedAddress,
        enabled: Boolean = settings.emergencyNotificationsEnabled,
        // The subscription a tap shows on the main screen (spec/SUBSCRIPTIONS.md 9)
        subscriptionId: String? = null,
        // The address's planned spans and whether it is warned about them: one continuous outage is
        // announced once (spec/NOTIFICATIONS.md 2.4a)
        plannedSpans: List<Span> = emptyList(),
        plannedAlertsOn: Boolean = false
    ) {
        if (!enabled || events.isEmpty()) return
        val appContext = context.applicationContext
        val lang = AppStrings.resolveLang(settings.language)
        val today = LocalDate.now(KYIV_ZONE)
        val registry = AlertRegistry(appContext)
        val address = addressLine?.replace("\\n", " ")?.takeIf { it.isNotBlank() }

        for (ev in events) {
            val key = ev.key(addressKey)
            if (registry.hasFired(key)) continue
            registry.markFired(key)
            // One continuous outage, one announcement (spec/NOTIFICATIONS.md 2.4a)
            val delivery = OutageEngine.emergencyDelivery(ev.kind, ev.start, ev.eta, LocalDateTime.now(KYIV_ZONE), plannedSpans, plannedAlertsOn)
            if (delivery == EmergencyDelivery.DROP) continue
            // Follow-ups the user turned off are dropped, never replayed later (spec/NOTIFICATIONS.md 2.4)
            val asKind = if (delivery == EmergencyDelivery.PROLONG) EmergencyEventKind.ETA_CHANGED else ev.kind
            if (asKind == EmergencyEventKind.ETA_CHANGED && !settings.emergencyEtaAlerts) continue
            if (asKind == EmergencyEventKind.END && !settings.emergencyEndAlerts) continue

            val start = formatWhen(lang, ev.start, today)
            val eta = ev.eta?.let { formatWhen(lang, it, today) }
            val (title, body) = when (asKind) {
                EmergencyEventKind.START -> {
                    val t = if (ev.upcoming) AppStrings.emergencyUpcomingTitle(lang) else AppStrings.emergencyStartTitle(lang)
                    t to AppStrings.emergencyStartBody(lang, start, eta)
                }
                EmergencyEventKind.ETA_CHANGED ->
                    AppStrings.emergencyChangedTitle(lang) to AppStrings.emergencyChangedBody(lang, eta ?: start)
                EmergencyEventKind.END ->
                    if (ev.earlyEnd && eta != null) {
                        AppStrings.emergencyEarlyEndTitle(lang) to AppStrings.emergencyEarlyEndBody(lang, eta)
                    } else {
                        AppStrings.emergencyEndTitle(lang) to AppStrings.emergencyEndBody(lang, start)
                    }
            }
            showPreWarningNotification(
                context = appContext,
                notificationId = AlarmCodes.codeFor(appContext, key),
                title = title,
                body = if (address != null) "$body\\n$address" else body,
                isTest = false,
                isEmergencyAlert = true,
                subscriptionId = subscriptionId
            )
        }
    }

    /** "22:04", "завтра 01:00" or "13.11 22:04" relative to [today]. */
    fun formatWhen(lang: String, dt: LocalDateTime, today: LocalDate): String {
        val hm = "\${dt.hour.toString().padStart(2, '0')}:\${dt.minute.toString().padStart(2, '0')}"
        return when (dt.toLocalDate()) {
            today -> hm
            today.plusDays(1) -> "\${AppStrings.tomorrowWord(lang)} $hm"
            today.minusDays(1) -> "\${AppStrings.yesterdayWord(lang)} $hm"
            else -> "\${dt.dayOfMonth.toString().padStart(2, '0')}.\${dt.monthValue.toString().padStart(2, '0')} $hm"
        }
    }

    fun showPreWarningNotification(
        context: Context,
        notificationId: Int,
        title: String,
        body: String,
        isTest: Boolean = false,
        isEmergencyAlert: Boolean = false,
        subscriptionId: String? = null
    ) {
        val settings = SettingsRepository(context).getSettings()
        // The master switch silences every alert (owner decision 1); the per-address switches were
        // checked by the caller (spec/SUBSCRIPTIONS.md section 8). A test notification still shows.
        val master = try {
            SubscriptionSync(context).master()
        } catch (_: Exception) {
            settings.notificationsEnabled || settings.emergencyNotificationsEnabled
        }
        if (!master && !isTest) return

        val activeSound = master && settings.soundEnabled
        val activeVibe = master && settings.vibrationEnabled

        createNotificationChannels(context)

        val targetChannelId = if (isEmergencyAlert) {
            when {
                activeSound && activeVibe -> CHANNEL_EMERGENCY_SOUND_VIBE
                activeSound && !activeVibe -> CHANNEL_EMERGENCY_SOUND_ONLY
                !activeSound && activeVibe -> CHANNEL_EMERGENCY_VIBE_ONLY
                else -> CHANNEL_EMERGENCY_SILENT
            }
        } else {
            when {
                activeSound && activeVibe -> CHANNEL_SOUND_VIBE
                activeSound && !activeVibe -> CHANNEL_SOUND_ONLY
                !activeSound && activeVibe -> CHANNEL_VIBE_ONLY
                else -> CHANNEL_SILENT
            }
        }

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            if (subscriptionId != null) putExtra(EXTRA_SUBSCRIPTION_ID, subscriptionId)
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

        val builder = NotificationCompat.Builder(context, targetChannelId)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(if (activeSound || activeVibe) NotificationCompat.PRIORITY_HIGH else NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)

        // Strict sound & vibration configuration
        if (activeSound) {
            builder.setSound(soundUri)
        } else {
            builder.setSound(null)
        }

        if (activeVibe) {
            builder.setVibrate(VIBRATION_PATTERN)
            if (!activeSound) {
                builder.setDefaults(NotificationCompat.DEFAULT_VIBRATE)
            }
            // Trigger hardware vibrator directly with USAGE_ALARM so vibration always fires even when sound is disabled,
            // but never when the notification itself is blocked (no POST_NOTIFICATIONS permission or app muted)
            if (NotificationManagerCompat.from(context).areNotificationsEnabled()) {
                triggerVibration(context)
            }
        } else {
            builder.setVibrate(longArrayOf(0))
        }

        // Only mark silent if BOTH sound AND vibration are disabled
        if (!activeSound && !activeVibe) {
            builder.setSilent(true)
        }

        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(notificationId, builder.build())
    }
}`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/notification/AlarmReceiver.kt',
    language: 'kotlin',
    description: 'Exact Alarm BroadcastReceiver enforcing single-notification-per-slot rule',
    content: `package ua.blackout.prewarning.notification

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import ua.blackout.prewarning.core.OutageEngine
import ua.blackout.prewarning.core.Subscriptions
import ua.blackout.prewarning.data.KYIV_ZONE
import ua.blackout.prewarning.data.repository.AlertRegistry
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.data.repository.SubscriptionSync
import ua.blackout.prewarning.ui.AppStrings
import ua.blackout.prewarning.widget.BlackoutGlanceWidget
import java.time.Instant
import java.time.LocalDateTime
import java.time.temporal.ChronoUnit

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val appContext = context.applicationContext
        val pendingResult = goAsync()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                // The notification goes first: redrawing widgets can involve a network fetch and must never delay a warning
                when (intent.action) {
                    AlarmScheduler.ACTION_ALERT -> handleAlert(appContext, intent)
                    AlarmScheduler.ACTION_MIDNIGHT -> AlarmScheduler.syncAlarms(appContext)
                }
                try {
                    BlackoutGlanceWidget.syncAllWidgets(appContext)
                } catch (_: Exception) {
                }
            } finally {
                try {
                    pendingResult.finish()
                } catch (_: Exception) {
                }
            }
        }
    }

    /**
     * Posts every planned group that starts at the alarm's span start and still has a member that
     * was not warned (spec/SUBSCRIPTIONS.md 8.2). The plan is recomputed from the current state, so
     * a changed schedule, queue or address list never posts a stale warning or loses a due one.
     */
    private suspend fun handleAlert(appContext: Context, intent: Intent) {
        val settings = SettingsRepository(appContext).getSettings()
        val sync = SubscriptionSync(appContext)
        val master = sync.master()
        if (!master) return
        val subs = sync.store()

        val startMs = intent.getLongExtra(AlarmScheduler.EXTRA_SPAN_START_MS, -1L)
        if (startMs < 0L) return
        val advance = intent.getIntExtra(AlarmScheduler.EXTRA_MINUTES, settings.advanceNoticeMinutes)

        val spanStart = LocalDateTime.ofInstant(Instant.ofEpochMilli(startMs), KYIV_ZONE)
        val now = LocalDateTime.now(KYIV_ZONE)
        val alertTime = spanStart.minusMinutes(advance.toLong())

        if (now.isBefore(alertTime.minusMinutes(2))) {
            // The system clock moved backward before the alert window: plan again
            AlarmScheduler.syncAlarms(appContext, onTimeChanged = true)
            return
        }
        if (now.isAfter(spanStart.plusMinutes(2))) {
            // The outage has already begun: a pre-warning would be stale
            return
        }

        // Plan as seen a little before the alarm, so the alert that is firing now is still part of it
        val lookback = now.minusMinutes(advance.toLong() + 3)
        val groups = AlarmScheduler.plannedGroups(appContext, subs, master, lookback, advance)
            .filter { it.spanStart == spanStart }
        if (groups.isEmpty()) return

        val registry = AlertRegistry(appContext)
        val lang = AppStrings.resolveLang(settings.language)
        for (group in groups) {
            if (Subscriptions.pendingMembers(group) { registry.hasNotified(it) }.isEmpty()) continue
            for (id in group.memberIds) registry.markNotified(Subscriptions.memberKey(id, group.spanStart))

            val body = AppStrings.plannedAlertBody(
                lang = lang,
                queue = group.queue,
                // A start is never "24:00": an outage starting at midnight reads 00:00 (spec/NOTIFICATIONS.md)
                start = "%02d:%02d".format(group.spanStart.hour, group.spanStart.minute),
                end = OutageEngine.formatSpanTime(group.spanEnd),
                minutesLeft = ChronoUnit.MINUTES.between(now, spanStart),
                durationMinutes = group.durationMinutes,
                mayContinue = group.mayContinue,
                labels = Subscriptions.alertLabels(subs, group.memberIds)
            )
            NotificationHelper.showPreWarningNotification(
                appContext,
                AlarmCodes.codeFor(appContext, group.key),
                AppStrings.plannedAlertTitle(lang),
                body,
                // a tap shows the first member, the primary when it is one (spec/SUBSCRIPTIONS.md 9)
                subscriptionId = group.memberIds.firstOrNull()
            )
        }
    }
}
`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/worker/ScheduleSyncWorker.kt',
    language: 'kotlin',
    description: 'WorkManager periodic background worker with AlarmManager exact scheduling',
    content: `package ua.blackout.prewarning.worker

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.CancellationException
import ua.blackout.prewarning.data.parser.ZtoeAddressLookup
import ua.blackout.prewarning.data.repository.HouseVariantChoices
import ua.blackout.prewarning.data.repository.OutageRepository
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.data.repository.SubscriptionSync
import ua.blackout.prewarning.notification.AlarmScheduler
import ua.blackout.prewarning.widget.BlackoutGlanceWidget
import java.util.concurrent.TimeUnit

class ScheduleSyncWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        val appContext = context.applicationContext
        try {
            val settingsRepo = SettingsRepository(appContext)
            val settings = settingsRepo.getSettings()

            // A house without a queue may be given one by the site later. Only the two fields that
            // belong to this check are written, so a setting the user changes meanwhile is never reverted.
            val addressQuery = settings.selectedAddressQuery
            if (addressQuery != null && settings.queue.isBlank()) {
                try {
                    ZtoeAddressLookup.initDiskCache(appContext)
                    val lookup = ZtoeAddressLookup.checkAddressOnZtoeWebsite(
                        addressQuery,
                        settings.cityUrl,
                        HouseVariantChoices.get(appContext, addressQuery.streetId, addressQuery.house)
                    )
                    if (lookup != null && (lookup.queue != settings.queue || lookup.statusText != settings.customQueueStatusText)) {
                        // through the subscription store, which writes the primary back into these keys
                        SubscriptionSync(appContext).assignPrimaryQueue(lookup.queue, lookup.statusText, null)
                    }
                } catch (e: CancellationException) {
                    throw e
                } catch (_: Exception) {
                }
            }

            // Each source is isolated inside OutageRepository: a failing site never stops the other one,
            // and a failure is never treated as "no outage".
            try {
                OutageRepository(appContext).refresh(settingsRepo.getSettings())
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
            }

            try {
                if (BlackoutGlanceWidget.hasActiveWidgets(appContext)) {
                    BlackoutGlanceWidget.syncAllWidgets(appContext)
                }
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
            }
            return Result.success()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            return if (runAttemptCount < MAX_ATTEMPTS) Result.retry() else Result.success()
        } finally {
            // Alarms are planned from the latest stored state even when a source failed above
            try {
                AlarmScheduler.syncAlarms(appContext)
            } catch (_: Exception) {
            }
        }
    }

    companion object {
        const val WORK_NAME = "ScheduleSyncWorker"
        private const val MAX_ATTEMPTS = 3

        fun schedulePeriodicWork(
            context: Context,
            policy: ExistingPeriodicWorkPolicy = ExistingPeriodicWorkPolicy.KEEP
        ) {
            val appContext = context.applicationContext
            val settings = SettingsRepository(appContext).getSettings()
            // WorkManager never runs periodic work more often than every 15 minutes
            val intervalMinutes = settings.refreshIntervalMinutes.coerceAtLeast(15L)

            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val syncRequest = PeriodicWorkRequestBuilder<ScheduleSyncWorker>(intervalMinutes, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(appContext).enqueueUniquePeriodicWork(
                WORK_NAME,
                policy,
                syncRequest
            )
        }
    }
}
`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/widget/BlackoutGlanceWidget.kt',
    language: 'kotlin',
    description: 'Jetpack Glance AppWidget: responsive Small (2x1) & Big (3x2/4x2) layouts, 24h timeline bitmap parity, refresh & mute callbacks',
    content: `package ua.blackout.prewarning.widget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.os.Build
import android.widget.RemoteViews
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.glance.ColorFilter
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.action.Action
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.AndroidRemoteViews
import androidx.glance.appwidget.CircularProgressIndicator
import androidx.glance.appwidget.LocalAppWidgetOptions
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.state.updateAppWidgetState
import androidx.glance.background
import androidx.glance.currentState
import androidx.glance.layout.*
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import ua.blackout.prewarning.MainActivity
import ua.blackout.prewarning.R
import ua.blackout.prewarning.core.OutageEngine
import ua.blackout.prewarning.data.KYIV_ZONE
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SlotStatus
import ua.blackout.prewarning.data.model.UserSettings
import ua.blackout.prewarning.data.repository.OutageRepository
import ua.blackout.prewarning.data.repository.OutageSnapshot
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.notification.NotificationHelper
import ua.blackout.prewarning.data.repository.SubscriptionSync
import ua.blackout.prewarning.notification.AlarmScheduler
import ua.blackout.prewarning.ui.AppStrings
import java.time.Instant
import java.time.LocalDateTime

open class BlackoutGlanceWidget(private val forceBigLayout: Boolean = false) : GlanceAppWidget() {

    override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

    private val responsive = SizeMode.Responsive(
        setOf(
            DpSize(120.dp, 60.dp),   // 2x1 Small
            DpSize(250.dp, 110.dp),  // 4x2 Big
            DpSize(250.dp, 160.dp)   // 3x2 Big
        )
    )

    /** One RemoteViews on Android 12+, so address-stack cards (a partial update) reach it (AddressStack.sizeMode). */
    override val sizeMode: SizeMode = AddressStack.sizeMode(responsive)

    companion object {
        val KEY_NOTIFICATIONS_ENABLED = booleanPreferencesKey("glance_notifications_enabled")
        val KEY_QUEUE = stringPreferencesKey("glance_queue")
        val KEY_LANGUAGE = stringPreferencesKey("glance_language")
        /** Bumped on every redraw so Glance recomposes; the widget itself renders only live values. */
        val KEY_REFRESH_TICK = longPreferencesKey("glance_refresh_tick")
        /** When the widget refresh button started a refresh (0 = idle); older than [REFRESH_BUSY_MAX_MS] counts as idle. */
        val KEY_REFRESHING_SINCE = longPreferencesKey("glance_refreshing_since")
        /** A refresh killed with the process must not leave the ring spinning: 2 clients x 8 s timeouts, plus margin. */
        const val REFRESH_BUSY_MAX_MS = 30_000L

        private val COUNTDOWN_PART_REGEX = Regex("(\\\\d{1,2}|--)")

        fun formatWidgetCountdown(rawCountdown: String, lang: String): String {
            val isEn = lang.equals("en", ignoreCase = true)
            val matches = COUNTDOWN_PART_REGEX.findAll(rawCountdown).map { it.value }.toList()
            if (matches.size >= 2) {
                val hh = if (matches[0] == "--") "--" else matches[0].padStart(2, '0')
                val mm = if (matches[1] == "--") "--" else matches[1].padStart(2, '0')
                return if (isEn) "\${hh}hr. \${mm}m." else "\${hh}г. \${mm}хв."
            }
            return rawCountdown
        }

        /** Everything the two widget layouts show, derived from one [OutageSnapshot] (local state only). */
        internal data class WidgetModel(
            val lang: String,
            val queueHeader: String,
            val isUnclear: Boolean,
            val isOffNow: Boolean,
            val countdown: String,
            /** Current outage when off, otherwise the next one: full "HH:mm – HH:mm" (end may be past midnight). */
            val period: String,
            val nextOutage: String,
            /** The 48 half-hour cells of today (empty when unclear): the same states the main timeline draws. */
            val slots: List<BlackoutSlot>,
            val nowHour: Int,
            val nowMinute: Int,
            /** Small "data from HH:mm" caption when the cached schedule is shown because the site failed. */
            val staleCaption: String?,
            /** Address label of the shown item (\`widgetLabel\`, spec/SUBSCRIPTIONS.md 10); null keeps the 1.4.0 look. */
            val addressLabel: String? = null
        )

        private fun p2(n: Int) = n.toString().padStart(2, '0')

        internal fun buildWidgetModel(settings: UserSettings, snapshot: OutageSnapshot, addressLabel: String? = null): WidgetModel {
            val lang = AppStrings.resolveLang(settings.language)
            val now = snapshot.now
            val isNoQueueHouse = !settings.customQueueStatusText.isNullOrBlank()
            val queueHeader = when {
                isNoQueueHouse -> if (lang == "uk") "Черга відсутня" else "No queue"
                settings.queue.isBlank() -> if (lang == "uk") "Черга —" else "Queue —"
                else -> "Черга \${settings.queue}"
            }
            val notConfigured = settings.queue.isBlank() && !isNoQueueHouse && !snapshot.hasAddress
            if (notConfigured || snapshot.isUnclear) {
                return WidgetModel(
                    lang = lang,
                    queueHeader = queueHeader,
                    isUnclear = true,
                    isOffNow = false,
                    countdown = formatWidgetCountdown("--:--:--", lang),
                    period = "--:-- - --:--",
                    nextOutage = "--:-- - --:--",
                    slots = emptyList(),
                    nowHour = now.hour,
                    nowMinute = now.minute,
                    staleCaption = null,
                    addressLabel = addressLabel
                )
            }

            val st = snapshot.status()
            val period = if (!st.isOffNow && st.nextSpan == null) AppStrings.widgetNoOutages(lang) else st.nextSlotTime
            // The next outage after the current moment, from the same merged spans the countdown uses
            val next = OutageEngine.spans(snapshot.outages.filter { !it.stale }).firstOrNull { it.start.isAfter(now) }
            val nextText = when {
                next == null -> AppStrings.widgetNoMoreOutages(lang)
                next.start.toLocalDate() == snapshot.today -> OutageEngine.formatSpan(next)
                else -> "\${AppStrings.widgetTomorrowPrefix(lang)} \${OutageEngine.formatSpan(next)}"
            }
            val staleCaption = if (snapshot.isStale) {
                snapshot.site?.lastSuccessMs?.let { ms ->
                    val t = LocalDateTime.ofInstant(Instant.ofEpochMilli(ms), KYIV_ZONE)
                    AppStrings.staleChip(lang, "\${p2(t.hour)}:\${p2(t.minute)}")
                }
            } else {
                null
            }
            return WidgetModel(
                lang = lang,
                queueHeader = queueHeader,
                isUnclear = false,
                isOffNow = st.isOffNow,
                countdown = formatWidgetCountdown(st.countdownText, lang),
                period = period,
                nextOutage = nextText,
                slots = snapshot.slotsFor(snapshot.today),
                nowHour = now.hour,
                nowMinute = now.minute,
                staleCaption = staleCaption,
                addressLabel = addressLabel
            )
        }

        /** 0 = power on, 1 = planned off, 2 = emergency only, 3 = emergency overlapping planned. */
        private fun cellKind(s: BlackoutSlot): Int = when {
            s.isEmergency && s.isPlanned -> 3
            s.isEmergency -> 2
            s.status == SlotStatus.POWER_OFF -> 1
            else -> 0
        }

        private const val STRIPE_PX = 8f

        @Volatile
        private var cachedChartBitmapKey: String? = null
        @Volatile
        private var cachedChartBitmap: Bitmap? = null

        suspend fun hasActiveWidgets(context: Context): Boolean {
            return try {
                val appCtx = context.applicationContext
                val manager = GlanceAppWidgetManager(appCtx)
                manager.getGlanceIds(BlackoutGlanceWidget::class.java).isNotEmpty() ||
                    manager.getGlanceIds(BlackoutBigGlanceWidget::class.java).isNotEmpty() ||
                    manager.getGlanceIds(BlackoutStripGlanceWidget::class.java).isNotEmpty() ||
                    manager.getGlanceIds(BlackoutMinimalGlanceWidget::class.java).isNotEmpty()
            } catch (_: Exception) {
                false
            }
        }

        /**
         * Redraws every placed widget. The widgets render from [OutageRepository.snapshot] at draw time,
         * so nothing computed here is persisted: this only bumps a tick that makes Glance recompose.
         */
        suspend fun syncAllWidgets(context: Context, refreshing: Boolean? = null) {
            val appCtx = context.applicationContext
            val manager = GlanceAppWidgetManager(appCtx)
            val smallIds = manager.getGlanceIds(BlackoutGlanceWidget::class.java)
            val bigIds = manager.getGlanceIds(BlackoutBigGlanceWidget::class.java)
            val stripIds = manager.getGlanceIds(BlackoutStripGlanceWidget::class.java)
            val minimalIds = manager.getGlanceIds(BlackoutMinimalGlanceWidget::class.java)
            if (smallIds.isEmpty() && bigIds.isEmpty() && stripIds.isEmpty() && minimalIds.isEmpty()) return

            val settings = SettingsRepository(appCtx).getSettings()
            val alertsMaster = SubscriptionSync(appCtx).master()
            val resolvedLang = AppStrings.resolveLang(settings.language)
            val nowMs = System.currentTimeMillis()

            suspend fun touch(gId: GlanceId) {
                updateAppWidgetState(appCtx, PreferencesGlanceStateDefinition, gId) { prefs ->
                    prefs.toMutablePreferences().apply {
                        this[KEY_NOTIFICATIONS_ENABLED] = alertsMaster
                        this[KEY_QUEUE] = settings.queue
                        this[KEY_LANGUAGE] = resolvedLang
                        this[KEY_REFRESH_TICK] = nowMs
                        if (refreshing != null) this[KEY_REFRESHING_SINCE] = if (refreshing) nowMs else 0L
                    }
                }
            }
            for (gId in smallIds) {
                try {
                    touch(gId)
                    BlackoutGlanceWidget().update(appCtx, gId)
                } catch (e: CancellationException) {
                    throw e
                } catch (_: Exception) {
                }
            }
            for (gId in bigIds) {
                try {
                    touch(gId)
                    BlackoutBigGlanceWidget().update(appCtx, gId)
                } catch (e: CancellationException) {
                    throw e
                } catch (_: Exception) {
                }
            }
            for (gId in stripIds) {
                try {
                    touch(gId)
                    BlackoutStripGlanceWidget().update(appCtx, gId)
                } catch (e: CancellationException) {
                    throw e
                } catch (_: Exception) {
                }
            }
            for (gId in minimalIds) {
                try {
                    touch(gId)
                    BlackoutMinimalGlanceWidget().update(appCtx, gId)
                } catch (e: CancellationException) {
                    throw e
                } catch (_: Exception) {
                }
            }
        }

        /**
         * Renders the 24-hour analog electricity counter (САЗУ-ИТ) chart as a high-DPI Bitmap
         * and caches it by (slotStatuses, currentH, currentM) to avoid redundant Bitmap allocations
         * and Canvas redraws within the same minute (e.g., when toggling the alert bell icon).
         */
        @Synchronized
        fun renderAnalogCounterBitmap(
            slots: List<BlackoutSlot>,
            currentH: Int,
            currentM: Int,
            lang: String = "uk",
            height: Int = 132
        ): Bitmap {
            val slotSignature = if (slots.isEmpty()) {
                "UNCLEAR"
            } else {
                buildString(slots.size) {
                    for (s in slots) {
                        append(cellKind(s))
                    }
                }
            }
            val bitmapKey = "\${slotSignature}_\${currentH}_\${currentM}_\${lang}_$height"
            val existingBmp = cachedChartBitmap
            if (cachedChartBitmapKey == bitmapKey && existingBmp != null && !existingBmp.isRecycled) {
                return existingBmp
            }

            val width = 720
            val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bmp)
            val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { isDither = true }

            // 1. Vintage enamel beige faceplate (#DFDDD0 -> #D4D1C1 -> #C6C2B0) with #7A7768 border
            val faceplateRect = RectF(2f, 2f, width - 2f, height - 2f)
            paint.style = Paint.Style.FILL
            paint.shader = LinearGradient(
                0f, 0f, 0f, height.toFloat(),
                intArrayOf(0xFFDFDDD0.toInt(), 0xFFD4D1C1.toInt(), 0xFFC6C2B0.toInt()),
                floatArrayOf(0f, 0.5f, 1f),
                Shader.TileMode.CLAMP
            )
            canvas.drawRoundRect(faceplateRect, 24f, 24f, paint)

            paint.shader = null
            paint.style = Paint.Style.STROKE
            paint.strokeWidth = 4f
            paint.color = 0xFF7A7768.toInt()
            canvas.drawRoundRect(faceplateRect, 24f, 24f, paint)

            // 2. Recessed dark-grey contour (#4E514E) with #6E716B border
            val contourLeft = 18f
            val contourTop = 18f
            val contourRight = width - 18f
            val contourBottom = height - 48f
            val contourRect = RectF(contourLeft, contourTop, contourRight, contourBottom)

            paint.style = Paint.Style.FILL
            paint.color = 0xFF4E514E.toInt()
            canvas.drawRoundRect(contourRect, 12f, 12f, paint)

            paint.style = Paint.Style.STROKE
            paint.strokeWidth = 3f
            paint.color = 0xFF6E716B.toInt()
            canvas.drawRoundRect(contourRect, 12f, 12f, paint)

            // 3. Inner light-gray slot track (#C8C6BC) for 1.5px hour separators
            val trackLeft = 26f
            val trackTop = 26f
            val trackRight = width - 26f
            val trackBottom = height - 56f
            val trackWidth = trackRight - trackLeft
            val trackRect = RectF(trackLeft, trackTop, trackRight, trackBottom)

            paint.style = Paint.Style.FILL
            paint.color = 0xFFC8C6BC.toInt()
            canvas.drawRoundRect(trackRect, 4f, 4f, paint)

            // 4. 24 hours x 2 half-hour cylindrical blocks (no half-hour separators)
            val sepPx = 3f
            val totalSep = sepPx * 23f
            val hourWidth = (trackWidth - totalSep) / 24f
            val halfWidth = hourWidth / 2f

            val offShader = LinearGradient(
                0f, trackTop, 0f, trackBottom,
                intArrayOf(0xFF9E1E18.toInt(), 0xFFD62E26.toInt(), 0xFF8C1914.toInt()),
                floatArrayOf(0f, 0.5f, 1f),
                Shader.TileMode.CLAMP
            )
            val onShader = LinearGradient(
                0f, trackTop, 0f, trackBottom,
                intArrayOf(0xFFD8D6CC.toInt(), 0xFFFCFBF7.toInt(), 0xFFCCC9BE.toInt()),
                floatArrayOf(0f, 0.5f, 1f),
                Shader.TileMode.CLAMP
            )

            if (slots.isEmpty()) {
                // Grey drum chart with "Графіки не діють" / "Outages unclear" when site is unreachable or no queues found
                val unclearShader = LinearGradient(
                    0f, trackTop, 0f, trackBottom,
                    intArrayOf(0xFF7E8287.toInt(), 0xFF94989E.toInt(), 0xFF6E7277.toInt()),
                    floatArrayOf(0f, 0.5f, 1f),
                    Shader.TileMode.CLAMP
                )
                paint.shader = unclearShader
                canvas.drawRoundRect(trackRect, 4f, 4f, paint)
                paint.shader = null

                val unclearText = AppStrings.outagesUnclear(lang)
                val unclearTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = 0xFFFFFFFF.toInt()
                    typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
                    textSize = 22f
                }
                val textWidth = unclearTextPaint.measureText(unclearText)
                val textX = trackLeft + (trackWidth - textWidth) / 2f
                val textYCenter = (trackTop + trackBottom) / 2f - (unclearTextPaint.descent() + unclearTextPaint.ascent()) / 2f
                canvas.drawText(unclearText, textX, textYCenter, unclearTextPaint)
            } else {
                // Emergency overlay, same recipe as the main drum: the bottom half of the cell is amber with
                // dark 45 degree stripes; the top half keeps the planned state (spec/UI_DRUM.md 1).
                val trackMid = (trackTop + trackBottom) / 2f
                val amberShader = LinearGradient(
                    0f, trackMid, 0f, trackBottom,
                    intArrayOf(0xFFFFB020.toInt(), 0xFFF28A1B.toInt(), 0xFFC96A0B.toInt()),
                    floatArrayOf(0f, 0.5f, 1f),
                    Shader.TileMode.CLAMP
                )
                val stripePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    style = Paint.Style.STROKE
                    strokeWidth = STRIPE_PX
                }
                val bandH = trackBottom - trackMid
                val stripeStep = STRIPE_PX * 2f * 1.4142135f

                for (idx in 0 until 48) {
                    val kind = slots.getOrNull(idx)?.let { cellKind(it) } ?: 0
                    val hour = idx / 2
                    val hLeft = trackLeft + hour * (hourWidth + sepPx)
                    val left = if (idx % 2 == 0) hLeft else hLeft + halfWidth
                    val right = if (idx % 2 == 0) hLeft + halfWidth else hLeft + hourWidth

                    paint.shader = when (kind) {
                        1, 3 -> offShader
                        else -> onShader
                    }
                    canvas.drawRect(left, trackTop, right, trackBottom, paint)

                    if (kind >= 2) {
                        paint.shader = amberShader
                        canvas.drawRect(left, trackMid, right, trackBottom, paint)
                        stripePaint.color = 0x8C1A1208.toInt()
                        canvas.save()
                        canvas.clipRect(left, trackMid, right, trackBottom)
                        // Global phase (anchored at trackLeft) keeps the stripes continuous across cells
                        var n = Math.floor(((left - trackLeft) / stripeStep).toDouble()).toInt()
                        while (true) {
                            val u = trackLeft - bandH + n * stripeStep
                            if (u >= right) break
                            canvas.drawLine(u, trackBottom, u + bandH, trackMid, stripePaint)
                            n++
                        }
                        canvas.restore()
                    }
                }
                paint.shader = null
            }

            // 5. Bright yellow current-time needle (#FFE600) with a black outline, from above the dark-grey contour
            // down to the hour labels (owner, 2026-11-17: the black needle was hard to see; the 720 px bitmap is
            // about 2.5 px per dp on the home screen, so the 5 px outline is 2 dp)
            val fraction = ((currentH.coerceIn(0, 23) * 60 + currentM.coerceIn(0, 59)) / 1440f).coerceIn(0f, 1f)
            val needleX = trackLeft + trackWidth * fraction
            val needleTop = contourTop - 8f
            val needleBottom = height - 36f // just above the hour labels (baseline height - 16)

            val needleOutline = 5f
            paint.style = Paint.Style.FILL
            paint.color = 0xFF000000.toInt()
            canvas.drawRoundRect(
                RectF(needleX - 3f - needleOutline, needleTop - needleOutline, needleX + 3f + needleOutline, needleBottom + needleOutline),
                3f + needleOutline, 3f + needleOutline, paint
            )
            paint.color = 0xFFFFE600.toInt()
            canvas.drawRoundRect(
                RectF(needleX - 3f, needleTop, needleX + 3f, needleBottom),
                3f, 3f, paint
            )

            // 6. Stamped black (#1C1B18) hour markers every 3 hours: 00, 03, 06 ... 24 (owner, 2026-11-17)
            val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = 0xFF1C1B18.toInt()
                typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
                textSize = 21f + (height - 132) * 0.1f
            }
            val labels = (0..24 step 3).map { h -> h / 24f to h.toString().padStart(2, '0') }
            val textY = height - 16f
            labels.forEach { (pos, label) ->
                val tw = textPaint.measureText(label)
                val x = when (pos) {
                    0f -> trackLeft
                    1.0f -> trackRight - tw
                    else -> trackLeft + trackWidth * pos - tw / 2f
                }
                canvas.drawText(label, x, textY, textPaint)
            }

            cachedChartBitmapKey = bitmapKey
            cachedChartBitmap = bmp
            return bmp
        }
    }

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val appContext = context.applicationContext
        // Which address this widget shows is looked up by its app widget id (spec/SUBSCRIPTIONS.md 10)
        val appWidgetId = try {
            GlanceAppWidgetManager(appContext).getAppWidgetId(id)
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            null
        }

        // Drawing never touches the network and never wipes caches (C13/C14): the data is refreshed by the
        // worker, the widget receiver and the refresh button, and every value below is computed live.
        provideContent {
            val prefs = currentState<Preferences>()
            // Reading the tick subscribes this composition to the Glance state that syncAllWidgets bumps
            @Suppress("UNUSED_VARIABLE")
            val refreshTick = prefs[KEY_REFRESH_TICK] ?: 0L
            val refreshingSince = prefs[KEY_REFRESHING_SINCE] ?: 0L
            val isRefreshing = refreshingSince > 0L && System.currentTimeMillis() - refreshingSince < REFRESH_BUSY_MAX_MS
            val source = widgetSource(appContext, appWidgetId)
            val model = buildWidgetModel(source.settings, source.snapshot, source.label)
            // the bell shows and toggles the master switch for all addresses (owner decision 4)
            val notificationsEnabled = SubscriptionSync(appContext).master()

            val kind = if (forceBigLayout) AddressStack.Kind.BIG else AddressStack.Kind.SMALL
            val size = AddressStack.layoutSize(appContext, kind)
            // Android 12+ lays out for the launcher's size; the big layout from the size of the 4x2 bucket of \`responsive\`
            val isBigWidget = forceBigLayout || if (AddressStack.supported) {
                size.width >= 250.dp && size.height >= 110.dp
            } else {
                size.height >= 110.dp || size.width >= 220.dp
            }
            // the app widget id of an address stack (spec/SUBSCRIPTIONS.md 10), null when this widget shows one address
            val stackWidgetId = appWidgetId?.takeIf { AddressStack.supported && WidgetBindings.stackIds(appContext, it).size >= 2 }
            val options = LocalAppWidgetOptions.current
            // the cards are composed off the composition and land a moment later in the frame drawn below
            val cards by produceState<List<Pair<String, RemoteViews>>?>(null, stackWidgetId, refreshTick, options, notificationsEnabled) {
                value = stackWidgetId?.let {
                    try {
                        AddressStack.buildCards(appContext, it, kind, options)
                    } catch (e: CancellationException) {
                        throw e
                    } catch (e: Exception) {
                        android.util.Log.w("AddressStack", "cards not built: widget $it", e)
                        null
                    }
                }
            }
            val ready = cards

            if (stackWidgetId != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                // Address stack (spec/SUBSCRIPTIONS.md 10): one card over the whole widget, and above it the buttons in
                // the corner the card leaves empty; the cards follow this frame as a partial update (see AddressStack)
                val widget = AddressStack.widgetSize(appContext, options, kind)
                // the frame is drawn from the first frame on (switching from the one-address layout left the launcher
                // reusing its views: its padding and background stayed and the buttons were lost); the cards follow
                LaunchedEffect(ready) {
                    if (ready.isNullOrEmpty()) return@LaunchedEffect
                    kotlinx.coroutines.delay(AddressStack.PUSH_DELAY_MS)
                    AddressStack.pushCards(appContext, stackWidgetId, ready, widget)
                }
                Box(modifier = GlanceModifier.fillMaxSize()) {
                    AndroidRemoteViews(
                        remoteViews = AddressStack.frame(appContext),
                        modifier = GlanceModifier.fillMaxSize()
                    )
                    StackButtons(isBigWidget, notificationsEnabled, isRefreshing)
                }
            } else {
                WidgetBody(model, isBigWidget, notificationsEnabled, isRefreshing, openAppAction(source.itemId))
            }
        }
    }
}

private fun GlanceModifier.clickableIf(action: Action?): GlanceModifier = if (action != null) clickable(action) else this

/** The 2x1 and 4x2 widget content of one address ([BlackoutGlanceWidget]). */
@Composable
internal fun WidgetBody(
    model: BlackoutGlanceWidget.Companion.WidgetModel,
    isBigWidget: Boolean,
    notificationsEnabled: Boolean,
    isRefreshing: Boolean,
    openApp: Action?
) {
    fun ink(c: Color): ColorProvider = ColorProvider(c)
    val open = openApp

    val resolvedLang = model.lang
    val isUnclear = model.isUnclear
    val isBlackoutNow = model.isOffNow
    val statusText = when {
        isUnclear -> AppStrings.powerUnclear(resolvedLang)
        isBlackoutNow -> "СВІТЛА НЕМАЄ"
        else -> "СВІТЛО Є"
    }
    val statusColor = when {
        isUnclear -> Color(0xFF9CA3AF)
        isBlackoutNow -> Color(0xFFFF5E3A)
        else -> Color(0xFF34D399)
    }

    GlanceTheme {
        Box(
            modifier = GlanceModifier
                .fillMaxSize()
                .cornerRadius(20.dp)
                .background(ink(Color(0xCC141A29)))
                .padding(12.dp)
        ) {
            if (isBigWidget) {
                // ----------------- 3x2 BIG WIDGET -----------------
                Column(
                    modifier = GlanceModifier.fillMaxSize(),
                    verticalAlignment = Alignment.Vertical.CenterVertically
                ) {
                    // Top Row: Queue + Status + Round Refresh Button + Round Notification Toggle Button
                    Row(
                        modifier = GlanceModifier.fillMaxWidth(),
                        verticalAlignment = Alignment.Vertical.CenterVertically
                    ) {
                        Column(modifier = GlanceModifier.defaultWeight().clickableIf(open)) {
                            Row(verticalAlignment = Alignment.Vertical.CenterVertically) {
                                Text(
                                    text = model.queueHeader,
                                    style = TextStyle(fontWeight = FontWeight.Bold, fontSize = 16.sp, color = ink(Color.White)),
                                    maxLines = 1
                                )
                                if (model.addressLabel != null) {
                                    Spacer(modifier = GlanceModifier.width(6.dp))
                                    Text(
                                        text = model.addressLabel,
                                        style = TextStyle(fontSize = 11.sp, color = ink(Color(0xB3BAE6FD))),
                                        maxLines = 1
                                    )
                                }
                            }
                            Row(verticalAlignment = Alignment.Vertical.CenterVertically) {
                                Text(
                                    text = statusText,
                                    style = TextStyle(fontWeight = FontWeight.Bold, fontSize = 11.sp, color = ink(statusColor))
                                )
                                if (model.staleCaption != null) {
                                    Spacer(modifier = GlanceModifier.width(6.dp))
                                    Text(
                                        text = model.staleCaption,
                                        style = TextStyle(fontSize = 9.sp, color = ink(Color(0xFFFFB020))),
                                        maxLines = 1
                                    )
                                }
                            }
                        }
                        RefreshButton(36.dp, 18.dp, isRefreshing)
                        Spacer(modifier = GlanceModifier.width(8.dp))
                        BellButton(36.dp, 20.dp, notificationsEnabled)
                    }

                    Spacer(modifier = GlanceModifier.height(6.dp))

                    // Countdown Card Row (clickable to open app)
                    Row(
                        modifier = GlanceModifier
                            .fillMaxWidth()
                            .cornerRadius(12.dp)
                            .background(ink(Color(0x33000000)))
                            .padding(horizontal = 10.dp, vertical = 6.dp)
                            .clickableIf(open),
                        verticalAlignment = Alignment.Vertical.CenterVertically
                    ) {
                        Column(modifier = GlanceModifier.defaultWeight()) {
                            Text(
                                text = if (isBlackoutNow) "До увімкнення:" else "До відключення:",
                                style = TextStyle(fontSize = 10.sp, color = ink(Color(0xB3BAE6FD)))
                            )
                            Text(
                                text = model.countdown,
                                style = TextStyle(fontSize = 20.sp, fontWeight = FontWeight.Bold, color = ink(Color.White)),
                                maxLines = 1
                            )
                        }
                        Column(horizontalAlignment = Alignment.Horizontal.End) {
                            Text(
                                text = "Період",
                                style = TextStyle(fontSize = 10.sp, color = ink(Color(0xB3BAE6FD)))
                            )
                            Text(
                                text = model.period,
                                style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Bold, color = ink(Color.White))
                            )
                        }
                    }

                    Spacer(modifier = GlanceModifier.height(6.dp))

                    // 24-Hour Analog Electricity Counter (САЗУ-ИТ) Chart rendered via Bitmap
                    val chartBitmap = BlackoutGlanceWidget.renderAnalogCounterBitmap(
                        model.slots, model.nowHour, model.nowMinute, resolvedLang
                    )
                    Image(
                        provider = ImageProvider(chartBitmap),
                        contentDescription = "24-годинний графік відключень",
                        contentScale = ContentScale.FillBounds,
                        modifier = GlanceModifier.fillMaxWidth().height(52.dp).clickableIf(open)
                    )

                    // Upcoming Outage Interval ("Наступне відключення")
                    Spacer(modifier = GlanceModifier.height(4.dp))
                    Row(
                        modifier = GlanceModifier
                            .fillMaxWidth()
                            .cornerRadius(8.dp)
                            .background(ink(Color(0x26000000)))
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                            .clickableIf(open),
                        verticalAlignment = Alignment.Vertical.CenterVertically
                    ) {
                        Text(
                            text = model.nextOutage,
                            style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Bold, color = ink(Color.White))
                        )
                        Spacer(modifier = GlanceModifier.defaultWeight())
                        Text(
                            text = "Наступне відключення",
                            style = TextStyle(fontSize = 10.sp, color = ink(Color(0xFFFF5E3A)))
                        )
                    }
                }
            } else {
                // ----------------- 2x1 SMALL WIDGET -----------------
                Column(
                    modifier = GlanceModifier.fillMaxSize(),
                    verticalAlignment = Alignment.Vertical.CenterVertically
                ) {
                    // Top Row: Queue + Status
                    Row(
                        modifier = GlanceModifier.fillMaxWidth(),
                        verticalAlignment = Alignment.Vertical.CenterVertically
                    ) {
                        Text(
                            text = model.queueHeader,
                            style = TextStyle(fontWeight = FontWeight.Bold, fontSize = 14.sp, color = ink(Color.White)),
                            maxLines = 1,
                            modifier = GlanceModifier.clickableIf(open)
                        )
                        if (model.addressLabel != null) {
                            Spacer(modifier = GlanceModifier.width(6.dp))
                            Text(
                                text = model.addressLabel,
                                style = TextStyle(fontSize = 10.sp, color = ink(Color(0xB3BAE6FD))),
                                maxLines = 1,
                                modifier = GlanceModifier.defaultWeight().clickableIf(open)
                            )
                            Spacer(modifier = GlanceModifier.width(6.dp))
                        } else {
                            Spacer(modifier = GlanceModifier.defaultWeight())
                        }
                        Text(
                            text = statusText,
                            style = TextStyle(fontWeight = FontWeight.Bold, fontSize = 10.sp, color = ink(statusColor)),
                            modifier = GlanceModifier.clickableIf(open)
                        )
                    }

                    Spacer(modifier = GlanceModifier.height(4.dp))

                    // Bottom Row: Countdown + Round Refresh Button + Round Notification Toggle Button
                    Row(
                        modifier = GlanceModifier.fillMaxWidth(),
                        verticalAlignment = Alignment.Vertical.CenterVertically
                    ) {
                        Column(modifier = GlanceModifier.defaultWeight().clickableIf(open)) {
                            Text(
                                text = if (isBlackoutNow) "До увімкнення:" else "До відключення:",
                                style = TextStyle(fontSize = 10.sp, color = ink(Color(0xB3BAE6FD)))
                            )
                            Text(
                                text = model.countdown,
                                style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Bold, color = ink(Color.White)),
                                maxLines = 1
                            )
                        }
                        RefreshButton(34.dp, 16.dp, isRefreshing)
                        Spacer(modifier = GlanceModifier.width(6.dp))
                        BellButton(34.dp, 18.dp, notificationsEnabled)
                    }
                }
            }
        }
    }
}

/**
 * The refresh and bell buttons of an address stack, above the front card (see [AddressStack]): in the corner each
 * card leaves empty: top right on the 4x2 card, 12 dp from the corner; bottom right on the 2x1 card, 12 dp from the
 * right and 8 dp from the bottom (the card's padding, widget_card_small.xml).
 */
@Composable
internal fun StackButtons(isBigWidget: Boolean, notificationsEnabled: Boolean, isRefreshing: Boolean) {
    Box(
        modifier = GlanceModifier.fillMaxSize()
            .padding(start = 12.dp, top = 12.dp, end = 12.dp, bottom = if (isBigWidget) 12.dp else 8.dp),
        contentAlignment = if (isBigWidget) Alignment.TopEnd else Alignment.BottomEnd
    ) {
        Row(verticalAlignment = Alignment.Vertical.CenterVertically) {
            if (isBigWidget) {
                RefreshButton(36.dp, 18.dp, isRefreshing)
                Spacer(modifier = GlanceModifier.width(8.dp))
                BellButton(36.dp, 20.dp, notificationsEnabled)
            } else {
                RefreshButton(34.dp, 16.dp, isRefreshing)
                Spacer(modifier = GlanceModifier.width(6.dp))
                BellButton(34.dp, 18.dp, notificationsEnabled)
            }
        }
    }
}

/** Round refresh button (same style as the notification toggle). */
@Composable
private fun RefreshButton(boxSize: Dp, iconSize: Dp, isRefreshing: Boolean) {
    Box(
        modifier = GlanceModifier
            .size(boxSize)
            .cornerRadius(boxSize / 2)
            .background(ColorProvider(Color(0x26FFFFFF)))
            .clickable(actionRunCallback<RefreshWidgetActionCallback>()),
        contentAlignment = Alignment.Center
    ) {
        if (isRefreshing) {
            // Glance cannot rotate an image; the platform progress ring animates on its own
            CircularProgressIndicator(color = ColorProvider(Color.White), modifier = GlanceModifier.size(iconSize))
        } else {
            Image(
                provider = ImageProvider(R.drawable.ic_refresh),
                contentDescription = "Оновити дані",
                colorFilter = ColorFilter.tint(ColorProvider(Color.White)),
                modifier = GlanceModifier.size(iconSize)
            )
        }
    }
}

/** Round notification toggle (the master switch for all addresses, owner decision 4). */
@Composable
private fun BellButton(boxSize: Dp, iconSize: Dp, notificationsEnabled: Boolean) {
    Box(
        modifier = GlanceModifier
            .size(boxSize)
            .cornerRadius(boxSize / 2)
            .background(ColorProvider(if (notificationsEnabled) Color.White else Color(0x26FFFFFF)))
            .clickable(actionRunCallback<ToggleAlertsActionCallback>()),
        contentAlignment = Alignment.Center
    ) {
        Image(
            provider = ImageProvider(
                if (notificationsEnabled) R.drawable.ic_notification else R.drawable.ic_notification_off
            ),
            contentDescription = "Toggle alerts",
            colorFilter = ColorFilter.tint(
                ColorProvider(if (notificationsEnabled) Color(0xFFFF5E3A) else Color.White)
            ),
            modifier = GlanceModifier.size(iconSize)
        )
    }
}

class BlackoutBigGlanceWidget : BlackoutGlanceWidget(forceBigLayout = true)

private val OPEN_SUBSCRIPTION = ActionParameters.Key<String>(NotificationHelper.EXTRA_SUBSCRIPTION_ID)

/** A tap opens the main screen with the widget's address shown (spec/SUBSCRIPTIONS.md 9 and 10). */
internal fun openAppAction(itemId: String?): Action =
    if (itemId == null) actionStartActivity<MainActivity>()
    else actionStartActivity<MainActivity>(actionParametersOf(OPEN_SUBSCRIPTION to itemId))

/**
 * Third widget (4x1): the 24-hour drum chart with the current-time needle, no buttons or switches; a tap
 * opens the app. It draws from the same snapshot as the other two widgets, so the 48 half-hour states
 * (including the emergency stripes) are identical. When the launcher cell is at least [INFO_MIN_HEIGHT]
 * tall (a usual portrait row is about 100 dp) one line with the queue, status and countdown sits above it.
 */
class BlackoutStripGlanceWidget : GlanceAppWidget() {

    override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

    private val responsive = SizeMode.Responsive(
        setOf(
            DpSize(250.dp, 40.dp),              // drum only
            DpSize(250.dp, INFO_MIN_HEIGHT)     // info line + drum
        )
    )

    /** One RemoteViews on Android 12+, so address-stack cards (a partial update) reach it (AddressStack.sizeMode). */
    override val sizeMode: SizeMode = AddressStack.sizeMode(responsive)

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val appContext = context.applicationContext
        // Which address this widget shows is looked up by its app widget id (spec/SUBSCRIPTIONS.md 10)
        val appWidgetId = try {
            GlanceAppWidgetManager(appContext).getAppWidgetId(id)
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            null
        }

        provideContent {
            val prefs = currentState<Preferences>()
            @Suppress("UNUSED_VARIABLE")
            val refreshTick = prefs[BlackoutGlanceWidget.KEY_REFRESH_TICK] ?: 0L
            // the app widget id of an address stack (spec/SUBSCRIPTIONS.md 10), null when this widget shows one address
            val stackWidgetId = appWidgetId?.takeIf { AddressStack.supported && WidgetBindings.stackIds(appContext, it).size >= 2 }
            val options = LocalAppWidgetOptions.current
            val cards by produceState<List<Pair<String, RemoteViews>>?>(null, stackWidgetId, refreshTick, options) {
                value = stackWidgetId?.let { AddressStack.buildCards(appContext, it, AddressStack.Kind.STRIP, options) }
            }
            val ready = cards
            if (stackWidgetId != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                // Address stack (spec/SUBSCRIPTIONS.md 10): this widget has no buttons, so the cards are all of it;
                // they follow this frame as a partial update (see AddressStack)
                // the frame is drawn from the first frame on (switching from the one-address layout left the launcher
                // reusing its views: its padding and background stayed and the buttons were lost); the cards follow
                LaunchedEffect(ready) {
                    if (ready.isNullOrEmpty()) return@LaunchedEffect
                    kotlinx.coroutines.delay(AddressStack.PUSH_DELAY_MS)
                    AddressStack.pushCards(appContext, stackWidgetId, ready, AddressStack.widgetSize(appContext, options, AddressStack.Kind.STRIP))
                }
                AndroidRemoteViews(
                    remoteViews = AddressStack.frame(appContext),
                    modifier = GlanceModifier.fillMaxSize()
                )
            } else {
                val source = widgetSource(appContext, appWidgetId)
                val model = BlackoutGlanceWidget.buildWidgetModel(source.settings, source.snapshot, source.label)
                val size = AddressStack.layoutSize(appContext, AddressStack.Kind.STRIP)
                StripBody(model, openAppAction(source.itemId), showInfo = size.height >= INFO_MIN_HEIGHT)
            }
        }
    }

    companion object {
        /** Drum height of the big widget, so both widgets show the drum at the same size. */
        internal val DRUM_HEIGHT = 52.dp
        /** Smallest widget height with room for the info line: 52 drum + 12 padding + 4 gap + 16 line. */
        internal val INFO_MIN_HEIGHT = 84.dp
    }
}

/** The «Графік» widget content of one address: the info line (when there is room) and the drum. */
@Composable
internal fun StripBody(
    model: BlackoutGlanceWidget.Companion.WidgetModel,
    openApp: Action?,
    showInfo: Boolean
) {
    // Same bitmap as the big widget's drum (720 x 132), drawn at the same 52 dp height
    val chartBitmap = BlackoutGlanceWidget.renderAnalogCounterBitmap(
        model.slots, model.nowHour, model.nowMinute, model.lang
    )
    val statusText = when {
        model.isUnclear -> AppStrings.powerUnclear(model.lang)
        model.isOffNow -> "СВІТЛА НЕМАЄ"
        else -> "СВІТЛО Є"
    }
    val statusColor = when {
        model.isUnclear -> Color(0xFF9CA3AF)
        model.isOffNow -> Color(0xFFFF5E3A)
        else -> Color(0xFF34D399)
    }
    val description = if (model.isUnclear) {
        AppStrings.outagesUnclear(model.lang)
    } else {
        "\${model.queueHeader}. \${if (model.isOffNow) "СВІТЛА НЕМАЄ" else "СВІТЛО Є"}"
    }

    GlanceTheme {
        Column(
            modifier = GlanceModifier
                .fillMaxSize()
                .cornerRadius(20.dp)
                .background(ColorProvider(Color(0xCC141A29)))
                .padding(6.dp)
                .clickableIf(openApp),
            verticalAlignment = Alignment.Vertical.CenterVertically
        ) {
            if (showInfo) {
                Row(
                    modifier = GlanceModifier.fillMaxWidth().padding(horizontal = 6.dp),
                    verticalAlignment = Alignment.Vertical.CenterVertically
                ) {
                    Text(
                        text = model.queueHeader,
                        style = TextStyle(
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            color = ColorProvider(Color.White)
                        ),
                        maxLines = 1
                    )
                    Spacer(modifier = GlanceModifier.width(6.dp))
                    if (model.addressLabel != null) {
                        Text(
                            text = model.addressLabel,
                            style = TextStyle(fontSize = 10.sp, color = ColorProvider(Color(0xB3BAE6FD))),
                            maxLines = 1,
                            modifier = GlanceModifier.defaultWeight()
                        )
                        Spacer(modifier = GlanceModifier.width(6.dp))
                    }
                    Text(
                        text = statusText,
                        style = TextStyle(
                            fontWeight = FontWeight.Bold,
                            fontSize = 10.sp,
                            color = ColorProvider(statusColor)
                        ),
                        maxLines = 1,
                        modifier = if (model.addressLabel == null) GlanceModifier.defaultWeight() else GlanceModifier
                    )
                    if (model.addressLabel != null && !model.isUnclear) Spacer(modifier = GlanceModifier.width(6.dp))
                    if (!model.isUnclear) {
                        Text(
                            text = model.countdown,
                            style = TextStyle(
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                                color = ColorProvider(Color.White)
                            ),
                            maxLines = 1
                        )
                    }
                }
                Spacer(modifier = GlanceModifier.height(4.dp))
            }
            Image(
                provider = ImageProvider(chartBitmap),
                contentDescription = description,
                contentScale = ContentScale.FillBounds,
                modifier = GlanceModifier
                    .fillMaxWidth()
                    .height(BlackoutStripGlanceWidget.DRUM_HEIGHT)
            )
        }
    }
}

class ToggleAlertsActionCallback : ActionCallback {
    override suspend fun onAction(
        context: Context,
        glanceId: GlanceId,
        parameters: ActionParameters
    ) {
        val appContext = context.applicationContext
        // The widget bell is the master switch for all addresses (multi-address owner decision 4)
        val sync = SubscriptionSync(appContext)
        sync.setMaster(!sync.master())
        try {
            AlarmScheduler.syncAlarms(appContext)
        } catch (_: Exception) {}
        try {
            BlackoutGlanceWidget.syncAllWidgets(appContext)
        } catch (_: Exception) {}
    }
}

class RefreshWidgetActionCallback : ActionCallback {
    override suspend fun onAction(
        context: Context,
        glanceId: GlanceId,
        parameters: ActionParameters
    ) {
        val appContext = context.applicationContext
        // Show the progress ring on the refresh buttons while the refresh runs
        try {
            BlackoutGlanceWidget.syncAllWidgets(appContext, refreshing = true)
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
        }
        // Network refresh on IO through the one shared pipeline. A failed source keeps its previous data
        // (nothing is cleared); each call is bounded by the connection timeouts of the clients (8 s).
        try {
            withContext(Dispatchers.IO) {
                val settings = SettingsRepository(appContext).getSettings()
                OutageRepository(appContext).refresh(settings, forceNetwork = true)
            }
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
        }
        // Whatever happened, re-plan alarms and redraw from what is stored now
        try {
            AlarmScheduler.syncAlarms(appContext)
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
        }
        try {
            BlackoutGlanceWidget.syncAllWidgets(appContext, refreshing = false)
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
        }
    }
}`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/widget/BlackoutWidgetReceiver.kt',
    language: 'kotlin',
    description: 'GlanceAppWidgetReceiver binding the widget lifecycle',
    content: `package ua.blackout.prewarning.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import ua.blackout.prewarning.data.repository.OutageRepository
import ua.blackout.prewarning.data.repository.ScheduleRepository
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.notification.AlarmScheduler

open class BlackoutWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = BlackoutGlanceWidget()

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        refreshAndRedraw(context, forceNetwork = true)
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        refreshAndRedraw(context, forceNetwork = false)
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        super.onDeleted(context, appWidgetIds)
        WidgetBindings.unbind(context, appWidgetIds)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        // The last widget is gone: re-plan so the widget transition alarms are cancelled
        refreshAndRedraw(context, forceNetwork = false, fetch = false)
    }

    /**
     * Refreshes through [OutageRepository] when the cache is missing or older than the refresh interval
     * (always when [forceNetwork]), then re-plans alarms (which schedule or cancel the widget transition
     * redraws) and redraws. A failed fetch keeps the previous data and still redraws.
     */
    private fun refreshAndRedraw(context: Context, forceNetwork: Boolean, fetch: Boolean = true) {
        val pendingResult = goAsync()
        val appContext = context.applicationContext
        CoroutineScope(Dispatchers.IO).launch {
            try {
                if (fetch) {
                    try {
                        val settings = SettingsRepository(appContext).getSettings()
                        val hasSource = settings.queue.isNotBlank() || settings.selectedAddressQuery != null
                        if (hasSource) {
                            val scheduleRepo = ScheduleRepository(appContext)
                            val cacheFresh = scheduleRepo.hasValidTodayCache(settings.queue) &&
                                scheduleRepo.isCacheFresh(settings.refreshIntervalMinutes)
                            if (forceNetwork || !cacheFresh) {
                                OutageRepository(appContext).refresh(settings, forceNetwork)
                            }
                        }
                    } catch (e: CancellationException) {
                        throw e
                    } catch (_: Exception) {
                    }
                }
                try {
                    AlarmScheduler.syncAlarms(appContext)
                } catch (e: CancellationException) {
                    throw e
                } catch (_: Exception) {
                }
                try {
                    BlackoutGlanceWidget.syncAllWidgets(appContext)
                } catch (e: CancellationException) {
                    throw e
                } catch (_: Exception) {
                }
            } finally {
                try {
                    pendingResult.finish()
                } catch (_: Exception) {
                }
            }
        }
    }
}

class BlackoutBigWidgetReceiver : BlackoutWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = BlackoutBigGlanceWidget()
}

class BlackoutStripWidgetReceiver : BlackoutWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = BlackoutStripGlanceWidget()
}

class BlackoutMinimalWidgetReceiver : BlackoutWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = BlackoutMinimalGlanceWidget()
}
`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/MainActivity.kt',
    language: 'kotlin',
    description: 'Main Jetpack Compose Activity with Material 3 navigation and permission handling',
    content: `package ua.blackout.prewarning

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import ua.blackout.prewarning.notification.NotificationHelper
import ua.blackout.prewarning.ui.screens.BlackoutAppNavigation
import ua.blackout.prewarning.ui.theme.ZTBlackoutTheme

class MainActivity : ComponentActivity() {

    private val requestNotificationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { isGranted ->
            // Notification permission granted or denied
        }

    /** Subscription id from the notification the app was opened with; the main screen shows it once. */
    private var openSubscriptionId by mutableStateOf<String?>(null)

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        intent.getStringExtra(NotificationHelper.EXTRA_SUBSCRIPTION_ID)?.let { openSubscriptionId = it }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // a recreated activity (rotation) must not jump back to the notification's address
        if (savedInstanceState == null) openSubscriptionId = intent?.getStringExtra(NotificationHelper.EXTRA_SUBSCRIPTION_ID)

        // Initialize Notification Channels
        NotificationHelper.createNotificationChannels(this)

        // Request runtime permission for Android 13+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestNotificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }

        setContent {
            val systemDark = isSystemInDarkTheme()
            var isDarkMode by remember { mutableStateOf(systemDark) }

            ZTBlackoutTheme(darkTheme = isDarkMode) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    BlackoutAppNavigation(
                        onThemeChanged = { isDarkMode = it },
                        openSubscriptionId = openSubscriptionId,
                        onOpenSubscriptionHandled = { openSubscriptionId = null }
                    )
                }
            }
        }
    }
}`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/ui/screens/MainScreen.kt',
    language: 'kotlin',
    description: 'Compose MainScreen with Hero Countdown, Today/Tomorrow tabs, 24h timeline, Facebook & site links',
    content: `package ua.blackout.prewarning.ui.screens

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.NotificationsOff
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.PullToRefreshDefaults
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import kotlinx.coroutines.delay
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import ua.blackout.prewarning.R
import ua.blackout.prewarning.core.IntervalStatus
import ua.blackout.prewarning.core.Outage
import ua.blackout.prewarning.core.OutageKind
import ua.blackout.prewarning.core.Subscription
import ua.blackout.prewarning.core.Subscriptions
import ua.blackout.prewarning.data.KYIV_ZONE
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SlotStatus
import ua.blackout.prewarning.data.repository.OutageSnapshot
import ua.blackout.prewarning.data.repository.ScheduleStatusInfo
import ua.blackout.prewarning.ui.AppStrings
import ua.blackout.prewarning.ui.components.spinWhile
import ua.blackout.prewarning.ui.components.GlassCard
import ua.blackout.prewarning.ui.components.OutageRowFormat
import ua.blackout.prewarning.ui.components.SiteNoticeCard
import ua.blackout.prewarning.ui.components.SiteStatusBanner
import ua.blackout.prewarning.ui.components.SiteStatusChipRow
import ua.blackout.prewarning.ui.components.SiteStatusModel
import ua.blackout.prewarning.ui.components.TimelineBar
import ua.blackout.prewarning.ui.theme.ZtColors
import ua.blackout.prewarning.ui.theme.ZtMinTouch
import ua.blackout.prewarning.ui.theme.ZtShapes
import ua.blackout.prewarning.ui.theme.ZtType
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.format.DateTimeFormatter

// Small text sits on a translucent card: the secondary and tertiary text alphas are raised from the
// 0xB3 / 0x99 tokens so the contrast stays above 4.5:1 on bright backgrounds (docs/review/UI_PROPOSALS.md 4.9, #2).
private val TextSecondary = Color(0xE6BAE6FD)
private val TextTertiary = Color(0xCCBAE6FD)
private val InkOnAccent = Color(0xFF0B0B0A)
private val TabIdle = Color(0xCCBAE6FD)

private const val TAB_TODAY = "today"
private const val TAB_TOMORROW = "tomorrow"

private fun formatAddressAfterCity(address: String?): String? {
    if (address.isNullOrBlank()) return null
    val trimmed = address.trim()
    val commaIdx = trimmed.indexOf(',')
    if (commaIdx != -1) {
        val cityPart = trimmed.substring(0, commaIdx + 1).trim()
        val streetPart = trimmed.substring(commaIdx + 1).trim()
        if (streetPart.isNotEmpty()) {
            return "$cityPart\\n$streetPart"
        }
    }
    return trimmed
}

/** Limits the font scale of the content (the 44 sp countdown must not char-wrap); other text keeps the user's scale. */
@Composable
private fun CappedFontScale(max: Float, content: @Composable () -> Unit) {
    val density = LocalDensity.current
    CompositionLocalProvider(
        LocalDensity provides Density(density.density, minOf(density.fontScale, max)),
        content = content
    )
}

/** False when the user turned system animations off (ANIMATOR_DURATION_SCALE == 0): decorative motion is skipped. */
@Composable
private fun rememberAnimationsEnabled(): Boolean {
    val context = LocalContext.current
    return remember {
        try {
            Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) != 0f
        } catch (_: Exception) {
            true
        }
    }
}

/**
 * Tip above the first-launch "Виберіть чергу" button: a line of text and an arrow nudging down at the button
 * (owner, 2026-11-17). The arrow stands still when system animations are off; read in graphicsLayer, so only it redraws.
 */
@Composable
private fun FirstStartTip(lang: String, modifier: Modifier = Modifier) {
    val animate = rememberAnimationsEnabled()
    val nudge: State<Float>? = if (animate) {
        rememberInfiniteTransition(label = "tip").animateFloat(
            initialValue = 0f,
            targetValue = 1f,
            animationSpec = infiniteRepeatable(
                animation = tween(700, easing = FastOutSlowInEasing),
                repeatMode = RepeatMode.Reverse
            ),
            label = "tipNudge"
        )
    } else {
        null
    }
    Column(
        modifier = modifier.widthIn(max = 300.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Text(
            text = AppStrings.firstStartTip(lang),
            style = ZtType.body.copy(fontWeight = FontWeight.Bold),
            color = Color.White,
            textAlign = TextAlign.Center
        )
        Icon(
            imageVector = Icons.Default.ArrowDownward,
            contentDescription = null,
            tint = ZtColors.Accent,
            modifier = Modifier
                .size(32.dp)
                .graphicsLayer { translationY = (nudge?.value ?: 0f) * 8.dp.toPx() }
        )
    }
}

/** Status dot of the hero. The pulse is read inside graphicsLayer, so only this node redraws, never the screen. */
@Composable
private fun StatusDot(color: Color, pulsing: Boolean) {
    val animate = pulsing && rememberAnimationsEnabled()
    val scale: State<Float>? = if (animate) {
        rememberInfiniteTransition(label = "pulse").animateFloat(
            initialValue = 0.85f,
            targetValue = 1.25f,
            animationSpec = infiniteRepeatable(
                animation = tween(900, easing = FastOutSlowInEasing),
                repeatMode = RepeatMode.Reverse
            ),
            label = "pulseScale"
        )
    } else {
        null
    }
    Box(
        modifier = Modifier
            .size(10.dp)
            .graphicsLayer {
                val s = scale?.value ?: 1f
                scaleX = s
                scaleY = s
            }
            .clip(CircleShape)
            .background(color)
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    queue: String = "",
    customQueueStatusText: String? = null,
    selectedAddress: String? = null,
    snapshot: OutageSnapshot,
    statusInfo: ScheduleStatusInfo,
    isRefreshing: Boolean = false,
    exactAlarmMissing: Boolean = false,
    onOpenExactAlarmSettings: () -> Unit = {},
    notificationsEnabled: Boolean = true,
    lastUpdated: String = "19:27",
    nextUpdated: String = "19:57",
    @Suppress("UNUSED_PARAMETER") currentTime: LocalTime = LocalTime.now(KYIV_ZONE),
    lang: String = "uk",
    selectedLanguage: String = "SYSTEM",
    onToggleNotifications: () -> Unit = {},
    onRefresh: () -> Unit = {},
    onOpenQueueSelection: () -> Unit = {},
    onChangeLanguage: (String) -> Unit = {},
    // Address switcher (spec/SUBSCRIPTIONS.md 9): empty with fewer than 2 addresses, then Main looks as in 1.4.0
    addresses: List<Subscription> = emptyList(),
    primaryAddressId: String? = null,
    shownAddressId: String? = null,
    onSelectAddress: (String) -> Unit = {},
    showNoAlertsCaption: Boolean = false,
    onOpenSettings: () -> Unit = {},
    /** Hoisted by the navigation: a double tap on this page's dock button scrolls it back to the top. */
    scrollState: ScrollState = rememberScrollState()
) {
    val context = LocalContext.current

    // Everything below is derived from one outage snapshot (see OutageRepository)
    val isBlackoutNow = statusInfo.isBlackoutNow
    val countdownText = statusInfo.countdownText
    val slotTimeText = statusInfo.nextSlotTime
    val todayDate = snapshot.today
    val tomorrowDate = todayDate.plusDays(1)
    val now = snapshot.now

    // Today / Tomorrow stays when another address is shown (spec/SUBSCRIPTIONS.md 9, owner 2026-11-18)
    var selectedDayTab by rememberSaveable { mutableStateOf(TAB_TODAY) }
    val isTomorrowSelected = selectedDayTab == TAB_TOMORROW
    val activeDate = if (isTomorrowSelected) tomorrowDate else todayDate

    val activeView = remember(snapshot, activeDate) { snapshot.dayView(activeDate) }
    val featuredEmergency = remember(snapshot) { snapshot.featuredEmergency() }
    val siteBanner = remember(snapshot, lang) { SiteStatusModel.banner(snapshot, lang) }
    val siteNotice = remember(snapshot) { SiteStatusModel.notice(snapshot) }

    val hasEmergencyOutage = featuredEmergency != null
    val hasCustomNoQueueStatus = !customQueueStatusText.isNullOrBlank() && !hasEmergencyOutage
    val isQueueUnselected = queue.isBlank() && !hasCustomNoQueueStatus && !hasEmergencyOutage
    val formattedSelectedAddress = remember(selectedAddress) { formatAddressAfterCity(selectedAddress) }

    // 48 light POWER_ON half-hour slots for buildings that are never disconnected by hourly schedules
    val lightNoOutageSlots = remember {
        (0 until 48).map { idx ->
            val sh = idx / 2
            val sm = if (idx % 2 == 0) "00" else "30"
            val eh = (idx + 1) / 2
            val em = if ((idx + 1) % 2 == 0) "00" else "30"
            val startStr = "\${sh.toString().padStart(2, '0')}:$sm"
            val endStr = "\${eh.toString().padStart(2, '0')}:$em"
            BlackoutSlot(
                hour = sh,
                startStr = startStr,
                endStr = endStr,
                status = SlotStatus.POWER_ON,
                label = "$startStr - $endStr"
            )
        }
    }

    // The ztoe table of the shown day is not known: the drum is grey, known emergency/repair outages are drawn on top
    val isTodayUnclear = !hasCustomNoQueueStatus && queue.isNotBlank() && !snapshot.plannedKnown
    val isTomorrowUnclear = !hasCustomNoQueueStatus && queue.isNotBlank() && !snapshot.tomorrowPublished
    val activeUnclear = if (isTomorrowSelected) isTomorrowUnclear else isTodayUnclear

    val activeSlots: List<BlackoutSlot> = remember(snapshot, activeDate, hasCustomNoQueueStatus) {
        if (hasCustomNoQueueStatus) lightNoOutageSlots else snapshot.slotsFor(activeDate)
    }

    val isStatusUnclear = (snapshot.isUnclear && !hasCustomNoQueueStatus) || isQueueUnselected
    val rows = activeView.rows
    val showOutageList = !isQueueUnselected && (rows.isNotEmpty() || (!activeUnclear && activeSlots.isNotEmpty()))

    val clock = now.toLocalTime()
    val currentTimeStr = remember(clock.hour, clock.minute) {
        clock.format(DateTimeFormatter.ofPattern("HH:mm"))
    }

    // Pull the page down to refresh, as in a browser (owner, 2026-11-18). The spinner shows only for a pull: the
    // quiet refresh on entering the page also sets isRefreshing. Without a queue the page does not scroll, so it
    // can not be pulled either.
    val pullState = rememberPullToRefreshState()
    var pulled by remember { mutableStateOf(false) }
    LaunchedEffect(isRefreshing) { if (!isRefreshing) pulled = false }
    LaunchedEffect(pulled) {
        // a pull whose refresh never started (one was already running and ended) must not spin forever
        if (pulled) { delay(1_500); if (!isRefreshing) pulled = false }
    }
    val pullSpinning = pulled
    PullToRefreshBox(
        isRefreshing = pullSpinning,
        onRefresh = {
            pulled = true
            if (!isRefreshing) onRefresh()
        },
        modifier = Modifier.fillMaxSize(),
        state = pullState,
        indicator = {
            PullToRefreshDefaults.Indicator(
                state = pullState,
                isRefreshing = pullSpinning,
                modifier = Modifier.align(Alignment.TopCenter).statusBarsPadding(),
                containerColor = ZtColors.CardSolid,
                color = ZtColors.Accent
            )
        }
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .then(
                    if (isQueueUnselected) {
                        // The overlay below is the only interactive thing: hide this layer from TalkBack too
                        Modifier
                            .clearAndSetSemantics {}
                            .alpha(0.15f)
                    } else {
                        Modifier.verticalScroll(scrollState)
                    }
                )
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // 1. Top Header: Queue title + sleek pill toggle switch (no text)
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (isQueueUnselected || hasCustomNoQueueStatus || queue.isBlank()) {
                    Box(modifier = Modifier.weight(1f).defaultMinSize(minHeight = ZtMinTouch))
                } else {
                    Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
                        Text(
                            text = "\${AppStrings.queue(lang)} $queue",
                            style = ZtType.title,
                            color = Color.White
                        )
                        Text(
                            text = formattedSelectedAddress ?: AppStrings.mainUtilityName(),
                            style = ZtType.caption,
                            color = TextSecondary,
                            maxLines = 3,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }

                NotificationPill(
                    enabled = notificationsEnabled,
                    interactive = !isQueueUnselected,
                    lang = lang,
                    onToggle = onToggleNotifications
                )
            }

            // 1'. The master is on but no address has a switch on: say so, with a way to Settings
            if (!isQueueUnselected && showNoAlertsCaption) {
                NoAlertsCaption(lang = lang, onOpenSettings = onOpenSettings)
            }

            val hasSwitcher = addresses.isNotEmpty()

            // 1a. Featured emergency outage (active, overdue or the next upcoming one); finished ones never show here
            if (!hasSwitcher && !isQueueUnselected && featuredEmergency != null) {
                EmergencyBanner(outage = featuredEmergency, now = now, lang = lang)
            }

            // 1b. Exact alarms are not allowed (Android 12+): warnings may arrive late
            if (!isQueueUnselected && exactAlarmMissing) {
                ExactAlarmCard(lang = lang, onOpenSettings = onOpenExactAlarmSettings)
            }

            // 1c. Site is degraded (no table / unreachable / no internet), persistent
            if (!isQueueUnselected && siteBanner != null) {
                SiteStatusBanner(siteBanner)
            }

            // 1c'. ztoe is up but publishes a notice instead of the table: quote it to the user
            if (siteNotice != null) {
                SiteNoticeCard(text = siteNotice, lang = lang)
            }

            // 1c''. Address switcher: under the global banners, above everything of one address
            if (hasSwitcher) {
                AddressSwitcher(
                    addresses = addresses,
                    primaryId = primaryAddressId,
                    shownId = shownAddressId,
                    lang = lang,
                    onSelect = onSelectAddress
                )
                if (!isQueueUnselected && featuredEmergency != null) {
                    EmergencyBanner(outage = featuredEmergency, now = now, lang = lang)
                }
            }

            // 1d. Custom ZTOE queue/house status message
            if (!isQueueUnselected && !customQueueStatusText.isNullOrBlank()) {
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        if (!formattedSelectedAddress.isNullOrBlank()) {
                            Text(text = formattedSelectedAddress, style = ZtType.caption, color = TextSecondary)
                        }
                        Text(text = customQueueStatusText, style = ZtType.subhead, color = Color.White)
                    }
                }
            }

            // 2. Hero outage status card
            GlassCard(modifier = Modifier.fillMaxWidth(), contentPadding = PaddingValues(18.dp)) {
                if (hasCustomNoQueueStatus && !hasEmergencyOutage) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 16.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CappedFontScale(1.15f) {
                            Text(
                                text = "--:--:--",
                                style = ZtType.display,
                                color = Color.White,
                                maxLines = 1,
                                softWrap = false
                            )
                        }
                    }
                } else {
                    val off = !isStatusUnclear && isBlackoutNow
                    Column {
                        // Status line
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                modifier = Modifier.weight(1f).padding(end = 8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                StatusDot(
                                    color = when {
                                        isStatusUnclear -> ZtColors.ChipGreyText
                                        isBlackoutNow -> ZtColors.Accent
                                        else -> ZtColors.ChipGreenText
                                    },
                                    pulsing = off
                                )
                                Text(
                                    text = when {
                                        isStatusUnclear -> AppStrings.powerUnclear(lang)
                                        isBlackoutNow -> AppStrings.powerOff(lang)
                                        else -> AppStrings.powerOn(lang)
                                    },
                                    style = ZtType.label.copy(fontWeight = FontWeight.Bold),
                                    color = Color.White,
                                    maxLines = 2,
                                    modifier = Modifier.weight(1f)
                                )
                            }

                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Icon(
                                    Icons.Default.Schedule,
                                    contentDescription = null,
                                    tint = TextSecondary,
                                    modifier = Modifier.size(14.dp)
                                )
                                Text(
                                    text = currentTimeStr,
                                    style = ZtType.captionMono,
                                    color = TextSecondary,
                                    maxLines = 1,
                                    softWrap = false
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        // Big countdown digits (font scale capped on this node only)
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = if (off) AppStrings.powerOnIn(lang) else AppStrings.powerOffIn(lang),
                                style = ZtType.caption,
                                color = TextSecondary,
                                textAlign = TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            CappedFontScale(1.15f) {
                                Text(
                                    text = countdownText,
                                    style = ZtType.display,
                                    color = Color.White,
                                    maxLines = 1,
                                    softWrap = false,
                                    textAlign = TextAlign.Center
                                )
                            }
                        }

                        val effectiveSlotTimeText = if (isStatusUnclear) "--:-- - --:--" else slotTimeText
                        if (effectiveSlotTimeText.isNotEmpty() && effectiveSlotTimeText != "Відключень немає") {
                            Spacer(modifier = Modifier.height(14.dp))
                            Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(ZtColors.Divider))
                            Spacer(modifier = Modifier.height(10.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = if (off) AppStrings.outagePeriod(lang) else AppStrings.nextPeriod(lang),
                                    style = ZtType.caption,
                                    color = TextSecondary,
                                    modifier = Modifier.weight(1f)
                                )
                                Box(
                                    modifier = Modifier
                                        .clip(ZtShapes.Badge)
                                        .background(Color(0x26FFFFFF))
                                        .padding(horizontal = 10.dp, vertical = 4.dp)
                                ) {
                                    Text(
                                        text = effectiveSlotTimeText,
                                        style = ZtType.label.copy(fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold),
                                        color = Color.White,
                                        maxLines = 1,
                                        softWrap = false
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // 3. Day selector: Tomorrow is always there; before ztoe publishes it, it shows the grey drum plus a notice
            DayTabs(
                isTomorrow = isTomorrowSelected,
                enabled = !isQueueUnselected,
                lang = lang,
                onSelect = { selectedDayTab = if (it) TAB_TOMORROW else TAB_TODAY }
            )

            if (isTomorrowSelected && isTomorrowUnclear && !isQueueUnselected) {
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = AppStrings.tomorrowNotPublished(lang),
                        style = ZtType.subhead,
                        color = Color.White
                    )
                }
            }

            // 4. Schedule card with the 24 h drum and the list of outages of the shown day
            GlassCard(modifier = Modifier.fillMaxWidth(), contentPadding = PaddingValues(18.dp)) {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    TimelineBar(
                        slots = activeSlots,
                        currentHour = clock.hour,
                        currentMinute = clock.minute,
                        showNeedle = !isTomorrowSelected,
                        lang = lang,
                        unclearBase = activeUnclear
                    )

                    if (showOutageList) {
                        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(ZtColors.Divider))

                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(
                                text = if (isTomorrowSelected) AppStrings.blackoutHoursForTomorrowHeader(lang) else AppStrings.blackoutHoursForDayHeader(lang),
                                style = ZtType.label,
                                color = TextSecondary
                            )

                            if (rows.isNotEmpty()) {
                                rows.forEachIndexed { index, row ->
                                    key(index, row.outage.id) {
                                        OutageRowItem(text = OutageRowFormat.format(lang, row), lang = lang)
                                    }
                                }
                            } else {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(ZtShapes.Row)
                                        .background(ZtColors.InnerRow)
                                        .padding(14.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = AppStrings.noBlackoutsScheduled(lang),
                                        style = ZtType.caption,
                                        color = TextSecondary
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // 5. Last updated, site status chips and the circular refresh button
            GlassCard(modifier = Modifier.fillMaxWidth(), contentPadding = PaddingValues(14.dp)) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(modifier = Modifier.weight(1f)) {
                            // As wide as the widest pair, every label filling the rest of its row: both times
                            // start at the same x, labels stay left-aligned and a wrapped label keeps its time
                            Column(
                                modifier = Modifier.width(IntrinsicSize.Max),
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                LabelledValue(AppStrings.lastUpdated(lang), lastUpdated)
                                LabelledValue(AppStrings.nextUpdated(lang), nextUpdated)
                            }
                        }
                        RefreshButton(
                            enabled = !isQueueUnselected,
                            isRefreshing = isRefreshing,
                            lang = lang,
                            onRefresh = onRefresh
                        )
                    }
                    SiteStatusChipRow(snapshot = snapshot, lang = lang)
                }
            }

            // 6. Emergency outages info link (Facebook)
            LinkCard(
                title = AppStrings.emergencyOutagesLabel(lang),
                url = AppStrings.EMERGENCY_OUTAGES_URL,
                tileColor = Color(0xFF1877F2),
                enabled = !isQueueUnselected,
                onClick = {
                    try {
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(AppStrings.EMERGENCY_OUTAGES_URL)))
                    } catch (_: Exception) {
                    }
                }
            ) {
                // Facebook vector logo
                Icon(
                    painter = painterResource(id = R.drawable.ic_facebook),
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(20.dp)
                )
            }

            // 7. Blackout schedules on the ZTOE website, at the very bottom after the Facebook link
            LinkCard(
                title = AppStrings.siteSchedulesLabel(lang),
                url = AppStrings.SITE_SCHEDULES_URL,
                tileColor = ZtColors.Accent,
                enabled = !isQueueUnselected,
                onClick = {
                    try {
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(AppStrings.SITE_SCHEDULES_URL)))
                    } catch (_: Exception) {
                    }
                }
            ) {
                Icon(
                    imageVector = Icons.Default.Language,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(20.dp)
                )
            }

            // Extra spacing so the floating navigation dock does not overlap the bottom card
            Spacer(modifier = Modifier.height(96.dp))
        }

        // First launch / unselected queue overlay: dark dim, centred accent "Виберіть чергу" button, language switch
        if (isQueueUnselected) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xD9070A12))
                    .clickable(enabled = false) {}
                    .padding(horizontal = 24.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(24.dp)
                ) {
                    FirstStartTip(lang = lang, modifier = Modifier.offset(y = 12.dp))
                    Box(
                        modifier = Modifier
                            .defaultMinSize(minWidth = 260.dp, minHeight = ZtMinTouch)
                            .clip(ZtShapes.Card)
                            .background(ZtColors.Accent)
                            .border(1.dp, Color(0x40FFFFFF), ZtShapes.Card)
                            .clickable(role = Role.Button) { onOpenQueueSelection() }
                            .padding(horizontal = 32.dp, vertical = 20.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            // White label on the accent fill (owner request; 3.0:1, large bold title)
                            Text(
                                text = AppStrings.selectQueueAction(lang),
                                style = ZtType.title.copy(fontWeight = FontWeight.ExtraBold),
                                color = Color.White,
                                textAlign = TextAlign.Center
                            )
                            Text(
                                text = AppStrings.mainUtilityName(),
                                style = ZtType.label.copy(fontWeight = FontWeight.Bold),
                                color = Color.White,
                                textAlign = TextAlign.Center
                            )
                        }
                    }

                    LanguageSwitch(
                        selectedLanguage = selectedLanguage,
                        lang = lang,
                        onChangeLanguage = onChangeLanguage
                    )
                }
            }
        }
    }
}

// -------------------------------------------------------------------------------------------------
// Pieces
// -------------------------------------------------------------------------------------------------

/** 58 x 34 pill switch for the notifications; the touch target is 48 dp tall without changing the look. */
@Composable
private fun NotificationPill(enabled: Boolean, interactive: Boolean, lang: String, onToggle: () -> Unit) {
    val label = AppStrings.notifications(lang)
    val stateText = if (enabled) AppStrings.switchOn(lang) else AppStrings.switchOff(lang)
    Box(
        modifier = Modifier
            .minimumInteractiveComponentSize()
            .size(width = 58.dp, height = 34.dp)
            .clip(CircleShape)
            .background(if (enabled) ZtColors.Accent else Color(0x26FFFFFF))
            .semantics {
                contentDescription = label
                stateDescription = stateText
            }
            .toggleable(
                value = enabled,
                enabled = interactive,
                role = Role.Switch,
                onValueChange = { onToggle() }
            )
            .padding(4.dp),
        contentAlignment = if (enabled) Alignment.CenterEnd else Alignment.CenterStart
    ) {
        Box(
            modifier = Modifier
                .size(26.dp)
                .clip(CircleShape)
                .background(Color.White),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = if (enabled) Icons.Default.Notifications else Icons.Default.NotificationsOff,
                contentDescription = null,
                tint = if (enabled) ZtColors.Accent else Color(0xFF6B7280),
                modifier = Modifier.size(16.dp)
            )
        }
    }
}

@Composable
private fun EmergencyBanner(outage: Outage, now: LocalDateTime, lang: String) {
    val format = remember { DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm") }
    val status = outage.statusAt(now)
    val title = when {
        lang == "uk" && !outage.label.isNullOrBlank() -> outage.label
        status == IntervalStatus.UPCOMING -> AppStrings.emergencyUpcomingTitle(lang)
        else -> AppStrings.emergencyOutageTitle(lang)
    }
    val restoreText = if (outage.overdue || !outage.end.isAfter(outage.start)) "--:--" else outage.end.format(format)

    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(text = title, style = ZtType.subhead, color = ZtColors.Accent)
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                BannerLine(AppStrings.emergencyStartLabel(lang), outage.start.format(format))
                BannerLine(AppStrings.emergencyRestoreLabel(lang), restoreText)
                if (status == IntervalStatus.OVERDUE) {
                    Text(text = AppStrings.rowOverdue(lang), style = ZtType.caption, color = TextSecondary)
                }
            }
        }
    }
}

@Composable
private fun BannerLine(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(text = label, style = ZtType.caption, color = TextSecondary, modifier = Modifier.weight(1f))
        Text(
            text = value,
            style = ZtType.captionMono,
            color = Color.White,
            maxLines = 1,
            softWrap = false,
            textAlign = TextAlign.End
        )
    }
}

/** Exact alarms are off: explains why warnings can be late and opens the system screen where they are allowed. */
@Composable
private fun ExactAlarmCard(lang: String, onOpenSettings: () -> Unit) {
    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(ZtColors.ChipAmber),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Alarm,
                    contentDescription = null,
                    tint = ZtColors.ChipAmberText,
                    modifier = Modifier.size(20.dp)
                )
            }
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(text = AppStrings.exactAlarmTitle(lang), style = ZtType.subhead, color = ZtColors.ChipAmberText)
                Text(text = AppStrings.exactAlarmBody(lang), style = ZtType.body, color = TextSecondary)
                Spacer(modifier = Modifier.height(2.dp))
                Box(
                    modifier = Modifier
                        .defaultMinSize(minHeight = ZtMinTouch)
                        .clip(ZtShapes.Control)
                        .background(ZtColors.Accent)
                        .clickable(role = Role.Button, onClick = onOpenSettings)
                        .padding(horizontal = 20.dp, vertical = 10.dp),
                    contentAlignment = Alignment.Center
                ) {
                    // Dark label on the accent fill (6.9:1)
                    Text(
                        text = AppStrings.exactAlarmButton(lang),
                        style = ZtType.label.copy(fontWeight = FontWeight.Bold),
                        color = InkOnAccent,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}

/** "No address has alerts turned on" under the header bell, with a link to Settings (spec/SUBSCRIPTIONS.md 9). */
@Composable
private fun NoAlertsCaption(lang: String, onOpenSettings: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(
            text = AppStrings.noAddressAlerts(lang),
            style = ZtType.caption,
            color = ZtColors.Accent,
            modifier = Modifier.weight(1f)
        )
        Box(
            modifier = Modifier
                .heightIn(min = ZtMinTouch)
                .clip(ZtShapes.Chip)
                .clickable(role = Role.Button, onClick = onOpenSettings)
                .padding(horizontal = 8.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = AppStrings.settingsTitle(lang),
                style = ZtType.label.copy(fontWeight = FontWeight.Bold),
                color = Color.White
            )
        }
    }
}

/** One chip per address, the primary with a star; scrolls sideways when the labels do not fit. */
@Composable
private fun AddressSwitcher(
    addresses: List<Subscription>,
    primaryId: String?,
    shownId: String?,
    lang: String,
    onSelect: (String) -> Unit
) {
    val selectedText = AppStrings.tabSelected(lang)
    val primaryText = AppStrings.primaryBadge(lang)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .selectableGroup(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        for (item in addresses) {
            val selected = item.id == shownId
            val isPrimary = item.id == primaryId
            val label = Subscriptions.displayLabel(item)
            Row(
                modifier = Modifier
                    .heightIn(min = ZtMinTouch)
                    .clip(ZtShapes.Chip)
                    .background(if (selected) Color(0x33FFFFFF) else Color(0x80141A29))
                    .border(1.dp, if (selected) Color(0x66FFFFFF) else Color(0x1FFFFFFF), ZtShapes.Chip)
                    .semantics { if (selected) stateDescription = selectedText }
                    .selectable(selected = selected, role = Role.Tab, onClick = { onSelect(item.id) })
                    .padding(horizontal = 14.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                if (isPrimary) {
                    Icon(Icons.Default.Star, contentDescription = primaryText, tint = ZtColors.Accent, modifier = Modifier.size(16.dp))
                }
                Text(
                    text = label,
                    style = ZtType.label.copy(fontWeight = FontWeight.Bold),
                    color = if (selected) Color.White else TabIdle,
                    maxLines = 1,
                    softWrap = false
                )
            }
        }
    }
}

@Composable
private fun DayTabs(isTomorrow: Boolean, enabled: Boolean, lang: String, onSelect: (Boolean) -> Unit) {
    GlassCard(
        modifier = Modifier.fillMaxWidth(),
        shape = ZtShapes.Control,
        cornerRadius = 16.dp,
        background = Color(0x80141A29),
        borderColor = null,
        contentPadding = PaddingValues(4.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth().selectableGroup()) {
            DayTab(AppStrings.today(lang), selected = !isTomorrow, enabled = enabled, lang = lang, modifier = Modifier.weight(1f)) {
                onSelect(false)
            }
            DayTab(AppStrings.tomorrow(lang), selected = isTomorrow, enabled = enabled, lang = lang, modifier = Modifier.weight(1f)) {
                onSelect(true)
            }
        }
    }
}

@Composable
private fun DayTab(text: String, selected: Boolean, enabled: Boolean, lang: String, modifier: Modifier, onClick: () -> Unit) {
    val selectedText = AppStrings.tabSelected(lang)
    Box(
        modifier = modifier
            .heightIn(min = ZtMinTouch)
            .clip(ZtShapes.Chip)
            .background(if (selected) Color(0x33FFFFFF) else Color.Transparent)
            .semantics { if (selected) stateDescription = selectedText }
            .selectable(selected = selected, enabled = enabled, role = Role.Tab, onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 8.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            style = ZtType.label.copy(fontWeight = FontWeight.Bold),
            color = if (selected) Color.White else TabIdle,
            maxLines = 1,
            textAlign = TextAlign.Center
        )
    }
}

/** One outage of the day: marker, full span, tags and the full duration chip. Finished rows are dimmed to 55 %. */
@Composable
private fun OutageRowItem(text: OutageRowFormat.RowText, lang: String) {
    val tags = listOfNotNull(text.kindTag, text.originTag, text.statusTag, text.continueTag).joinToString(" · ")
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .alpha(if (text.isFinished) 0.55f else 1f)
            .clip(ZtShapes.Row)
            .background(ZtColors.InnerRow)
            .clearAndSetSemantics { contentDescription = text.contentDescription }
            .padding(horizontal = 14.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Fixed 20x20dp leading indicator slot so the text start X is identical in every row
        Box(modifier = Modifier.size(20.dp), contentAlignment = Alignment.Center) {
            when {
                text.isEmergency -> {
                    Box(
                        modifier = Modifier
                            .size(20.dp)
                            .clip(CircleShape)
                            .background(ZtColors.Accent),
                        contentAlignment = Alignment.Center
                    ) {
                        // The glyph does not scale with the font size: the circle is fixed at 20 dp
                        CappedFontScale(1f) {
                            Text(
                                text = "!",
                                style = ZtType.overline.copy(fontWeight = FontWeight.Black, letterSpacing = androidx.compose.ui.unit.TextUnit.Unspecified),
                                color = Color.White
                            )
                        }
                    }
                }
                text.isRepair -> Icon(
                    imageVector = Icons.Default.Build,
                    contentDescription = null,
                    tint = ZtColors.Accent,
                    modifier = Modifier.size(18.dp)
                )
                else -> Box(
                    modifier = Modifier
                        .size(10.dp)
                        .clip(CircleShape)
                        .background(ZtColors.Accent)
                )
            }
        }

        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(text = text.timeText, style = ZtType.timeMono, color = Color.White, maxLines = 2)
            if (tags.isNotEmpty()) {
                Text(
                    text = tags,
                    style = ZtType.caption,
                    color = if (text.isEmergency && !text.isFinished) ZtColors.Accent else TextSecondary
                )
            }
        }

        if (text.durationText != null) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color(0x26FF5E3A))
                    .padding(horizontal = 8.dp, vertical = 3.dp)
            ) {
                Text(
                    text = text.durationText,
                    style = ZtType.captionMono,
                    color = ZtColors.Accent,
                    maxLines = 1,
                    softWrap = false
                )
            }
        }
    }
}

@Composable
private fun LabelledValue(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            text = label,
            style = ZtType.caption,
            color = TextTertiary,
            modifier = Modifier.weight(1f)
        )
        Text(
            text = value,
            style = ZtType.captionMono,
            color = Color.White,
            maxLines = 1,
            softWrap = false
        )
    }
}

/** 42 dp white refresh disc; 48 dp touch target; the arrow rotates while a refresh runs. */
@Composable
private fun RefreshButton(enabled: Boolean, isRefreshing: Boolean, lang: String, onRefresh: () -> Unit) {
    val label = AppStrings.refreshBtn(lang)
    val busyText = AppStrings.refreshing(lang)
    Box(
        modifier = Modifier
            .minimumInteractiveComponentSize()
            .size(42.dp)
            .clip(CircleShape)
            .background(Color.White)
            .semantics {
                contentDescription = label
                if (isRefreshing) stateDescription = busyText
            }
            .clickable(enabled = enabled && !isRefreshing, role = Role.Button) { onRefresh() },
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = Icons.Default.Refresh,
            contentDescription = null,
            tint = Color.Black,
            modifier = Modifier.size(20.dp).spinWhile(isRefreshing)
        )
    }
}

/** Card with one tappable link row: icon tile, title and the full URL (wraps to two lines instead of a dead ellipsis). */
@Composable
private fun LinkCard(
    title: String,
    url: String,
    tileColor: Color,
    enabled: Boolean,
    onClick: () -> Unit,
    icon: @Composable () -> Unit
) {
    GlassCard(modifier = Modifier.fillMaxWidth(), contentPadding = PaddingValues(14.dp)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(ZtShapes.Row)
                .background(ZtColors.InnerRow)
                .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(ZtShapes.Badge)
                    .background(tileColor),
                contentAlignment = Alignment.Center
            ) {
                icon()
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(text = title, style = ZtType.label.copy(fontWeight = FontWeight.Bold), color = Color.White)
                Text(
                    text = url,
                    style = ZtType.captionMono.copy(fontWeight = FontWeight.Normal),
                    color = TextTertiary,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }
            Icon(
                imageVector = Icons.Default.OpenInNew,
                contentDescription = null,
                tint = TextTertiary,
                modifier = Modifier.size(16.dp)
            )
        }
    }
}

/** 3-segment language switch of the first-launch overlay; stacks vertically at large font scales instead of clipping. */
@Composable
private fun LanguageSwitch(selectedLanguage: String, lang: String, onChangeLanguage: (String) -> Unit) {
    val options = listOf(
        "SYSTEM" to AppStrings.mainLangAuto(lang),
        "en" to "English",
        "uk" to "Українська"
    )
    val stacked = LocalDensity.current.fontScale > 1.15f

    @Composable
    fun Segment(code: String, label: String, modifier: Modifier) {
        val isActive = selectedLanguage.equals(code, ignoreCase = true)
        Box(
            modifier = modifier
                .heightIn(min = ZtMinTouch)
                .clip(ZtShapes.Chip)
                .background(if (isActive) Color.White else Color.Transparent)
                .selectable(selected = isActive, role = Role.RadioButton) { onChangeLanguage(code) }
                .padding(horizontal = 8.dp, vertical = 8.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = label,
                style = ZtType.label.copy(fontWeight = FontWeight.Bold),
                color = if (isActive) Color.Black else Color(0xE6BAE6FD),
                maxLines = 1,
                textAlign = TextAlign.Center
            )
        }
    }

    val containerModifier = Modifier
        .fillMaxWidth(0.9f)
        .clip(ZtShapes.Control)
        .background(Color(0xE6141A29))
        .border(1.dp, Color(0x33FFFFFF), ZtShapes.Control)
        .padding(6.dp)
        .selectableGroup()

    if (stacked) {
        Column(modifier = containerModifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            options.forEach { (code, label) -> Segment(code, label, Modifier.fillMaxWidth()) }
        }
    } else {
        Row(
            modifier = containerModifier,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            options.forEach { (code, label) -> Segment(code, label, Modifier.weight(1f)) }
        }
    }
}
`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/ui/screens/SettingsScreen.kt',
    language: 'kotlin',
    description: 'Compose Settings screen with dropdown queue selection, ? help dialog, timer inputs, and toggles',
    content: `package ua.blackout.prewarning.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.AlarmOff
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.HelpOutline
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.RadioButtonChecked
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.filled.Vibration
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.zIndex
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.material.icons.filled.DragIndicator
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import ua.blackout.prewarning.core.ConsumerType
import ua.blackout.prewarning.data.repository.HouseVariantChoices
import ua.blackout.prewarning.core.HouseVariant
import ua.blackout.prewarning.core.HouseVariants
import ua.blackout.prewarning.core.Subscription
import ua.blackout.prewarning.core.SubscriptionStore
import ua.blackout.prewarning.core.Subscriptions
import ua.blackout.prewarning.data.model.SelectedAddressQuery
import ua.blackout.prewarning.data.parser.AddressLookupResult
import ua.blackout.prewarning.data.parser.FetchStatus
import ua.blackout.prewarning.data.parser.ZtoeAddressLookup
import ua.blackout.prewarning.data.parser.ZtoeParser
import ua.blackout.prewarning.data.parser.ZtoeHouseLookupResult
import ua.blackout.prewarning.data.parser.ZtoeRemOption
import ua.blackout.prewarning.data.parser.ZtoeSettlementOption
import ua.blackout.prewarning.data.parser.ZtoeStreetOption
import ua.blackout.prewarning.ui.AppStrings
import ua.blackout.prewarning.ui.components.spinWhile
import ua.blackout.prewarning.ui.components.GlassCard
import ua.blackout.prewarning.ui.components.PickerItem
import ua.blackout.prewarning.ui.components.CoachOverlay
import ua.blackout.prewarning.ui.components.CoachTargets
import ua.blackout.prewarning.ui.components.CoachTip
import ua.blackout.prewarning.ui.components.LocalCoachTargets
import ua.blackout.prewarning.ui.components.OnboardingTour
import ua.blackout.prewarning.ui.components.TourInput
import ua.blackout.prewarning.ui.components.TourPage
import ua.blackout.prewarning.ui.components.TourStep
import ua.blackout.prewarning.ui.components.coachTarget
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import ua.blackout.prewarning.ui.components.PickerSearch
import ua.blackout.prewarning.ui.components.SearchablePickerField
import ua.blackout.prewarning.ui.components.glassFieldColors
import ua.blackout.prewarning.ui.theme.ZtColors
import ua.blackout.prewarning.ui.theme.ZtMinTouch
import ua.blackout.prewarning.ui.theme.ZtShapes
import ua.blackout.prewarning.ui.theme.ZtType

/** Presets for "warn me N minutes before". 5 and 10 work: alarms are exact, only the site refresh is bounded by WorkManager. */
private val ADVANCE_PRESETS = listOf(5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240)

/** Presets for the site check. WorkManager never runs periodic work more often than every 15 minutes. */
private val REFRESH_PRESETS = listOf(15, 30, 60, 120, 180, 240)

private val QUEUES = listOf(
    "1.1", "1.2", "2.1", "2.2", "3.1", "3.2",
    "4.1", "4.2", "5.1", "5.2", "6.1", "6.2"
)

private const val ZTOE_SEARCH_URL = "https://www.ztoe.com.ua/unhooking-search.php"

/**
 * Settings page.
 *
 * @param exactAlarmMissing show the card that explains the "Alarms & reminders" permission
 * @param onOpenExactAlarmSettings opens that system screen
 * @param isVisible false while the pager keeps this page composed off screen; the site check waits
 *   until the page is shown so launch does not run a second full schedule fetch
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    currentQueue: String = "",
    subscriptions: SubscriptionStore = SubscriptionStore.EMPTY,
    alertsMaster: Boolean = true,
    selectedAddressQuery: SelectedAddressQuery? = null,
    siteUrl: String = ZTOE_SEARCH_URL,
    // CRITICAL CONSTANTS — Default values: advanceMinutes = 15, refreshMinutes = 30. Never modify on your own.
    advanceMinutes: Int = 15,
    refreshMinutes: Int = 30,
    notificationsEnabled: Boolean = true,
    emergencyNotificationsEnabled: Boolean = true,
    soundEnabled: Boolean = true,
    vibrationEnabled: Boolean = true,
    currentLanguage: String = "SYSTEM",
    lang: String = "uk",
    autoOpenQueueHelp: Boolean = false,
    onAutoOpenQueueHelpHandled: () -> Unit = {},
    /** First-run tour (spec/ONBOARDING.md): the lookup dialog shows its PICK / APPLY steps. */
    tourActive: Boolean = false,
    onTourSkip: () -> Unit = {},
    /** The rename dialog was closed (saved or cancelled): the tour goes on from RENAME to ALERTS. */
    onRenameDialogClosed: () -> Unit = {},
    onAddAddress: (
        queue: String,
        statusText: String?,
        addressLabel: String,
        query: SelectedAddressQuery
    ) -> Unit = { _, _, _, _ -> },
    onAddQueueOnly: (String) -> Unit = {},
    onRemoveSubscription: (String) -> Unit = {},
    onMakePrimary: (String) -> Unit = {},
    onSetPlanned: (id: String, on: Boolean) -> Unit = { _, _ -> },
    onSetEmergency: (id: String, on: Boolean) -> Unit = { _, _ -> },
    onRenameSubscription: (id: String, label: String) -> Unit = { _, _ -> },
    /** The address of an existing item was edited (spec/SUBSCRIPTIONS.md section 4, \`setAddress\`). */
    onEditAddress: (
        id: String,
        queue: String,
        statusText: String?,
        addressLabel: String,
        query: SelectedAddressQuery
    ) -> Unit = { _, _, _, _, _ -> },
    /** Moves an address to a new list position (spec/SUBSCRIPTIONS.md section 4, \`move\`). */
    onMoveSubscription: (id: String, toIndex: Int) -> Unit = { _, _ -> },
    onToggleMaster: (Boolean) -> Unit = {},
    onSiteUrlChanged: (String) -> Unit = {},
    onAdvanceMinutesChanged: (Int) -> Unit = {},
    onRefreshMinutesChanged: (Int) -> Unit = {},
    onToggleSound: (Boolean) -> Unit = {},
    onToggleVibration: (Boolean) -> Unit = {},
    emergencyEtaAlerts: Boolean = true,
    emergencyEndAlerts: Boolean = true,
    onToggleEmergencyEtaAlerts: (Boolean) -> Unit = {},
    onToggleEmergencyEndAlerts: (Boolean) -> Unit = {},
    onLanguageSelected: (String) -> Unit = {},
    onSendTestAlert: () -> Unit = {},
    onForceRefresh: () -> Unit = {},
    /** A refresh is running: the refresh button's icon rotates and taps are ignored. */
    isRefreshing: Boolean = false,
    onResetDefaults: () -> Unit = {},
    onShowAppBanner: (String) -> Unit = {},
    exactAlarmMissing: Boolean = false,
    onOpenExactAlarmSettings: () -> Unit = {},
    isVisible: Boolean = true,
    /** Hoisted by the navigation: a double tap on this page's dock button scrolls it back to the top. */
    scrollState: ScrollState = rememberScrollState()
) {
    val context = LocalContext.current
    var showQueueHelpDialog by remember { mutableStateOf(false) }
    var showResetConfirmDialog by remember { mutableStateOf(false) }
    var removeCandidate by remember { mutableStateOf<Subscription?>(null) }
    var renameCandidate by remember { mutableStateOf<Subscription?>(null) }
    /** The item whose address the lookup edits (opened from the card's edit dialog). */
    var editAddressCandidate by remember { mutableStateOf<Subscription?>(null) }
    var renameWasOpen by remember { mutableStateOf(false) }
    LaunchedEffect(renameCandidate) {
        if (renameCandidate != null) {
            renameWasOpen = true
        } else if (renameWasOpen) {
            renameWasOpen = false
            onRenameDialogClosed()
        }
    }

    LaunchedEffect(autoOpenQueueHelp) {
        if (autoOpenQueueHelp) {
            showQueueHelpDialog = true
            onAutoOpenQueueHelpHandled()
        }
    }

    val isUrlInValidList = remember(siteUrl) { ZtoeParser.isValidUrl(siteUrl, context) }
    var urlFetchStatus by remember { mutableStateOf(FetchStatus.SUCCESS) }
    var isVerifyingUrl by remember { mutableStateOf(false) }
    var urlChecked by remember { mutableStateOf(false) }

    // Live URL verification against valid-urls.json + the real table; waits until the page is on screen
    LaunchedEffect(siteUrl, currentQueue, isVisible) {
        if (!isVisible) return@LaunchedEffect
        if (!ZtoeParser.isValidUrl(siteUrl, context)) {
            urlFetchStatus = FetchStatus.NO_QUEUES_FOUND
            urlChecked = true
            return@LaunchedEffect
        }
        isVerifyingUrl = true
        val verifyQueue = currentQueue.ifBlank { "1.1" }
        val res = withContext(Dispatchers.IO) {
            ZtoeParser.fetchFullSchedule(siteUrl, verifyQueue, context)
        }
        urlFetchStatus = res.status
        isVerifyingUrl = false
        urlChecked = true
    }

    val isChecking = isVerifyingUrl || !urlChecked
    val isSiteVerifiedSuccess = isUrlInValidList && urlFetchStatus == FetchStatus.SUCCESS

    val minShort = AppStrings.minShort(lang)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .verticalScroll(scrollState)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Icon(Icons.Default.Tune, contentDescription = null, tint = ZtColors.Accent, modifier = Modifier.size(24.dp))
            Text(
                text = AppStrings.settingsTitle(lang),
                style = ZtType.heading,
                color = Color.White,
                modifier = Modifier.weight(1f)
            )
        }

        // Exact-alarm permission (Android 12+): plain instruction and a button to the right system screen
        if (exactAlarmMissing) {
            GlassCard(
                modifier = Modifier.fillMaxWidth(),
                borderColor = Color(0x59FF5E3A),
                contentPadding = PaddingValues18
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(Icons.Default.AlarmOff, contentDescription = null, tint = ZtColors.Accent, modifier = Modifier.size(24.dp))
                        Text(
                            text = AppStrings.exactAlarmTitle(lang),
                            style = ZtType.subhead,
                            color = Color.White,
                            modifier = Modifier.weight(1f)
                        )
                    }
                    Text(text = AppStrings.exactAlarmBody(lang), style = ZtType.body, color = ZtColors.TextSecondary)
                    ActionButton(
                        text = AppStrings.exactAlarmButton(lang),
                        icon = null,
                        filled = true,
                        onClick = onOpenExactAlarmSettings,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }

        // 1. My addresses: up to 5 addresses (or queues), each with its own planned / emergency switches
        MyAddressesCard(
            store = subscriptions,
            alertsMaster = alertsMaster,
            advanceMinutes = advanceMinutes,
            lang = lang,
            onHelp = { showQueueHelpDialog = true },
            onAddQueueOnly = onAddQueueOnly,
            onMove = onMoveSubscription,
            onRemove = { removeCandidate = it },
            onRename = { renameCandidate = it },
            onMakePrimary = onMakePrimary,
            onSetPlanned = onSetPlanned,
            onSetEmergency = onSetEmergency
        )

        // 2. Site address with a strict check against valid-urls.json and the live table
        GlassCard(modifier = Modifier.fillMaxWidth(), contentPadding = PaddingValues18) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                @OptIn(ExperimentalLayoutApi::class)
                FlowRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = AppStrings.siteAddressTitle(lang),
                        style = ZtType.overline,
                        color = Color.White,
                        modifier = Modifier.padding(vertical = 6.dp)
                    )
                    when {
                        isChecking -> StatusChip(
                            text = AppStrings.siteStateChecking(lang),
                            background = ZtColors.ChipGrey,
                            foreground = ZtColors.ChipGreyText,
                            icon = null
                        )
                        isSiteVerifiedSuccess -> StatusChip(
                            text = AppStrings.siteReachable(lang),
                            background = ZtColors.ChipGreen,
                            foreground = ZtColors.ChipGreenText,
                            icon = null
                        )
                        else -> StatusChip(
                            text = if (urlFetchStatus == FetchStatus.NO_INTERNET) {
                                AppStrings.errorNoInternet(lang)
                            } else {
                                AppStrings.errorNoQueuesFound(lang)
                            },
                            background = ZtColors.ChipRed,
                            foreground = ZtColors.ChipRedText,
                            icon = Icons.Default.ErrorOutline
                        )
                    }
                }

                Text(text = AppStrings.siteAddressDesc(lang), style = ZtType.caption, color = ZtColors.TextSecondary)

                val urlBad = !isChecking && !isSiteVerifiedSuccess
                OutlinedTextField(
                    value = siteUrl,
                    onValueChange = { onSiteUrlChanged(it) },
                    singleLine = true,
                    textStyle = ZtType.body,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                    modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp),
                    shape = ZtShapes.Control,
                    colors = glassFieldColors(
                        focusedBorder = if (urlBad) Color(0xFFEF4444) else ZtColors.Accent,
                        unfocusedBorder = if (urlBad) Color(0x66EF4444) else ZtColors.InputBorder
                    )
                )
            }
        }

        // 3. Timers: presets only (no free text), ranges match what really works
        GlassCard(modifier = Modifier.fillMaxWidth(), contentPadding = PaddingValues18) {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(text = AppStrings.advanceNoticeTitle(lang), style = ZtType.overline, color = Color.White)
                        Text(
                            text = "\${AppStrings.advanceNoticeHint(lang)} · \${AppStrings.rangeMinutes(lang, ADVANCE_PRESETS.first(), ADVANCE_PRESETS.last())}",
                            style = ZtType.caption,
                            color = ZtColors.TextTertiary
                        )
                    }
                    GlassDropdown(
                        value = "$advanceMinutes $minShort",
                        options = ADVANCE_PRESETS.map { "$it $minShort" },
                        onSelect = { onAdvanceMinutesChanged(ADVANCE_PRESETS[it]) }
                    )
                }

                Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(ZtColors.Divider))

                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(text = AppStrings.refreshIntervalTitle(lang), style = ZtType.overline, color = Color.White)
                        Text(
                            text = "\${AppStrings.rangeMinutes(lang, REFRESH_PRESETS.first(), REFRESH_PRESETS.last())} · \${AppStrings.refreshFloorHint(lang)}",
                            style = ZtType.caption,
                            color = ZtColors.TextTertiary
                        )
                    }
                    GlassDropdown(
                        value = "$refreshMinutes $minShort",
                        options = REFRESH_PRESETS.map { "$it $minShort" },
                        onSelect = { onRefreshMinutesChanged(REFRESH_PRESETS[it]) }
                    )
                }
            }
        }

        // 4. Alerts: the master switch for all addresses (owner decision 1), then sound and vibration.
        // Sound and vibration follow the master switch (spec/SUBSCRIPTIONS.md section 7).
        val anyAlertsEnabled = alertsMaster
        val noAddressAlerts = Subscriptions.noAlertsCaption(alertsMaster, subscriptions)
        GlassCard(modifier = Modifier.fillMaxWidth(), contentPadding = PaddingValues18) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SwitchRow(
                    icon = Icons.Default.Notifications,
                    iconTint = Color.White,
                    title = AppStrings.notifications(lang),
                    hint = AppStrings.masterHint(lang),
                    checked = alertsMaster,
                    onCheckedChange = onToggleMaster,
                    lang = lang
                )
                if (noAddressAlerts) {
                    Text(text = AppStrings.noAddressAlerts(lang), style = ZtType.caption, color = ZtColors.Accent)
                }
                Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(ZtColors.Divider))
                SwitchRow(
                    icon = Icons.Default.VolumeUp,
                    iconTint = if (anyAlertsEnabled) Color(0xB3BAE6FD) else Color(0x4DBAE6FD),
                    title = AppStrings.sound(lang),
                    hint = null,
                    checked = anyAlertsEnabled && soundEnabled,
                    onCheckedChange = onToggleSound,
                    lang = lang,
                    enabled = anyAlertsEnabled
                )
                Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(ZtColors.Divider))
                SwitchRow(
                    icon = Icons.Default.Vibration,
                    iconTint = if (anyAlertsEnabled) Color(0xB3BAE6FD) else Color(0x4DBAE6FD),
                    title = AppStrings.vibration(lang),
                    hint = null,
                    checked = anyAlertsEnabled && vibrationEnabled,
                    onCheckedChange = onToggleVibration,
                    lang = lang,
                    enabled = anyAlertsEnabled
                )
                Text(
                    text = AppStrings.soundVibrationHint(lang),
                    style = ZtType.caption,
                    color = ZtColors.TextTertiary,
                    modifier = Modifier.padding(top = 2.dp)
                )
            }
        }

        // 4b. Emergency follow-ups for all addresses: restoration time changes and restoration. The start is
        // always announced (spec/NOTIFICATIONS.md 2.4). Locked and shown off while the master is off.
        GlassCard(modifier = Modifier.fillMaxWidth(), contentPadding = PaddingValues18) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(text = AppStrings.emergencyAlertsTitle(lang), style = ZtType.overline, color = Color.White)
                Text(text = AppStrings.emergencyAlertsDesc(lang), style = ZtType.caption, color = ZtColors.TextSecondary)
                SwitchRow(
                    icon = Icons.Default.Schedule,
                    iconTint = if (alertsMaster) ZtColors.EmergencyAmberStart else Color(0x4DBAE6FD),
                    title = AppStrings.emergencyEtaAlertsTitle(lang),
                    hint = AppStrings.emergencyEtaAlertsHint(lang),
                    checked = alertsMaster && emergencyEtaAlerts,
                    onCheckedChange = onToggleEmergencyEtaAlerts,
                    lang = lang,
                    enabled = alertsMaster
                )
                Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(ZtColors.Divider))
                SwitchRow(
                    icon = Icons.Default.Bolt,
                    iconTint = if (alertsMaster) ZtColors.ChipGreenText else Color(0x4DBAE6FD),
                    title = AppStrings.emergencyEndAlertsTitle(lang),
                    hint = AppStrings.emergencyEndAlertsHint(lang),
                    checked = alertsMaster && emergencyEndAlerts,
                    onCheckedChange = onToggleEmergencyEndAlerts,
                    lang = lang,
                    enabled = alertsMaster
                )
            }
        }

        // 5. Language
        GlassCard(modifier = Modifier.fillMaxWidth(), contentPadding = PaddingValues18) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(Icons.Default.Language, contentDescription = null, tint = ZtColors.Accent, modifier = Modifier.size(18.dp))
                    Text(
                        text = AppStrings.languageTitle(lang),
                        style = ZtType.overline,
                        color = Color.White,
                        modifier = Modifier.weight(1f)
                    )
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .selectableGroup()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0x59000000))
                        .border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(12.dp))
                        .padding(4.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    listOf(
                        "SYSTEM" to AppStrings.langSystem(lang),
                        "uk" to "Українська",
                        "en" to "English"
                    ).forEach { (code, label) ->
                        val isSelected = currentLanguage.equals(code, ignoreCase = true)
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .heightIn(min = ZtMinTouch - 8.dp)
                                .clip(RoundedCornerShape(9.dp))
                                .background(if (isSelected) Color.White else Color.Transparent)
                                .selectable(selected = isSelected, role = Role.RadioButton) { onLanguageSelected(code) }
                                .padding(vertical = 8.dp, horizontal = 6.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = label,
                                style = ZtType.label,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.SemiBold,
                                color = if (isSelected) Color.Black else Color(0xBFE0F2FE),
                                textAlign = TextAlign.Center,
                                maxLines = 2
                            )
                        }
                    }
                }
            }
        }

        // 6. Diagnostics and actions
        GlassCard(modifier = Modifier.fillMaxWidth(), contentPadding = PaddingValues18) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                val stackButtons = LocalDensity.current.fontScale >= 1.3f
                val testButton: @Composable (Modifier) -> Unit = { m ->
                    ActionButton(
                        text = AppStrings.testAlertBtn(lang),
                        icon = Icons.Default.Send,
                        filled = true,
                        onClick = {
                            onSendTestAlert()
                            onShowAppBanner(AppStrings.testAlertSent(lang))
                        },
                        modifier = m
                    )
                }
                val refreshButton: @Composable (Modifier) -> Unit = { m ->
                    ActionButton(
                        text = AppStrings.refreshBtn(lang),
                        icon = Icons.Default.Refresh,
                        filled = false,
                        onClick = onForceRefresh,
                        modifier = m,
                        busy = isRefreshing,
                        busyText = AppStrings.refreshing(lang)
                    )
                }
                if (stackButtons) {
                    testButton(Modifier.fillMaxWidth())
                    refreshButton(Modifier.fillMaxWidth())
                } else {
                    // Same height even when only one label wraps to two lines
                    Row(modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        testButton(Modifier.weight(1f).fillMaxHeight())
                        refreshButton(Modifier.weight(1f).fillMaxHeight())
                    }
                }

                ActionButton(
                    text = AppStrings.resetDefaultsBtn(lang),
                    icon = Icons.Default.Refresh,
                    filled = false,
                    subdued = true,
                    onClick = { showResetConfirmDialog = true },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }

        Spacer(modifier = Modifier.height(96.dp))
    }

    if (showQueueHelpDialog) {
        AddressLookupDialog(
            siteUrl = siteUrl,
            lang = lang,
            // a new address starts empty (only the city is filled in), not from the last added (owner, 2026-11-18)
            saved = null,
            onDismiss = { showQueueHelpDialog = false },
            onApply = { queue, statusText, addressLabel, query ->
                onAddAddress(queue, statusText, addressLabel, query)
                showQueueHelpDialog = false
            },
            onShowAppBanner = onShowAppBanner,
            tourActive = tourActive,
            onTourSkip = onTourSkip
        )
    }

    editAddressCandidate?.let { item ->
        AddressLookupDialog(
            siteUrl = siteUrl,
            lang = lang,
            // the item's own address; a queue-only item starts empty like a new address
            saved = item.address?.let { a -> SelectedAddressQuery(a.remSlug, a.settlementId, a.streetId, a.house) },
            onDismiss = { editAddressCandidate = null },
            onApply = { queue, statusText, addressLabel, query ->
                onEditAddress(item.id, queue, statusText, addressLabel, query)
                editAddressCandidate = null
            },
            onShowAppBanner = onShowAppBanner
        )
    }

    removeCandidate?.let { item ->
        AlertDialog(
            onDismissRequest = { removeCandidate = null },
            title = { Text(AppStrings.removeConfirmTitle(lang), style = ZtType.heading, color = Color.White) },
            text = {
                Text(
                    AppStrings.removeConfirmBody(lang, Subscriptions.displayLabel(item)),
                    style = ZtType.body,
                    color = ZtColors.TextSecondary
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        onRemoveSubscription(item.id)
                        removeCandidate = null
                    },
                    modifier = Modifier.heightIn(min = ZtMinTouch)
                ) {
                    Text(AppStrings.removeAddress(lang), style = ZtType.label, color = ZtColors.Accent, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { removeCandidate = null }, modifier = Modifier.heightIn(min = ZtMinTouch)) {
                    Text(AppStrings.cancel(lang), style = ZtType.label, color = Color.White)
                }
            },
            containerColor = ZtColors.CardSolid
        )
    }

    renameCandidate?.let { item ->
        var text by remember(item.id) { mutableStateOf(item.label) }
        AlertDialog(
            onDismissRequest = { renameCandidate = null },
            title = { Text(AppStrings.renameAddress(lang), style = ZtType.heading, color = Color.White) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = text,
                        onValueChange = { text = it.take(Subscriptions.MAX_LABEL_LENGTH) },
                        singleLine = true,
                        textStyle = ZtType.body,
                        placeholder = { Text(Subscriptions.defaultLabel(item), style = ZtType.body, color = ZtColors.TextTertiary) },
                        modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp),
                        shape = ZtShapes.Control,
                        colors = glassFieldColors()
                    )
                    Text(AppStrings.renameHint(lang), style = ZtType.caption, color = ZtColors.TextTertiary)
                    // the address itself can be changed too (owner, 2026-11-18): opens the lookup on this item
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = ZtMinTouch)
                            .clip(ZtShapes.Control)
                            .background(Color(0x1AFFFFFF))
                            .border(1.dp, ZtColors.InputBorder, ZtShapes.Control)
                            .clickable(role = Role.Button) {
                                editAddressCandidate = item
                                renameCandidate = null
                            }
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(Icons.Default.Edit, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
                        Text(AppStrings.editAddress(lang), style = ZtType.label, color = Color.White)
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        onRenameSubscription(item.id, text)
                        renameCandidate = null
                    },
                    modifier = Modifier.heightIn(min = ZtMinTouch)
                ) {
                    Text(AppStrings.save(lang), style = ZtType.label, color = ZtColors.Accent, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { renameCandidate = null }, modifier = Modifier.heightIn(min = ZtMinTouch)) {
                    Text(AppStrings.cancel(lang), style = ZtType.label, color = Color.White)
                }
            },
            containerColor = ZtColors.CardSolid
        )
    }

    if (showResetConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showResetConfirmDialog = false },
            title = { Text(AppStrings.resetConfirmTitle(lang), style = ZtType.heading, color = Color.White) },
            text = { Text(AppStrings.resetConfirmDesc(lang), style = ZtType.body, color = ZtColors.TextSecondary) },
            confirmButton = {
                TextButton(
                    onClick = {
                        onResetDefaults()
                        showResetConfirmDialog = false
                        onShowAppBanner(AppStrings.settingsReset(lang))
                    },
                    modifier = Modifier.heightIn(min = ZtMinTouch)
                ) {
                    Text(AppStrings.resetYes(lang), style = ZtType.label, color = ZtColors.Accent, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showResetConfirmDialog = false }, modifier = Modifier.heightIn(min = ZtMinTouch)) {
                    Text(AppStrings.cancel(lang), style = ZtType.label, color = Color.White)
                }
            },
            containerColor = ZtColors.CardSolid
        )
    }
}

private val PaddingValues18 = PaddingValues(18.dp)

// =============================================================================================
// "Мої адреси" card (multi-address step 2, spec/SUBSCRIPTIONS.md, mockup frame 1)
// =============================================================================================

@Composable
private fun MyAddressesCard(
    store: SubscriptionStore,
    /** Master off: every address's switches show off and are locked; their own values are kept. */
    alertsMaster: Boolean,
    advanceMinutes: Int,
    lang: String,
    onHelp: () -> Unit,
    onAddQueueOnly: (String) -> Unit,
    onMove: (String, Int) -> Unit,
    onRemove: (Subscription) -> Unit,
    onRename: (Subscription) -> Unit,
    onMakePrimary: (String) -> Unit,
    onSetPlanned: (String, Boolean) -> Unit,
    onSetEmergency: (String, Boolean) -> Unit
) {
    val count = store.items.size
    val canAdd = count < Subscriptions.MAX_ITEMS
    GlassCard(modifier = Modifier.fillMaxWidth(), contentPadding = PaddingValues18) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(text = AppStrings.myAddressesTitle(lang), style = ZtType.overline, color = Color.White)
                    Text(text = AppStrings.myAddressesDesc(lang), style = ZtType.caption, color = ZtColors.TextSecondary)
                }
                if (count > 0) {
                    StatusChip(
                        text = AppStrings.addressesCount(lang, count, Subscriptions.MAX_ITEMS),
                        background = ZtColors.ChipGrey,
                        foreground = ZtColors.ChipGreyText,
                        icon = null
                    )
                }
                // 48 dp touch target around the 40 dp "?" tile; opens the address lookup
                Box(
                    modifier = Modifier
                        .size(ZtMinTouch)
                        .clickable(role = Role.Button, onClickLabel = AppStrings.queueHelpTitle(lang), onClick = onHelp)
                        .semantics { contentDescription = AppStrings.queueHelpTitle(lang) },
                    contentAlignment = Alignment.Center
                ) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(ZtColors.Accent)
                            .border(1.dp, Color(0x40FFFFFF), RoundedCornerShape(16.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.HelpOutline, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
                    }
                }
            }

            if (!alertsMaster && store.items.isNotEmpty()) {
                Text(text = AppStrings.masterOffCaption(lang), style = ZtType.caption, color = ZtColors.ChipAmberText)
            }
            // Drag the handle to reorder: a local order follows the finger, the store is written on release
            val ids = store.items.map { it.id }
            var order by remember { mutableStateOf(ids) }
            var draggingId by remember { mutableStateOf<String?>(null) }
            var dragOffset by remember { mutableFloatStateOf(0f) }
            val heights = remember { mutableStateMapOf<String, Int>() }
            val gapPx = with(LocalDensity.current) { 12.dp.toPx() }
            val currentOnMove by rememberUpdatedState(onMove)
            // the drag gesture outlives recompositions: read the newest store order through this
            val currentIds by rememberUpdatedState(ids)
            if (draggingId == null && order != ids) order = ids
            val byId = store.items.associateBy { it.id }

            fun dragBy(id: String, dy: Float) {
                dragOffset += dy
                val i = order.indexOf(id)
                if (i < 0) return
                if (dragOffset > 0f && i < order.lastIndex) {
                    val step = (heights[order[i + 1]] ?: 0) + gapPx
                    if (dragOffset > step / 2f) {
                        order = order.toMutableList().apply { add(i + 1, removeAt(i)) }
                        dragOffset -= step
                    }
                } else if (dragOffset < 0f && i > 0) {
                    val step = (heights[order[i - 1]] ?: 0) + gapPx
                    if (-dragOffset > step / 2f) {
                        order = order.toMutableList().apply { add(i - 1, removeAt(i)) }
                        dragOffset += step
                    }
                }
            }

            fun dropped(id: String) {
                val to = order.indexOf(id)
                draggingId = null
                dragOffset = 0f
                if (to >= 0 && to != currentIds.indexOf(id)) currentOnMove(id, to)
            }

            order.mapNotNull { byId[it] }.forEachIndexed { index, item ->
              // key: when the order changes the block keeps its own composition, so the drag gesture in
              // progress is not handed to another block and cancelled (the card then "hung" mid-drag)
              key(item.id) {
                val label = Subscriptions.displayLabel(item)
                val isDragging = draggingId == item.id
                val handle = if (store.items.size < 2) null else Modifier
                    .pointerInput(item.id) {
                        detectDragGestures(
                            onDragStart = {
                                draggingId = item.id
                                dragOffset = 0f
                            },
                            onDragEnd = { dropped(item.id) },
                            onDragCancel = { dropped(item.id) },
                            onDrag = { change, amount ->
                                change.consume()
                                dragBy(item.id, amount.y)
                            }
                        )
                    }
                    .semantics {
                        contentDescription = "\${AppStrings.reorderHandle(lang)}: $label"
                        customActions = buildList {
                            if (index > 0) add(CustomAccessibilityAction(AppStrings.moveUp(lang)) { currentOnMove(item.id, index - 1); true })
                            if (index < store.items.lastIndex) add(CustomAccessibilityAction(AppStrings.moveDown(lang)) { currentOnMove(item.id, index + 1); true })
                        }
                    }
                SubscriptionBlock(
                    item = item,
                    alertsMaster = alertsMaster,
                    isPrimary = item.id == store.primaryId,
                    advanceMinutes = advanceMinutes,
                    lang = lang,
                    onRemove = { onRemove(item) },
                    onRename = { onRename(item) },
                    onMakePrimary = { onMakePrimary(item.id) },
                    tourTargets = index == 0,
                    onSetPlanned = { onSetPlanned(item.id, it) },
                    onSetEmergency = { onSetEmergency(item.id, it) },
                    dragHandle = handle,
                    modifier = Modifier
                        .onSizeChanged { heights[item.id] = it.height }
                        .zIndex(if (isDragging) 1f else 0f)
                        .graphicsLayer {
                            translationY = if (isDragging) dragOffset else 0f
                            scaleX = if (isDragging) 1.02f else 1f
                            scaleY = if (isDragging) 1.02f else 1f
                        }
                        .then(if (isDragging) Modifier.shadow(10.dp, RoundedCornerShape(16.dp)) else Modifier)
                )
              }
            }

            if (canAdd) {
                ActionButton(
                    text = AppStrings.addAddress(lang),
                    icon = Icons.Default.Add,
                    filled = true,
                    onClick = onHelp,
                    modifier = Modifier.fillMaxWidth()
                )
                val used = store.items.mapNotNull { if (it.address == null) it.queue else null }.toSet()
                val free = QUEUES.filter { it !in used }
                GlassDropdown(
                    value = AppStrings.addQueueOnly(lang),
                    options = free.map { "\${AppStrings.queue(lang)} $it" },
                    onSelect = { onAddQueueOnly(free[it]) }
                )
                if (count > 0) {
                    Text(
                        text = AppStrings.addressesLeft(lang, Subscriptions.MAX_ITEMS - count),
                        style = ZtType.caption,
                        color = ZtColors.TextTertiary
                    )
                }
            } else {
                Text(
                    text = AppStrings.addressLimitReached(lang, Subscriptions.MAX_ITEMS),
                    style = ZtType.caption,
                    color = ZtColors.TextSecondary
                )
            }
        }
    }
}

@Composable
private fun SubscriptionBlock(
    item: Subscription,
    alertsMaster: Boolean,
    isPrimary: Boolean,
    advanceMinutes: Int,
    lang: String,
    onRemove: () -> Unit,
    onRename: () -> Unit,
    onMakePrimary: () -> Unit,
    onSetPlanned: (Boolean) -> Unit,
    onSetEmergency: (Boolean) -> Unit,
    /** Gesture and accessibility actions of the reorder handle; null hides it (one address). */
    dragHandle: Modifier? = null,
    /** The first block marks its rename button and alert switches for the first-run tour. */
    tourTargets: Boolean = false,
    modifier: Modifier = Modifier
) {
    val shape = RoundedCornerShape(16.dp)
    val label = Subscriptions.displayLabel(item)
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Color(0x14FFFFFF))
            .border(1.dp, if (isPrimary) Color(0x59FF5E3A) else Color(0x1AFFFFFF), shape)
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            if (dragHandle != null) {
                // 48 dp grip: press and drag up or down; TalkBack offers "move up" / "move down"
                Box(modifier = Modifier.size(ZtMinTouch).then(dragHandle), contentAlignment = Alignment.Center) {
                    Icon(Icons.Default.DragIndicator, contentDescription = null, tint = ZtColors.TextSecondary, modifier = Modifier.size(22.dp))
                }
            }
            @OptIn(ExperimentalLayoutApi::class)
            FlowRow(
                modifier = Modifier.weight(1f),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                // a queue-only item already says "Черга X" in its label
                if (item.address != null) {
                    StatusChip(
                        text = when {
                            item.queue != null -> "\${AppStrings.queue(lang)} \${item.queue}"
                            !item.queueStatusText.isNullOrBlank() -> AppStrings.noQueueNotDisconnected(lang)
                            else -> AppStrings.selectQueueAction(lang)
                        },
                        background = ZtColors.ChipGrey,
                        foreground = ZtColors.ChipGreyText,
                        icon = null
                    )
                }
                if (isPrimary) {
                    StatusChip(
                        text = AppStrings.primaryBadge(lang),
                        background = ZtColors.ChipGrey,
                        foreground = Color.White,
                        icon = Icons.Default.Star
                    )
                }
            }
            IconTile(
                icon = Icons.Default.Edit,
                description = "\${AppStrings.renameAddress(lang)}: $label",
                onClick = onRename,
                modifier = if (tourTargets) Modifier.coachTarget("rename") else Modifier
            )
            IconTile(icon = Icons.Default.Delete, description = "\${AppStrings.removeAddress(lang)}: $label", onClick = onRemove, danger = true)
        }
        Text(text = label, style = ZtType.subhead, color = Color.White)
        val caption = item.address?.text?.takeIf { it.isNotBlank() } ?: if (item.address == null) AppStrings.queueOnlyCaption(lang) else null
        if (caption != null) {
            Text(text = caption, style = ZtType.caption, color = ZtColors.TextSecondary)
        }
        SwitchRow(
            icon = Icons.Default.Notifications,
            iconTint = Color.White,
            title = AppStrings.plannedShort(lang),
            hint = AppStrings.plannedDesc(lang, advanceMinutes),
            checked = alertsMaster && item.plannedAlerts,
            onCheckedChange = onSetPlanned,
            lang = lang,
            enabled = alertsMaster && item.queue != null,
            modifier = if (tourTargets) Modifier.coachTarget("alert-planned") else Modifier
        )
        SwitchRow(
            icon = Icons.Default.Warning,
            iconTint = ZtColors.Accent,
            title = AppStrings.emergencyShort(lang),
            hint = if (item.address != null) AppStrings.emergencyDesc(lang) else AppStrings.emergencyNeedsAddress(lang),
            checked = alertsMaster && item.emergencyAlerts && item.address != null,
            onCheckedChange = onSetEmergency,
            lang = lang,
            enabled = alertsMaster && item.address != null,
            modifier = if (tourTargets) Modifier.coachTarget("alert-emergency") else Modifier
        )
        if (!isPrimary) {
            ActionButton(
                text = AppStrings.makePrimary(lang),
                icon = Icons.Default.Star,
                filled = false,
                onClick = onMakePrimary,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

/** 48 dp touch target around a 36 dp icon tile. */
@Composable
private fun IconTile(icon: ImageVector, description: String, onClick: () -> Unit, danger: Boolean = false, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .size(ZtMinTouch)
            .clickable(role = Role.Button, onClick = onClick)
            .semantics { contentDescription = description },
        contentAlignment = Alignment.Center
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(if (danger) Color(0x33EF4444) else Color(0x1AFFFFFF)),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, contentDescription = null, tint = if (danger) Color(0xFFFCA5A5) else Color.White, modifier = Modifier.size(18.dp))
        }
    }
}

// =============================================================================================
// Small building blocks
// =============================================================================================

@Composable
private fun StatusChip(text: String, background: Color, foreground: Color, icon: ImageVector?) {
    Row(
        modifier = Modifier
            .clip(ZtShapes.Chip)
            .background(background)
            .padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        if (icon != null) Icon(icon, contentDescription = null, tint = foreground, modifier = Modifier.size(16.dp))
        Text(text = text, style = ZtType.label, color = foreground)
    }
}

@Composable
private fun switchColors(): androidx.compose.material3.SwitchColors = SwitchDefaults.colors(
    checkedThumbColor = Color.White,
    checkedTrackColor = ZtColors.Accent,
    uncheckedThumbColor = Color.LightGray,
    uncheckedTrackColor = Color(0x33FFFFFF),
    disabledCheckedTrackColor = Color(0x33FF5E3A),
    disabledUncheckedTrackColor = Color(0x1AFFFFFF),
    disabledUncheckedThumbColor = Color(0x4DFFFFFF)
)

/**
 * A labelled switch row. The whole row is the toggle target (role Switch, localized On/Off state), so
 * TalkBack reads "title, hint, On" once; the [Switch] itself is only drawn.
 */
@Composable
private fun SwitchRow(
    icon: ImageVector,
    iconTint: Color,
    title: String,
    hint: String?,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    lang: String,
    enabled: Boolean = true,
    modifier: Modifier = Modifier
) {
    val stateText = if (checked) AppStrings.switchOn(lang) else AppStrings.switchOff(lang)
    Row(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = ZtMinTouch)
            .toggleable(value = checked, enabled = enabled, role = Role.Switch, onValueChange = onCheckedChange)
            .semantics { stateDescription = stateText },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(20.dp))
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = title,
                style = ZtType.subhead,
                color = if (enabled) Color.White else Color(0x80FFFFFF)
            )
            if (hint != null) {
                Text(
                    text = hint,
                    style = ZtType.caption,
                    color = if (enabled) ZtColors.TextSecondary else ZtColors.TextTertiary
                )
            }
        }
        Switch(checked = checked, onCheckedChange = null, enabled = enabled, colors = switchColors())
    }
}

/** Read-only dropdown for short preset lists (queues, minutes). Long searchable lists use SearchablePickerField. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun GlassDropdown(value: String, options: List<String>, onSelect: (Int) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
        OutlinedTextField(
            value = value,
            onValueChange = {},
            readOnly = true,
            singleLine = true,
            textStyle = ZtType.body,
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier.menuAnchor().fillMaxWidth().heightIn(min = 56.dp),
            shape = ZtShapes.Control,
            colors = glassFieldColors()
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            modifier = Modifier.background(ZtColors.CardSolid)
        ) {
            options.forEachIndexed { index, text ->
                DropdownMenuItem(
                    text = { Text(text, style = ZtType.subhead, color = Color.White) },
                    onClick = {
                        onSelect(index)
                        expanded = false
                    }
                )
            }
        }
    }
}

/** Button with a 48 dp minimum height. [filled] is the accent button, [subdued] the quiet outlined one. */
@Composable
private fun ActionButton(
    text: String,
    icon: ImageVector?,
    filled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    subdued: Boolean = false,
    /** Work is running: the icon rotates, taps are ignored and [busyText] is announced. */
    busy: Boolean = false,
    busyText: String? = null
) {
    val shape = ZtShapes.Control
    val contentColor = if (subdued) ZtColors.TextSecondary else Color.White
    Box(
        modifier = modifier
            .heightIn(min = ZtMinTouch)
            .clip(shape)
            .then(
                when {
                    filled -> Modifier.background(ZtColors.Accent)
                    subdued -> Modifier.border(1.dp, Color(0x1AFFFFFF), shape)
                    else -> Modifier.background(Color(0x1AFFFFFF)).border(1.dp, ZtColors.CardBorder, shape)
                }
            )
            .semantics { if (busy && busyText != null) stateDescription = busyText }
            .clickable(enabled = !busy, role = Role.Button, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally)
        ) {
            if (icon != null) Icon(icon, contentDescription = null, tint = contentColor, modifier = Modifier.size(16.dp).spinWhile(busy))
            Text(
                text = text,
                style = ZtType.label,
                fontWeight = if (filled) FontWeight.Bold else FontWeight.SemiBold,
                color = contentColor,
                textAlign = TextAlign.Center
            )
        }
    }
}

private fun ZtoeRemOption.displayName(lang: String) = if (lang == "uk") nameUk else nameEn
// Settlements and streets keep their Ukrainian names in both languages: the live ztoe lists have no English
// names, so translating only the built-in ones mixed the two (owner request 2026-11-15).
@Suppress("UNUSED_PARAMETER")
private fun ZtoeSettlementOption.displayName(lang: String) = nameUk
@Suppress("UNUSED_PARAMETER")
private fun ZtoeStreetOption.displayName(lang: String) = nameUk

/** Loading flags of one level of the REM, city, street, house cascade; [retry] re-runs its fetch with forceRefresh. */
private class LevelState {
    var loading by mutableStateOf(false)
    var failed by mutableStateOf(false)
    var retry by mutableIntStateOf(0)
}

// =============================================================================================
// Full-screen queue help and address lookup dialog ("?" button)
// =============================================================================================

/** «Побутові споживачі, Непобутові (юридичні) споживачі» for the consumer types of a variant. */
private fun consumerLabel(variant: HouseVariant, lang: String): String =
    if (variant.consumers.isEmpty()) {
        AppStrings.consumerUnknown(lang)
    } else {
        variant.consumers.joinToString(", ") {
            when (it) {
                ConsumerType.HOUSEHOLD -> AppStrings.consumerHousehold(lang)
                ConsumerType.BUSINESS -> AppStrings.consumerBusiness(lang)
                else -> it
            }
        }
    }

/** One button per queue of a house the site lists more than once (households / non-household). */
@Composable
private fun HouseVariantChooser(
    choices: List<HouseVariant>,
    active: HouseVariant,
    lang: String,
    onChoose: (HouseVariant) -> Unit
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.fillMaxWidth().selectableGroup()
    ) {
        Text(
            text = AppStrings.addrVariantsHint(lang),
            style = ZtType.caption,
            color = ZtColors.ChipAmberText
        )
        for (v in choices) {
            val isActive = v.queue == active.queue
            val title = if (v.queue.isNotEmpty()) "\${AppStrings.queue(lang)} \${v.queue}" else AppStrings.variantNoQueue(lang)
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = ZtMinTouch)
                    .clip(RoundedCornerShape(14.dp))
                    .background(if (isActive) ZtColors.Accent.copy(alpha = 0.22f) else Color(0x0FFFFFFF))
                    .border(2.dp, if (isActive) ZtColors.Accent else Color(0x33FFFFFF), RoundedCornerShape(14.dp))
                    .selectable(selected = isActive, role = Role.RadioButton) { onChoose(v) }
                    .padding(horizontal = 14.dp, vertical = 10.dp)
            ) {
                Icon(
                    if (isActive) Icons.Default.RadioButtonChecked else Icons.Default.RadioButtonUnchecked,
                    contentDescription = null,
                    tint = if (isActive) ZtColors.Accent else ZtColors.TextSecondary,
                    modifier = Modifier.size(20.dp)
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = title,
                        style = ZtType.label,
                        fontWeight = FontWeight.ExtraBold,
                        color = Color.White
                    )
                    Text(
                        text = consumerLabel(v, lang),
                        style = ZtType.caption,
                        color = ZtColors.TextSecondary
                    )
                }
            }
        }
    }
}

@Composable
@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
private fun AddressLookupDialog(
    siteUrl: String,
    lang: String,
    saved: SelectedAddressQuery?,
    onDismiss: () -> Unit,
    onApply: (queue: String, statusText: String?, addressLabel: String, query: SelectedAddressQuery) -> Unit,
    onShowAppBanner: (String) -> Unit,
    tourActive: Boolean = false,
    onTourSkip: () -> Unit = {}
) {
    val lookupContext = LocalContext.current
    // First-run tour inside this dialog window (spec/ONBOARDING.md): PICK, then APPLY once a result card shows
    val tourTargets = remember { CoachTargets() }
    var tourResultShown by remember { mutableStateOf(false) }
    val applyBringer = remember { BringIntoViewRequester() }
    // The cascade starts from the saved address, or from Zhytomyr city on a first launch. After that a REM
    // never picks a city for the user: choosing another REM clears city, street and house.
    var selectedRemId by remember { mutableStateOf(saved?.remId?.ifBlank { "zhytomyr" } ?: "zhytomyr") }
    var selectedSettlementId by remember { mutableStateOf(saved?.settlementId?.ifBlank { "zt_city" } ?: "zt_city") }
    var selectedStreetId by remember { mutableStateOf(saved?.streetId ?: "") }
    var selectedHouse by remember { mutableStateOf(saved?.house ?: "") }

    var allRems by remember { mutableStateOf(ZtoeAddressLookup.getRems()) }
    var settlementsList by remember { mutableStateOf(ZtoeAddressLookup.getSettlementsForRem(selectedRemId)) }
    var streetsList by remember {
        mutableStateOf(
            if (selectedSettlementId.isNotBlank()) ZtoeAddressLookup.getStreetsForSettlement(selectedSettlementId) else emptyList()
        )
    }
    var housesList by remember {
        mutableStateOf(
            if (selectedStreetId.isNotBlank()) ZtoeAddressLookup.getHousesForStreet(selectedStreetId) else emptyList()
        )
    }
    val remsState = remember { LevelState() }
    val settlementsState = remember { LevelState() }
    val streetsState = remember { LevelState() }
    val housesState = remember { LevelState() }
    /** Grows when a street is chosen, so the house list opens right away. */
    var houseOpenRequest by remember { mutableIntStateOf(0) }

    var isCheckingAddressOnSite by remember { mutableStateOf(false) }
    var addressCheckFailed by remember { mutableStateOf(false) }
    var addressLookupResult by remember { mutableStateOf<AddressLookupResult?>(null) }
    // Queue of the variant the user tapped ("" = the one without a queue); null = default (spec/ADDRESS_KEY.md section 6)
    var chosenVariantQueue by remember { mutableStateOf<String?>(null) }

    fun clearBelowRem() {
        selectedSettlementId = ""
        selectedStreetId = ""
        selectedHouse = ""
        streetsList = emptyList()
        housesList = emptyList()
        addressLookupResult = null
    }

    fun clearBelowSettlement() {
        selectedStreetId = ""
        selectedHouse = ""
        housesList = emptyList()
        addressLookupResult = null
    }

    // REM list. A retry forces a fresh fetch; otherwise the in-memory cache is used.
    LaunchedEffect(siteUrl, remsState.retry) {
        remsState.loading = true
        remsState.failed = false
        val fetched = withContext(Dispatchers.IO) {
            runCatching { ZtoeAddressLookup.fetchRemsFromZtoe(siteUrl, forceRefresh = remsState.retry > 0) }.getOrNull()
        }
        if (!fetched.isNullOrEmpty()) allRems = fetched
        remsState.failed = allRems.isEmpty()
        remsState.loading = false
    }

    // City list of the chosen REM. Never selects a city by itself; only drops a choice that no longer exists.
    LaunchedEffect(selectedRemId, siteUrl, settlementsState.retry) {
        settlementsList = ZtoeAddressLookup.getSettlementsForRem(selectedRemId)
        settlementsState.loading = true
        settlementsState.failed = false
        val fetched = withContext(Dispatchers.IO) {
            runCatching {
                ZtoeAddressLookup.fetchSettlementsForRem(selectedRemId, siteUrl, forceRefresh = settlementsState.retry > 0)
            }.getOrDefault(emptyList())
        }
        if (fetched.isNotEmpty()) settlementsList = fetched
        settlementsState.failed = settlementsList.isEmpty()
        settlementsState.loading = false
        if (selectedSettlementId.isNotBlank() && settlementsList.isNotEmpty() && settlementsList.none { it.id == selectedSettlementId }) {
            selectedSettlementId = ""
            clearBelowSettlement()
        }
    }

    // Street list (the fetch also bulk-indexes the houses of the whole settlement)
    LaunchedEffect(selectedRemId, selectedSettlementId, siteUrl, streetsState.retry) {
        if (selectedSettlementId.isBlank()) {
            streetsList = emptyList()
            streetsState.loading = false
            streetsState.failed = false
            return@LaunchedEffect
        }
        streetsList = ZtoeAddressLookup.getStreetsForSettlement(selectedSettlementId)
        streetsState.loading = true
        streetsState.failed = false
        val fetched = withContext(Dispatchers.IO) {
            runCatching {
                ZtoeAddressLookup.fetchStreetsForSettlement(
                    selectedRemId, selectedSettlementId, siteUrl, forceRefresh = streetsState.retry > 0
                )
            }.getOrDefault(emptyList())
        }
        if (fetched.isNotEmpty()) {
            streetsList = fetched
            allRems = ZtoeAddressLookup.getRems()
            settlementsList = ZtoeAddressLookup.getSettlementsForRem(selectedRemId)
            if (selectedStreetId.isNotBlank()) {
                val bulkIndexed = ZtoeAddressLookup.getHousesForStreet(selectedStreetId)
                if (bulkIndexed.isNotEmpty()) housesList = bulkIndexed
            }
        }
        streetsState.failed = streetsList.isEmpty()
        streetsState.loading = false
    }

    // House list of the chosen street (served from the bulk index when it is already there)
    LaunchedEffect(selectedRemId, selectedSettlementId, selectedStreetId, siteUrl, housesState.retry) {
        if (selectedStreetId.isBlank()) {
            housesList = emptyList()
            housesState.loading = false
            housesState.failed = false
            return@LaunchedEffect
        }
        housesList = ZtoeAddressLookup.getHousesForStreet(selectedStreetId)
        housesState.loading = true
        housesState.failed = false
        val fetched = withContext(Dispatchers.IO) {
            runCatching {
                ZtoeAddressLookup.fetchHousesForStreet(
                    selectedRemId, selectedSettlementId, selectedStreetId, siteUrl, forceRefresh = housesState.retry > 0
                )
            }.getOrDefault(emptyList())
        }
        if (fetched.isNotEmpty()) housesList = fetched
        housesState.failed = housesList.isEmpty()
        housesState.loading = false
    }

    val currentRem = allRems.firstOrNull { it.id == selectedRemId }
    val currentSettlement = if (selectedSettlementId.isBlank()) null else {
        settlementsList.find { it.id == selectedSettlementId } ?: ZtoeAddressLookup.findSettlementById(selectedSettlementId)
    }
    val currentStreet = if (selectedStreetId.isBlank()) null else {
        streetsList.find { it.id == selectedStreetId } ?: ZtoeAddressLookup.findStreetById(selectedStreetId)
    }
    val currentHouseRecord = housesList.find { it.house.equals(selectedHouse, ignoreCase = true) }

    // Queries the site when street and house are chosen. Nothing closes or applies until the user presses the button.
    LaunchedEffect(selectedRemId, selectedSettlementId, selectedStreetId, selectedHouse, siteUrl) {
        addressLookupResult = null
        chosenVariantQueue = null
        addressCheckFailed = false
        if (selectedStreetId.isBlank() || selectedHouse.isBlank()) {
            isCheckingAddressOnSite = false
            return@LaunchedEffect
        }
        isCheckingAddressOnSite = true
        val res = withContext(Dispatchers.IO) {
            runCatching {
                ZtoeAddressLookup.checkAddressOnZtoeWebsite(
                    remId = selectedRemId,
                    settlementId = selectedSettlementId,
                    streetId = selectedStreetId,
                    house = selectedHouse,
                    siteUrl = siteUrl
                )
            }.getOrNull()
        }
        isCheckingAddressOnSite = false
        addressLookupResult = res
        addressCheckFailed = res == null
        if (res != null) {
            val exists = housesList.any { it.house.equals(res.house, ignoreCase = true) }
            housesList = if (!exists) {
                housesList + res
            } else {
                housesList.map { h ->
                    if (h.house.equals(res.house, ignoreCase = true)) {
                        if (res.variants.isNotEmpty()) {
                            h.copy(
                                queue = res.queue,
                                statusText = res.statusText,
                                addressLabel = res.addressLabel.ifEmpty { h.addressLabel },
                                variants = res.variants
                            )
                        } else {
                            h.copy(
                                queue = res.queue.ifEmpty { h.queue },
                                statusText = res.statusText ?: h.statusText,
                                addressLabel = res.addressLabel.ifEmpty { h.addressLabel }
                            )
                        }
                    } else h
                }
            }
        }
    }

    val selectedAddressStr = if (currentStreet != null && selectedHouse.isNotBlank()) {
        val remName = currentRem?.displayName(lang).orEmpty()
        val settlementName = currentSettlement?.displayName(lang).orEmpty()
        val streetName = currentStreet.displayName(lang)
        "$remName, $settlementName,\\n$streetName, \${AppStrings.addrHousePrefix(lang)} $selectedHouse"
    } else {
        ""
    }

    val remItems = remember(allRems, lang) { allRems.map { PickerItem(it.id, it.displayName(lang)) } }
    val settlementItems = remember(settlementsList, lang) { settlementsList.map { PickerItem(it.id, it.displayName(lang)) } }
    val streetItems = remember(streetsList, lang) { streetsList.map { PickerItem(it.id, it.displayName(lang)) } }
    val houseItems = remember(housesList) { housesList.map { PickerItem(it.house, it.house) } }

    LaunchedEffect(tourActive, tourResultShown) {
        // bring the «Обрати чергу» button into view once the result card has settled
        if (tourActive && tourResultShown) {
            kotlinx.coroutines.delay(400)
            applyBringer.bringIntoView()
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
      CompositionLocalProvider(LocalCoachTargets provides tourTargets) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(ZtColors.CardSolid)
                .statusBarsPadding()
                .navigationBarsPadding()
                .imePadding()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 14.dp, vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp)
            ) {
                // Modal header
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(40.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(ZtColors.Accent),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(text = "?", style = ZtType.heading, fontWeight = FontWeight.Black, color = Color.White, maxLines = 1)
                            }
                            Text(
                                text = AppStrings.queueHelpTitle(lang),
                                style = ZtType.heading,
                                color = Color.White,
                                modifier = Modifier.weight(1f)
                            )
                        }
                        Box(
                            modifier = Modifier
                                .size(ZtMinTouch)
                                .clickable(role = Role.Button, onClickLabel = AppStrings.pickerClose(lang), onClick = onDismiss)
                                .semantics { contentDescription = AppStrings.pickerClose(lang) },
                            contentAlignment = Alignment.Center
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(40.dp)
                                    .clip(CircleShape)
                                    .background(Color(0x1AFFFFFF))
                                    .border(1.dp, ZtColors.CardBorder, CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.Close, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
                            }
                        }
                    }
                    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(ZtColors.InputBorder))
                }

                // 1) Interactive search by address
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(24.dp))
                        .background(Color(0x0DFFFFFF))
                        .border(2.dp, Color.White.copy(alpha = 0.25f), RoundedCornerShape(24.dp))
                        .padding(20.dp)
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(
                                text = AppStrings.addrFindTitle(lang).uppercase(),
                                style = ZtType.label,
                                fontWeight = FontWeight.ExtraBold,
                                letterSpacing = 0.7.sp,
                                color = Color.White
                            )
                            Text(
                                text = AppStrings.queueHelpAddressSubtitle(lang),
                                style = ZtType.caption,
                                color = Color(0xCCBAE6FD)
                            )
                        }

                        SearchablePickerField(
                            label = AppStrings.addrRemLabel(lang),
                            value = currentRem?.displayName(lang),
                            placeholder = AppStrings.addrRemPlaceholder(lang),
                            items = remItems,
                            selectedId = selectedRemId,
                            onSelect = { item ->
                                if (item.id != selectedRemId) {
                                    selectedRemId = item.id
                                    clearBelowRem()
                                }
                            },
                            lang = lang,
                            loading = remsState.loading,
                            loadFailed = remsState.failed,
                            onRetry = { remsState.retry++ }
                        )

                        SearchablePickerField(
                            modifier = Modifier.coachTarget("settlement"),
                            label = AppStrings.addrCityLabel(lang),
                            value = currentSettlement?.displayName(lang),
                            placeholder = AppStrings.addrCityPlaceholder(lang),
                            items = settlementItems,
                            selectedId = selectedSettlementId.ifBlank { null },
                            onSelect = { item ->
                                if (item.id != selectedSettlementId) {
                                    selectedSettlementId = item.id
                                    clearBelowSettlement()
                                }
                            },
                            lang = lang,
                            loading = settlementsState.loading,
                            loadFailed = settlementsState.failed,
                            onRetry = { settlementsState.retry++ }
                        )

                        SearchablePickerField(
                            modifier = Modifier.coachTarget("street"),
                            label = AppStrings.addrStreetLabel(lang),
                            value = currentStreet?.displayName(lang),
                            placeholder = AppStrings.addrStreetPlaceholder(lang),
                            items = streetItems,
                            selectedId = selectedStreetId.ifBlank { null },
                            onSelect = { item ->
                                if (item.id != selectedStreetId) {
                                    selectedStreetId = item.id
                                    selectedHouse = ""
                                    housesList = ZtoeAddressLookup.getHousesForStreet(item.id)
                                    addressLookupResult = null
                                    houseOpenRequest++
                                }
                            },
                            lang = lang,
                            enabled = selectedSettlementId.isNotBlank(),
                            disabledHint = AppStrings.pickerChooseFirst(lang),
                            loading = streetsState.loading,
                            loadFailed = streetsState.failed && selectedSettlementId.isNotBlank(),
                            onRetry = { streetsState.retry++ }
                        )

                        SearchablePickerField(
                            modifier = Modifier.coachTarget("house"),
                            label = AppStrings.addrHouseLabel(lang),
                            value = selectedHouse,
                            placeholder = AppStrings.addrHousePlaceholder(lang),
                            items = houseItems,
                            selectedId = selectedHouse.ifBlank { null },
                            onSelect = { item ->
                                selectedHouse = item.id
                                addressLookupResult = null
                            },
                            lang = lang,
                            enabled = currentStreet != null,
                            disabledHint = AppStrings.pickerChooseFirst(lang),
                            loading = housesState.loading,
                            loadFailed = housesState.failed && currentStreet != null,
                            onRetry = { housesState.retry++ },
                            kind = PickerSearch.Kind.HOUSE,
                            openRequest = houseOpenRequest
                        )

                        // Result card (shown when a house is selected)
                        val validLookupResult = addressLookupResult?.takeIf {
                            it.house.equals(selectedHouse, ignoreCase = true)
                        }
                        val foundRecord: ZtoeHouseLookupResult? = when {
                            validLookupResult != null && validLookupResult.variants.isNotEmpty() -> validLookupResult
                            validLookupResult != null && currentHouseRecord != null -> validLookupResult.copy(
                                queue = validLookupResult.queue.ifEmpty { currentHouseRecord.queue },
                                statusText = validLookupResult.statusText ?: currentHouseRecord.statusText
                            )
                            validLookupResult != null -> validLookupResult
                            currentHouseRecord != null -> currentHouseRecord
                            selectedHouse.isNotBlank() -> AddressLookupResult(
                                house = selectedHouse,
                                queue = "",
                                addressLabel = selectedAddressStr
                            )
                            else -> null
                        }
                        // A house with several queues: the tapped variant, else the saved one, else households first
                        val variantChoices = foundRecord?.choices.orEmpty()
                        val storedChoice = remember(selectedStreetId, selectedHouse) {
                            HouseVariantChoices.get(lookupContext, selectedStreetId, selectedHouse)
                        }
                        val activeVariant = if (variantChoices.size > 1) {
                            if (chosenVariantQueue != null) {
                                HouseVariants.pick(variantChoices, chosenVariantQueue)
                            } else {
                                HouseVariants.pick(variantChoices, storedChoice?.queue, storedChoice?.consumers.orEmpty())
                            }
                        } else null
                        val matchedRecord = if (foundRecord != null && activeVariant != null) foundRecord.withVariant(activeVariant) else foundRecord
                        val resultShown = selectedHouse.isNotBlank() && matchedRecord != null
                        SideEffect { tourResultShown = resultShown }
                        if (selectedHouse.isNotBlank() && matchedRecord != null) {
                            // while the site answers, an address without a known queue cannot be confirmed yet
                            val canApply = !(isCheckingAddressOnSite && matchedRecord.queue.isBlank())
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 6.dp)
                                    .coachTarget("result")
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(Color(0xD9141A29))
                                    .border(2.dp, Color.White.copy(alpha = 0.25f), RoundedCornerShape(16.dp))
                                    .padding(16.dp)
                            ) {
                                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                    if (selectedAddressStr.isNotBlank()) {
                                        Text(
                                            text = selectedAddressStr,
                                            style = ZtType.label,
                                            color = Color(0xE6BAE6FD)
                                        )
                                    }

                                    if (isCheckingAddressOnSite) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                                        ) {
                                            CircularProgressIndicator(
                                                modifier = Modifier.size(20.dp),
                                                strokeWidth = 2.dp,
                                                color = ZtColors.Accent
                                            )
                                            Text(
                                                text = AppStrings.addrChecking(lang),
                                                style = ZtType.caption,
                                                color = ZtColors.TextSecondary,
                                                modifier = Modifier.weight(1f)
                                            )
                                        }
                                    } else if (addressCheckFailed) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                                        ) {
                                            Icon(
                                                Icons.Default.ErrorOutline,
                                                contentDescription = null,
                                                tint = ZtColors.ChipAmberText,
                                                modifier = Modifier.size(20.dp)
                                            )
                                            Text(
                                                text = AppStrings.addrCheckFailed(lang),
                                                style = ZtType.caption,
                                                color = ZtColors.ChipAmberText,
                                                modifier = Modifier.weight(1f)
                                            )
                                        }
                                    }

                                    if (activeVariant != null) {
                                        HouseVariantChooser(
                                            choices = variantChoices,
                                            active = activeVariant,
                                            lang = lang,
                                            onChoose = { chosenVariantQueue = it.queue }
                                        )
                                    }

                                    if (matchedRecord.queue.isNotBlank()) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(
                                                text = if (lang == "uk") "Знайдена черга:" else "Found Queue:",
                                                style = ZtType.label,
                                                color = Color(0xCCBAE6FD),
                                                modifier = Modifier.weight(1f)
                                            )
                                            Text(
                                                text = "\${AppStrings.queue(lang)} \${matchedRecord.queue}",
                                                style = ZtType.timeMono,
                                                fontWeight = FontWeight.ExtraBold,
                                                color = Color.White,
                                                softWrap = false
                                            )
                                        }
                                    }

                                    if (!matchedRecord.statusText.isNullOrBlank()) {
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clip(RoundedCornerShape(16.dp))
                                                .background(Color(0x0FFFFFFF))
                                                .border(2.dp, Color(0x33FFFFFF), RoundedCornerShape(16.dp))
                                                .padding(horizontal = 16.dp, vertical = 12.dp)
                                        ) {
                                            Text(
                                                text = matchedRecord.statusText,
                                                style = ZtType.label,
                                                fontWeight = FontWeight.Bold,
                                                color = Color.White
                                            )
                                        }
                                    }

                                    // Full-width "Обрати чергу X.Y" / "Apply Queue X.Y" button under the address
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .coachTarget("apply")
                                            .bringIntoViewRequester(applyBringer)
                                            .heightIn(min = ZtMinTouch)
                                            .clip(RoundedCornerShape(16.dp))
                                            .background(if (canApply) ZtColors.Accent else Color(0x66FF5E3A))
                                            .clickable(enabled = canApply, role = Role.Button) {
                                                val query = SelectedAddressQuery(
                                                    remId = selectedRemId,
                                                    settlementId = selectedSettlementId,
                                                    streetId = selectedStreetId,
                                                    house = selectedHouse
                                                )
                                                val addressToSave = selectedAddressStr.ifBlank { matchedRecord.addressLabel }
                                                // re-checks keep this variant (spec/ADDRESS_KEY.md section 6, rule 5)
                                                HouseVariantChoices.put(lookupContext, selectedStreetId, selectedHouse, activeVariant)
                                                if (matchedRecord.queue.isNotBlank()) {
                                                    onApply(matchedRecord.queue, null, addressToSave, query)
                                                    onShowAppBanner("\${AppStrings.queue(lang)} \${matchedRecord.queue}")
                                                } else {
                                                    onApply("", matchedRecord.statusText, addressToSave, query)
                                                    onShowAppBanner(matchedRecord.statusText ?: AppStrings.addrSaved(lang))
                                                }
                                            }
                                            .padding(vertical = 12.dp, horizontal = 16.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = if (matchedRecord.queue.isNotBlank()) {
                                                if (lang == "uk") "Обрати чергу \${matchedRecord.queue}" else "Apply Queue \${matchedRecord.queue}"
                                            } else {
                                                AppStrings.addrConfirm(lang)
                                            },
                                            style = ZtType.subhead,
                                            fontWeight = FontWeight.ExtraBold,
                                            color = Color.White,
                                            textAlign = TextAlign.Center
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // 2) "Пошук вручну" / "Manual search"
                Text(
                    text = AppStrings.queueHelpManualSearchTitle(lang).uppercase(),
                    style = ZtType.label,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 0.7.sp,
                    color = Color.White,
                    modifier = Modifier.padding(top = 4.dp, start = 4.dp)
                )

                // 3) Numbered instructions 1-4 (text comes unchanged from AppStrings.queueHelpSteps)
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    AppStrings.queueHelpSteps(lang).forEachIndexed { idx, step ->
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(16.dp))
                                .background(Color(0x0AFFFFFF))
                                .border(2.dp, Color(0x26FFFFFF), RoundedCornerShape(16.dp))
                                .padding(16.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.Top,
                                horizontalArrangement = Arrangement.spacedBy(14.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .padding(top = 2.dp)
                                        .defaultMinSize(minWidth = 24.dp, minHeight = 24.dp)
                                        .clip(CircleShape)
                                        .background(Color(0x26FFFFFF)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = "\${idx + 1}",
                                        style = ZtType.captionMono,
                                        color = Color.White,
                                        modifier = Modifier.padding(horizontal = 6.dp)
                                    )
                                }
                                val urlStart = step.indexOf(ZTOE_SEARCH_URL)
                                // only the address itself is a link, not the whole step
                                val annotatedStep = buildAnnotatedString {
                                    if (urlStart >= 0) {
                                        append(step.substring(0, urlStart))
                                        withLink(
                                            LinkAnnotation.Url(
                                                ZTOE_SEARCH_URL,
                                                TextLinkStyles(
                                                    SpanStyle(
                                                        color = ZtColors.Accent,
                                                        fontWeight = FontWeight.SemiBold,
                                                        textDecoration = TextDecoration.Underline
                                                    )
                                                )
                                            )
                                        ) {
                                            append(ZTOE_SEARCH_URL)
                                        }
                                        append(step.substring(urlStart + ZTOE_SEARCH_URL.length))
                                    } else {
                                        append(step)
                                    }
                                }
                                Text(
                                    text = annotatedStep,
                                    style = ZtType.body,
                                    color = Color(0xFFF4F4F5),
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                    }
                }

                // Bottom "Зрозуміло" / "Got it" button (white bg, black text)
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 4.dp)
                        .heightIn(min = ZtMinTouch)
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color.White)
                        .clickable(role = Role.Button, onClick = onDismiss)
                        .padding(vertical = 12.dp, horizontal = 20.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = AppStrings.queueHelpGotIt(lang),
                        color = Color.Black,
                        style = ZtType.subhead,
                        fontWeight = FontWeight.ExtraBold
                    )
                }
            }

            if (tourActive) {
                val step = OnboardingTour.step(
                    TourInput(
                        active = true,
                        lookupOpen = true,
                        resultShown = tourResultShown,
                        page = TourPage.SETTINGS,
                        hasAddress = false,
                        reachedRename = false,
                        renameDone = false
                    )
                )
                if (step == TourStep.PICK) {
                    // the tip sits outside the lit block; the next field to fill is ringed
                    val block = listOf("settlement", "street", "house")
                    val ringKey = when {
                        currentStreet != null -> "house"
                        selectedSettlementId.isNotBlank() -> "street"
                        else -> "settlement"
                    }
                    CoachOverlay(
                        targets = tourTargets,
                        holes = listOf(block),
                        tips = listOf(CoachTip(anchor = block, text = AppStrings.tourPick(lang), ring = ringKey, skip = true)),
                        lang = lang,
                        onSkip = onTourSkip
                    )
                } else if (step == TourStep.APPLY) {
                    // outside the result card unless the card fills most of the screen; the button is ringed
                    val screenPx = androidx.compose.ui.platform.LocalConfiguration.current.screenHeightDp *
                        androidx.compose.ui.platform.LocalDensity.current.density
                    val card = tourTargets.rects["result"]
                    val anchor = if (card != null && card.height < screenPx * 0.55f) "result" else "apply"
                    CoachOverlay(
                        targets = tourTargets,
                        holes = listOf(listOf("result")),
                        tips = listOf(CoachTip(anchor = listOf(anchor), text = AppStrings.tourApply(lang), ring = "apply", skip = true)),
                        lang = lang,
                        onSkip = onTourSkip
                    )
                }
            }
        }
      }
    }
}
`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/data/parser/ZtoeAddressLookup.kt',
    language: 'kotlin',
    description: 'ZTOE Address Queue Lookup & Emergency Outage Parser',
    content: `package ua.blackout.prewarning.data.parser

import org.json.JSONArray
import org.json.JSONObject
import ua.blackout.prewarning.core.HouseKey
import ua.blackout.prewarning.core.HouseVariant
import ua.blackout.prewarning.core.HouseVariants
import ua.blackout.prewarning.core.StreetKey
import ua.blackout.prewarning.core.TextNorm
import ua.blackout.prewarning.data.model.EmergencyOutageInfo
import ua.blackout.prewarning.data.model.SelectedAddressQuery
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.nio.CharBuffer
import java.nio.charset.Charset
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

typealias AddressLookupResult = ZtoeHouseLookupResult

data class ZtoeRemOption(
    val id: String,
    val ztoeRemId: Int,
    val nameUk: String,
    val nameEn: String,
    val ztoeOtgId: Int? = null
) {
    val settlements: List<ZtoeSettlementOption>
        get() = ZtoeAddressLookup.getSettlementsForRem(id)
}

data class ZtoeSettlementOption(
    val id: String,
    val remId: String,
    val ztoeNaspunktId: Int,
    val nameUk: String,
    val nameEn: String,
    val poweronCityId: Int? = null
) {
    val streets: List<ZtoeStreetOption>
        get() = ZtoeAddressLookup.getStreetsForSettlement(id)
}

/**
 * One street of one settlement. ztoe and PowerOn list the same street under several ids (apostrophe,
 * case or spacing differences), so an option holds every id that [StreetKey] puts into one group:
 * [allIds] (option ids), [ztoeVulicaIds] and [poweronStreetIds]. [id], [ztoeVulicaId] and
 * [poweronStreetId] are the canonical ones.
 */
data class ZtoeStreetOption(
    val id: String,
    val settlementId: String,
    val ztoeVulicaId: Int,
    val nameUk: String,
    val nameEn: String,
    val poweronStreetId: Int? = null,
    val allIds: List<String> = listOf(id),
    val ztoeVulicaIds: List<Int> = listOf(ztoeVulicaId),
    val poweronStreetIds: List<Int> = listOfNotNull(poweronStreetId)
) {
    val houses: List<ZtoeHouseLookupResult>
        get() = ZtoeAddressLookup.getHousesForStreet(id)
}

/**
 * [emergencyOutage] is kept for source compatibility only; emergencies come from PowerOnClient and are always null here.
 * [queue] / [statusText] are the default variant; [variants] holds every queue the site lists for the house
 * (households / non-household, spec/ADDRESS_KEY.md section 6) in discovery order.
 */
data class ZtoeHouseLookupResult(
    val house: String,
    val queue: String,
    val statusText: String? = null,
    val emergencyOutage: EmergencyOutageInfo? = null,
    val addressLabel: String = "",
    val variants: List<HouseVariant> = emptyList()
) {
    /** The variants in display order (households first); one entry for a record without stored variants. */
    val choices: List<HouseVariant>
        get() = HouseVariants.ordered(variants.ifEmpty { HouseVariants.add(emptyList(), queue, statusText, null) })

    /** True when the site lists the house with more than one queue (or a queue and a status). */
    val hasChoice: Boolean get() = choices.size > 1

    /** This record with [variant] applied as its queue and status. */
    fun withVariant(variant: HouseVariant): ZtoeHouseLookupResult =
        copy(queue = variant.queue, statusText = if (variant.queue.isEmpty()) variant.statusText else null)

    companion object {
        /** One table row of the house; [consumer] is the raw 7th column («побутові споживачі» ...). */
        fun row(house: String, queue: String, statusText: String?, consumer: String?): ZtoeHouseLookupResult =
            ZtoeHouseLookupResult(
                house = house,
                queue = queue,
                statusText = statusText,
                variants = HouseVariants.add(emptyList(), queue, statusText, consumer)
            )

        /** Unites two records of one house: the variants of both, the default variant applied, the first display form. */
        fun merge(a: ZtoeHouseLookupResult, b: ZtoeHouseLookupResult?): ZtoeHouseLookupResult {
            val va = a.variants.ifEmpty { HouseVariants.add(emptyList(), a.queue, a.statusText, null) }
            val vb = b?.let { it.variants.ifEmpty { HouseVariants.add(emptyList(), it.queue, it.statusText, null) } } ?: emptyList()
            val all = HouseVariants.union(va, vb)
            val first = HouseVariants.pick(all, null)
            return a.copy(
                queue = first?.queue ?: a.queue,
                statusText = if (first == null) a.statusText else if (first.queue.isEmpty()) first.statusText else null,
                addressLabel = a.addressLabel.ifEmpty { b?.addressLabel.orEmpty() },
                variants = all
            )
        }
    }
}

object ZtoeAddressLookup {
    const val DEFAULT_SITE_URL = "https://www.ztoe.com.ua/unhooking-search.php"

    /** Bumped to 2 when merged street ids were introduced; caches of other versions are discarded. */
    /** 3: drops street house lists that were cut to ztoe's first page of 10 records (per-street request without all=1). */
    /** 4: houses keep every queue variant (households / non-household), spec/ADDRESS_KEY.md section 6. */
    internal const val CACHE_VERSION = 4
    private const val PREFS_NAME = "zt_address_index_cache_v1"
    private const val KEY_INDEX_JSON = "address_index_json_v1"
    private const val MAX_PERSISTED_HOUSE_STREETS = 50
    private const val FRESH_HOUSE_CACHE_TTL_MS = 120_000L

    /** The bulk page for a whole settlement (all=1) is large; it is fetched at most once per TTL. */
    internal const val BULK_TTL_MS = 6L * 60 * 60 * 1000
    private const val FORCE_REFRESH_MIN_INTERVAL_MS = 10L * 60 * 1000
    private const val IN_FLIGHT_WAIT_SECONDS = 45L

    private const val SCHEDULE_MARKER = "Графіки погодинних відключень"

    private val VALID_OUTAGE_TIMESTAMP_REGEX = Regex("""(?:\\b\\d{1,2}\\.\\d{1,2}(?:\\.\\d{2,4})?\\b|\\b\\d{4}-\\d{2}-\\d{2}\\b)?[\\sT]*\\b([01]?\\d|2[0-3]):[0-5]\\d\\b""")
    private val SELECT_REM_REGEX = Regex("""<select[^>]*name=["']?rem_id["']?[^>]*>([\\s\\S]*?)</select>""", RegexOption.IGNORE_CASE)
    private val SELECT_NASPUNKT_REGEX = Regex("""<select[^>]*name=["']?naspunkt_id["']?[^>]*>([\\s\\S]*?)</select>""", RegexOption.IGNORE_CASE)
    private val SELECT_VULICA_REGEX = Regex("""<select[^>]*name=["']?vulica_id["']?[^>]*>([\\s\\S]*?)</select>""", RegexOption.IGNORE_CASE)
    private val OPTION_TAG_REGEX = Regex("""<option\\s+value=["']?(\\d+)["']?[^>]*>([\\s\\S]*?)</option>""", RegexOption.IGNORE_CASE)
    private val TR_TAG_REGEX = Regex("""<tr\\b[^>]*>([\\s\\S]*?)</tr>""", RegexOption.IGNORE_CASE)
    private val TD_TH_TAG_REGEX = Regex("""<(?:td|th)\\b[^>]*>([\\s\\S]*?)</(?:td|th)>""", RegexOption.IGNORE_CASE)
    private val HTML_TAG_STRIP_REGEX = Regex("""<[^>]*>""")
    private val WHITESPACE_REGEX = Regex("""\\s+""")
    private val HOUSE_SPLIT_REGEX = Regex("[,;]")
    private val NON_DIGIT_REGEX = Regex("[^0-9]")
    private val PARENS_REGEX = Regex("""\\([^)]*\\)""")
    private val CITY_PREFIX_REGEX = Regex("""^(?:(?:м|с|смт)\\.\\s*|(?:місто|село|смт|селище)\\s+)""")
    private val CITY_PUNCT_REGEX = Regex("""[.,"«»]""")
    private val LABEL_VILLAGE_REGEX = Regex("^село\\\\s+", RegexOption.IGNORE_CASE)
    private val LABEL_TOWN_REGEX = Regex("^місто\\\\s+", RegexOption.IGNORE_CASE)

    /** Canonical street type tokens as they appear in a [StreetKey] (after the Latin look-alike skeleton). */
    private val STREET_TYPE_KEY_TOKENS: Set<String> = listOf(
        "вул", "пров", "просп", "б-р", "пл", "пр-д", "узв", "туп", "наб", "шосе", "майдан"
    ).map { TextNorm.skeleton(it) }.toSet()

    @Volatile
    private var appContext: android.content.Context? = null

    @Volatile
    private var diskCacheHydrated: Boolean = false
    private val hydrateAttempted = AtomicBoolean(false)

    @Volatile
    private var cachedRems: List<ZtoeRemOption>? = null
    private val cachedSettlementsByRem = ConcurrentHashMap<String, List<ZtoeSettlementOption>>()

    /** Merged street lists per settlement; every list written here already went through [mergeStreets]. */
    private val cachedStreetsBySettlement = ConcurrentHashMap<String, List<ZtoeStreetOption>>()

    /** Any street option id (canonical or merged duplicate) to its option. */
    private val streetByAnyId = ConcurrentHashMap<String, ZtoeStreetOption>()

    /** Houses by canonical street id. */
    private val cachedHousesByStreet = ConcurrentHashMap<String, List<ZtoeHouseLookupResult>>()
    private val houseCacheUpdatedAtByStreet = ConcurrentHashMap<String, Long>()
    private val bulkFetchedAtBySettlement = ConcurrentHashMap<String, Long>()
    private val inFlight = ConcurrentHashMap<String, CompletableFuture<Any?>>()

    private val recentLock = Any()
    private val recentHouseStreets = ArrayList<String>()

    private val persistPending = AtomicBoolean(false)
    private val diskPersistExecutor = Executors.newSingleThreadExecutor { r ->
        Thread(r, "ZtoeDiskCachePersist").apply {
            isDaemon = true
            priority = Thread.MIN_PRIORITY
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Static fallback directory
    // ---------------------------------------------------------------------------------------------

    val ZTOE_REM_OPTIONS: List<ZtoeRemOption> = ZtoeStaticDirectory.REMS
    val ZTOE_SETTLEMENTS: List<ZtoeSettlementOption> = ZtoeStaticDirectory.SETTLEMENTS

    /** Static streets, already merged by [StreetKey]. */
    val ZTOE_STREETS: List<ZtoeStreetOption> by lazy { mergeStreets(ZtoeStaticDirectory.STREETS_RAW) }

    private val staticStreetByAnyId: Map<String, ZtoeStreetOption> by lazy {
        HashMap<String, ZtoeStreetOption>().also { m -> for (s in ZTOE_STREETS) for (id in s.allIds) m[id] = s }
    }
    private val staticStreetByVulica: Map<Int, ZtoeStreetOption> by lazy {
        HashMap<Int, ZtoeStreetOption>().also { m -> for (s in ZTOE_STREETS) for (v in s.ztoeVulicaIds) m.putIfAbsent(v, s) }
    }

    val DIRECTORY: List<ZtoeRemOption>
        get() = getRems()

    fun getRems(): List<ZtoeRemOption> = cachedRems ?: ZTOE_REM_OPTIONS

    fun getSettlementsForRem(remId: String): List<ZtoeSettlementOption> {
        return cachedSettlementsByRem[remId] ?: ZTOE_SETTLEMENTS.filter { it.remId == remId }
    }

    fun getStreetsForSettlement(settlementId: String): List<ZtoeStreetOption> {
        val sid = canonicalSettlementId(settlementId)
        return cachedStreetsBySettlement[sid] ?: ZTOE_STREETS.filter { it.settlementId == sid }
    }

    /** Houses of the street (any of its merged ids). Empty until the live index loaded them; there are no fake defaults. */
    fun getHousesForStreet(streetId: String): List<ZtoeHouseLookupResult> {
        cachedHousesByStreet[streetId]?.let { return it }
        val canonical = findStreetById(streetId)?.id ?: return emptyList()
        return cachedHousesByStreet[canonical] ?: emptyList()
    }

    private fun canonicalSettlementId(id: String): String = ZtoeStaticDirectory.LEGACY_SETTLEMENT_IDS[id] ?: id

    fun findSettlementById(settlementId: String): ZtoeSettlementOption? {
        val id = canonicalSettlementId(settlementId)
        for (list in cachedSettlementsByRem.values) {
            list.firstOrNull { it.id == id }?.let { found ->
                if (found.poweronCityId != null) return found
                val staticMatch = ZTOE_SETTLEMENTS.firstOrNull { it.id == found.id || it.ztoeNaspunktId == found.ztoeNaspunktId }
                return if (staticMatch?.poweronCityId != null) found.copy(poweronCityId = staticMatch.poweronCityId) else found
            }
        }
        ZTOE_SETTLEMENTS.firstOrNull { it.id == id }?.let { return it }
        val npId = id.removePrefix("np_").toIntOrNull()
        if (npId != null) {
            for (list in cachedSettlementsByRem.values) {
                list.firstOrNull { it.ztoeNaspunktId == npId }?.let { return it }
            }
            ZTOE_SETTLEMENTS.firstOrNull { it.ztoeNaspunktId == npId }?.let { return it }
            return ZtoeSettlementOption(settlementId, "", npId, "", "")
        }
        return null
    }

    /** Resolves the canonical option id or any merged duplicate id, plus the legacy ids of earlier versions. */
    fun findStreetById(streetId: String): ZtoeStreetOption? {
        if (streetId.isBlank()) return null
        val id = ZtoeStaticDirectory.LEGACY_STREET_IDS[streetId] ?: streetId
        streetByAnyId[id]?.let { return it }
        staticStreetByAnyId[id]?.let { return it }
        val vulId = id.removePrefix("st_").toIntOrNull() ?: return null
        streetByAnyId.values.firstOrNull { vulId in it.ztoeVulicaIds }?.let { return it }
        staticStreetByVulica[vulId]?.let { return it }
        return ZtoeStreetOption(streetId, "", vulId, "", "")
    }

    // ---------------------------------------------------------------------------------------------
    // Street merge (spec/ADDRESS_KEY.md section 5)
    // ---------------------------------------------------------------------------------------------

    /**
     * Groups streets of one settlement by [StreetKey.of] and returns one option per group that holds
     * all ids. Display name: first name seen. Canonical id: a static (non "st_") id when there is one,
     * otherwise the member with the lowest ztoe id. Idempotent, so it is safe to apply to data that
     * is already merged (cache hydration, read).
     */
    internal fun mergeStreets(streets: List<ZtoeStreetOption>): List<ZtoeStreetOption> {
        if (streets.isEmpty()) return streets
        val groups = LinkedHashMap<String, MutableList<ZtoeStreetOption>>(streets.size * 2)
        var anonymous = 0
        for (s in streets) {
            val key = StreetKey.of(s.nameUk)
            val groupKey = if (key.isEmpty()) "#\${anonymous++}" else "\${s.settlementId}|$key"
            groups.getOrPut(groupKey) { ArrayList(1) }.add(s)
        }
        val out = ArrayList<ZtoeStreetOption>(groups.size)
        for (g in groups.values) out.add(mergeGroup(g))
        return out
    }

    private fun mergeGroup(group: List<ZtoeStreetOption>): ZtoeStreetOption {
        val first = group[0]
        val canonical = group.firstOrNull { !it.id.startsWith("st_") }
            ?: group.minByOrNull { it.ztoeVulicaId }
            ?: first
        val ordered = listOf(canonical) + group.filter { it !== canonical }
        val allIds = (listOf(canonical.id) + ordered.flatMap { it.allIds + it.id }).distinct()
        val vulicaIds = (listOf(canonical.ztoeVulicaId) + ordered.flatMap { it.ztoeVulicaIds + it.ztoeVulicaId }).distinct()
        val poweronIds = ordered.flatMap { it.poweronStreetIds + listOfNotNull(it.poweronStreetId) }.distinct()
        return canonical.copy(
            nameUk = first.nameUk,
            nameEn = first.nameEn,
            poweronStreetId = canonical.poweronStreetId ?: poweronIds.firstOrNull(),
            allIds = allIds,
            ztoeVulicaIds = vulicaIds,
            poweronStreetIds = poweronIds
        )
    }

    /** Publishes a merged street list and re-keys houses cached under an id that stopped being canonical. */
    private fun registerStreets(settlementId: String, merged: List<ZtoeStreetOption>) {
        cachedStreetsBySettlement[settlementId] = merged
        for (st in merged) {
            for (id in st.allIds) {
                val prev = streetByAnyId.put(id, st)
                if (prev != null && prev.id != st.id) {
                    cachedHousesByStreet.remove(prev.id)?.let { old ->
                        cachedHousesByStreet.merge(st.id, old) { a, b -> unionHouses(a, b) }
                    }
                    houseCacheUpdatedAtByStreet.remove(prev.id)
                }
            }
        }
    }

    // ---------------------------------------------------------------------------------------------
    // House helpers
    // ---------------------------------------------------------------------------------------------

    private class HouseSortEntry(val house: ZtoeHouseLookupResult) {
        val number: Int
        val text: String = house.house.trim().lowercase()

        init {
            var end = 0
            while (end < text.length && text[end] in '0'..'9') end++
            number = if (end == 0) Int.MAX_VALUE else text.substring(0, end).toIntOrNull() ?: Int.MAX_VALUE
        }
    }

    private fun sortHouses(houses: Collection<ZtoeHouseLookupResult>): List<ZtoeHouseLookupResult> {
        return houses.map { HouseSortEntry(it) }
            .sortedWith(compareBy<HouseSortEntry> { it.number }.thenBy { it.text })
            .map { it.house }
    }

    /** First display form wins; the variants of all rows of the house are united (spec/ADDRESS_KEY.md section 6). */
    private fun putHouse(map: MutableMap<String, ZtoeHouseLookupResult>, h: ZtoeHouseLookupResult) {
        val key = HouseKey.of(h.house)
        if (key.isEmpty()) return
        val existing = map[key]
        map[key] = if (existing == null) ZtoeHouseLookupResult.merge(h, null) else ZtoeHouseLookupResult.merge(existing, h)
    }

    internal fun unionHouses(a: List<ZtoeHouseLookupResult>, b: List<ZtoeHouseLookupResult>): List<ZtoeHouseLookupResult> {
        val map = LinkedHashMap<String, ZtoeHouseLookupResult>()
        for (h in a) putHouse(map, h)
        for (h in b) putHouse(map, h)
        return sortHouses(map.values)
    }

    private fun storeStreetHouses(canonicalStreetId: String, houses: List<ZtoeHouseLookupResult>) {
        cachedHousesByStreet[canonicalStreetId] = houses
        houseCacheUpdatedAtByStreet[canonicalStreetId] = System.currentTimeMillis()
        recordRecentHouseStreet(canonicalStreetId)
    }

    private fun recordRecentHouseStreet(streetId: String) {
        if (streetId.isBlank()) return
        synchronized(recentLock) {
            recentHouseStreets.remove(streetId)
            recentHouseStreets.add(0, streetId)
            while (recentHouseStreets.size > MAX_PERSISTED_HOUSE_STREETS) {
                recentHouseStreets.removeAt(recentHouseStreets.lastIndex)
            }
        }
    }

    private fun recentSnapshot(): List<String> = synchronized(recentLock) { ArrayList(recentHouseStreets) }

    // ---------------------------------------------------------------------------------------------
    // Text helpers
    // ---------------------------------------------------------------------------------------------

    private fun stripHtmlFast(raw: String): String {
        val noTags = HTML_TAG_STRIP_REGEX.replace(raw, " ")
        val decoded = TextNorm.decodeEntities(noTags).replace(' ', ' ')
        return WHITESPACE_REGEX.replace(decoded, " ").trim()
    }

    /** Exact-match key for settlement names: no prefix, no parentheses, no apostrophes; never a substring test. */
    internal fun cityKey(raw: String): String {
        var s = TextNorm.decodeEntities(raw).lowercase()
        s = PARENS_REGEX.replace(s, "")
        s = CITY_PREFIX_REGEX.replace(s.trim(), "")
        s = s.filter { TextNorm.APOSTROPHES.indexOf(it) < 0 }
        s = CITY_PUNCT_REGEX.replace(s, " ").replace("бердичив", "бердичів")
        return WHITESPACE_REGEX.replace(s, " ").trim()
    }

    private fun formatSettlementLabelUk(rawLabel: String): String {
        return rawLabel
            .replace(LABEL_VILLAGE_REGEX, "с. ")
            .replace(LABEL_TOWN_REGEX, "м. ")
            .trim()
    }

    private fun splitHouses(field: String): List<String> {
        return field.split(HOUSE_SPLIT_REGEX)
            .map { it.trim() }
            .filter { it.isNotEmpty() && !it.equals("будинки", ignoreCase = true) }
    }

    /** The «Споживач» cell of a house row (7th column), or null for a table without it (spec/ADDRESS_KEY.md section 6). */
    private fun consumerCell(cells: List<String>): String? {
        for (i in cells.indices.reversed()) {
            if (i < 4) break
            if (cells[i].contains("споживач", ignoreCase = true)) return cells[i]
        }
        return null
    }

    /** The part of the page before the schedule section, without copying the string. */
    private fun addressSection(html: String): CharSequence {
        val idx = html.indexOf(SCHEDULE_MARKER)
        return if (idx >= 0) CharBuffer.wrap(html, 0, idx) else html
    }

    private fun bareStreetKey(key: String): String {
        val space = key.indexOf(' ')
        if (space < 0) return if (key in STREET_TYPE_KEY_TOKENS) "" else key
        return if (key.substring(0, space) in STREET_TYPE_KEY_TOKENS) key.substring(space + 1) else key
    }

    // ---------------------------------------------------------------------------------------------
    // Disk cache (org.json)
    // ---------------------------------------------------------------------------------------------

    private fun JSONObject.str(name: String): String? = if (has(name) && !isNull(name)) optString(name) else null
    private fun JSONObject.int(name: String): Int? = if (has(name) && !isNull(name)) optInt(name) else null

    private fun JSONObject.strList(name: String): List<String> {
        val arr = optJSONArray(name) ?: return emptyList()
        return (0 until arr.length()).mapNotNull { i -> arr.optString(i).takeIf { it.isNotEmpty() } }
    }

    private fun JSONObject.intList(name: String): List<Int> {
        val arr = optJSONArray(name) ?: return emptyList()
        return (0 until arr.length()).map { i -> arr.optInt(i) }
    }

    fun serializeCacheToJson(): String {
        val root = JSONObject()
        root.put("version", CACHE_VERSION)

        val rems = JSONArray()
        for (r in cachedRems ?: emptyList()) {
            rems.put(JSONObject().apply {
                put("id", r.id)
                put("ztoeRemId", r.ztoeRemId)
                r.ztoeOtgId?.let { put("ztoeOtgId", it) }
                put("nameUk", r.nameUk)
                put("nameEn", r.nameEn)
            })
        }
        root.put("rems", rems)

        val settlements = JSONArray()
        for (list in cachedSettlementsByRem.values) {
            for (s in list) {
                settlements.put(JSONObject().apply {
                    put("id", s.id)
                    put("remId", s.remId)
                    put("ztoeNaspunktId", s.ztoeNaspunktId)
                    s.poweronCityId?.let { put("poweronCityId", it) }
                    put("nameUk", s.nameUk)
                    put("nameEn", s.nameEn)
                })
            }
        }
        root.put("settlements", settlements)

        val streets = JSONArray()
        for (list in cachedStreetsBySettlement.values) {
            for (st in list) {
                streets.put(JSONObject().apply {
                    put("id", st.id)
                    put("settlementId", st.settlementId)
                    put("ztoeVulicaId", st.ztoeVulicaId)
                    st.poweronStreetId?.let { put("poweronStreetId", it) }
                    put("nameUk", st.nameUk)
                    put("nameEn", st.nameEn)
                    put("allIds", JSONArray(st.allIds))
                    put("ztoeVulicaIds", JSONArray(st.ztoeVulicaIds))
                    put("poweronStreetIds", JSONArray(st.poweronStreetIds))
                })
            }
        }
        root.put("streets", streets)

        val houses = JSONArray()
        val recent = recentSnapshot()
        val orderedStreets = (recent + cachedHousesByStreet.keys.toList()).distinct().take(MAX_PERSISTED_HOUSE_STREETS)
        for (streetId in orderedStreets) {
            val list = cachedHousesByStreet[streetId] ?: continue
            for (h in list) {
                houses.put(JSONObject().apply {
                    put("streetId", streetId)
                    put("house", h.house)
                    put("queue", h.queue)
                    if (!h.statusText.isNullOrBlank()) put("statusText", h.statusText)
                    if (h.variants.isNotEmpty()) {
                        val vs = JSONArray()
                        for (v in h.variants) {
                            vs.put(JSONObject().apply {
                                put("queue", v.queue)
                                if (!v.statusText.isNullOrBlank()) put("statusText", v.statusText)
                                put("consumers", JSONArray(v.consumers))
                            })
                        }
                        put("variants", vs)
                    }
                })
            }
        }
        root.put("houses", houses)
        root.put("recent", JSONArray(recent))

        val bulk = JSONObject()
        for ((sid, at) in bulkFetchedAtBySettlement) bulk.put(sid, at)
        root.put("bulkAt", bulk)
        return root.toString()
    }

    /**
     * Loads a stored index. A cache of another [CACHE_VERSION] is rejected. Street lists are merged
     * again (an old cache with duplicates heals on read) and in-memory data that is already present
     * is not overwritten by older stored data.
     */
    fun hydrateCacheFromJson(jsonStr: String): Boolean {
        if (jsonStr.isBlank()) return false
        return try {
            val root = JSONObject(jsonStr)
            if (root.optInt("version", -1) != CACHE_VERSION) return false

            root.optJSONArray("rems")?.let { arr ->
                val parsed = mutableListOf<ZtoeRemOption>()
                for (i in 0 until arr.length()) {
                    val o = arr.optJSONObject(i) ?: continue
                    val id = o.str("id") ?: continue
                    val ztoeRemId = o.int("ztoeRemId") ?: continue
                    val nameUk = stripHtmlFast(o.str("nameUk") ?: continue)
                    val nameEn = stripHtmlFast(o.str("nameEn") ?: nameUk)
                    val staticRem = ZTOE_REM_OPTIONS.firstOrNull { it.id == id || it.ztoeRemId == ztoeRemId }
                    parsed.add(ZtoeRemOption(id, ztoeRemId, nameUk, nameEn, o.int("ztoeOtgId") ?: staticRem?.ztoeOtgId))
                }
                if (parsed.isNotEmpty() && cachedRems == null) cachedRems = parsed
            }

            root.optJSONArray("settlements")?.let { arr ->
                val grouped = LinkedHashMap<String, MutableList<ZtoeSettlementOption>>()
                for (i in 0 until arr.length()) {
                    val o = arr.optJSONObject(i) ?: continue
                    val id = o.str("id") ?: continue
                    val remId = o.str("remId") ?: continue
                    val npId = o.int("ztoeNaspunktId") ?: continue
                    val nameUk = stripHtmlFast(o.str("nameUk") ?: continue)
                    val nameEn = stripHtmlFast(o.str("nameEn") ?: nameUk)
                    val staticSettlement = ZTOE_SETTLEMENTS.firstOrNull { it.id == id || it.ztoeNaspunktId == npId }
                    val cityId = o.int("poweronCityId") ?: staticSettlement?.poweronCityId
                    grouped.getOrPut(remId) { mutableListOf() }.add(ZtoeSettlementOption(id, remId, npId, nameUk, nameEn, cityId))
                }
                for ((remId, list) in grouped) {
                    if (list.isNotEmpty()) cachedSettlementsByRem.putIfAbsent(remId, list)
                }
            }

            root.optJSONArray("streets")?.let { arr ->
                val grouped = LinkedHashMap<String, MutableList<ZtoeStreetOption>>()
                for (i in 0 until arr.length()) {
                    val o = arr.optJSONObject(i) ?: continue
                    val id = o.str("id") ?: continue
                    val settlementId = o.str("settlementId") ?: continue
                    val vulId = o.int("ztoeVulicaId") ?: continue
                    val nameUk = stripHtmlFast(o.str("nameUk") ?: continue)
                    val nameEn = stripHtmlFast(o.str("nameEn") ?: nameUk)
                    val static = staticStreetByAnyId[id] ?: staticStreetByVulica[vulId]
                    val poweronIds = (o.intList("poweronStreetIds") + (static?.poweronStreetIds ?: emptyList())).distinct()
                    grouped.getOrPut(settlementId) { mutableListOf() }.add(
                        ZtoeStreetOption(
                            id = id,
                            settlementId = settlementId,
                            ztoeVulicaId = vulId,
                            nameUk = nameUk,
                            nameEn = nameEn,
                            poweronStreetId = o.int("poweronStreetId") ?: static?.poweronStreetId,
                            allIds = (listOf(id) + o.strList("allIds")).distinct(),
                            ztoeVulicaIds = (listOf(vulId) + o.intList("ztoeVulicaIds")).distinct(),
                            poweronStreetIds = poweronIds
                        )
                    )
                }
                for ((settlementId, list) in grouped) {
                    if (list.isNotEmpty() && !cachedStreetsBySettlement.containsKey(settlementId)) {
                        registerStreets(settlementId, mergeStreets(list))
                    }
                }
            }

            root.optJSONArray("houses")?.let { arr ->
                val grouped = LinkedHashMap<String, MutableList<ZtoeHouseLookupResult>>()
                val accepted = HashSet<String>()
                for (i in 0 until arr.length()) {
                    val o = arr.optJSONObject(i) ?: continue
                    val streetId = o.str("streetId") ?: continue
                    if (streetId !in accepted) {
                        if (accepted.size >= MAX_PERSISTED_HOUSE_STREETS) continue
                        accepted.add(streetId)
                    }
                    val house = o.str("house") ?: continue
                    val canonical = findStreetById(streetId)?.id ?: streetId
                    val variants = ArrayList<HouseVariant>()
                    o.optJSONArray("variants")?.let { vs ->
                        for (j in 0 until vs.length()) {
                            val v = vs.optJSONObject(j) ?: continue
                            variants.add(HouseVariant(v.str("queue") ?: "", v.str("statusText"), v.strList("consumers")))
                        }
                    }
                    grouped.getOrPut(canonical) { mutableListOf() }.add(
                        ZtoeHouseLookupResult(house = house, queue = o.str("queue") ?: "", statusText = o.str("statusText"), variants = variants)
                    )
                }
                for ((canonical, list) in grouped) {
                    if (list.isNotEmpty()) cachedHousesByStreet.putIfAbsent(canonical, unionHouses(list, emptyList()))
                }
            }

            root.optJSONArray("recent")?.let { arr ->
                synchronized(recentLock) {
                    if (recentHouseStreets.isEmpty()) {
                        for (i in 0 until arr.length()) {
                            val id = arr.optString(i)
                            if (id.isNotEmpty() && recentHouseStreets.size < MAX_PERSISTED_HOUSE_STREETS && id !in recentHouseStreets) {
                                recentHouseStreets.add(id)
                            }
                        }
                    }
                }
            }

            root.optJSONObject("bulkAt")?.let { bulk ->
                for (sid in bulk.keys()) {
                    val at = bulk.optLong(sid, 0L)
                    if (at > 0L) bulkFetchedAtBySettlement.putIfAbsent(sid, at)
                }
            }
            diskCacheHydrated = true
            true
        } catch (_: Exception) {
            false
        }
    }

    /** Hydrates once per process from SharedPreferences; a stale or unreadable cache is removed. */
    fun initDiskCache(context: android.content.Context): Boolean {
        appContext = context.applicationContext
        if (hydrateAttempted.getAndSet(true)) return diskCacheHydrated
        return try {
            val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)
            val rawJson = prefs.getString(KEY_INDEX_JSON, null) ?: return false
            val ok = hydrateCacheFromJson(rawJson)
            if (!ok) prefs.edit().remove(KEY_INDEX_JSON).apply()
            ok
        } catch (_: Exception) {
            false
        }
    }

    /** Writes are coalesced: calls made while a write is queued share that write. */
    fun persistToDiskCache() {
        val ctx = appContext ?: return
        if (!persistPending.compareAndSet(false, true)) return
        try {
            diskPersistExecutor.execute {
                persistPending.set(false)
                try {
                    val json = serializeCacheToJson()
                    ctx.getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)
                        .edit()
                        .putString(KEY_INDEX_JSON, json)
                        .apply()
                } catch (_: Exception) {
                }
            }
        } catch (_: Exception) {
            persistPending.set(false)
        }
    }

    fun clearCacheForTesting() {
        diskCacheHydrated = false
        hydrateAttempted.set(false)
        cachedRems = null
        cachedSettlementsByRem.clear()
        cachedStreetsBySettlement.clear()
        streetByAnyId.clear()
        cachedHousesByStreet.clear()
        houseCacheUpdatedAtByStreet.clear()
        bulkFetchedAtBySettlement.clear()
        inFlight.clear()
        synchronized(recentLock) { recentHouseStreets.clear() }
    }

    // ---------------------------------------------------------------------------------------------
    // Network
    // ---------------------------------------------------------------------------------------------

    private fun postZtoeForm(formBody: String, siteUrl: String): String? {
        if (!ZtoeParser.isValidUrl(siteUrl)) return null
        var conn: HttpURLConnection? = null
        return try {
            conn = (URL(siteUrl).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                doOutput = true
                connectTimeout = 8000
                readTimeout = 8000
                setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
                setRequestProperty("User-Agent", "Mozilla/5.0 (Android; ZTBlackoutPreWarning)")
            }
            OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { writer ->
                writer.write(formBody)
                writer.flush()
            }
            if (conn.responseCode in 200..299) {
                val bytes = conn.inputStream.use { it.readBytes() }
                val win1251 = String(bytes, Charset.forName("windows-1251"))
                if (win1251.contains("Оберіть") || win1251.contains("Черга") || win1251.contains("Будинки")) {
                    win1251
                } else {
                    String(bytes, Charsets.UTF_8)
                }
            } else {
                null
            }
        } catch (_: Exception) {
            null
        } finally {
            conn?.disconnect()
        }
    }

    /**
     * Runs [block] once per [key]; concurrent callers wait (outside any monitor) for the first
     * caller's result and get [fallback] if it failed or took too long.
     */
    @Suppress("UNCHECKED_CAST")
    private fun <T> singleFlight(key: String, fallback: () -> T, block: () -> T): T {
        val mine = CompletableFuture<Any?>()
        val running = inFlight.putIfAbsent(key, mine)
        if (running != null) {
            return try {
                running.get(IN_FLIGHT_WAIT_SECONDS, TimeUnit.SECONDS) as T
            } catch (e: InterruptedException) {
                Thread.currentThread().interrupt()
                fallback()
            } catch (_: Exception) {
                fallback()
            }
        }
        try {
            val value = block()
            mine.complete(value)
            return value
        } catch (t: Throwable) {
            mine.completeExceptionally(t)
            throw t
        } finally {
            inFlight.remove(key, mine)
        }
    }

    private fun awaitInFlight(key: String) {
        val running = inFlight[key] ?: return
        try {
            running.get(IN_FLIGHT_WAIT_SECONDS, TimeUnit.SECONDS)
        } catch (e: InterruptedException) {
            Thread.currentThread().interrupt()
        } catch (_: Exception) {
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Directory parsing (rem, settlement, street selects)
    // ---------------------------------------------------------------------------------------------

    fun parseZtoeRemOptionsHtml(html: String): List<ZtoeRemOption> {
        val selectInner = SELECT_REM_REGEX.find(html)?.groupValues?.get(1) ?: return emptyList()
        val parsed = mutableListOf<ZtoeRemOption>()
        val seenIds = HashSet<String>()
        for (m in OPTION_TAG_REGEX.findAll(selectInner)) {
            val remNum = m.groupValues[1].trim().toIntOrNull() ?: continue
            if (remNum <= 0) continue
            val label = stripHtmlFast(m.groupValues[2])
            if (label.isEmpty() || label.contains("Оберіть", ignoreCase = true)) continue
            val matchedExisting = ZTOE_REM_OPTIONS.firstOrNull {
                it.nameUk.equals(label, ignoreCase = true)
            } ?: ZTOE_REM_OPTIONS.firstOrNull {
                it.ztoeRemId == remNum
            }
            if (matchedExisting != null) {
                if (seenIds.add(matchedExisting.id)) {
                    parsed.add(matchedExisting.copy(ztoeRemId = remNum))
                }
            } else {
                val id = "rem_$remNum"
                if (seenIds.add(id)) {
                    val ukLabel = if (label.contains("РЕМ", ignoreCase = true)) label else "$label РЕМ"
                    parsed.add(ZtoeRemOption(id = id, ztoeRemId = remNum, nameUk = ukLabel, nameEn = label))
                }
            }
        }
        for (staticRem in ZTOE_REM_OPTIONS) {
            if (seenIds.add(staticRem.id)) {
                parsed.add(staticRem)
            }
        }
        return parsed
    }

    fun parseZtoeSettlementOptionsHtml(remId: String, html: String): List<ZtoeSettlementOption> {
        val selectInner = SELECT_NASPUNKT_REGEX.find(html)?.groupValues?.get(1) ?: return emptyList()
        val existingForRem = ZTOE_SETTLEMENTS.filter { it.remId == remId }
        val existingKeys = existingForRem.map { cityKey(it.nameUk) }
        val parsed = mutableListOf<ZtoeSettlementOption>()
        val seenIds = HashSet<String>()
        for (m in OPTION_TAG_REGEX.findAll(selectInner)) {
            val npId = m.groupValues[1].trim().toIntOrNull() ?: continue
            if (npId <= 0) continue
            val label = formatSettlementLabelUk(stripHtmlFast(m.groupValues[2]))
            if (label.isEmpty() || label.contains("Оберіть", ignoreCase = true)) continue
            val labelKey = cityKey(label)
            val byName = existingKeys.indexOf(labelKey).takeIf { it >= 0 }?.let { existingForRem[it] }
            val candidate = byName ?: existingForRem.firstOrNull { it.ztoeNaspunktId == npId }
            val matchedExisting = candidate?.takeIf { !seenIds.contains(it.id) }

            if (matchedExisting != null) {
                seenIds.add(matchedExisting.id)
                parsed.add(matchedExisting.copy(ztoeNaspunktId = npId))
            } else {
                val id = "np_$npId"
                if (seenIds.add(id)) {
                    parsed.add(
                        ZtoeSettlementOption(
                            id = id,
                            remId = remId,
                            ztoeNaspunktId = npId,
                            nameUk = label,
                            nameEn = label
                        )
                    )
                }
            }
        }
        return parsed
    }

    /** Parses the street select and returns the list already merged by [StreetKey]. */
    fun parseZtoeStreetOptionsHtml(settlementId: String, html: String): List<ZtoeStreetOption> {
        val selectInner = SELECT_VULICA_REGEX.find(html)?.groupValues?.get(1) ?: return emptyList()
        val staticForSettlement = ZTOE_STREETS.filter { it.settlementId == settlementId }
        val staticByKey = HashMap<String, ZtoeStreetOption>()
        for (s in staticForSettlement) staticByKey.putIfAbsent(StreetKey.of(s.nameUk), s)
        val usedStatic = HashSet<String>()
        val parsed = ArrayList<ZtoeStreetOption>()
        for (m in OPTION_TAG_REGEX.findAll(selectInner)) {
            val vulId = m.groupValues[1].trim().toIntOrNull() ?: continue
            if (vulId <= 0) continue
            val label = stripHtmlFast(m.groupValues[2])
            if (label.isEmpty() || label.contains("Оберіть", ignoreCase = true)) continue
            val candidate = staticByKey[StreetKey.of(label)]
                ?: staticStreetByVulica[vulId]?.takeIf { it.settlementId == settlementId }
            val matchedStatic = candidate?.takeIf { usedStatic.add(it.id) }
            if (matchedStatic != null) {
                parsed.add(
                    matchedStatic.copy(
                        ztoeVulicaId = vulId,
                        ztoeVulicaIds = listOf(vulId),
                        allIds = listOf(matchedStatic.id)
                    )
                )
            } else {
                parsed.add(ZtoeStreetOption(id = "st_$vulId", settlementId = settlementId, ztoeVulicaId = vulId, nameUk = label, nameEn = label))
            }
        }
        return mergeStreets(parsed)
    }

    // ---------------------------------------------------------------------------------------------
    // House table parsing
    // ---------------------------------------------------------------------------------------------

    /**
     * Parses a settlement-wide ZTOE response (\`rem_id=X&naspunkt_id=Y&all=1\`) and indexes the houses of
     * EVERY street of the settlement in one pass. A row is assigned to a street only when the
     * [StreetKey] of its name equals the key of the street (or, when exactly one street fits and one
     * side has no street type, the bare names are equal). Never by substring.
     */
    fun parseZtoeSettlementHousesTableHtml(
        settlementId: String,
        streets: List<ZtoeStreetOption>,
        html: String,
        /** False for a one-street page: the caller unites the rows of all ids of the street first. */
        cache: Boolean = true
    ): Map<String, List<ZtoeHouseLookupResult>> {
        if (html.isBlank() || streets.isEmpty()) return emptyMap()

        val merged = mergeStreets(streets)
        val idByKey = HashMap<String, String>(merged.size * 2)
        val keyById = HashMap<String, String>(merged.size * 2)
        val idsByBare = HashMap<String, MutableList<String>>(merged.size * 2)
        for (st in merged) {
            val key = StreetKey.of(st.nameUk)
            if (key.isEmpty()) continue
            idByKey.putIfAbsent(key, st.id)
            keyById[st.id] = key
            val bare = bareStreetKey(key)
            if (bare.isNotEmpty()) idsByBare.getOrPut(bare) { mutableListOf() }.add(st.id)
        }

        val rowMatchCache = HashMap<String, String?>()
        fun matchStreet(rawName: String): String? {
            if (rowMatchCache.containsKey(rawName)) return rowMatchCache[rawName]
            val key = StreetKey.of(rawName)
            var found = idByKey[key]
            if (found == null && key.isNotEmpty()) {
                val bare = bareStreetKey(key)
                val candidates = if (bare.isEmpty()) null else idsByBare[bare]
                if (candidates != null && candidates.size == 1) {
                    // at least one side must have no street type, otherwise "вул. X" would match "пров. X"
                    val candidateKey = keyById[candidates[0]].orEmpty()
                    if (key == bare || candidateKey == bare) {
                        found = candidates[0]
                    }
                }
            }
            rowMatchCache[rawName] = found
            return found
        }

        val houseMaps = HashMap<String, LinkedHashMap<String, ZtoeHouseLookupResult>>()
        for (trMatch in TR_TAG_REGEX.findAll(addressSection(html))) {
            val rowHtml = trMatch.groupValues[1]
            if (rowHtml.contains("<select", ignoreCase = true) || rowHtml.contains("<input", ignoreCase = true)) {
                continue
            }
            val cells = ArrayList<String>(7)
            for (cellMatch in TD_TH_TAG_REGEX.findAll(rowHtml)) {
                cells.add(stripHtmlFast(cellMatch.groupValues[1]))
            }
            if (cells.size < 5) continue

            if (cells[0].lowercase() == "рем" || cells[2].lowercase().contains("назва вулиці")) {
                continue
            }

            val streetNameRaw = cells[2].trim()
            val houseField = cells[3].trim()
            if (streetNameRaw.isEmpty() || houseField.isEmpty()) continue

            val streetId = matchStreet(streetNameRaw) ?: continue

            val col4 = cells[4].trim()
            val col5 = if (cells.size >= 6) cells[5].trim() else ""
            val candidateQueue = "\${NON_DIGIT_REGEX.replace(col4, "")}.\${NON_DIGIT_REGEX.replace(col5, "")}"

            val resolvedQueue: String
            val resolvedStatusText: String?
            if (ZtoeParser.ALL_QUEUES.contains(candidateQueue)) {
                resolvedQueue = candidateQueue
                resolvedStatusText = null
            } else if (col4.length > 3) {
                resolvedQueue = ""
                resolvedStatusText = col4
            } else {
                continue
            }

            val consumer = consumerCell(cells)
            val streetMap = houseMaps.getOrPut(streetId) { LinkedHashMap() }
            for (h in splitHouses(houseField)) {
                putHouse(streetMap, ZtoeHouseLookupResult.row(h, resolvedQueue, resolvedStatusText, consumer))
            }
        }

        val result = HashMap<String, List<ZtoeHouseLookupResult>>(houseMaps.size)
        for ((streetId, map) in houseMaps) {
            if (map.isEmpty()) continue
            val sorted = sortHouses(map.values)
            result[streetId] = sorted
            if (cache) {
                cachedHousesByStreet[streetId] = sorted
                houseCacheUpdatedAtByStreet[streetId] = System.currentTimeMillis()
            }
        }
        return result
    }

    /**
     * Parses HTML table rows from ZTOE unhooking-search.php address lookup results.
     * Supports 7-column real ZTOE tables, 3-column [Queue, Subqueue, Houses] or [House, Queue, Subqueue] tables,
     * and colspan status messages using fast regex/string scanning without Jsoup DOM allocation overhead.
     */
    fun parseZtoeAddressLookupTableHtml(html: String): List<ZtoeHouseLookupResult> {
        val results = mutableListOf<ZtoeHouseLookupResult>()

        for (trMatch in TR_TAG_REGEX.findAll(addressSection(html))) {
            val rowHtml = trMatch.groupValues[1]
            if (rowHtml.contains("<select", ignoreCase = true) || rowHtml.contains("<input", ignoreCase = true)) continue
            val cells = TD_TH_TAG_REGEX.findAll(rowHtml).map { stripHtmlFast(it.groupValues[1]) }.toList()
            if (cells.size < 2) continue

            val joinedLower = cells.joinToString(" ").lowercase()
            if (joinedLower.contains("населений пункт") ||
                joinedLower.contains("назва вулиці") ||
                (cells[0].lowercase().contains("черга") && cells[1].lowercase().contains("підчерга"))
            ) {
                continue
            }

            // Format A: Real ZTOE 5+ column address lookup table:
            // [0] REM, [1] settlement, [2] street, [3] houses, [4] queue (or colspan="3" status message), [5] subqueue
            if (cells.size >= 5) {
                val col4 = cells[4].trim()
                val col5 = if (cells.size >= 6) cells[5].trim() else ""
                val houses = splitHouses(cells[3])

                if (houses.isNotEmpty()) {
                    val candidateQueue = "\${NON_DIGIT_REGEX.replace(col4, "")}.\${NON_DIGIT_REGEX.replace(col5, "")}"
                    val consumer = consumerCell(cells)

                    if (ZtoeParser.ALL_QUEUES.contains(candidateQueue)) {
                        for (h in houses) {
                            results.add(ZtoeHouseLookupResult.row(h, candidateQueue, null, consumer))
                        }
                        continue
                    } else if (col4.length > 3) {
                        for (h in houses) {
                            results.add(ZtoeHouseLookupResult.row(h, "", col4, consumer))
                        }
                        continue
                    }
                }
            }

            // Format B1: 3-column table [Queue, Subqueue, Houses]
            if (cells.size >= 3) {
                val candidateQueue01 = "\${NON_DIGIT_REGEX.replace(cells[0], "")}.\${NON_DIGIT_REGEX.replace(cells[1], "")}"
                if (ZtoeParser.ALL_QUEUES.contains(candidateQueue01)) {
                    for (h in splitHouses(cells[cells.size - 1])) {
                        results.add(ZtoeHouseLookupResult(house = h, queue = candidateQueue01))
                    }
                    continue
                }

                // Format B2: 3-column table [Houses, Queue, Subqueue]
                val candidateQueue12 = "\${NON_DIGIT_REGEX.replace(cells[1], "")}.\${NON_DIGIT_REGEX.replace(cells[2], "")}"
                if (ZtoeParser.ALL_QUEUES.contains(candidateQueue12)) {
                    for (h in splitHouses(cells[0])) {
                        results.add(ZtoeHouseLookupResult(house = h, queue = candidateQueue12))
                    }
                    continue
                }
            }

            // Format C: 2-column or colspan status message row ([Houses, StatusMessage] or [StatusMessage, Houses])
            val firstCell = cells.first()
            val lastCell = cells.last()
            if (lastCell.length > 12 && firstCell.length <= 12) {
                for (h in splitHouses(firstCell)) {
                    results.add(ZtoeHouseLookupResult(house = h, queue = "", statusText = lastCell))
                }
            } else {
                val statusMessage = cells.dropLast(1).joinToString(" ").trim()
                if (statusMessage.isNotEmpty()) {
                    for (h in splitHouses(lastCell)) {
                        results.add(ZtoeHouseLookupResult(house = h, queue = "", statusText = statusMessage))
                    }
                }
            }
        }
        return results
    }

    /** Returns Pair(queueOrNull, statusTextOrNull) for a specific house number (compared by [HouseKey]). */
    fun parseZtoeAddressLookupTableHtml(html: String, targetHouse: String): Pair<String?, String?>? {
        val target = HouseKey.of(targetHouse)
        if (target.isEmpty()) return null
        val map = LinkedHashMap<String, ZtoeHouseLookupResult>()
        for (row in parseZtoeAddressLookupTableHtml(html)) {
            if (HouseKey.of(row.house) == target) putHouse(map, row)
        }
        val house = map[target] ?: return null
        if (house.queue.isNotEmpty()) return house.queue to null
        if (!house.statusText.isNullOrBlank()) return null to house.statusText
        return null
    }

    // ---------------------------------------------------------------------------------------------
    // Fetching
    // ---------------------------------------------------------------------------------------------

    fun fetchRemsFromZtoe(
        siteUrl: String = DEFAULT_SITE_URL,
        forceRefresh: Boolean = false
    ): List<ZtoeRemOption> {
        val currentCached = cachedRems
        if (!forceRefresh && currentCached != null && currentCached.isNotEmpty()) {
            return currentCached
        }
        val html = postZtoeForm("", siteUrl)
        if (!html.isNullOrBlank()) {
            val liveRems = parseZtoeRemOptionsHtml(html)
            if (liveRems.isNotEmpty()) {
                cachedRems = liveRems
                persistToDiskCache()
                return liveRems
            }
        }
        return getRems()
    }

    fun fetchSettlementsForRem(
        remId: String,
        siteUrl: String = DEFAULT_SITE_URL,
        forceRefresh: Boolean = false
    ): List<ZtoeSettlementOption> {
        val cached = cachedSettlementsByRem[remId]
        if (!forceRefresh && cached != null && cached.size > 5) return cached

        val rem = getRems().firstOrNull { it.id == remId }
            ?: ZTOE_REM_OPTIONS.firstOrNull { it.id == remId }
            ?: return getSettlementsForRem(remId)
        val html = postZtoeForm("rem_id=\${rem.ztoeRemId}", siteUrl)
        if (!html.isNullOrBlank()) {
            val liveRems = parseZtoeRemOptionsHtml(html)
            if (liveRems.isNotEmpty()) {
                cachedRems = liveRems
            }
            val liveList = parseZtoeSettlementOptionsHtml(remId, html)
            if (liveList.isNotEmpty()) {
                cachedSettlementsByRem[remId] = liveList
                persistToDiskCache()
                return liveList
            }
        }
        return getSettlementsForRem(remId)
    }

    private fun bulkRefreshDue(settlementId: String, forceRefresh: Boolean): Boolean {
        val at = bulkFetchedAtBySettlement[settlementId] ?: return true
        val age = System.currentTimeMillis() - at
        if (age < 0L || age >= BULK_TTL_MS) return true
        return forceRefresh && age >= FORCE_REFRESH_MIN_INTERVAL_MS
    }

    /**
     * Streets (merged) and, from the same single response, all houses of the settlement. The bulk
     * page is requested at most once per [BULK_TTL_MS] per settlement; a force refresh is honoured only
     * after [FORCE_REFRESH_MIN_INTERVAL_MS]. Concurrent callers share one request.
     */
    fun fetchStreetsForSettlement(
        remId: String,
        settlementId: String,
        siteUrl: String = DEFAULT_SITE_URL,
        forceRefresh: Boolean = false
    ): List<ZtoeStreetOption> {
        val sid = canonicalSettlementId(settlementId)
        val cached = cachedStreetsBySettlement[sid]
        if (cached != null && !bulkRefreshDue(sid, forceRefresh)) return cached
        return singleFlight(
            key = "bulk::$sid",
            fallback = { getStreetsForSettlement(sid) }
        ) {
            loadSettlementBulk(remId, sid, siteUrl)
        }
    }

    private fun loadSettlementBulk(remId: String, settlementId: String, siteUrl: String): List<ZtoeStreetOption> {
        val rem = getRems().firstOrNull { it.id == remId }
            ?: ZTOE_REM_OPTIONS.firstOrNull { it.id == remId }
            ?: return getStreetsForSettlement(settlementId)
        val settlement = findSettlementById(settlementId) ?: return getStreetsForSettlement(settlementId)

        val html = postZtoeForm("rem_id=\${rem.ztoeRemId}&naspunkt_id=\${settlement.ztoeNaspunktId}&all=1", siteUrl)
        if (!html.isNullOrBlank()) {
            val liveRems = parseZtoeRemOptionsHtml(html)
            if (liveRems.isNotEmpty()) {
                cachedRems = liveRems
            }
            val liveSettlements = parseZtoeSettlementOptionsHtml(remId, html)
            if (liveSettlements.isNotEmpty()) {
                cachedSettlementsByRem[remId] = liveSettlements
            }
            val liveStreets = parseZtoeStreetOptionsHtml(settlementId, html)
            if (liveStreets.isNotEmpty()) {
                registerStreets(settlementId, liveStreets)
                parseZtoeSettlementHousesTableHtml(settlementId, liveStreets, html)
                bulkFetchedAtBySettlement[settlementId] = System.currentTimeMillis()
                persistToDiskCache()
                return liveStreets
            }
        }
        return getStreetsForSettlement(settlementId)
    }

    /**
     * Houses of one (merged) street straight from the site: one request per ztoe id of the street,
     * results united and de-duplicated by [HouseKey]. Null when no request succeeded.
     *
     * The request carries \`all=1\`: without it ztoe lists only the first 10 records of the street and a
     * "показати ще N записів" button (vul. Київська in Zhytomyr: 21 of 127 houses). Rows are kept only
     * when their street name has the street's [StreetKey], so a page that ignored \`vulica_id\` cannot
     * add other streets. Only when no row carries the name (an unusual spelling) the first page is
     * used unfiltered, as before.
     */
    private fun fetchStreetHouseRows(
        rem: ZtoeRemOption,
        settlement: ZtoeSettlementOption,
        street: ZtoeStreetOption,
        siteUrl: String
    ): List<ZtoeHouseLookupResult>? {
        var anyResponse = false
        val map = LinkedHashMap<String, ZtoeHouseLookupResult>()
        for (vulicaId in street.ztoeVulicaIds) {
            val form = "rem_id=\${rem.ztoeRemId}&naspunkt_id=\${settlement.ztoeNaspunktId}&vulica_id=$vulicaId"
            val html = postZtoeForm("$form&all=1", siteUrl)
            if (html.isNullOrBlank()) continue
            anyResponse = true
            val rows = parseZtoeSettlementHousesTableHtml(settlement.id, listOf(street), html, cache = false).values.flatten()
            if (rows.isNotEmpty()) {
                for (row in rows) putHouse(map, row)
                continue
            }
            val firstPage = postZtoeForm(form, siteUrl) ?: continue
            for (row in parseZtoeAddressLookupTableHtml(firstPage)) putHouse(map, row)
        }
        return if (anyResponse) sortHouses(map.values) else null
    }

    fun fetchHousesForStreet(
        remId: String,
        settlementId: String,
        streetId: String,
        siteUrl: String = DEFAULT_SITE_URL,
        forceRefresh: Boolean = false
    ): List<ZtoeHouseLookupResult> {
        if (streetId.isBlank()) return emptyList()

        val street = findStreetById(streetId)
        val canonical = street?.id ?: streetId
        val sid = canonicalSettlementId(settlementId)

        fun fresh(): List<ZtoeHouseLookupResult>? {
            val cached = cachedHousesByStreet[canonical]
            if (cached.isNullOrEmpty()) return null
            val updatedAt = houseCacheUpdatedAtByStreet[canonical] ?: 0L
            val age = System.currentTimeMillis() - updatedAt
            return if (!forceRefresh || age in 0 until FRESH_HOUSE_CACHE_TTL_MS) cached else null
        }

        fresh()?.let {
            recordRecentHouseStreet(canonical)
            return it
        }
        // A bulk fetch of the settlement may be filling this street right now.
        awaitInFlight("bulk::$sid")
        fresh()?.let {
            recordRecentHouseStreet(canonical)
            return it
        }

        val rem = getRems().firstOrNull { it.id == remId } ?: ZTOE_REM_OPTIONS.firstOrNull { it.id == remId }
        val settlement = findSettlementById(sid)
        if (rem != null && settlement != null && street != null) {
            val rows = fetchStreetHouseRows(rem, settlement, street, siteUrl)
            if (!rows.isNullOrEmpty()) {
                storeStreetHouses(canonical, rows)
                persistToDiskCache()
                return rows
            }
        }
        return cachedHousesByStreet[canonical] ?: emptyList()
    }

    /**
     * Loads the REM list, the settlements of all REMs, the streets of the active and default city
     * and the houses of the saved street in the background, so the "?" lookup opens without delay.
     */
    fun prefetchAddressIndexInBackground(
        context: android.content.Context? = null,
        siteUrl: String = DEFAULT_SITE_URL,
        savedQuery: SelectedAddressQuery? = null,
        forceRefresh: Boolean = false
    ) {
        if (context != null) {
            initDiskCache(context)
        }

        val activeRemId = savedQuery?.remId?.ifBlank { "zhytomyr" } ?: "zhytomyr"
        val activeSettlementId = savedQuery?.settlementId?.ifBlank { "zt_city" } ?: "zt_city"

        // One bulk request indexes the REM list, the settlements of the REM, all streets and all houses of the city.
        fetchStreetsForSettlement("zhytomyr", "zt_city", siteUrl, forceRefresh)

        if (activeRemId != "zhytomyr") {
            fetchSettlementsForRem(activeRemId, siteUrl, forceRefresh)
        }
        if (activeSettlementId.isNotBlank() && (activeRemId != "zhytomyr" || activeSettlementId != "zt_city")) {
            fetchStreetsForSettlement(activeRemId, activeSettlementId, siteUrl, forceRefresh)
        }
        val savedStreetId = savedQuery?.streetId
        if (!savedStreetId.isNullOrBlank()) {
            fetchHousesForStreet(activeRemId, activeSettlementId, savedStreetId, siteUrl, false)
        }

        val allRems = fetchRemsFromZtoe(siteUrl, false)
        val priorityRems = listOf("zhytomyr", activeRemId).distinct()

        // Bounded low-priority prefetch (2 daemon workers) of the remaining REMs' settlements and primary city streets.
        val remainingRems = java.util.concurrent.ConcurrentLinkedQueue(
            allRems.filter { it.id !in priorityRems }
        )
        if (remainingRems.isNotEmpty()) {
            val workerCount = minOf(2, remainingRems.size)
            val executor = Executors.newFixedThreadPool(workerCount) { r ->
                Thread(r, "ZtoeBgPrefetch").apply {
                    isDaemon = true
                    priority = Thread.MIN_PRIORITY
                }
            }
            try {
                val futures = (0 until workerCount).map {
                    executor.submit {
                        while (true) {
                            val rem = remainingRems.poll() ?: break
                            val settlements = fetchSettlementsForRem(rem.id, siteUrl, forceRefresh)
                            val primarySettlement = settlements.firstOrNull()
                            if (primarySettlement != null && primarySettlement.id.isNotBlank()) {
                                fetchStreetsForSettlement(rem.id, primarySettlement.id, siteUrl, false)
                            }
                        }
                    }
                }
                for (f in futures) {
                    try {
                        f.get()
                    } catch (_: Exception) {
                    }
                }
            } finally {
                executor.shutdown()
            }
        }

        persistToDiskCache()
    }

    // ---------------------------------------------------------------------------------------------
    // Timestamp validation (used by settings and the main screen)
    // ---------------------------------------------------------------------------------------------

    fun isValidOutageTimestamp(value: String?): Boolean {
        if (value.isNullOrBlank()) return false
        val lower = value.lowercase()
        if (lower.contains("не вимикається") ||
            lower.contains("за винятком") ||
            lower.contains("побутові") ||
            lower.contains("споживачі")
        ) {
            return false
        }
        return VALID_OUTAGE_TIMESTAMP_REGEX.containsMatchIn(value.trim())
    }

    fun isValidEmergencyOutage(info: EmergencyOutageInfo?): Boolean {
        if (info == null) return false
        val typeLower = info.outageType.lowercase()
        val validType = (typeLower.contains("аварійн") ||
            typeLower.contains("emergency") ||
            typeLower.contains("гав") ||
            typeLower.contains("сгав")) &&
            !typeLower.contains("не вимикається") &&
            !typeLower.contains("за винятком")
        return validType &&
            isValidOutageTimestamp(info.startTime) &&
            isValidOutageTimestamp(info.estimatedRestoreTime)
    }

    // ---------------------------------------------------------------------------------------------
    // Queue lookup for the selected address
    // ---------------------------------------------------------------------------------------------

    fun checkAddressOnZtoeWebsite(
        remId: String,
        settlementId: String,
        streetId: String,
        house: String,
        siteUrl: String = DEFAULT_SITE_URL,
        preferred: HouseVariant? = null
    ): ZtoeHouseLookupResult? {
        return checkAddressOnZtoeWebsite(
            query = SelectedAddressQuery(
                remId = remId,
                settlementId = settlementId,
                streetId = streetId,
                house = house
            ),
            siteUrl = siteUrl,
            preferred = preferred
        )
    }

    /**
     * Resolves the queue (or the "does not switch off" status) of the selected house from the ztoe
     * site. The live row is authoritative (A-H1: upstream queue changes propagate); the cached row is
     * used only when the site is unreachable or does not list the house. Emergencies are not looked up
     * here: [OutageRepository] asks PowerOnClient. The result's \`emergencyOutage\` is always null.
     *
     * A house the site lists with several queues (households / non-household) keeps all of them in
     * \`variants\`; the applied one is [preferred], the variant the user chose in the lookup (see
     * \`HouseVariantChoices\`), while the house still has it for that consumer type, otherwise the default
     * variant (spec/ADDRESS_KEY.md section 6, rule 5).
     */
    fun checkAddressOnZtoeWebsite(
        query: SelectedAddressQuery,
        siteUrl: String = DEFAULT_SITE_URL,
        preferred: HouseVariant? = null
    ): ZtoeHouseLookupResult? {
        val targetKey = HouseKey.of(query.house)
        if (targetKey.isEmpty()) return null

        val rem = getRems().firstOrNull { it.id == query.remId }
            ?: ZTOE_REM_OPTIONS.firstOrNull { it.id == query.remId }
        var settlement = findSettlementById(query.settlementId)
        var street = findStreetById(query.streetId)

        // After a restore without the index the names are unknown: reload the index once (one bulk request, shared and cached).
        if (rem != null && settlement != null && (street == null || street.nameUk.isBlank() || settlement.nameUk.isBlank())) {
            fetchStreetsForSettlement(query.remId, settlement.id, siteUrl, false)
            settlement = findSettlementById(query.settlementId) ?: settlement
            street = findStreetById(query.streetId) ?: street
        }

        val canonical = street?.id ?: query.streetId
        var resolved = cachedHousesByStreet[canonical]?.firstOrNull { HouseKey.of(it.house) == targetKey }

        if (rem != null && settlement != null && street != null) {
            val rows = fetchStreetHouseRows(rem, settlement, street, siteUrl)
            if (!rows.isNullOrEmpty()) {
                storeStreetHouses(canonical, rows)
                rows.firstOrNull { HouseKey.of(it.house) == targetKey }?.let { resolved = it }
            }
        }

        val found = resolved ?: return null
        val base = HouseVariants.pick(found.choices, preferred?.queue, preferred?.consumers.orEmpty())?.let { found.withVariant(it) } ?: found
        val head = listOf(rem?.nameUk, settlement?.nameUk).filter { !it.isNullOrBlank() }.joinToString(", ")
        val streetPart = street?.nameUk?.takeIf { it.isNotBlank() }?.let { "$it, " } ?: ""
        val label = (if (head.isNotEmpty()) "$head,\\n" else "") + streetPart + "буд. " + query.house.trim()
        return base.copy(emergencyOutage = null, addressLabel = label)
    }
}
`
  },
  {
    path: 'app/src/main/res/xml/blackout_widget_big_info.xml',
    language: 'xml',
    description: 'Big (4x2) Home Screen AppWidget Provider Metadata',
    content: `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:description="@string/widget_big_name"
    android:initialKeyguardLayout="@layout/glance_default_loading_layout"
    android:initialLayout="@layout/glance_default_loading_layout"
    android:minWidth="250dp"
    android:minHeight="110dp"
    android:previewImage="@drawable/widget_preview_big"
    android:resizeMode="horizontal|vertical"
    android:targetCellWidth="4"
    android:targetCellHeight="2"
    android:updatePeriodMillis="900000"
    android:configure="ua.blackout.prewarning.widget.WidgetConfigActivity"
    android:widgetFeatures="reconfigurable|configuration_optional"
    android:widgetCategory="home_screen" />
`
  },
  {
    path: 'app/src/main/res/drawable/widget_preview_small.xml',
    language: 'xml',
    description: 'Small (2x1) Widget Picker Thumbnail Vector Drawable',
    content: `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="220dp"
    android:height="100dp"
    android:viewportWidth="220"
    android:viewportHeight="100">

    <!-- Outer rounded widget background (#141A29) -->
    <path
        android:fillColor="#141A29"
        android:pathData="M20,4 L200,4 A16,16 0 0,1 216,20 L216,80 A16,16 0 0,1 200,96 L20,96 A16,16 0 0,1 4,80 L4,20 A16,16 0 0,1 20,4 Z" />

    <!-- Subtle border -->
    <path
        android:fillColor="#00000000"
        android:strokeColor="#33FFFFFF"
        android:strokeWidth="1.5"
        android:pathData="M20,4 L200,4 A16,16 0 0,1 216,20 L216,80 A16,16 0 0,1 200,96 L20,96 A16,16 0 0,1 4,80 L4,20 A16,16 0 0,1 20,4 Z" />

    <!-- Top-left Queue title bar ("Черга 1.1") -->
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M18,18 L86,18 A5,5 0 0,1 91,23 L91,27 A5,5 0 0,1 86,32 L18,32 A5,5 0 0,1 13,27 L13,23 A5,5 0 0,1 18,18 Z" />

    <!-- Top-right Green Status indicator ("СВІТЛО Є") -->
    <path
        android:fillColor="#34D399"
        android:pathData="M148,20 L200,20 A4,4 0 0,1 204,24 L204,26 A4,4 0 0,1 200,30 L148,30 A4,4 0 0,1 144,26 L144,24 A4,4 0 0,1 148,20 Z" />

    <!-- Bottom-left Countdown subtitle ("До відключення:") -->
    <path
        android:fillColor="#99BAE6FD"
        android:pathData="M16,52 L82,52 A3,3 0 0,1 85,55 L85,57 A3,3 0 0,1 82,60 L16,60 A3,3 0 0,1 13,57 L13,55 A3,3 0 0,1 16,52 Z" />

    <!-- Bottom-left Countdown value ("04г. 30хв.") -->
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M17,66 L102,66 A5,5 0 0,1 107,71 L107,76 A5,5 0 0,1 102,81 L17,81 A5,5 0 0,1 12,76 L12,71 A5,5 0 0,1 17,66 Z" />

    <!-- Round Refresh Button (#26FFFFFF) -->
    <path
        android:fillColor="#26FFFFFF"
        android:pathData="M146,66 m-16,0 a16,16 0 1,0 32,0 a16,16 0 1,0 -32,0" />
    <path
        android:fillColor="#00000000"
        android:strokeColor="#FFFFFF"
        android:strokeWidth="2.2"
        android:pathData="M146,59 A7,7 0 1,1 139.5,68.5 M146,56 L146,62 L140,62" />

    <!-- Round Notification Button (White circle with #FF5E3A bell) -->
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M186,66 m-16,0 a16,16 0 1,0 32,0 a16,16 0 1,0 -32,0" />
    <path
        android:fillColor="#FF5E3A"
        android:pathData="M186,57 C182.5,57 180,59.5 180,63 L180,68 L178,70 L178,71 L194,71 L194,70 L192,68 L192,63 C192,59.5 189.5,57 186,57 Z M184,72.5 A2,2 0 0,0 188,72.5 Z" />
</vector>
`
  },
  {
    path: 'app/src/main/res/drawable/widget_preview_big.xml',
    language: 'xml',
    description: 'Big (4x2) Widget Picker Thumbnail Vector Drawable',
    content: `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="320dp"
    android:height="180dp"
    android:viewportWidth="320"
    android:viewportHeight="180">

    <!-- Outer rounded widget background (#141A29) -->
    <path
        android:fillColor="#141A29"
        android:pathData="M22,4 L298,4 A18,18 0 0,1 316,22 L316,158 A18,18 0 0,1 298,176 L22,176 A18,18 0 0,1 4,158 L4,22 A18,18 0 0,1 22,4 Z" />

    <!-- Subtle border -->
    <path
        android:fillColor="#00000000"
        android:strokeColor="#33FFFFFF"
        android:strokeWidth="1.5"
        android:pathData="M22,4 L298,4 A18,18 0 0,1 316,22 L316,158 A18,18 0 0,1 298,176 L22,176 A18,18 0 0,1 4,158 L4,22 A18,18 0 0,1 22,4 Z" />

    <!-- Top Header: Queue bar + Status bar -->
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M20,16 L104,16 A5,5 0 0,1 109,21 L109,25 A5,5 0 0,1 104,30 L20,30 A5,5 0 0,1 15,25 L15,21 A5,5 0 0,1 20,16 Z" />
    <path
        android:fillColor="#34D399"
        android:pathData="M18,35 L76,35 A3.5,3.5 0 0,1 79.5,38.5 L79.5,40.5 A3.5,3.5 0 0,1 76,44 L18,44 A3.5,3.5 0 0,1 14.5,40.5 L14.5,38.5 A3.5,3.5 0 0,1 18,35 Z" />

    <!-- Top Right Round Refresh Button -->
    <path
        android:fillColor="#26FFFFFF"
        android:pathData="M248,30 m-15,0 a15,15 0 1,0 30,0 a15,15 0 1,0 -30,0" />
    <path
        android:fillColor="#00000000"
        android:strokeColor="#FFFFFF"
        android:strokeWidth="2"
        android:pathData="M248,23.5 A6.5,6.5 0 1,1 242,32 M248,21 L248,26.5 L242.5,26.5" />

    <!-- Top Right Round Notification Button -->
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M286,30 m-15,0 a15,15 0 1,0 30,0 a15,15 0 1,0 -30,0" />
    <path
        android:fillColor="#FF5E3A"
        android:pathData="M286,21.5 C282.8,21.5 280.5,23.8 280.5,27 L280.5,31.5 L278.5,33.5 L278.5,34.5 L293.5,34.5 L293.5,33.5 L291.5,31.5 L291.5,27 C291.5,23.8 289.2,21.5 286,21.5 Z M284,36 A2,2 0 0,0 288,36 Z" />

    <!-- Middle Countdown Box (#33000000) -->
    <path
        android:fillColor="#33000000"
        android:pathData="M24,52 L296,52 A10,10 0 0,1 306,62 L306,86 A10,10 0 0,1 296,96 L24,96 A10,10 0 0,1 14,86 L14,62 A10,10 0 0,1 24,52 Z" />
    <path
        android:fillColor="#99BAE6FD"
        android:pathData="M24,58 L92,58 A2.5,2.5 0 0,1 94.5,60.5 L94.5,62.5 A2.5,2.5 0 0,1 92,65 L24,65 A2.5,2.5 0 0,1 21.5,62.5 L21.5,60.5 A2.5,2.5 0 0,1 24,58 Z" />
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M25,70 L122,70 A5,5 0 0,1 127,75 L127,82 A5,5 0 0,1 122,87 L25,87 A5,5 0 0,1 20,82 L20,75 A5,5 0 0,1 25,70 Z" />
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M220,72 L292,72 A4,4 0 0,1 296,76 L296,81 A4,4 0 0,1 292,85 L220,85 A4,4 0 0,1 216,81 L216,76 A4,4 0 0,1 220,72 Z" />

    <!-- Vintage Analog Electricity Counter (САЗУ-ИТ) 24h Drum Chart (#D4D1C1) -->
    <path
        android:fillColor="#D4D1C1"
        android:strokeColor="#7A7768"
        android:strokeWidth="1.5"
        android:pathData="M22,102 L298,102 A8,8 0 0,1 306,110 L306,142 A8,8 0 0,1 298,150 L22,150 A8,8 0 0,1 14,142 L14,110 A8,8 0 0,1 22,102 Z" />

    <!-- Recessed Drum Window (#4E514E) -->
    <path
        android:fillColor="#4E514E"
        android:pathData="M24,108 L296,108 A4,4 0 0,1 300,112 L300,134 A4,4 0 0,1 296,138 L24,138 A4,4 0 0,1 20,134 L20,112 A4,4 0 0,1 24,108 Z" />

    <!-- Light Power-On Drum Track (#FCFBF7) -->
    <path
        android:fillColor="#FCFBF7"
        android:pathData="M24,111 L296,111 L296,135 L24,135 Z" />

    <!-- Red Blackout Segments (#D62E26) -->
    <path
        android:fillColor="#D62E26"
        android:pathData="M70,111 L115,111 L115,135 L70,135 Z" />
    <path
        android:fillColor="#D62E26"
        android:pathData="M182,111 L238,111 L238,135 L182,135 Z" />

    <!-- Black Current-Time Needle (#0B0B0A) -->
    <path
        android:fillColor="#0B0B0A"
        android:pathData="M146,105 L150,105 L150,141 L146,141 Z" />

    <!-- Bottom Next Outage Bar -->
    <path
        android:fillColor="#26000000"
        android:pathData="M20,155 L300,155 A5,5 0 0,1 305,160 L305,165 A5,5 0 0,1 300,170 L20,170 A5,5 0 0,1 15,165 L15,160 A5,5 0 0,1 20,155 Z" />
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M22,159 L95,159 L95,166 L22,166 Z" />
    <path
        android:fillColor="#FF5E3A"
        android:pathData="M210,159 L298,159 L298,166 L210,166 Z" />
</vector>
`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/ui/screens/AboutScreen.kt',
    language: 'kotlin',
    description: 'About screen with app version, developer links, donations, and disclaimer',
    content: `package ua.blackout.prewarning.ui.screens

import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ua.blackout.prewarning.BuildConfig
import ua.blackout.prewarning.data.repository.DonationsRepository
import ua.blackout.prewarning.ui.AppStrings
import ua.blackout.prewarning.ui.components.glassSurface

@Composable
fun AboutScreen(
    lang: String = "uk",
    /** Hoisted by the navigation: a double tap on this page's dock button scrolls it back to the top. */
    scrollState: ScrollState = rememberScrollState()
) {
    val context = LocalContext.current
    val appContext = remember { context.applicationContext }
    var donationLinks by remember {
        mutableStateOf(DonationsRepository.getCachedDonations(appContext))
    }
    var faviconBitmaps by remember {
        mutableStateOf<Map<String, Bitmap>>(emptyMap())
    }

    val currentBuildVersion = remember {
        val semverRegex = Regex("^[0-9]+\\\\.[0-9]+.*")
        val rawVersion = try {
            val pInfo = appContext.packageManager.getPackageInfo(appContext.packageName, 0)
            pInfo.versionName?.removePrefix("v")?.trim()
        } catch (_: Exception) {
            null
        }
        val buildCfgVersion = BuildConfig.VERSION_NAME.removePrefix("v").trim()
        val resolved = when {
            !rawVersion.isNullOrBlank() && rawVersion.matches(semverRegex) -> rawVersion
            buildCfgVersion.matches(semverRegex) -> buildCfgVersion
            else -> "1.4.2"
        }
        "v$resolved"
    }

    LaunchedEffect(Unit) {
        val refreshed = withContext(Dispatchers.IO) {
            DonationsRepository.getDonationsWithDailyRefresh(appContext, forceRefresh = true)
        }
        donationLinks = refreshed
        for (item in refreshed) {
            launch(Dispatchers.IO) {
                val bmp = DonationsRepository.fetchFaviconBitmap(appContext, item.url)
                if (bmp != null) {
                    withContext(Dispatchers.Main) {
                        faviconBitmaps = faviconBitmaps + (item.url to bmp)
                    }
                }
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .verticalScroll(scrollState)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // 1. App Identity Banner
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .glassSurface(RoundedCornerShape(24.dp), 24.dp)
                .padding(20.dp)
        ) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier
                        .size(60.dp)
                        .clip(RoundedCornerShape(18.dp))
                        .background(Color(0xFFFF5E3A)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Default.Bolt,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(36.dp)
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = AppStrings.aboutTitle(lang),
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = AppStrings.aboutSubtitle(lang),
                    fontSize = 12.sp,
                    color = Color(0xB3BAE6FD),
                    modifier = Modifier.padding(horizontal = 12.dp)
                )

                Spacer(modifier = Modifier.height(10.dp))

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0x1AFFFFFF))
                            .padding(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        Text(currentBuildVersion, fontSize = 11.sp, fontFamily = FontFamily.Monospace, color = Color.White)
                    }
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0x33FF5E3A))
                            .padding(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        Text("Jetpack Compose M3", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFFFF5E3A))
                    }
                }
            }
        }

        // 2. App Description Card
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .glassSurface(RoundedCornerShape(24.dp), 24.dp)
                .padding(18.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    text = AppStrings.aboutDescTitle(lang),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xB3BAE6FD)
                )
                Text(
                    text = AppStrings.aboutDescText(lang),
                    fontSize = 12.sp,
                    lineHeight = 18.sp,
                    color = Color(0xFFE2E8F0)
                )

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0x14FFFFFF))
                        .padding(12.dp)
                ) {
                    Text(
                        text = AppStrings.aboutDesktopNotice(lang),
                        fontSize = 11.sp,
                        lineHeight = 16.sp,
                        color = Color(0xB3BAE6FD)
                    )
                }
            }
        }

        // 3. Links Card (Developer, Issues, Desktop App)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .glassSurface(RoundedCornerShape(24.dp), 24.dp)
                .padding(18.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    text = AppStrings.aboutLinksTitle(lang),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xB3BAE6FD)
                )

                // Link 1: GitHub Profile
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0x14FFFFFF))
                        .clickable {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://github.com/IgorZaharov"))
                            context.startActivity(intent)
                        }
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(Color.White),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Code, contentDescription = null, tint = Color.Black, modifier = Modifier.size(18.dp))
                        }
                        Column {
                            Text(AppStrings.devProfile(lang), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            Text("github.com/IgorZaharov", fontSize = 10.sp, fontFamily = FontFamily.Monospace, color = Color(0x99BAE6FD))
                        }
                    }
                    Icon(Icons.Default.OpenInNew, contentDescription = null, tint = Color(0x99BAE6FD), modifier = Modifier.size(16.dp))
                }

                // Link 2: Світло в Житомирі на Github
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0x14FFFFFF))
                        .clickable {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(AppStrings.ABOUT_GITHUB_README_URL))
                            context.startActivity(intent)
                        }
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(Color(0x26FFFFFF)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Computer, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                        }
                        Column {
                            Text(AppStrings.desktopApp(lang), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            Text("github.com/IgorZaharov/Android-ZTBlackoutPreWarning/blob/main/README.md", fontSize = 10.sp, fontFamily = FontFamily.Monospace, color = Color(0x99BAE6FD))
                        }
                    }
                    Icon(Icons.Default.OpenInNew, contentDescription = null, tint = Color(0x99BAE6FD), modifier = Modifier.size(16.dp))
                }

                // Link 3: Issues & Requests
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0x14FFFFFF))
                        .clickable {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/issues"))
                            context.startActivity(intent)
                        }
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(Color(0xFFFF5E3A)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.BugReport, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                        }
                        Column {
                            Text(AppStrings.repoIssues(lang), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            Text("github.com/IgorZaharov/.../issues", fontSize = 10.sp, fontFamily = FontFamily.Monospace, color = Color(0x99BAE6FD))
                        }
                    }
                    Icon(Icons.Default.OpenInNew, contentDescription = null, tint = Color(0x99BAE6FD), modifier = Modifier.size(16.dp))
                }
            }
        }

        // 4. Donations / Благодійність і Пожертви Card (loaded from GitHub donations.json once per day)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .glassSurface(RoundedCornerShape(24.dp), 24.dp)
                .padding(18.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    text = AppStrings.aboutDonationsTitle(lang),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xB3BAE6FD)
                )

                donationLinks.forEach { item ->
                    val faviconBmp = faviconBitmaps[item.url]
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(Color(0x14FFFFFF))
                            .clickable {
                                try {
                                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(item.url))
                                    context.startActivity(intent)
                                } catch (_: Exception) {}
                            }
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(Color(0x26FFFFFF)),
                                contentAlignment = Alignment.Center
                            ) {
                                if (faviconBmp != null) {
                                    Image(
                                        bitmap = faviconBmp.asImageBitmap(),
                                        contentDescription = item.title,
                                        contentScale = ContentScale.Fit,
                                        modifier = Modifier
                                            .size(22.dp)
                                            .clip(RoundedCornerShape(4.dp))
                                    )
                                } else {
                                    Icon(
                                        imageVector = Icons.Default.Language,
                                        contentDescription = null,
                                        tint = Color.White,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            }
                            Column {
                                Text(item.title, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
                                Text(
                                    text = item.url.replaceFirst(Regex("^https?://"), ""),
                                    fontSize = 10.sp,
                                    fontFamily = FontFamily.Monospace,
                                    color = Color(0x99BAE6FD)
                                )
                            }
                        }
                        Icon(Icons.Default.OpenInNew, contentDescription = null, tint = Color(0x99BAE6FD), modifier = Modifier.size(16.dp))
                    }
                }
            }
        }

        // 5. Disclaimer Card about ztoe.com.ua
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .glassSurface(RoundedCornerShape(24.dp), 24.dp)
                .padding(18.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(Color(0x33F59E0B)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Shield, contentDescription = null, tint = Color(0xFFFBBF24), modifier = Modifier.size(18.dp))
                }
                Text(
                    text = AppStrings.disclaimerText(lang),
                    fontSize = 11.sp,
                    lineHeight = 16.sp,
                    color = Color(0xB3BAE6FD)
                )
            }
        }

        Spacer(modifier = Modifier.height(96.dp))
    }
}
`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/ui/screens/BlackoutAppNavigation.kt',
    language: 'kotlin',
    description: 'Main navigation pager with time-of-day dynamic background and top scrim',
    content: `package ua.blackout.prewarning.ui.screens

import androidx.compose.foundation.rememberScrollState
import android.os.SystemClock
import android.content.SharedPreferences
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.PagerDefaults
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.foundation.pager.PagerState
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ua.blackout.prewarning.core.SiteState
import ua.blackout.prewarning.data.parser.ZtoeAddressLookup
import ua.blackout.prewarning.data.repository.HouseVariantChoices
import ua.blackout.prewarning.data.repository.OutageRepository
import ua.blackout.prewarning.data.repository.OutageStateStore
import ua.blackout.prewarning.data.repository.RefreshOutcome
import ua.blackout.prewarning.data.repository.ScheduleRepository
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.data.repository.SubscriptionSync
import ua.blackout.prewarning.core.StoreResult
import ua.blackout.prewarning.core.Subscriptions
import ua.blackout.prewarning.data.model.UserSettings
import ua.blackout.prewarning.data.repository.OutageSnapshot
import ua.blackout.prewarning.notification.AlarmScheduler
import ua.blackout.prewarning.notification.ExactAlarmGate
import ua.blackout.prewarning.notification.NotificationHelper
import ua.blackout.prewarning.ui.AppStrings
import ua.blackout.prewarning.ui.components.glassSurface
import ua.blackout.prewarning.ui.components.CoachOverlay
import ua.blackout.prewarning.ui.components.CoachTargets
import ua.blackout.prewarning.ui.components.CoachTip
import ua.blackout.prewarning.ui.components.LocalCoachTargets
import ua.blackout.prewarning.ui.components.OnboardingStore
import ua.blackout.prewarning.ui.components.OnboardingTour
import ua.blackout.prewarning.ui.components.TourInput
import ua.blackout.prewarning.ui.components.TourPage
import ua.blackout.prewarning.ui.components.TourStep
import ua.blackout.prewarning.ui.components.coachTarget
import androidx.compose.runtime.CompositionLocalProvider
import ua.blackout.prewarning.ui.components.PageGlide
import ua.blackout.prewarning.ui.components.ambientBreath
import ua.blackout.prewarning.ui.components.ambientDrift
import ua.blackout.prewarning.ui.components.reducedMotion
import ua.blackout.prewarning.ui.components.rememberAmbientSeconds
import ua.blackout.prewarning.ui.theme.TimeOfDayPalette
import ua.blackout.prewarning.widget.BlackoutGlanceWidget
import java.time.Instant
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import ua.blackout.prewarning.data.KYIV_ZONE

private fun smoothGaussianRadialBrush(
    color: Color,
    maxAlpha: Float,
    center: Offset,
    radius: Float
): Brush {
    val safeRadius = radius.coerceAtLeast(1f)
    return Brush.radialGradient(
        colorStops = arrayOf(
            0.00f to color.copy(alpha = maxAlpha),
            0.18f to color.copy(alpha = maxAlpha * 0.90f),
            0.36f to color.copy(alpha = maxAlpha * 0.68f),
            0.54f to color.copy(alpha = maxAlpha * 0.42f),
            0.72f to color.copy(alpha = maxAlpha * 0.18f),
            0.88f to color.copy(alpha = maxAlpha * 0.04f),
            1.00f to color.copy(alpha = 0f)
        ),
        center = center,
        radius = safeRadius
    )
}


/** Two taps on the same dock button within this time scroll its page to the top (iOS: \`Dock.doubleTapWindow\`). */
private const val DOCK_DOUBLE_TAP_MS = 400L

@Composable
fun BlackoutAppNavigation(
    onThemeChanged: (Boolean) -> Unit = {},
    // Subscription id from a tapped notification: shown once on the main screen (spec/SUBSCRIPTIONS.md 9)
    openSubscriptionId: String? = null,
    onOpenSubscriptionHandled: () -> Unit = {}
) {
    val context = LocalContext.current
    val appContext = remember { context.applicationContext }
    val lifecycleOwner = LocalLifecycleOwner.current
    val coroutineScope = rememberCoroutineScope()
    val settingsRepo = remember { SettingsRepository(appContext) }
    val scheduleRepo = remember { ScheduleRepository(appContext) }
    val outageRepo = remember { OutageRepository(appContext) }
    val outageStore = remember { OutageStateStore(appContext) }
    val initialSettings = remember { settingsRepo.getSettings() }
    // Multi-address store (step 2): Settings edits it, the primary is mirrored into the keys above
    val subscriptionSync = remember { SubscriptionSync(appContext) }
    var subscriptions by remember { mutableStateOf(subscriptionSync.ensureReady()) }
    var alertsMaster by remember { mutableStateOf(subscriptionSync.master()) }
    // The address the main screen shows (step 4): session state, a cold start shows the primary (decision 5)
    var shownSubscriptionId by rememberSaveable { mutableStateOf<String?>(null) }

    // Latest persisted settings; kept in sync by the preference listener below
    var currentSettings by remember { mutableStateOf(initialSettings) }
    var siteUrl by remember { mutableStateOf(initialSettings.cityUrl) }
    var queue by remember { mutableStateOf(initialSettings.queue) }
    var customQueueStatusText by remember { mutableStateOf(initialSettings.customQueueStatusText) }
    var selectedAddress by remember { mutableStateOf(initialSettings.selectedAddress) }
    var selectedAddressQuery by remember { mutableStateOf(initialSettings.selectedAddressQuery) }
    var advanceMinutes by remember { mutableStateOf(initialSettings.advanceNoticeMinutes) }
    var refreshMinutes by remember { mutableStateOf(initialSettings.refreshIntervalMinutes.toInt()) }
    var notificationsEnabled by remember { mutableStateOf(initialSettings.notificationsEnabled) }
    var emergencyNotificationsEnabled by remember { mutableStateOf(initialSettings.emergencyNotificationsEnabled) }
    var soundEnabled by remember { mutableStateOf(initialSettings.soundEnabled) }
    var vibrationEnabled by remember { mutableStateOf(initialSettings.vibrationEnabled) }
    var currentLanguage by remember { mutableStateOf(initialSettings.language) }
    var autoOpenQueueHelp by remember { mutableStateOf(false) }
    // First-run tour (spec/ONBOARDING.md): started by the first-launch button, never shown again once finished
    val onboarding = remember { OnboardingStore(appContext) }
    val coachTargets = remember { CoachTargets() }
    var tourActive by remember { mutableStateOf(false) }
    var tourReachedRename by remember { mutableStateOf(false) }
    var tourRenameDone by remember { mutableStateOf(false) }
    fun endTour() {
        onboarding.setDone(true)
        tourActive = false
        tourReachedRename = false
        tourRenameDone = false
    }
    var currentTime by remember { mutableStateOf(LocalTime.now(KYIV_ZONE)) }

    // An address counts as a selection even when it has no queue and no emergency right now
    val isQueueUnselected = queue.isBlank() && customQueueStatusText.isNullOrBlank() && selectedAddressQuery == null

    // Pager for swipe left/right between windows with beyondViewportPageCount = 2 to eliminate swipe jittering
    val pagerState = rememberPagerState(initialPage = 0, pageCount = { 3 })
    // the pages' scroll positions, hoisted so a double tap on a dock button can scroll its page to the top
    val pageScrolls = listOf(rememberScrollState(), rememberScrollState(), rememberScrollState())
    var lastDockTap by remember { mutableStateOf<Pair<Int, Long>?>(null) }
    // A tap switches to the page at once; a second tap on the same button within DOCK_DOUBLE_TAP_MS also
    // scrolls that page to its top (owner, 2026-11-15). Timed by hand, so a single tap never waits.
    fun onDockTap(page: Int) {
        val now = SystemClock.uptimeMillis()
        val last = lastDockTap
        val isDouble = last != null && last.first == page && now - last.second < DOCK_DOUBLE_TAP_MS
        lastDockTap = if (isDouble) null else page to now
        coroutineScope.launch { pagerState.animateScrollToPage(page, animationSpec = PageGlide) }
        if (isDouble) coroutineScope.launch { pageScrolls[page].animateScrollTo(0) }
    }

    // Custom In-App Banner with Application Icon (replaces raw OS Toast so Android robot icon never appears)
    var appBannerMessage by remember { mutableStateOf<String?>(null) }
    var appBannerTick by remember { mutableStateOf(0L) }

    val showAppBanner: (String) -> Unit = { msg ->
        appBannerMessage = msg
        appBannerTick = System.currentTimeMillis()
    }

    LaunchedEffect(appBannerTick) {
        if (appBannerMessage != null) {
            delay(3000L)
            appBannerMessage = null
        }
    }

    val resolvedLang = remember(currentLanguage) {
        AppStrings.resolveLang(currentLanguage)
    }

    // Everything the screens show about outages comes from one snapshot of the stored state
    val addressKey = remember(selectedAddressQuery) { outageRepo.addressKey(selectedAddressQuery) }
    // The shown item when it is not the primary; the primary is read through the mirrored settings as in 1.4.0
    fun otherShownItem() = Subscriptions.viewItem(subscriptions, shownSubscriptionId)?.takeIf { it.id != subscriptions.primaryId }
    fun shownSnapshot(
        settings: UserSettings,
        now: LocalDateTime = LocalDateTime.now(KYIV_ZONE),
        primaryKey: String? = outageRepo.addressKey(settings.selectedAddressQuery)
    ): OutageSnapshot = otherShownItem()?.let { outageRepo.snapshotFor(it, now) } ?: outageRepo.snapshot(settings, now, primaryKey)

    var snapshot by remember {
        mutableStateOf(outageRepo.snapshot(initialSettings, LocalDateTime.now(KYIV_ZONE)))
    }
    val recomputeSnapshot: () -> Unit = {
        snapshot = shownSnapshot(currentSettings, LocalDateTime.now(KYIV_ZONE), addressKey)
    }
    var statusInfo by remember { mutableStateOf(snapshot.scheduleStatus()) }
    var isRefreshing by remember { mutableStateOf(false) }

    // "Last updated" is the last successful ztoe fetch; "next" is one refresh interval after the last check
    val hhmm = remember { DateTimeFormatter.ofPattern("HH:mm") }
    val lastUpdated = remember(snapshot.site, snapshot.plannedKnown) {
        val ms = snapshot.site?.lastSuccessMs ?: scheduleRepo.lastSyncMs().takeIf { it > 0L }
        if (ms == null) "--:--" else Instant.ofEpochMilli(ms).atZone(KYIV_ZONE).format(hhmm)
    }
    val nextUpdated = remember(snapshot.site, refreshMinutes) {
        val ms = snapshot.site?.checkedAtMs?.takeIf { it > 0L } ?: System.currentTimeMillis()
        Instant.ofEpochMilli(ms).plusSeconds(refreshMinutes * 60L).atZone(KYIV_ZONE).format(hhmm)
    }

    // The exact-alarm permission can change while the app is in the background, so it is re-read on every resume
    var resumeTick by remember { mutableStateOf(0) }
    DisposableEffect(lifecycleOwner) {
        val observer = androidx.lifecycle.LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) resumeTick++
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }
    // Planned warnings of any address need exact alarms (spec/SUBSCRIPTIONS.md 8.1)
    val anyPlannedActive = subscriptions.items.any { Subscriptions.plannedActive(alertsMaster, it) }
    val exactAlarmMissing = remember(resumeTick, anyPlannedActive) {
        anyPlannedActive && !ExactAlarmGate.canScheduleExact(appContext)
    }

    // settledPage, not currentPage: currentPage flips half way through a swipe, and the work that hangs on it
    // (countdown on/off, snapshot, the Settings site check, recomposing both pages) made the swipe stutter
    val isMainScreenVisible = pagerState.settledPage == 0
    val isCountdownScreenActive = isMainScreenVisible && !isQueueUnselected
    var hasCompletedInitialScheduleFetch by remember { mutableStateOf(false) }

    /**
     * Re-checks the saved address (a house without a queue may get one), then refreshes both sources
     * through [OutageRepository] and re-plans alarms and widgets. A failing source keeps its old data.
     */
    suspend fun runRefresh(force: Boolean, resolveAddress: Boolean): RefreshOutcome {
        isRefreshing = true
        try {
            val outcome = withContext(Dispatchers.IO) {
                ZtoeAddressLookup.initDiskCache(appContext)
                val addrQuery = settingsRepo.getSettings().selectedAddressQuery
                if (resolveAddress && addrQuery != null && addrQuery.streetId.isNotBlank() && addrQuery.house.isNotBlank()) {
                    val saved = settingsRepo.getSettings()
                    val lookup = try {
                        // the variant the user chose is kept when the site lists the house with several queues (households / non-household)
                        ZtoeAddressLookup.checkAddressOnZtoeWebsite(
                            remId = addrQuery.remId,
                            settlementId = addrQuery.settlementId,
                            streetId = addrQuery.streetId,
                            house = addrQuery.house,
                            siteUrl = saved.cityUrl,
                            preferred = HouseVariantChoices.get(appContext, addrQuery.streetId, addrQuery.house)
                        )
                    } catch (_: Exception) {
                        null
                    }
                    if (lookup != null) {
                        val current = settingsRepo.getSettings()
                        val nextQueue = when {
                            !lookup.queue.isNullOrBlank() -> lookup.queue
                            !lookup.statusText.isNullOrBlank() -> ""
                            else -> current.queue
                        }
                        val nextStatus = when {
                            !lookup.queue.isNullOrBlank() -> null
                            !lookup.statusText.isNullOrBlank() -> lookup.statusText
                            else -> current.customQueueStatusText
                        }
                        val nextLabel = lookup.addressLabel.takeIf { it.isNotBlank() } ?: current.selectedAddress
                        if (nextQueue != current.queue || nextStatus != current.customQueueStatusText || nextLabel != current.selectedAddress) {
                            // into the primary subscription, which is mirrored back into these keys
                            subscriptionSync.assignPrimaryQueue(nextQueue, nextStatus, nextLabel)
                        }
                    }
                }
                val result = outageRepo.refresh(settingsRepo.getSettings(), forceNetwork = force, shownId = otherShownItem()?.id)
                try {
                    AlarmScheduler.syncAlarms(appContext)
                } catch (_: Exception) {
                }
                try {
                    BlackoutGlanceWidget.syncAllWidgets(appContext)
                } catch (_: Exception) {
                }
                result
            }
            snapshot = shownSnapshot(settingsRepo.getSettings())
            return outcome
        } finally {
            isRefreshing = false
        }
    }

    // Entering the main screen: show fresh numbers at once, then refresh quietly in the background
    LaunchedEffect(isMainScreenVisible) {
        if (isMainScreenVisible) {
            currentTime = LocalTime.now(KYIV_ZONE)
            val settings = currentSettings
            val key = addressKey
            snapshot = withContext(Dispatchers.Default) { shownSnapshot(settings, LocalDateTime.now(KYIV_ZONE), key) }
            if (hasCompletedInitialScheduleFetch) {
                runRefresh(force = false, resolveAddress = true)
            }
        }
    }

    // Live countdown: once per second while the main screen is visible and the app is resumed (battery friendly)
    LaunchedEffect(lifecycleOwner, isCountdownScreenActive, currentSettings, addressKey, shownSubscriptionId, subscriptions) {
        if (!isCountdownScreenActive) {
            val nowDt = LocalDateTime.now(KYIV_ZONE)
            currentTime = nowDt.toLocalTime()
            // off the main thread: stores are read and the engine runs, which must not cost a frame of a swipe
            val fresh = withContext(Dispatchers.Default) { shownSnapshot(currentSettings, nowDt, addressKey) }
            snapshot = fresh
            statusInfo = fresh.scheduleStatus()
            return@LaunchedEffect
        }
        lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            withContext(Dispatchers.IO) {
                try {
                    AlarmScheduler.syncAlarms(appContext)
                } catch (_: Exception) {
                }
            }
            while (true) {
                val nowDt = LocalDateTime.now(KYIV_ZONE)
                currentTime = nowDt.toLocalTime()
                val fresh = withContext(Dispatchers.Default) { shownSnapshot(currentSettings, nowDt, addressKey) }
                snapshot = fresh
                val updatedStatus = fresh.scheduleStatus()
                statusInfo = updatedStatus
                if (!updatedStatus.isBlackoutNow && updatedStatus.countdownText == "--:--:--" && updatedStatus.nextSlotTime == "Відключень немає") {
                    delay(15_000L)
                } else {
                    delay(1000L)
                }
            }
        }
    }

    // Keep strong references to SharedPreferences listeners (Android stores them in a WeakHashMap)
    val settingsListener = remember(settingsRepo) {
        SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
            val updated = settingsRepo.getSettings()
            currentSettings = updated
            queue = updated.queue
            customQueueStatusText = updated.customQueueStatusText
            selectedAddress = updated.selectedAddress
            selectedAddressQuery = updated.selectedAddressQuery
            siteUrl = updated.cityUrl
            advanceMinutes = updated.advanceNoticeMinutes
            refreshMinutes = updated.refreshIntervalMinutes.toInt()
            notificationsEnabled = updated.notificationsEnabled
            emergencyNotificationsEnabled = updated.emergencyNotificationsEnabled
            soundEnabled = updated.soundEnabled
            vibrationEnabled = updated.vibrationEnabled
            currentLanguage = updated.language
            subscriptions = subscriptionSync.store()
            alertsMaster = subscriptionSync.master()
            snapshot = shownSnapshot(updated)
        }
    }

    // Schedule cache or outage state changed (worker, widget, refresh): show it
    val stateListener = remember(settingsRepo, outageRepo) {
        SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
            snapshot = shownSnapshot(settingsRepo.getSettings())
        }
    }

    // Listen to SharedPreferences changes from Widget (ToggleAlertsActionCallback / RefreshWidgetActionCallback)
    DisposableEffect(settingsRepo, scheduleRepo, outageStore, settingsListener, stateListener) {
        val settingsPrefs = settingsRepo.getSharedPreferences()
        val schedulePrefs = scheduleRepo.getSharedPreferences()
        val outagePrefs = outageStore.getSharedPreferences()

        settingsPrefs.registerOnSharedPreferenceChangeListener(settingsListener)
        schedulePrefs.registerOnSharedPreferenceChangeListener(stateListener)
        outagePrefs.registerOnSharedPreferenceChangeListener(stateListener)

        onDispose {
            settingsPrefs.unregisterOnSharedPreferenceChangeListener(settingsListener)
            schedulePrefs.unregisterOnSharedPreferenceChangeListener(stateListener)
            outagePrefs.unregisterOnSharedPreferenceChangeListener(stateListener)
        }
    }

    // Refresh donations links from .json on GitHub using daily 24h cache
    LaunchedEffect(Unit) {
        withContext(Dispatchers.IO) {
            try {
                val links = ua.blackout.prewarning.data.repository.DonationsRepository.getDonationsWithDailyRefresh(
                    appContext,
                    forceRefresh = false
                )
                for (item in links) {
                    ua.blackout.prewarning.data.repository.DonationsRepository.fetchFaviconBitmap(appContext, item.url)
                }
            } catch (_: Exception) {}
        }
    }

    // Hydrate address index from disk cache and prefetch REMs, cities, and streets strictly in the background after initial UI render
    LaunchedEffect(siteUrl) {
        delay(250L)
        withContext(Dispatchers.IO) {
            try {
                ZtoeAddressLookup.initDiskCache(appContext)
                ZtoeAddressLookup.prefetchAddressIndexInBackground(
                    context = appContext,
                    siteUrl = siteUrl,
                    savedQuery = selectedAddressQuery,
                    forceRefresh = false
                )
            } catch (_: Exception) {}
        }
    }

    // Refresh both sources when the queue, site address or selected address changes (and once at launch)
    LaunchedEffect(queue, customQueueStatusText, siteUrl, selectedAddressQuery) {
        if (queue.isBlank() && selectedAddressQuery == null) {
            hasCompletedInitialScheduleFetch = true
            recomputeSnapshot()
            return@LaunchedEffect
        }
        runRefresh(force = false, resolveAddress = true)
        hasCompletedInitialScheduleFetch = true
    }

    // Another address is shown: poll its PowerOn too (its switches gate notifications only)
    LaunchedEffect(shownSubscriptionId) {
        if (hasCompletedInitialScheduleFetch && otherShownItem() != null) {
            runRefresh(force = false, resolveAddress = false)
        }
    }

    // A tapped notification shows its address on the main screen
    LaunchedEffect(openSubscriptionId) {
        val id = openSubscriptionId ?: return@LaunchedEffect
        shownSubscriptionId = id
        pagerState.scrollToPage(0)
        onOpenSubscriptionHandled()
    }

    // Manual refresh: always goes to the network and tells the user what the site answered
    val performManualRefresh: () -> Unit = {
        coroutineScope.launch {
            val outcome = runRefresh(force = true, resolveAddress = true)
            val message = when (outcome.siteState) {
                null, SiteState.AVAILABLE_WITH_TABLE -> AppStrings.refreshSuccessToast(resolvedLang)
                SiteState.AVAILABLE_NO_TABLE -> AppStrings.siteStateNoTable(resolvedLang)
                SiteState.SITE_UNREACHABLE -> AppStrings.siteStateUnreachable(resolvedLang)
                SiteState.NO_INTERNET -> AppStrings.siteStateNoInternet(resolvedLang)
            }
            showAppBanner(message)
        }
    }

    val syncAlarmsAndWidgets: () -> Unit = {
        coroutineScope.launch(Dispatchers.IO) {
            try {
                AlarmScheduler.syncAlarms(appContext)
                BlackoutGlanceWidget.syncAllWidgets(appContext)
            } catch (_: Exception) {}
        }
    }

    /** Shows why a store change was refused; on success alarms and widgets follow the new primary mirror. */
    val onStoreResult: (StoreResult) -> Boolean = { result ->
        when (result) {
            is StoreResult.Ok -> {
                subscriptions = result.store
                syncAlarmsAndWidgets()
                true
            }
            is StoreResult.Error -> {
                when (result.code) {
                    Subscriptions.ERR_DUPLICATE -> showAppBanner(AppStrings.addressDuplicate(resolvedLang))
                    Subscriptions.ERR_LIMIT -> showAppBanner(AppStrings.addressLimitReached(resolvedLang, Subscriptions.MAX_ITEMS))
                    else -> Unit
                }
                false
            }
        }
    }

    // Gradual Time-of-Day Background Palette (60% Primary, 30% Secondary, 10% Accent, Supporting/Core)
    // Keyed by minute-of-day so full-screen radial gradients are only recalculated once per minute instead of every second
    val currentMinuteOfDay = remember(statusInfo.countdownText) {
        val now = LocalTime.now(KYIV_ZONE)
        now.hour * 60 + now.minute
    }
    val bgColors = remember(currentMinuteOfDay) {
        TimeOfDayPalette.getInterpolatedColors(LocalTime.now(KYIV_ZONE))
    }
    // Very slow warp of the background orbs, and a slight parallax with the pager (read in the draw
    // phase only, so neither recomposes the screens). Both stop under reduced motion.
    val ambient = rememberAmbientSeconds()
    val reduceMotion = remember { reducedMotion(appContext) }

    CompositionLocalProvider(LocalCoachTargets provides coachTargets) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(bgColors.primary)
            .drawBehind {
                val w = size.width.coerceAtLeast(1f)
                val h = size.height.coerceAtLeast(1f)
                val maxDim = maxOf(w, h)
                val t = ambient.value
                // the orbs move a little against the swipe: 3 % of the width per page
                val parallax = if (reduceMotion) Offset.Zero
                else Offset(-(pagerState.currentPage + pagerState.currentPageOffsetFraction) * w * 0.03f, 0f)

                // 1. Primary (60%) & Secondary (30%) full-canvas radial atmospheric base matching PhoneSimulator.tsx
                drawRect(
                    brush = Brush.radialGradient(
                        colorStops = arrayOf(
                            0.0f to bgColors.primary.copy(alpha = 0.60f),
                            0.55f to bgColors.primary.copy(alpha = 0.35f),
                            1.0f to bgColors.secondary.copy(alpha = 0.60f)
                        ),
                        center = Offset(w * 0.50f, h * 0.45f),
                        radius = maxDim * 0.85f
                    )
                )

                // 2. Secondary (30%) top-right smooth Gaussian blurred orb (full-rect draw avoids circular edge clipping)
                drawRect(
                    brush = smoothGaussianRadialBrush(
                        color = bgColors.secondary,
                        maxAlpha = 0.68f,
                        center = Offset(w * 0.88f, h * 0.08f) + ambientDrift(t, 0, w, h) + parallax,
                        radius = w * 0.98f * ambientBreath(t, 0)
                    )
                )

                // 3. Supporting/Core top-left contrast orb matching PhoneSimulator.tsx
                drawRect(
                    brush = smoothGaussianRadialBrush(
                        color = bgColors.supporting,
                        maxAlpha = 0.62f,
                        center = Offset(w * 0.12f, h * 0.06f) + ambientDrift(t, 1, w, h) + parallax,
                        radius = w * 0.92f * ambientBreath(t, 1)
                    )
                )

                // 4. Secondary (30%) lower-left smooth Gaussian wave matching PhoneSimulator.tsx
                drawRect(
                    brush = smoothGaussianRadialBrush(
                        color = bgColors.secondary,
                        maxAlpha = 0.58f,
                        center = Offset(w * 0.08f, h * 0.68f) + ambientDrift(t, 2, w, h) + parallax,
                        radius = w * 0.98f * ambientBreath(t, 2)
                    )
                )

                // 5. Accent (10%) bottom-right highlight orb matching PhoneSimulator.tsx
                drawRect(
                    brush = smoothGaussianRadialBrush(
                        color = bgColors.accent,
                        maxAlpha = 0.52f,
                        center = Offset(w * 0.82f, h * 0.84f) + ambientDrift(t, 3, w, h) + parallax,
                        radius = w * 0.82f * ambientBreath(t, 3)
                    )
                )

                // 6. Subtle top scrim (#0B0C10 at 65% -> 25% -> 0%) matching PhoneSimulator.tsx for crisp header contrast
                val scrimHeight = 148.dp.toPx().coerceAtMost(h)
                drawRect(
                    brush = Brush.verticalGradient(
                        colorStops = arrayOf(
                            0.0f to Color(0xFF0B0C10).copy(alpha = 0.65f),
                            0.45f to Color(0xFF0B0C10).copy(alpha = 0.25f),
                            1.0f to Color(0xFF0B0C10).copy(alpha = 0.0f)
                        ),
                        startY = 0f,
                        endY = scrimHeight
                    ),
                    topLeft = Offset.Zero,
                    size = Size(w, scrimHeight)
                )

                // 7. First-launch / unselected queue dark dimming base matching Workbench (#0b0f19 / brightness-50)
                if (isQueueUnselected) {
                    drawRect(color = Color(0xD9070A12))
                }
            }
    ) {
        // Main swipeable screens with pre-composed pages (beyondViewportPageCount = 2) for smooth 60fps swiping
        HorizontalPager(
            state = pagerState,
            beyondViewportPageCount = 2,
            userScrollEnabled = !isQueueUnselected,
            flingBehavior = PagerDefaults.flingBehavior(state = pagerState, snapAnimationSpec = PageGlide),
            modifier = Modifier.fillMaxSize()
        ) { page ->
          // While swiping, the page leaving dims and recedes a little (only fades under reduced motion)
          Box(
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer {
                    // alpha per draw call instead of an offscreen copy of the whole page every frame
                    compositingStrategy = CompositingStrategy.ModulateAlpha
                    val away = kotlin.math.abs((pagerState.currentPage - page) + pagerState.currentPageOffsetFraction).coerceIn(0f, 1f)
                    alpha = 1f - 0.35f * away
                    if (!reduceMotion) {
                        val scale = 1f - 0.05f * away
                        scaleX = scale
                        scaleY = scale
                    }
                }
          ) {
            when (page) {
                0 -> {
                    val other = otherShownItem()
                    MainScreen(
                        scrollState = pageScrolls[0],
                        queue = if (other != null) other.queue.orEmpty() else queue,
                        customQueueStatusText = if (other != null) other.queueStatusText else customQueueStatusText,
                        selectedAddress = if (other != null) {
                            other.address?.let { a -> a.text.ifBlank { Subscriptions.displayLabel(other) } }
                        } else {
                            selectedAddress
                        },
                        addresses = Subscriptions.switcherItems(subscriptions),
                        primaryAddressId = subscriptions.primaryId,
                        shownAddressId = Subscriptions.viewItem(subscriptions, shownSubscriptionId)?.id,
                        onSelectAddress = { shownSubscriptionId = it },
                        showNoAlertsCaption = Subscriptions.noAlertsCaption(alertsMaster, subscriptions),
                        onOpenSettings = { coroutineScope.launch { pagerState.animateScrollToPage(1, animationSpec = PageGlide) } },
                        snapshot = snapshot,
                        statusInfo = statusInfo,
                        isRefreshing = isRefreshing,
                        exactAlarmMissing = exactAlarmMissing,
                        onOpenExactAlarmSettings = {
                            ExactAlarmGate.settingsIntent(appContext)?.let {
                                try {
                                    appContext.startActivity(it)
                                } catch (_: Exception) {
                                }
                            }
                        },
                        // the header bell is the master switch for all addresses (owner decision 4)
                        notificationsEnabled = alertsMaster,
                        lastUpdated = lastUpdated,
                        nextUpdated = nextUpdated,
                        currentTime = currentTime,
                        lang = resolvedLang,
                        selectedLanguage = currentLanguage,
                        onToggleNotifications = {
                            subscriptionSync.setMaster(!alertsMaster)
                            alertsMaster = subscriptionSync.master()
                            syncAlarmsAndWidgets()
                        },
                        onRefresh = {
                            performManualRefresh()
                        },
                        onOpenQueueSelection = {
                            autoOpenQueueHelp = true
                            if (!onboarding.isDone()) {
                                tourActive = true
                                tourReachedRename = false
                                tourRenameDone = false
                            }
                            coroutineScope.launch {
                                pagerState.animateScrollToPage(1, animationSpec = PageGlide)
                            }
                        },
                        onChangeLanguage = { newLang ->
                            currentLanguage = newLang
                            val current = settingsRepo.getSettings()
                            settingsRepo.saveSettings(current.copy(language = newLang))
                            coroutineScope.launch(Dispatchers.IO) {
                                try {
                                    BlackoutGlanceWidget.syncAllWidgets(appContext)
                                } catch (_: Exception) {}
                            }
                        }
                    )
                }
                1 -> {
                    SettingsScreen(
                        scrollState = pageScrolls[1],
                        currentQueue = queue,
                        subscriptions = subscriptions,
                        alertsMaster = alertsMaster,
                        selectedAddressQuery = selectedAddressQuery,
                        siteUrl = siteUrl,
                        advanceMinutes = advanceMinutes,
                        refreshMinutes = refreshMinutes,
                        notificationsEnabled = notificationsEnabled,
                        emergencyNotificationsEnabled = emergencyNotificationsEnabled,
                        soundEnabled = soundEnabled,
                        vibrationEnabled = vibrationEnabled,
                        currentLanguage = currentLanguage,
                        lang = resolvedLang,
                        autoOpenQueueHelp = autoOpenQueueHelp,
                        onAutoOpenQueueHelpHandled = { autoOpenQueueHelp = false },
                        tourActive = tourActive,
                        onTourSkip = { endTour() },
                        onRenameDialogClosed = { if (tourActive && tourReachedRename) tourRenameDone = true },
                        onAddAddress = { resolvedQueue, statusText, addressLabel, query ->
                            val ok = onStoreResult(subscriptionSync.addFromLookup(resolvedQueue, statusText, addressLabel, query))
                            // the user stays in Settings (owner request): the address is added in place
                            if (ok) showAppBanner(AppStrings.addressAdded(resolvedLang))
                        },
                        onAddQueueOnly = { newQueue -> onStoreResult(subscriptionSync.addQueueOnly(newQueue)) },
                        onRemoveSubscription = { id -> onStoreResult(subscriptionSync.change { Subscriptions.remove(it, id) }) },
                        onMakePrimary = { id -> onStoreResult(subscriptionSync.change { Subscriptions.setPrimary(it, id) }) },
                        onSetPlanned = { id, on -> onStoreResult(subscriptionSync.change { Subscriptions.setPlanned(it, id, on) }) },
                        onSetEmergency = { id, on -> onStoreResult(subscriptionSync.change { Subscriptions.setEmergency(it, id, on) }) },
                        onRenameSubscription = { id, label -> onStoreResult(subscriptionSync.change { Subscriptions.rename(it, id, label) }) },
                        onEditAddress = { id, resolvedQueue, statusText, addressLabel, query ->
                            val ok = onStoreResult(subscriptionSync.editAddress(id, resolvedQueue, statusText, addressLabel, query))
                            if (ok) showAppBanner(AppStrings.addressChanged(resolvedLang))
                        },
                        onMoveSubscription = { id, to -> onStoreResult(subscriptionSync.change { Subscriptions.move(it, id, to) }) },
                        onSiteUrlChanged = { newUrl ->
                            siteUrl = newUrl
                            val current = settingsRepo.getSettings()
                            settingsRepo.saveSettings(current.copy(cityUrl = newUrl))
                        },
                        onAdvanceMinutesChanged = {
                            advanceMinutes = it
                            val current = settingsRepo.getSettings()
                            settingsRepo.saveSettings(current.copy(advanceNoticeMinutes = it))
                            coroutineScope.launch(Dispatchers.IO) {
                                try {
                                    AlarmScheduler.syncAlarms(appContext)
                                } catch (_: Exception) {}
                            }
                        },
                        onRefreshMinutesChanged = {
                            val intervalChanged = refreshMinutes != it
                            refreshMinutes = it
                            val current = settingsRepo.getSettings()
                            settingsRepo.saveSettings(current.copy(refreshIntervalMinutes = it.toLong()))
                            if (intervalChanged) {
                                ua.blackout.prewarning.worker.ScheduleSyncWorker.schedulePeriodicWork(
                                    appContext,
                                    androidx.work.ExistingPeriodicWorkPolicy.UPDATE
                                )
                            }
                        },
                        onToggleMaster = { on ->
                            subscriptionSync.setMaster(on)
                            alertsMaster = subscriptionSync.master()
                            syncAlarmsAndWidgets()
                        },
                        onToggleSound = {
                            soundEnabled = it
                            val current = settingsRepo.getSettings()
                            settingsRepo.saveSettings(current.copy(soundEnabled = it, prevSoundEnabled = it))
                        },
                        onToggleVibration = {
                            vibrationEnabled = it
                            val current = settingsRepo.getSettings()
                            settingsRepo.saveSettings(current.copy(vibrationEnabled = it, prevVibrationEnabled = it))
                        },
                        emergencyEtaAlerts = currentSettings.emergencyEtaAlerts,
                        emergencyEndAlerts = currentSettings.emergencyEndAlerts,
                        onToggleEmergencyEtaAlerts = { on ->
                            settingsRepo.saveSettings(settingsRepo.getSettings().copy(emergencyEtaAlerts = on))
                        },
                        onToggleEmergencyEndAlerts = { on ->
                            settingsRepo.saveSettings(settingsRepo.getSettings().copy(emergencyEndAlerts = on))
                        },
                        onLanguageSelected = {
                            currentLanguage = it
                            val current = settingsRepo.getSettings()
                            settingsRepo.saveSettings(current.copy(language = it))
                            coroutineScope.launch(Dispatchers.IO) {
                                try {
                                    BlackoutGlanceWidget.syncAllWidgets(appContext)
                                } catch (_: Exception) {}
                            }
                        },
                        onSendTestAlert = {
                            val displayQ = queue.ifBlank { "1.1" }
                            NotificationHelper.showPreWarningNotification(
                                context = appContext,
                                notificationId = 9999,
                                title = if (resolvedLang == "uk") "Тестове попередження" else "Test notification",
                                body = if (resolvedLang == "uk")
                                    "Черга $displayQ: відключення розпочнеться о 14:00 (через $advanceMinutes хв)."
                                else
                                    "Queue $displayQ: blackout begins at 14:00 (in $advanceMinutes min).",
                                isTest = true
                            )
                        },
                        onForceRefresh = {
                            performManualRefresh()
                        },
                        isRefreshing = isRefreshing,
                        onResetDefaults = {
                            // CRITICAL CONSTANTS — Default values: advanceMinutes = 15, refreshMinutes = 30
                            settingsRepo.resetAllAppDataToFirstLaunch()
                            coroutineScope.launch {
                                pagerState.animateScrollToPage(0, animationSpec = PageGlide)
                            }
                            coroutineScope.launch(Dispatchers.IO) {
                                try {
                                    scheduleRepo.clearScheduleCache()
                                    outageStore.clearAll()
                                    AlarmScheduler.syncAlarms(appContext)
                                    BlackoutGlanceWidget.syncAllWidgets(appContext)
                                } catch (_: Exception) {}
                            }
                        },
                        onShowAppBanner = showAppBanner,
                        exactAlarmMissing = exactAlarmMissing,
                        onOpenExactAlarmSettings = {
                            ExactAlarmGate.settingsIntent(appContext)?.let {
                                try {
                                    appContext.startActivity(it)
                                } catch (_: Exception) {
                                }
                            }
                        },
                        isVisible = pagerState.settledPage == 1
                    )
                }
                2 -> {
                    AboutScreen(
                        scrollState = pageScrolls[2],
                        lang = resolvedLang
                    )
                }
            }
          }
        }

        // Top In-App Notification Banner with Application Icon (white lightning on #FF5E3A rounded square)
        AnimatedVisibility(
            visible = appBannerMessage != null,
            enter = fadeIn() + slideInVertically(initialOffsetY = { -it }),
            exit = fadeOut() + slideOutVertically(targetOffsetY = { -it }),
            modifier = Modifier
                .align(Alignment.TopCenter)
                .statusBarsPadding()
                .padding(top = 12.dp, start = 20.dp, end = 20.dp)
        ) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color(0xF2141A29))
                    .padding(horizontal = 16.dp, vertical = 10.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(28.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFFFF5E3A)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Bolt,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                    Text(
                        text = appBannerMessage ?: "",
                        color = Color.White,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        // Floating Capsule Bottom Navigation Dock matching emulator (dimmed & disabled when queue unselected)
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .navigationBarsPadding()
                .padding(bottom = 16.dp)
                .alpha(if (isQueueUnselected) 0.15f else 1f)
        ) {
            Box(
                modifier = Modifier
                    .glassSurface(CircleShape, 32.dp, background = Color(0xB8141A29))
                    .padding(6.dp)
            ) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Each tab reads the pager itself, so the live page highlight recomposes only the tab
                    DockTab(pagerState, 0, Icons.Default.Home, "Графік", !isQueueUnselected, Modifier.coachTarget("dock-home")) { onDockTap(0) }
                    DockTab(pagerState, 1, Icons.Default.Settings, "Налаштування", !isQueueUnselected) { onDockTap(1) }
                    DockTab(pagerState, 2, Icons.Default.Info, "Про додаток", !isQueueUnselected, Modifier.coachTarget("dock-about")) { onDockTap(2) }
                }
            }
        }

        // First-run tour on the main window: RENAME, ALERTS (Settings) and ABOUT (main screen); the lookup
        // dialog draws PICK and APPLY in its own window
        if (tourActive) {
            val tourPage = when (pagerState.settledPage) {
                0 -> TourPage.SCHEDULE
                1 -> TourPage.SETTINGS
                2 -> TourPage.ABOUT
                else -> TourPage.OTHER
            }
            val step = OnboardingTour.step(
                TourInput(
                    active = true,
                    lookupOpen = false,
                    resultShown = false,
                    page = tourPage,
                    hasAddress = subscriptions.items.isNotEmpty(),
                    reachedRename = tourReachedRename,
                    renameDone = tourRenameDone
                )
            )
            LaunchedEffect(step) { if (step == TourStep.RENAME) tourReachedRename = true }
            LaunchedEffect(tourPage, tourReachedRename) {
                if (OnboardingTour.finishedBy(tourPage, tourReachedRename)) endTour()
            }
            when (step) {
                TourStep.RENAME -> CoachOverlay(
                    targets = coachTargets,
                    holes = listOf(listOf("rename")),
                    tips = listOf(CoachTip(anchor = listOf("rename"), text = AppStrings.tourRename(resolvedLang), next = true, skip = true)),
                    lang = resolvedLang,
                    onSkip = { endTour() },
                    onNext = { tourRenameDone = true }
                )
                TourStep.ALERTS -> {
                    val switches = listOf("alert-planned", "alert-emergency")
                    CoachOverlay(
                        targets = coachTargets,
                        holes = listOf(switches, listOf("dock-home")),
                        tips = listOf(
                            CoachTip(anchor = switches, text = AppStrings.tourAlerts(resolvedLang), skip = true),
                            CoachTip(anchor = listOf("dock-home"), text = AppStrings.tourBack(resolvedLang))
                        ),
                        lang = resolvedLang,
                        onSkip = { endTour() }
                    )
                }
                TourStep.ABOUT -> CoachOverlay(
                    targets = coachTargets,
                    holes = listOf(listOf("dock-about")),
                    tips = listOf(CoachTip(anchor = listOf("dock-about"), text = AppStrings.tourDonate(resolvedLang), done = true)),
                    lang = resolvedLang,
                    onSkip = { endTour() },
                    onDone = { endTour() }
                )
                else -> Unit
            }
        }
    }
    }
}

/** One dock button; reads [PagerState.currentPage] here so a swipe recomposes only this button. */
@Composable
private fun DockTab(
    pagerState: PagerState,
    page: Int,
    icon: ImageVector,
    description: String,
    enabled: Boolean,
    modifier: Modifier = Modifier,
    onTap: () -> Unit
) {
    val selected = pagerState.currentPage == page
    Box(
        modifier = modifier
            .size(44.dp)
            .clip(CircleShape)
            .background(if (selected) Color.White else Color.Transparent)
            .clickable(enabled = enabled, onClick = onTap),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            icon,
            contentDescription = description,
            tint = if (selected) Color.Black else Color(0xB3BAE6FD),
            modifier = Modifier.size(20.dp)
        )
    }
}
`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/ui/components/FloatingShadow.kt',
    language: 'kotlin',
    description: 'Custom drop-shadow extension modifier with Gaussian BlurMaskFilter',
    content: `package ua.blackout.prewarning.ui.components

import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Custom floating shadow modifier that draws a genuine hardware-accelerated
 * multi-step Gaussian drop-shadow behind the composable. The defaults are the soft glass-card shadow,
 * matching the web \`.zt-glass\` box-shadow 0 4px 14px rgba(0,0,0,0.25).
 *
 * This renders reliably on all real physical devices and GPUs without depending
 * on unsupported platform mask filters that are ignored by Android HWUI/Skia.
 */
fun Modifier.floatingShadow(
    color: Color = Color(0x40000000),
    borderRadius: Dp = 24.dp,
    blurRadius: Dp = 14.dp,
    offsetY: Dp = 4.dp,
    spread: Dp = 0.dp
): Modifier = this.drawBehind {
    val blurPx = blurRadius.toPx()
    val offsetYPx = offsetY.toPx()
    val spreadPx = spread.toPx()
    val cornerPx = borderRadius.toPx()

    if (blurPx <= 0f && spreadPx <= 0f) return@drawBehind

    val steps = 18
    val baseAlpha = color.alpha

    for (step in steps downTo 1) {
        val t = step.toFloat() / steps.toFloat() // 1.0 down to ~0.055
        val progress = t * t // Quadratic curve creates smooth Gaussian density

        val expandX = spreadPx + blurPx * progress
        val topExpand = (spreadPx + blurPx * progress * 0.45f - offsetYPx * progress * 0.45f).coerceAtLeast(0f)
        val bottomExpand = spreadPx + blurPx * progress + offsetYPx * progress

        val currentCornerRadius = (cornerPx + expandX * 0.5f).coerceAtLeast(0f)
        val falloff = (1f - progress).coerceIn(0f, 1f)
        val stepAlpha = (baseAlpha / steps) * (0.6f + 1.2f * falloff)

        if (stepAlpha > 0.003f) {
            drawRoundRect(
                color = color.copy(alpha = stepAlpha.coerceIn(0f, 1f)),
                topLeft = Offset(-expandX, -topExpand),
                size = Size(
                    width = size.width + 2f * expandX,
                    height = size.height + topExpand + bottomExpand
                ),
                cornerRadius = CornerRadius(currentCornerRadius, currentCornerRadius)
            )
        }
    }
}
`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/core/OutageEngine.kt',
    language: 'kotlin',
    description: 'Pure outage engine: two-day window, spans merged across midnight, alert plan',
    content: `package ua.blackout.prewarning.core

import ua.blackout.prewarning.data.KYIV_ZONE
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.temporal.ChronoUnit

/**
 * The single source of truth for "what is off when". Pure functions over a two-day window
 * (yesterday tail, today, tomorrow) of absolute Kyiv wall-clock instants, so an outage that
 * crosses midnight is one block with its real length everywhere: list, drum, countdown, alerts.
 *
 * Rules are specified in \`spec/OUTAGE_ENGINE.md\` and verified by the JSON files in \`spec/vectors/\`.
 */
object OutageEngine {

    // ---------------------------------------------------------------------------------------------
    // Building outages
    // ---------------------------------------------------------------------------------------------

    /** Accepts 48 half-hour cells or 24 hourly cells and returns 48, or null for anything else. */
    fun normalizeSlots(raw: List<Boolean>?): List<Boolean>? = when (raw?.size) {
        48 -> raw
        24 -> raw!!.flatMap { listOf(it, it) }
        else -> null
    }

    /**
     * Turns the ztoe day tables (true = power off) into planned outages. Contiguous off-cells are one
     * outage even across midnight when both days are known. A block that touches the end of the
     * last known day, whose next day is unknown, is flagged [Outage.mayContinue].
     */
    fun buildPlanned(
        today: LocalDate,
        todayOff: List<Boolean>?,
        tomorrowOff: List<Boolean>?,
        yesterdayOff: List<Boolean>? = null
    ): List<Outage> {
        val days: List<Pair<LocalDate, List<Boolean>>> = listOf(
            today.minusDays(1) to normalizeSlots(yesterdayOff),
            today to normalizeSlots(todayOff),
            today.plusDays(1) to normalizeSlots(tomorrowOff)
        ).mapNotNull { (d, s) -> s?.let { d to it } }
        if (days.isEmpty()) return emptyList()

        val knownDates = days.map { it.first }.toSet()
        val out = ArrayList<Outage>()
        var runStart: LocalDateTime? = null

        fun close(end: LocalDateTime, mayContinue: Boolean) {
            val s = runStart ?: return
            out.add(Outage(id = "planned_$s", kind = OutageKind.PLANNED, start = s, end = end, mayContinue = mayContinue))
            runStart = null
        }

        for ((day, slots) in days) {
            val dayStart = day.atStartOfDay()
            for (i in 0 until OutageConfig.SLOTS_PER_DAY) {
                val slotStart = dayStart.plusMinutes(i.toLong() * OutageConfig.SLOT_MINUTES)
                if (slots[i]) {
                    if (runStart == null) runStart = slotStart
                } else {
                    close(slotStart, mayContinue = false)
                }
            }
            if (runStart != null && day.plusDays(1) !in knownDates) {
                close(day.plusDays(1).atStartOfDay(), mayContinue = true)
            }
        }
        return out
    }

    /**
     * Resolves one emergency record against [now]. A listed outage past its estimated restore is
     * OVERDUE (still active) for [graceMinutes], then STALE (finished, never alerts).
     */
    fun resolveEmergency(
        rec: EmergencyRecord,
        now: LocalDateTime,
        graceMinutes: Long = OutageConfig.OVERDUE_GRACE_MINUTES
    ): Outage {
        val est = rec.estimatedEnd
        val closed = rec.closedAt
        var end: LocalDateTime
        var overdue = false
        var stale = false
        var isEstimate = false
        when {
            closed != null -> end = if (closed.isAfter(rec.start)) closed else rec.start
            est == null -> {
                end = if (now.isAfter(rec.start)) now else rec.start
                overdue = !now.isBefore(rec.start)
                isEstimate = true
            }
            now.isBefore(est) -> {
                end = est
                isEstimate = true
            }
            else -> {
                val overdueMinutes = ChronoUnit.MINUTES.between(est, now)
                isEstimate = true
                if (overdueMinutes <= graceMinutes) {
                    end = if (now.isAfter(est)) now else est
                    overdue = true
                } else {
                    end = est
                    stale = true
                }
            }
        }
        if (end.isBefore(rec.start)) end = rec.start
        return Outage(
            id = rec.id,
            kind = OutageKind.EMERGENCY,
            start = rec.start,
            end = end,
            endIsEstimate = isEstimate,
            overdue = overdue,
            stale = stale,
            label = rec.label
        )
    }

    /** Keeps only outages that touch [yesterday 00:00, tomorrow+1 00:00). Rows dated further ahead are ignored. */
    fun inWindow(outages: List<Outage>, today: LocalDate): List<Outage> {
        val from = today.minusDays(1).atStartOfDay()
        val to = today.plusDays(2).atStartOfDay()
        return outages.filter { it.start.isBefore(to) && it.end.isAfter(from) }
    }

    // ---------------------------------------------------------------------------------------------
    // Spans, day views, status
    // ---------------------------------------------------------------------------------------------

    /** Union of the outages of [kinds] (all kinds when null); touching or overlapping outages merge. */
    fun spans(outages: List<Outage>, kinds: Set<OutageKind>? = null): List<Span> {
        val items = outages
            .filter { (kinds == null || it.kind in kinds) && it.end.isAfter(it.start) }
            .sortedBy { it.start }
        val result = ArrayList<Span>()
        var curStart: LocalDateTime? = null
        var curEnd: LocalDateTime? = null
        var curMay = false
        var curKinds = LinkedHashSet<OutageKind>()
        for (o in items) {
            if (curStart == null || curEnd == null) {
                curStart = o.start
                curEnd = o.end
                curMay = o.mayContinue
                curKinds = linkedSetOf(o.kind)
            } else if (!o.start.isAfter(curEnd)) {
                if (o.end.isAfter(curEnd)) {
                    curEnd = o.end
                    curMay = o.mayContinue
                } else if (o.end == curEnd) {
                    curMay = curMay || o.mayContinue
                }
                curKinds.add(o.kind)
            } else {
                result.add(Span(curStart, curEnd, curMay, curKinds))
                curStart = o.start
                curEnd = o.end
                curMay = o.mayContinue
                curKinds = linkedSetOf(o.kind)
            }
        }
        if (curStart != null && curEnd != null) result.add(Span(curStart, curEnd, curMay, curKinds))
        return result
    }

    fun minutesBetween(a: LocalDateTime, b: LocalDateTime, zone: ZoneId = KYIV_ZONE): Long =
        ChronoUnit.MINUTES.between(a.atZone(zone), b.atZone(zone))

    fun secondsBetween(a: LocalDateTime, b: LocalDateTime, zone: ZoneId = KYIV_ZONE): Long =
        ChronoUnit.SECONDS.between(a.atZone(zone), b.atZone(zone))

    private fun maxOf(a: LocalDateTime, b: LocalDateTime) = if (a.isAfter(b)) a else b
    private fun minOf(a: LocalDateTime, b: LocalDateTime) = if (a.isBefore(b)) a else b

    /** The drum cells and list rows for one calendar day. Finished outages stay (history); they just never alert. */
    fun dayView(
        outages: List<Outage>,
        date: LocalDate,
        now: LocalDateTime,
        zone: ZoneId = KYIV_ZONE
    ): DayView {
        val dayStart = date.atStartOfDay()
        val dayEnd = date.plusDays(1).atStartOfDay()
        val relevant = outages.filter { it.end.isAfter(it.start) && it.start.isBefore(dayEnd) && it.end.isAfter(dayStart) }

        val slots = (0 until OutageConfig.SLOTS_PER_DAY).map { i ->
            val s = dayStart.plusMinutes(i.toLong() * OutageConfig.SLOT_MINUTES)
            val e = s.plusMinutes(OutageConfig.SLOT_MINUTES.toLong())
            SlotState(
                planned = relevant.any { it.isPlannedLike && it.start.isBefore(e) && it.end.isAfter(s) },
                emergency = relevant.any { it.isEmergencyLike && it.start.isBefore(e) && it.end.isAfter(s) }
            )
        }

        val rows = relevant
            .map { o ->
                val from = maxOf(o.start, dayStart)
                val to = minOf(o.end, dayEnd)
                DayRow(
                    outage = o,
                    from = from,
                    to = to,
                    status = o.statusAt(now),
                    continuesFromPrevDay = o.start.isBefore(dayStart),
                    continuesToNextDay = o.end.isAfter(dayEnd),
                    durationMinutes = minutesBetween(o.start, o.end, zone),
                    inDayMinutes = minutesBetween(from, to, zone)
                )
            }
            .sortedWith(compareBy<DayRow> { it.from }.thenBy { it.outage.kind.ordinal })

        val clipped = relevant.map { it.copy(start = maxOf(it.start, dayStart), end = minOf(it.end, dayEnd)) }
        val total = spans(clipped).sumOf { minutesBetween(it.start, it.end, zone) }
        return DayView(date, slots, rows, total)
    }

    private fun p2(n: Number): String = n.toString().padStart(2, '0')

    /** "HH:mm" (ASCII digits whatever the device locale); an end of exactly 00:00 reads "24:00". */
    fun formatSpanTime(t: LocalDateTime): String =
        if (t.toLocalTime() == LocalTime.MIDNIGHT) "24:00" else "\${p2(t.hour)}:\${p2(t.minute)}"

    fun formatSpan(span: Span): String =
        "\${p2(span.start.hour)}:\${p2(span.start.minute)} – \${formatSpanTime(span.end)}"

    fun formatCountdown(totalSeconds: Long): String {
        val s = totalSeconds.coerceAtLeast(0L)
        return "\${p2(s / 3600)}:\${p2((s % 3600) / 60)}:\${p2(s % 60)}"
    }

    /** Power state, countdown and next/current period from [now]. Stale emergencies never count as off. */
    fun status(
        outages: List<Outage>,
        now: LocalDateTime,
        zone: ZoneId = KYIV_ZONE
    ): StatusInfo {
        // An overdue emergency has no known end: treat it as lasting just past now so it is "current".
        val openEnd = now.plusSeconds(1)
        val effective = outages
            .filter { !it.stale }
            .map { if (it.overdue) it.copy(end = openEnd) else it }
        val all = spans(effective)
        val current = all.firstOrNull { !now.isBefore(it.start) && now.isBefore(it.end) }

        if (current != null) {
            if (current.end == openEnd && effective.any { it.overdue }) {
                return StatusInfo(
                    isOffNow = true,
                    countdownSeconds = null,
                    countdownText = "--:--:--",
                    nextSlotTime = "\${p2(current.start.hour)}:\${p2(current.start.minute)} – --:--",
                    currentSpan = current.copy(end = now),
                    nextSpan = null
                )
            }
            val secs = secondsBetween(now, current.end, zone)
            return StatusInfo(true, secs, formatCountdown(secs), formatSpan(current), current, null)
        }
        val next = all.firstOrNull { it.start.isAfter(now) }
        if (next != null) {
            val secs = secondsBetween(now, next.start, zone)
            return StatusInfo(false, secs, formatCountdown(secs), formatSpan(next), null, next)
        }
        return StatusInfo(false, null, "--:--:--", "Відключень немає", null, null)
    }

    // ---------------------------------------------------------------------------------------------
    // Alerts and widget transitions
    // ---------------------------------------------------------------------------------------------

    /**
     * One pre-warning per merged planned span (the ztoe schedule only; repair works get none), keyed by the span's
     * absolute start. Spans already started, or whose alert time has passed, never alert; a 00:00
     * continuation never gets its own alert because it is part of the earlier span.
     */
    fun planAlerts(
        outages: List<Outage>,
        now: LocalDateTime,
        advanceMinutes: Int,
        zone: ZoneId = KYIV_ZONE
    ): List<AlertSpec> {
        val plannedSpans = spans(outages.filter { !it.stale }, setOf(OutageKind.PLANNED))
        val emergencies = outages.filter { it.isEmergencyLike && !it.stale }
        return plannedSpans.mapNotNull { sp ->
            if (!sp.start.isAfter(now)) return@mapNotNull null
            // One continuous outage, one warning (spec/OUTAGE_ENGINE.md 6.2 step 2a): an emergency that started
            // (or a repair work) before the block and still on at its start means power is already off
            if (emergencies.any { it.start.isBefore(sp.start) && (it.overdue || !it.end.isBefore(sp.start)) }) return@mapNotNull null
            val fireAt = sp.start.minusMinutes(advanceMinutes.toLong())
            if (!fireAt.isAfter(now)) return@mapNotNull null
            AlertSpec(
                key = "planned_\${sp.start}",
                fireAt = fireAt,
                spanStart = sp.start,
                spanEnd = sp.end,
                mayContinue = sp.mayContinue,
                durationMinutes = minutesBetween(sp.start, sp.end, zone)
            )
        }
    }

    /** The planned (ztoe schedule) spans of an address, not stale: what its pre-warnings are about. */
    fun plannedSpans(outages: List<Outage>): List<Span> =
        spans(outages.filter { !it.stale }, setOf(OutageKind.PLANNED))

    /**
     * Whether an emergency event is announced when emergency and scheduled outages of one address form
     * one continuous outage (spec/NOTIFICATIONS.md 2.4a): only its beginning is announced, a longer
     * emergency inside a warned block becomes a prolongation, and the end is not "restored" while the
     * schedule keeps the power off.
     */
    fun emergencyDelivery(
        kind: EmergencyEventKind,
        start: LocalDateTime,
        eta: LocalDateTime?,
        now: LocalDateTime,
        plannedSpans: List<Span>,
        plannedAlertsOn: Boolean
    ): EmergencyDelivery = when (kind) {
        EmergencyEventKind.ETA_CHANGED -> EmergencyDelivery.SEND
        EmergencyEventKind.END ->
            if (plannedSpans.any { !it.start.isAfter(now) && now.isBefore(it.end) }) EmergencyDelivery.DROP else EmergencyDelivery.SEND
        EmergencyEventKind.START -> {
            val holder = if (plannedAlertsOn) plannedSpans.firstOrNull { !it.start.isAfter(start) && !start.isAfter(it.end) } else null
            when {
                holder == null -> EmergencyDelivery.SEND
                eta != null && eta.isAfter(holder.end) -> EmergencyDelivery.PROLONG
                else -> EmergencyDelivery.DROP
            }
        }
    }

    /** Instants where the power state flips (all kinds, stale excluded), inclusive of [from] and [to]. */
    fun transitions(outages: List<Outage>, from: LocalDateTime, to: LocalDateTime): List<Transition> =
        spans(outages.filter { !it.stale && !it.overdue })
            .flatMap { listOf(Transition(it.start, true), Transition(it.end, false)) }
            .filter { !it.at.isBefore(from) && !it.at.isAfter(to) }
            .sortedBy { it.at }
}

/** How one emergency event is announced within a continuous outage (spec/NOTIFICATIONS.md 2.4a). */
enum class EmergencyDelivery { SEND, PROLONG, DROP }
`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/core/OutageModels.kt',
    language: 'kotlin',
    description: 'Outage kinds, spans, day views and alert plan models',
    content: `package ua.blackout.prewarning.core

import java.time.LocalDateTime

/**
 * Platform-neutral outage model. Everything in \`core/\` is pure Kotlin (java.time only) so the same
 * rules can be ported to TypeScript and Swift and verified against the JSON files in \`spec/vectors/\`.
 *
 * All instants are Kyiv wall-clock [LocalDateTime]s. Durations are measured as elapsed time in the
 * Kyiv zone so a span over a DST night is counted correctly.
 */
object OutageConfig {
    const val SLOTS_PER_DAY = 48
    const val SLOT_MINUTES = 30

    /** An emergency still listed by PowerOn this long after its estimated restore is "overdue" (still active). */
    const val OVERDUE_GRACE_MINUTES = 60L

    /** Ledger entries older than this (since last sighting or close) are dropped. */
    const val LEDGER_RETENTION_HOURS = 48L

    /** A changed restore estimate notifies only when it moved by at least this much. */
    const val ETA_CHANGE_MIN_DELTA_MINUTES = 10L
}

/**
 * What produced an outage. REPAIR (PowerOn "possible planned works") is treated like EMERGENCY: it counts
 * as off and is drawn in the emergency half of the drum, but never gets a pre-warning (owner, 2026-11-18).
 */
enum class OutageKind { PLANNED, REPAIR, EMERGENCY }

enum class IntervalStatus { FINISHED, ACTIVE, UPCOMING, OVERDUE }

data class Outage(
    val id: String,
    val kind: OutageKind,
    val start: LocalDateTime,
    /** Effective end. For a listed emergency past its estimate this is "now" while within the grace. */
    val end: LocalDateTime,
    /** The block touches the end of the known schedule window, so the real end may be later. */
    val mayContinue: Boolean = false,
    val endIsEstimate: Boolean = false,
    /** Emergency still listed after its estimated restore, within the grace: treated as active. */
    val overdue: Boolean = false,
    /** Emergency still listed but beyond the grace: shown as finished, never alerts. */
    val stale: Boolean = false,
    val label: String? = null
) {
    /** Scheduled by the ztoe table: the only kind that gets pre-warnings and the planned half of the drum. */
    val isPlannedLike: Boolean get() = kind == OutageKind.PLANNED

    /** EMERGENCY or REPAIR: drawn in the emergency half of the drum. */
    val isEmergencyLike: Boolean get() = kind == OutageKind.EMERGENCY || kind == OutageKind.REPAIR

    fun statusAt(now: LocalDateTime): IntervalStatus = when {
        stale -> IntervalStatus.FINISHED
        now.isBefore(start) -> IntervalStatus.UPCOMING
        overdue -> IntervalStatus.OVERDUE
        now.isBefore(end) -> IntervalStatus.ACTIVE
        else -> IntervalStatus.FINISHED
    }
}

/** One emergency outage as observed from PowerOn (or restored from the ledger). */
data class EmergencyRecord(
    val id: String,
    val start: LocalDateTime,
    val estimatedEnd: LocalDateTime?,
    /** Set by the ledger when a confirmed fetch no longer lists the outage. */
    val closedAt: LocalDateTime? = null,
    val label: String? = null
)

/** A maximal union of outages that touch or overlap. */
data class Span(
    val start: LocalDateTime,
    val end: LocalDateTime,
    val mayContinue: Boolean,
    val kinds: Set<OutageKind>
)

/** State of one half-hour cell of a day on the drum chart. */
data class SlotState(val planned: Boolean, val emergency: Boolean) {
    val off: Boolean get() = planned || emergency
}

/** One outage as it appears in a day's list, clipped to that day. */
data class DayRow(
    val outage: Outage,
    val from: LocalDateTime,
    val to: LocalDateTime,
    val status: IntervalStatus,
    val continuesFromPrevDay: Boolean,
    val continuesToNextDay: Boolean,
    /** Full length of the outage in minutes (not clipped to the day). */
    val durationMinutes: Long,
    /** Minutes of the outage that fall inside this day. */
    val inDayMinutes: Long
)

data class DayView(
    val date: java.time.LocalDate,
    val slots: List<SlotState>,
    val rows: List<DayRow>,
    /** Union of all kinds, clipped to the day, in elapsed minutes. */
    val totalOffMinutes: Long
)

data class StatusInfo(
    val isOffNow: Boolean,
    val countdownSeconds: Long?,
    /** HH:MM:SS, or "--:--:--" when nothing is ahead. */
    val countdownText: String,
    /** "HH:mm – HH:mm" of the current or next span, or "Відключень немає". */
    val nextSlotTime: String,
    val currentSpan: Span?,
    val nextSpan: Span?
)

data class AlertSpec(
    val key: String,
    val fireAt: LocalDateTime,
    val spanStart: LocalDateTime,
    val spanEnd: LocalDateTime,
    val mayContinue: Boolean,
    val durationMinutes: Long
)

data class Transition(val at: LocalDateTime, val isOff: Boolean)
`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/core/EmergencyLedger.kt',
    language: 'kotlin',
    description: 'Per-address record of seen emergency outages (START / ETA_CHANGED / END)',
    content: `package ua.blackout.prewarning.core

import java.time.LocalDateTime
import java.time.temporal.ChronoUnit
import kotlin.math.abs

/** Result of asking PowerOn about one address. An empty confirmed list means "no emergency", not "failed". */
sealed interface EmergencyFetch {
    data class Confirmed(val records: List<EmergencyRecord>) : EmergencyFetch
    data class Unavailable(val reason: String) : EmergencyFetch
}

/** One emergency outage seen for an address, with what has already been announced about it. */
data class LedgerEntry(
    val id: String,
    val start: LocalDateTime,
    val estimatedEnd: LocalDateTime?,
    val label: String?,
    val firstSeen: LocalDateTime,
    val lastSeen: LocalDateTime,
    val closedAt: LocalDateTime?,
    val startEmitted: Boolean,
    val endEmitted: Boolean,
    val lastEmittedEta: LocalDateTime?
)

enum class EmergencyEventKind { START, ETA_CHANGED, END }

data class EmergencyEvent(
    val kind: EmergencyEventKind,
    val entryId: String,
    val start: LocalDateTime,
    val eta: LocalDateTime?,
    /** START only: the outage begins in the future. */
    val upcoming: Boolean = false,
    /** END only: it disappeared before its estimated restore (restored early or cancelled). */
    val earlyEnd: Boolean = false
) {
    /** Platform-neutral dedupe key, see \`spec/NOTIFICATIONS.md\`. */
    fun key(addressKey: String): String = when (kind) {
        EmergencyEventKind.START -> "emerg_start_\${addressKey}_$start"
        EmergencyEventKind.ETA_CHANGED -> "emerg_change_\${addressKey}_\${start}_$eta"
        EmergencyEventKind.END -> "emerg_end_\${addressKey}_$start"
    }
}

data class LedgerResult(val entries: List<LedgerEntry>, val events: List<EmergencyEvent>)

/**
 * Remembers emergencies per address so that:
 *  - a failed fetch never looks like "power restored" (Unavailable changes nothing),
 *  - an outage that was already over when first seen never alerts,
 *  - finished emergencies of today stay listable (PowerOn keeps no history),
 *  - each transition (start / eta changed / end) is announced exactly once.
 */
object EmergencyLedger {

    fun reconcile(
        entries: List<LedgerEntry>,
        fetch: EmergencyFetch,
        now: LocalDateTime,
        graceMinutes: Long = OutageConfig.OVERDUE_GRACE_MINUTES
    ): LedgerResult {
        val pruned = prune(entries, now)
        if (fetch is EmergencyFetch.Unavailable) return LedgerResult(pruned, emptyList())
        fetch as EmergencyFetch.Confirmed

        val byId = pruned.associateBy { it.id }
        val events = ArrayList<EmergencyEvent>()
        val out = LinkedHashMap<String, LedgerEntry>()
        val seen = HashSet<String>()
        // Open entries PowerOn stopped listing: a listed record overlapping one is the same outage
        // re-registered under a new start (continuation, spec/NOTIFICATIONS.md 2.2)
        val listed = fetch.records.map { it.id }.toHashSet()
        val vanished = pruned.filter { it.closedAt == null && it.id !in listed }
        val absorbed = HashSet<String>()

        for (rec in fetch.records) {
            if (!seen.add(rec.id)) continue
            val resolved = OutageEngine.resolveEmergency(rec.copy(closedAt = null), now, graceMinutes)
            val old = byId[rec.id]
            val continued = if (old == null) vanished.firstOrNull { it.id !in absorbed && overlaps(it, rec) } else null
            when {
                continued != null -> {
                    absorbed.add(continued.id)
                    var e = newEntry(rec, now, announced = continued.endEmitted).copy(
                        firstSeen = continued.firstSeen,
                        startEmitted = continued.startEmitted,
                        lastEmittedEta = continued.lastEmittedEta
                    )
                    if (!resolved.stale && e.startEmitted && !e.endEmitted) {
                        val newEta = rec.estimatedEnd
                        val last = continued.lastEmittedEta
                        if (newEta != null && last == null) {
                            e = e.copy(lastEmittedEta = newEta)
                        } else if (newEta != null && last != null &&
                            abs(ChronoUnit.MINUTES.between(last, newEta)) >= OutageConfig.ETA_CHANGE_MIN_DELTA_MINUTES
                        ) {
                            events.add(EmergencyEvent(EmergencyEventKind.ETA_CHANGED, rec.id, rec.start, newEta))
                            e = e.copy(lastEmittedEta = newEta)
                        }
                    }
                    out[rec.id] = e
                }
                old == null -> {
                    if (resolved.stale) {
                        out[rec.id] = newEntry(rec, now, announced = true)
                    } else {
                        out[rec.id] = newEntry(rec, now, announced = false)
                        events.add(EmergencyEvent(EmergencyEventKind.START, rec.id, rec.start, rec.estimatedEnd, upcoming = now.isBefore(rec.start)))
                    }
                }
                old.closedAt != null -> {
                    if (resolved.stale) {
                        out[rec.id] = old.copy(lastSeen = now)
                    } else {
                        out[rec.id] = newEntry(rec, now, announced = false).copy(firstSeen = old.firstSeen)
                        events.add(EmergencyEvent(EmergencyEventKind.START, rec.id, rec.start, rec.estimatedEnd, upcoming = now.isBefore(rec.start)))
                    }
                }
                else -> {
                    var e = old.copy(lastSeen = now, estimatedEnd = rec.estimatedEnd, label = rec.label ?: old.label)
                    if (!resolved.stale && old.startEmitted && !old.endEmitted) {
                        val newEta = rec.estimatedEnd
                        val last = old.lastEmittedEta
                        if (newEta != null && last == null) {
                            e = e.copy(lastEmittedEta = newEta)
                        } else if (newEta != null && last != null &&
                            abs(ChronoUnit.MINUTES.between(last, newEta)) >= OutageConfig.ETA_CHANGE_MIN_DELTA_MINUTES
                        ) {
                            events.add(EmergencyEvent(EmergencyEventKind.ETA_CHANGED, rec.id, rec.start, newEta))
                            e = e.copy(lastEmittedEta = newEta)
                        }
                    }
                    out[rec.id] = e
                }
            }
        }

        for (old in pruned) {
            if (old.id in seen) continue
            if (old.closedAt != null) {
                out[old.id] = old
                continue
            }
            // Taken over by a new record, or covered by a listed one: the outage goes on, nothing ended
            if (old.id in absorbed || fetch.records.any { overlaps(old, it) }) continue
            val est = old.estimatedEnd
            val wasStale = est != null && ChronoUnit.MINUTES.between(est, now) > graceMinutes
            val silent = old.endEmitted || wasStale || !old.startEmitted
            out[old.id] = old.copy(closedAt = now, endEmitted = true)
            if (!silent) {
                events.add(EmergencyEvent(EmergencyEventKind.END, old.id, old.start, est, earlyEnd = est != null && now.isBefore(est)))
            }
        }
        return LedgerResult(out.values.toList(), events)
    }

    /** The entry's time and the record's time overlap or touch; a missing estimate is open-ended. */
    private fun overlaps(e: LedgerEntry, r: EmergencyRecord): Boolean {
        val eEnd = e.estimatedEnd
        val rEnd = r.estimatedEnd
        return (rEnd == null || !e.start.isAfter(rEnd)) && (eEnd == null || !r.start.isAfter(eEnd))
    }

    private fun newEntry(rec: EmergencyRecord, now: LocalDateTime, announced: Boolean) = LedgerEntry(
        id = rec.id,
        start = rec.start,
        estimatedEnd = rec.estimatedEnd,
        label = rec.label,
        firstSeen = now,
        lastSeen = now,
        closedAt = null,
        startEmitted = true,
        endEmitted = announced,
        lastEmittedEta = rec.estimatedEnd
    )

    fun prune(entries: List<LedgerEntry>, now: LocalDateTime): List<LedgerEntry> {
        val cutoff = now.minusHours(OutageConfig.LEDGER_RETENTION_HOURS)
        return entries.filter { (it.closedAt ?: it.lastSeen).isAfter(cutoff) }
    }

    /** Ledger entries as outages for the engine (active, overdue, stale and closed ones alike). */
    fun outages(entries: List<LedgerEntry>, now: LocalDateTime): List<Outage> = entries.map {
        OutageEngine.resolveEmergency(EmergencyRecord(it.id, it.start, it.estimatedEnd, it.closedAt, it.label), now)
    }
}
`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/core/AddressKeys.kt',
    language: 'kotlin',
    description: 'StreetKey / HouseKey: merge duplicate streets and compare houses',
    content: `package ua.blackout.prewarning.core

/**
 * Canonical keys for matching street and house names across ztoe.com.ua, PowerOn and the device
 * cache. Specified in \`spec/ADDRESS_KEY.md\`; the real duplicate pairs found on both sites are in
 * \`spec/vectors/address_keys.json\`.
 */
object TextNorm {
    private val NUMERIC_ENTITY = Regex("&#([xX][0-9a-fA-F]+|[0-9]+);")
    private val NAMED_ENTITY = Regex("&([a-zA-Z]+);")
    private val NAMED = mapOf(
        "amp" to "&", "lt" to "<", "gt" to ">", "quot" to "\\"", "apos" to "'", "nbsp" to " ",
        "rsquo" to "’", "lsquo" to "‘", "ndash" to "–", "mdash" to "—",
        "laquo" to "«", "raquo" to "»", "hellip" to "…"
    )

    /** Decodes numeric and common named entities; repeats so \`&amp;#039;\` (double escaped) also becomes \`'\`. */
    fun decodeEntities(raw: String): String {
        var s = raw
        repeat(3) {
            if (!s.contains('&')) return s
            val before = s
            s = NUMERIC_ENTITY.replace(s) { m ->
                val v = m.groupValues[1]
                val cp = if (v[0] == 'x' || v[0] == 'X') v.substring(1).toIntOrNull(16) else v.toIntOrNull()
                if (cp != null && cp in 1..0x10FFFF) String(Character.toChars(cp)) else m.value
            }
            s = NAMED_ENTITY.replace(s) { m -> NAMED[m.groupValues[1].lowercase()] ?: m.value }
            if (s == before) return s
        }
        return s
    }

    /**
     * Maps letters that look identical in Latin and Cyrillic to one skeleton letter, so
     * \`16A\` (Latin) and \`16А\` (Cyrillic) compare equal. Input must already be lower-case.
     */
    fun skeleton(lower: String): String {
        val sb = StringBuilder(lower.length)
        for (ch in lower) sb.append(CONFUSABLE[ch] ?: ch)
        return sb.toString()
    }

    private val CONFUSABLE: Map<Char, Char> = mapOf(
        'а' to 'a', 'в' to 'b', 'с' to 'c', 'е' to 'e', 'н' to 'h', 'і' to 'i',
        'к' to 'k', 'м' to 'm', 'о' to 'o', 'р' to 'p', 'т' to 't', 'х' to 'x', 'у' to 'y'
    )

    /** All apostrophe-like characters seen in street names. */
    const val APOSTROPHES = "'’ʼ‘´\`ʻ′"
}

object StreetKey {
    private val INITIAL_DOT_SPACE = Regex("(?<![\\\\p{L}\\\\p{N}])(\\\\p{L})\\\\.\\\\s+(?=\\\\p{L})")
    private val SPACES = Regex("[\\\\s\\\\u00A0\\\\u200B]+")

    private val TYPES: Map<String, String> = mapOf(
        "вулиця" to "вул", "вул" to "вул",
        "провулок" to "пров", "пров" to "пров", "пр-к" to "пров",
        "проспект" to "просп", "просп" to "просп", "пр-т" to "просп",
        "бульвар" to "б-р", "бульв" to "б-р", "бул" to "б-р", "б-р" to "б-р",
        "площа" to "пл", "пл" to "пл",
        "проїзд" to "пр-д", "пр-д" to "пр-д",
        "узвіз" to "узв", "узв" to "узв",
        "тупик" to "туп", "туп" to "туп",
        "набережна" to "наб", "наб" to "наб",
        "шосе" to "шосе",
        "майдан" to "майдан", "м-н" to "майдан"
    )

    /** True for a street-type word of the table above (\`вул.\`, \`Провулок\`, \`б-р\` …), compared lower-case without trailing dots. */
    fun isTypeWord(token: String): Boolean = TYPES.containsKey(token.lowercase().trimEnd('.'))

    /** Stable comparison key. See \`spec/ADDRESS_KEY.md\` for the step list. */
    fun of(raw: String): String {
        var s = TextNorm.decodeEntities(raw).lowercase()
        s = s.filter { TextNorm.APOSTROPHES.indexOf(it) < 0 }
        s = SPACES.replace(s, " ").trim()
        s = INITIAL_DOT_SPACE.replace(s) { "\${it.groupValues[1]}." }
        val tokens = s.split(' ').filter { it.isNotEmpty() }.map { token ->
            TYPES[token.trimEnd('.')] ?: token
        }
        return TextNorm.skeleton(tokens.joinToString(" "))
    }
}

object HouseKey {
    // "будинок" must come before "буд\\.?", otherwise the shorter alternative eats its first letters
    private val PREFIX = Regex("^(?:будинок|буд\\\\.?|№)\\\\s*")
    private val JUNK = Regex("[\\\\s'\\"«»’ʼ\`.]+")
    private val HYPHEN_BEFORE_LETTER = Regex("(?<=\\\\p{N})-(?=\\\\p{L})")

    /** \`34-А\`, \`34 А\`, \`34А\` and \`34A\` (Latin) share one key; \`14/а\` keeps its slash. */
    fun of(raw: String): String {
        var s = TextNorm.decodeEntities(raw).lowercase().trim()
        s = PREFIX.replace(s, "")
        s = JUNK.replace(s, "")
        s = HYPHEN_BEFORE_LETTER.replace(s, "")
        return TextNorm.skeleton(s)
    }

    /** PowerOn \`buildingNames\` is a comma separated list ("1, 10, 43А, 51а, 14/а"). */
    fun tokens(buildingNames: String): List<String> =
        buildingNames.split(',', ';').map { it.trim() }.filter { it.isNotEmpty() }

    fun listContains(buildingNames: String, house: String): Boolean {
        val target = of(house)
        if (target.isEmpty()) return false
        return tokens(buildingNames).any { of(it) == target }
    }
}
`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/core/PowerOnMapper.kt',
    language: 'kotlin',
    description: 'Maps PowerOn rows (Kyiv wall-clock labelled +00:00) to outages',
    content: `package ua.blackout.prewarning.core

import java.time.LocalDate
import java.time.LocalDateTime

/** One row of \`pw_accidents\` / \`pw_accident_planeds\` from the PowerOn API, reduced to plain types. */
data class PowerOnRow(
    val id: Long,
    val cityId: Int?,
    val cityName: String,
    val streetId: Int?,
    val streetName: String,
    val dateEvent: String,
    val datePlanIn: String,
    val koment: String?,
    /** 2 = mirror of the hourly schedule (GPV), anything else is a real emergency. Absent on planned works. */
    val switchSubReason: Int?,
    val typeOff: Int?,
    /** Comma separated list of affected buildings on the street. */
    val buildingNames: String
)

/**
 * Maps PowerOn rows to outages for one house. See \`spec/POWERON_API.md\`.
 *
 * PowerOn timestamps look like \`2026-11-12T22:04:40+00:00\` but are Kyiv wall-clock time with a wrong
 * offset label (verified: the mirror of queue 3.1 reads 22:04 to 00:04 while ztoe shows 22:00-24:00).
 * The offset is therefore ignored, never converted.
 */
object PowerOnMapper {
    private val ISO = Regex("^\\\\s*(\\\\d{4})-(\\\\d{2})-(\\\\d{2})[T ](\\\\d{2}):(\\\\d{2})(?::\\\\d{2}(?:\\\\.\\\\d+)?)?")

    /** Minute precision; the \`+00:00\` / \`Z\` suffix is deliberately dropped. */
    fun parseTime(raw: String?): LocalDateTime? {
        val m = ISO.find(raw ?: return null) ?: return null
        return runCatching {
            LocalDateTime.of(
                m.groupValues[1].toInt(), m.groupValues[2].toInt(), m.groupValues[3].toInt(),
                m.groupValues[4].toInt(), m.groupValues[5].toInt()
            )
        }.getOrNull()
    }

    /** Real emergencies for [house] (switchSubReason != 2), merged per start time. */
    fun emergencyRecordsFor(rows: List<PowerOnRow>, house: String): List<EmergencyRecord> {
        val byId = LinkedHashMap<String, EmergencyRecord>()
        for (row in rows) {
            if (row.switchSubReason == 2) continue
            if (!HouseKey.listContains(row.buildingNames, house)) continue
            val start = parseTime(row.dateEvent) ?: continue
            val est = parseTime(row.datePlanIn)?.takeIf { it.isAfter(start) }
            val id = "pw_$start"
            val label = row.koment?.trim()?.takeIf { it.isNotEmpty() }
            val old = byId[id]
            byId[id] = if (old == null) {
                EmergencyRecord(id, start, est, null, label)
            } else {
                old.copy(
                    estimatedEnd = listOfNotNull(old.estimatedEnd, est).maxOrNull(),
                    label = old.label ?: label
                )
            }
        }
        return mergeOverlapping(byId.values.sortedBy { it.start })
    }

    /**
     * Records whose times overlap or touch are one outage (spec/POWERON_API.md 5.1 step 7): operators
     * re-register an ongoing outage as a new row when its estimate runs out. The merged record keeps the
     * id and start of the earliest and the latest estimate; a record without an estimate is open-ended.
     */
    private fun mergeOverlapping(sorted: List<EmergencyRecord>): List<EmergencyRecord> {
        val out = ArrayList<EmergencyRecord>(sorted.size)
        for (rec in sorted) {
            val last = out.lastOrNull()
            val lastEnd = last?.estimatedEnd
            if (last != null && (lastEnd == null || !rec.start.isAfter(lastEnd))) {
                out[out.lastIndex] = last.copy(
                    estimatedEnd = listOfNotNull(lastEnd, rec.estimatedEnd).maxOrNull(),
                    label = last.label ?: rec.label
                )
            } else {
                out.add(rec)
            }
        }
        return out
    }

    /** Planned repair works for [house]; treated as planned outages. Rows beyond tomorrow are dropped. */
    fun repairOutagesFor(rows: List<PowerOnRow>, house: String, today: LocalDate): List<Outage> {
        val byId = LinkedHashMap<String, Outage>()
        val limit = today.plusDays(2).atStartOfDay()
        for (row in rows) {
            if (!HouseKey.listContains(row.buildingNames, house)) continue
            val start = parseTime(row.dateEvent) ?: continue
            val end = parseTime(row.datePlanIn) ?: continue
            if (!end.isAfter(start) || !start.isBefore(limit)) continue
            val id = "repair_$start"
            val label = row.koment?.trim()?.takeIf { it.isNotEmpty() }
            val old = byId[id]
            byId[id] = if (old == null) {
                Outage(id, OutageKind.REPAIR, start, end, label = label)
            } else {
                old.copy(end = if (end.isAfter(old.end)) end else old.end, label = old.label ?: label)
            }
        }
        return byId.values.sortedBy { it.start }
    }
}
`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/core/SiteState.kt',
    language: 'kotlin',
    description: 'Four ZTOE site states shown on the main screen',
    content: `package ua.blackout.prewarning.core

/**
 * What the user should be told about the ztoe.com.ua schedule site. See \`spec/SITE_STATE.md\`.
 *  - AVAILABLE_WITH_TABLE: the site answered and today's schedule table is present.
 *  - AVAILABLE_NO_TABLE: the site answered but there is no schedule table (not published, or layout changed).
 *  - SITE_UNREACHABLE: the device has working internet but the site did not answer (DNS, timeout, TLS, HTTP error).
 *  - NO_INTERNET: the device itself has no validated internet connection.
 */
enum class SiteState { AVAILABLE_WITH_TABLE, AVAILABLE_NO_TABLE, SITE_UNREACHABLE, NO_INTERNET }

/** Why a request failed, independent of the platform's exception types. */
enum class FetchFailure { NONE, DNS, CONNECT, TIMEOUT, TLS, HTTP_ERROR, OTHER }

object SiteStateResolver {
    /**
     * [networkValidated] is the operating system's own verdict that the device has working internet
     * (Android \`NET_CAPABILITY_VALIDATED\`, iOS \`NWPath.status == .satisfied\`). No third-party host is
     * contacted to decide it.
     */
    fun resolve(failure: FetchFailure, hasTodayTable: Boolean, networkValidated: Boolean): SiteState = when {
        failure != FetchFailure.NONE -> if (networkValidated) SiteState.SITE_UNREACHABLE else SiteState.NO_INTERNET
        hasTodayTable -> SiteState.AVAILABLE_WITH_TABLE
        else -> SiteState.AVAILABLE_NO_TABLE
    }
}
`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/core/SiteNotice.kt',
    language: 'kotlin',
    description: 'Extracts the "УВАГА! ВАЖЛИВА ІНФОРМАЦІЯ!" notice when ztoe has no table',
    content: `package ua.blackout.prewarning.core

/**
 * Extracts the notice ztoe publishes in place of the schedule ("УВАГА! ВАЖЛИВА ІНФОРМАЦІЯ!",
 * for example "Графіки погодинних відключень електроенергії наразі не діють"). Regex based on purpose,
 * so Kotlin, TypeScript and Swift give the same text for the same page (spec/SITE_STATE.md, section
 * "Site notice"; vectors in site_notice.json).
 *
 * Rules: find the marker (case-insensitive, any whitespace or \`&nbsp;\` between the words); the block
 * ends at the first closing \`h1\`-\`h6\`, \`p\`, \`div\`, \`td\`, \`center\` tag, an opening \`table\`/\`hr\`, or after
 * [MAX_SCAN] characters. Inside it \`<br>\` is a line break, other tags are dropped, entities are decoded,
 * every line is trimmed with its whitespace collapsed, and empty lines are removed. The result keeps
 * the marker as its first line and is cut at [MAX_LENGTH] characters on a line boundary (with "…").
 * Returns null when there is no marker or nothing follows it.
 */
object SiteNotice {
    const val MAX_SCAN = 4000
    const val MAX_LENGTH = 1000

    /** ASCII whitespace plus the no-break space; spelled out so Kotlin, JS and Swift agree. */
    private const val WS = "[ \\\\t\\\\n\\\\x0B\\\\f\\\\r\\\\u00A0]"

    private val MARKER = Regex(
        "УВАГА!(?:$WS|&nbsp;)*ВАЖЛИВА(?:$WS|&nbsp;)+ІНФОРМАЦІЯ!?",
        RegexOption.IGNORE_CASE
    )
    private val BLOCK_END = Regex("</(?:h[1-6]|p|div|td|center)\\\\s*>|<(?:table|hr)\\\\b", RegexOption.IGNORE_CASE)
    private val BR = Regex("<br\\\\s*/?>", RegexOption.IGNORE_CASE)
    private val TAG = Regex("<[^>]*>")
    private val SPACES = Regex("$WS+")

    fun extract(html: String): String? {
        val m = MARKER.find(html) ?: return null
        val from = m.range.first
        val scanEnd = minOf(html.length, m.range.last + 1 + MAX_SCAN)
        val end = BLOCK_END.find(html.substring(m.range.last + 1, scanEnd))
            ?.let { m.range.last + 1 + it.range.first } ?: scanEnd
        val block = html.substring(from, end)

        // Source line breaks are plain whitespace; only <br> starts a new line
        val text = TextNorm.decodeEntities(BR.replace(block.replace(SPACES, " "), "\\n").replace(TAG, ""))
        val lines = text.split('\\n')
            .map { it.replace(SPACES, " ").trim() }
            .filter { it.isNotEmpty() }
        if (lines.size < 2) return null

        val out = StringBuilder()
        for (line in lines) {
            val add = if (out.isEmpty()) line.length else line.length + 1
            if (out.length + add > MAX_LENGTH) {
                out.append("\\n…")
                break
            }
            if (out.isNotEmpty()) out.append('\\n')
            out.append(line)
        }
        return out.toString()
    }
}
`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/data/poweron/PowerOnClient.kt',
    language: 'kotlin',
    description: 'PowerOn JSON API client (dotted filters, pagination=false)',
    content: `package ua.blackout.prewarning.data.poweron

import org.json.JSONArray
import org.json.JSONObject
import ua.blackout.prewarning.core.EmergencyFetch
import ua.blackout.prewarning.core.HouseKey
import ua.blackout.prewarning.core.Outage
import ua.blackout.prewarning.core.PowerOnMapper
import ua.blackout.prewarning.core.PowerOnRow
import ua.blackout.prewarning.core.StreetKey
import ua.blackout.prewarning.core.TextNorm
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.time.LocalDate
import java.time.LocalDateTime

/** The only network seam of the PowerOn client, so tests can replace it. */
fun interface HttpGet {
    @Throws(IOException::class)
    fun get(url: String): String
}

class UrlConnectionHttpGet(
    private val connectTimeoutMs: Int = 8_000,
    private val readTimeoutMs: Int = 8_000
) : HttpGet {
    override fun get(url: String): String {
        val conn = URL(url).openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "GET"
            conn.connectTimeout = connectTimeoutMs
            conn.readTimeout = readTimeoutMs
            conn.setRequestProperty("Accept", "application/json")
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Android; ZTBlackoutPreWarning)")
            val code = conn.responseCode
            if (code !in 200..299) throw IOException("HTTP $code")
            return conn.inputStream.use { String(it.readBytes(), Charsets.UTF_8) }
        } finally {
            conn.disconnect()
        }
    }
}

/** What identifies the address on PowerOn. Names come from ztoe; ids are cached after the first resolution. */
data class PowerOnTarget(
    val remOtgId: Int?,
    val settlementName: String,
    /** Names of every ztoe street option merged into the selected street (duplicates keep all names). */
    val streetNames: List<String>,
    val house: String,
    val cachedCityIds: List<Int> = emptyList(),
    val cachedStreetIds: List<Int> = emptyList()
)

data class PowerOnIds(val cityIds: List<Int>, val streetIds: List<Int>)

/**
 * Outcome of one PowerOn refresh for an address. [repairs] is null when the planned-works request
 * failed (keep what was known); [emergency] is Unavailable when the accidents request failed.
 */
data class PowerOnResult(
    val emergency: EmergencyFetch,
    val repairs: List<Outage>?,
    val ids: PowerOnIds?
)

/**
 * Per-address PowerOn queries. Everything here follows \`spec/POWERON_API.md\`:
 *  - only the dotted filters work (\`street.id[]\`, \`city.id\`, \`otg.id\`); \`street=\`, \`otg=\` are ignored by the server,
 *  - \`pagination=false\` is required (default page size is 30 of thousands of rows),
 *  - timestamps are Kyiv wall-clock despite the \`+00:00\` label (handled in [PowerOnMapper.parseTime]),
 *  - a failed request is Unavailable, never "no outage".
 */
class PowerOnClient(private val http: HttpGet = UrlConnectionHttpGet()) {

    companion object {
        const val BASE_URL = "https://api-ztoe-poweron.inneti.net/api"
        const val IDS_TTL_MS = 7L * 24 * 60 * 60 * 1000
        private val CITY_PREFIX = Regex("^(?:м\\\\.|місто|с\\\\.|село|смт\\\\.?|селище)\\\\s*", RegexOption.IGNORE_CASE)
        private val PARENS = Regex("\\\\([^)]*\\\\)")
        private const val EMERGENCY_REASONS = "switchSubReason[]=0&switchSubReason[]=1&switchSubReason[]=3"

        fun cityKey(raw: String): String {
            var s = TextNorm.decodeEntities(raw).lowercase()
            s = PARENS.replace(s, " ")
            s = CITY_PREFIX.replace(s.trim(), "")
            s = s.filter { TextNorm.APOSTROPHES.indexOf(it) < 0 }
            return s.replace(Regex("\\\\s+"), " ").trim()
        }

        /** Plain array (Accept: application/json) or a hydra collection, both accepted. */
        fun toArray(json: String): JSONArray {
            val trimmed = json.trim()
            return when {
                trimmed.startsWith("[") -> JSONArray(trimmed)
                trimmed.startsWith("{") -> JSONObject(trimmed).optJSONArray("hydra:member") ?: JSONArray()
                else -> JSONArray()
            }
        }

        fun parseRows(json: String): List<PowerOnRow> {
            val arr = toArray(json)
            val rows = ArrayList<PowerOnRow>(arr.length())
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                val city = o.optJSONObject("city")
                val street = o.optJSONObject("street")
                rows.add(
                    PowerOnRow(
                        id = o.optLong("id", 0L),
                        cityId = city?.takeIf { it.has("id") }?.optInt("id"),
                        cityName = city?.optString("name", "") ?: "",
                        streetId = street?.takeIf { it.has("id") }?.optInt("id"),
                        streetName = street?.optString("name", "") ?: "",
                        dateEvent = o.optString("dateEvent", ""),
                        datePlanIn = o.optString("datePlanIn", ""),
                        koment = if (o.isNull("koment")) null else o.optString("koment"),
                        switchSubReason = if (o.has("switchSubReason") && !o.isNull("switchSubReason")) o.optInt("switchSubReason") else null,
                        typeOff = if (o.has("typeOff") && !o.isNull("typeOff")) o.optInt("typeOff") else null,
                        buildingNames = o.optString("buildingNames", "")
                    )
                )
            }
            return rows
        }

        private fun enc(s: String): String = URLEncoder.encode(s, "UTF-8")
    }

    /** City ids by exact name (inside the REM when known), then street ids by canonical street key. */
    fun resolveIds(target: PowerOnTarget): PowerOnIds {
        val wanted = cityKey(target.settlementName)
        val byRem = target.remOtgId?.let { "&otg.id=$it" } ?: ""
        val cityRows = fetchCities(wanted, target.settlementName, byRem)
        val cityIds = cityRows.map { it.first }.distinct()
        if (cityIds.isEmpty()) return PowerOnIds(emptyList(), emptyList())

        val streetKeys = target.streetNames.map { StreetKey.of(it) }.toSet()
        val streetIds = LinkedHashSet<Int>()
        for (cityId in cityIds) {
            val body = http.get("$BASE_URL/pw_streets?city.id=$cityId&pagination=false")
            val arr = toArray(body)
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                if (StreetKey.of(o.optString("name", "")) in streetKeys) streetIds.add(o.optInt("id"))
            }
        }
        return PowerOnIds(cityIds, streetIds.toList())
    }

    private fun fetchCities(wantedKey: String, rawName: String, byRem: String): List<Pair<Int, String>> {
        fun query(extra: String): List<Pair<Int, String>> {
            val bare = CITY_PREFIX.replace(TextNorm.decodeEntities(rawName).trim(), "").trim()
            val body = http.get("$BASE_URL/pw_cities?name=\${enc(bare)}$extra&pagination=false")
            val arr = toArray(body)
            val out = ArrayList<Pair<Int, String>>()
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                val name = o.optString("name", "")
                if (cityKey(name) == wantedKey) out.add(o.optInt("id") to name)
            }
            return out
        }
        val inRem = if (byRem.isNotEmpty()) query(byRem) else emptyList()
        return inRem.ifEmpty { query("") }
    }

    /**
     * Fetches emergencies and planned works for the address. Resolution order for the query scope:
     * street ids, then city ids (rows filtered by street key), then the REM (filtered by city and street).
     */
    fun fetch(target: PowerOnTarget, today: LocalDate, now: LocalDateTime): PowerOnResult {
        var ids: PowerOnIds? = if (target.cachedStreetIds.isNotEmpty() || target.cachedCityIds.isNotEmpty()) {
            PowerOnIds(target.cachedCityIds, target.cachedStreetIds)
        } else {
            null
        }
        try {
            if (ids == null) ids = resolveIds(target)
        } catch (e: Exception) {
            return PowerOnResult(EmergencyFetch.Unavailable("resolve: \${e.message}"), null, null)
        }

        val scope: String
        var streetFilter: Set<String>? = null
        var cityFilter: String? = null
        when {
            ids.streetIds.isNotEmpty() -> scope = ids.streetIds.joinToString("&") { "street.id[]=$it" }
            ids.cityIds.isNotEmpty() -> {
                scope = ids.cityIds.joinToString("&") { "city.id[]=$it" }
                streetFilter = target.streetNames.map { StreetKey.of(it) }.toSet()
            }
            target.remOtgId != null -> {
                scope = "otg.id=\${target.remOtgId}"
                streetFilter = target.streetNames.map { StreetKey.of(it) }.toSet()
                cityFilter = cityKey(target.settlementName)
            }
            else -> return PowerOnResult(EmergencyFetch.Unavailable("no scope"), null, ids)
        }

        fun filtered(rows: List<PowerOnRow>): List<PowerOnRow> = rows.filter { r ->
            (streetFilter == null || StreetKey.of(r.streetName) in streetFilter) &&
                (cityFilter == null || cityKey(r.cityName) == cityFilter)
        }

        val emergency: EmergencyFetch = try {
            val rows = filtered(parseRows(http.get("$BASE_URL/pw_accidents?$scope&$EMERGENCY_REASONS&pagination=false")))
            val limit = today.plusDays(2).atStartOfDay()
            val records = PowerOnMapper.emergencyRecordsFor(rows, target.house).filter { it.start.isBefore(limit) }
            EmergencyFetch.Confirmed(records)
        } catch (e: Exception) {
            EmergencyFetch.Unavailable("accidents: \${e.message}")
        }

        val repairs: List<Outage>? = try {
            val rows = filtered(parseRows(http.get("$BASE_URL/pw_accident_planeds?$scope&datePlanIn[after]=$today&pagination=false")))
            PowerOnMapper.repairOutagesFor(rows, target.house, today)
        } catch (_: Exception) {
            null
        }
        return PowerOnResult(emergency, repairs, ids)
    }
}
`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/data/repository/OutageRepository.kt',
    language: 'kotlin',
    description: 'Single source of truth: refresh() does the network, snapshot() is local',
    content: `package ua.blackout.prewarning.data.repository

import ua.blackout.prewarning.widget.WidgetBindings
import android.content.Context
import ua.blackout.prewarning.core.DayView
import ua.blackout.prewarning.core.EmergencyEvent
import ua.blackout.prewarning.core.EmergencyFetch
import ua.blackout.prewarning.core.EmergencyLedger
import ua.blackout.prewarning.core.HouseKey
import ua.blackout.prewarning.core.IntervalStatus
import ua.blackout.prewarning.core.Outage
import ua.blackout.prewarning.core.OutageEngine
import ua.blackout.prewarning.core.OutageKind
import ua.blackout.prewarning.core.SiteState
import ua.blackout.prewarning.core.StatusInfo
import ua.blackout.prewarning.core.StreetKey
import ua.blackout.prewarning.core.Subscription
import ua.blackout.prewarning.core.SubscriptionStore
import ua.blackout.prewarning.core.Subscriptions
import ua.blackout.prewarning.data.KYIV_ZONE
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SelectedAddressQuery
import ua.blackout.prewarning.data.model.SlotStatus
import ua.blackout.prewarning.data.model.UserSettings
import ua.blackout.prewarning.data.parser.FetchStatus
import ua.blackout.prewarning.data.parser.ZtoeAddressLookup
import ua.blackout.prewarning.data.parser.ZtoeParser
import ua.blackout.prewarning.data.poweron.PowerOnClient
import ua.blackout.prewarning.data.poweron.PowerOnTarget
import ua.blackout.prewarning.notification.NotificationHelper
import java.time.LocalDate
import java.time.LocalDateTime

private fun hhmm(minuteOfDay: Int): String =
    "\${(minuteOfDay / 60).toString().padStart(2, '0')}:\${(minuteOfDay % 60).toString().padStart(2, '0')}"

/** Everything the screens, widgets and alarms need, derived from local state only (no network). */
data class OutageSnapshot(
    val now: LocalDateTime,
    val queue: String,
    val outages: List<Outage>,
    /** Today's ztoe table is cached and still valid for today (or the address has no queue at all). */
    val plannedKnown: Boolean,
    val tomorrowPublished: Boolean,
    val site: SiteSnapshot?,
    val poweron: PowerOnSnapshot?,
    val hasAddress: Boolean
) {
    val today: LocalDate get() = now.toLocalDate()

    fun dayView(date: LocalDate): DayView = OutageEngine.dayView(outages, date, now)

    fun status(): StatusInfo = OutageEngine.status(outages, now)

    /** The planned schedule is unknown and nothing else is known either: screens go grey. */
    val isUnclear: Boolean
        get() = queue.isNotBlank() && !plannedKnown && outages.none { !it.stale && it.kind != OutageKind.PLANNED }

    /** True when the shown schedule comes from the cache because the site could not be refreshed. */
    val isStale: Boolean
        get() = plannedKnown && queue.isNotBlank() && site != null && site.state != SiteState.AVAILABLE_WITH_TABLE

    /** Legacy shape used by the existing main screen and widgets. */
    fun scheduleStatus(): ScheduleStatusInfo {
        if (isUnclear) {
            return ScheduleStatusInfo(
                isBlackoutNow = false,
                countdownText = "--:--:--",
                nextSlotTime = "--:-- - --:--",
                totalBlackoutHours = 0.0,
                isUnclear = true
            )
        }
        val st = status()
        return ScheduleStatusInfo(
            isBlackoutNow = st.isOffNow,
            countdownText = st.countdownText,
            nextSlotTime = st.nextSlotTime,
            totalBlackoutHours = dayView(today).totalOffMinutes / 60.0,
            isUnclear = false
        )
    }

    /** The 48 cells of [date] in the shape the drum chart and widgets draw. Empty when unclear. */
    fun slotsFor(date: LocalDate): List<BlackoutSlot> {
        if (isUnclear) return emptyList()
        val view = dayView(date)
        val dateStr = date.toString()
        return view.slots.mapIndexed { i, s ->
            val startMin = i * 30
            val endMin = startMin + 30
            val startStr = hhmm(startMin)
            val endStr = if (endMin >= 1440) "24:00" else hhmm(endMin)
            BlackoutSlot(
                id = "\${dateStr}_\${startStr}_Q$queue",
                startHour = startMin / 60,
                endHour = endMin / 60,
                startMinute = startMin % 60,
                endMinute = endMin % 60,
                startTimeStr = startStr,
                endTimeStr = endStr,
                status = if (s.off) SlotStatus.POWER_OFF else SlotStatus.POWER_ON,
                isEmergency = s.emergency,
                isPlanned = s.planned
            )
        }
    }

    /** The emergency outage to feature in the banner: active or overdue first, then the next upcoming one. */
    fun featuredEmergency(): Outage? {
        val live = outages.filter { it.kind == OutageKind.EMERGENCY && !it.stale }
        return live.firstOrNull { val st = it.statusAt(now); st == IntervalStatus.ACTIVE || st == IntervalStatus.OVERDUE }
            ?: live.filter { it.statusAt(now) == IntervalStatus.UPCOMING }.minByOrNull { it.start }
    }
}

data class RefreshOutcome(
    val siteState: SiteState?,
    val fetchStatus: FetchStatus?,
    val poweronOk: Boolean?,
    val events: List<EmergencyEvent>,
    val snapshot: OutageSnapshot
)

/**
 * One place that refreshes both sources and turns the stored state into a snapshot. The main
 * screen, the background worker, the widgets and the alarm scheduler all go through it, so they
 * can no longer disagree about what is off and when (spec/OUTAGE_ENGINE.md).
 */
class OutageRepository(context: Context) {
    private val appContext: Context = context.applicationContext
    private val schedule = ScheduleRepository(appContext)
    private val store = OutageStateStore(appContext)

    /** Stable key of the selected address; survives duplicate-street merges because it uses the canonical street key. */
    fun addressKey(query: SelectedAddressQuery?): String? {
        query ?: return null
        if (query.house.isBlank()) return null
        val streetName = try {
            ZtoeAddressLookup.findStreetById(query.streetId)?.nameUk
        } catch (_: Exception) {
            null
        } ?: query.streetId
        return "\${query.settlementId}|\${StreetKey.of(streetName)}|\${HouseKey.of(query.house)}"
    }

    fun snapshot(
        settings: UserSettings,
        now: LocalDateTime = LocalDateTime.now(KYIV_ZONE),
        key: String? = addressKey(settings.selectedAddressQuery)
    ): OutageSnapshot = snapshotOf(settings.queue, key, now, store.poweron())

    /**
     * The snapshot of one non-primary subscription for the main screen (spec/SUBSCRIPTIONS.md 9).
     * The primary goes through [snapshot]; another item has its own PowerOn status under its address key.
     */
    fun snapshotFor(item: Subscription, now: LocalDateTime = LocalDateTime.now(KYIV_ZONE)): OutageSnapshot {
        val key = item.address?.key
        return snapshotOf(item.queue.orEmpty(), key, now, key?.let { store.poweron(it) })
    }

    private fun snapshotOf(q: String, key: String?, now: LocalDateTime, poweron: PowerOnSnapshot?): OutageSnapshot =
        OutageSnapshot(
            now = now,
            queue = q,
            outages = outagesFor(q, key, now),
            plannedKnown = q.isBlank() || schedule.hasValidTodayCache(q),
            tomorrowPublished = q.isNotBlank() && schedule.hasTomorrowSchedule(q),
            site = store.site(),
            poweron = poweron,
            hasAddress = key != null
        )

    /**
     * The outages of one queue and address key (either may be absent), local state only. One ztoe
     * fetch caches all 12 queues, so this works for every subscription (spec/SUBSCRIPTIONS.md 8.1).
     */
    fun outagesFor(queue: String?, key: String?, now: LocalDateTime = LocalDateTime.now(KYIV_ZONE)): List<Outage> {
        val today = now.toLocalDate()
        val q = queue.orEmpty()
        val planned = if (q.isNotBlank()) {
            OutageEngine.buildPlanned(today, schedule.todayOffCells(q), schedule.tomorrowOffCells(q), schedule.yesterdayOffCells(q))
        } else {
            emptyList()
        }
        val emergencies = if (key != null) EmergencyLedger.outages(store.ledger(key), now) else emptyList()
        val repairs = if (key != null) store.repairs(key) else emptyList()
        return OutageEngine.inWindow(planned + repairs + emergencies, today)
    }

    /**
     * Refreshes ztoe (planned) and PowerOn (emergency + repair works) for the selected address.
     * Runs on a worker thread. A source that fails keeps its previous data and is reported as such;
     * it never counts as "no outage". [shownId] is the item the main screen shows: it is polled whatever
     * its switches (spec/SUBSCRIPTIONS.md 8.4).
     */
    fun refresh(settings: UserSettings, forceNetwork: Boolean = false, notify: Boolean = true, shownId: String? = null): RefreshOutcome {
        val nowMs = System.currentTimeMillis()
        var siteState: SiteState? = null
        var fetchStatus: FetchStatus? = null
        val subs: Pair<SubscriptionStore, Boolean>? = try {
            val sync = SubscriptionSync(appContext)
            sync.store() to sync.master()
        } catch (_: Exception) {
            null
        }

        // One fetch caches all 12 queues. A primary without a queue still fetches for the other addresses.
        val ztoeQueue = settings.queue.ifBlank {
            subs?.first?.let { s -> Subscriptions.alertOrder(s).firstNotNullOfOrNull { it.queue } }.orEmpty()
        }
        if (ztoeQueue.isNotBlank()) {
            try {
                val res = ZtoeParser.fetchFullSchedule(settings.cityUrl, ztoeQueue, appContext, forceNetwork)
                store.saveSite(res.siteState, nowMs, res.notice)
                if (settings.queue.isNotBlank()) {
                    fetchStatus = res.status
                    siteState = res.siteState
                }
            } catch (_: Exception) {
            }
        }

        var poweronOk: Boolean? = null
        var events: List<EmergencyEvent> = emptyList()
        val query = settings.selectedAddressQuery
        val key = addressKey(query)
        if (query != null && key != null) {
            val polled = pollPowerOn(query, key, nowMs)
            poweronOk = polled?.first ?: false
            events = polled?.second.orEmpty()
            store.savePowerOn(poweronOk, nowMs)
            if (notify && events.isNotEmpty() && settings.emergencyNotificationsEnabled) {
                val primary = subs?.first?.primary
                NotificationHelper.postEmergencyEvents(
                    appContext, settings, key, events, subscriptionId = subs?.first?.primaryId,
                    plannedSpans = OutageEngine.plannedSpans(outagesFor(settings.queue, key)),
                    plannedAlertsOn = if (subs != null && primary != null) Subscriptions.plannedActive(subs.second, primary) else settings.notificationsEnabled
                )
            }
        }
        if (subs != null) refreshOtherAddresses(settings, subs.first, subs.second, key, nowMs, notify, shownId)
        return RefreshOutcome(siteState, fetchStatus, poweronOk, events, snapshot(settings))
    }

    /**
     * PowerOn for every other subscription that wants emergency alerts, plus the one the main screen
     * shows (spec/SUBSCRIPTIONS.md 8.4): own request, own failure, own ledger, own status line.
     */
    private fun refreshOtherAddresses(
        settings: UserSettings,
        subs: SubscriptionStore,
        master: Boolean,
        primaryKey: String?,
        nowMs: Long,
        notify: Boolean,
        shownId: String?
    ) {
        // Addresses on a widget are polled too, so the widget's emergency state is fresh (spec/SUBSCRIPTIONS.md 10)
        val onWidgets = try {
            WidgetBindings.shownItemIds(appContext, subs)
        } catch (_: Exception) {
            emptyList()
        }
        for (item in subs.items) {
            val a = item.address ?: continue
            if (item.id == subs.primaryId) continue
            val alerts = master && item.emergencyAlerts
            if (!alerts && item.id != shownId && item.id !in onWidgets) continue
            val key = a.key
            if (key == primaryKey) continue
            val polled = pollPowerOn(SelectedAddressQuery(a.remSlug, a.settlementId, a.streetId, a.house), key, nowMs)
            store.savePowerOn(key, polled?.first ?: false, nowMs)
            if (polled == null) continue
            if (notify && alerts && polled.second.isNotEmpty()) {
                NotificationHelper.postEmergencyEvents(
                    appContext, settings, key, polled.second, addressLine(item), enabled = true, subscriptionId = item.id,
                    plannedSpans = OutageEngine.plannedSpans(outagesFor(item.queue, key)),
                    plannedAlertsOn = Subscriptions.plannedActive(master, item)
                )
            }
        }
    }

    /** Second line of an emergency notification for [item] (spec/SUBSCRIPTIONS.md 8.4). */
    private fun addressLine(item: Subscription): String =
        item.address?.text?.takeIf { it.isNotBlank() } ?: Subscriptions.displayLabel(item)

    /** One PowerOn query: saves ids, ledger and repairs under [key]. Null when it failed or could not be built. */
    private fun pollPowerOn(query: SelectedAddressQuery, key: String, nowMs: Long): Pair<Boolean, List<EmergencyEvent>>? = try {
        ZtoeAddressLookup.initDiskCache(appContext)
        val target = buildTarget(query, key, nowMs)
        if (target == null) {
            null
        } else {
            val now = LocalDateTime.now(KYIV_ZONE)
            val result = PowerOnClient().fetch(target, now.toLocalDate(), now)
            result.ids?.let { if (it.cityIds.isNotEmpty() || it.streetIds.isNotEmpty()) store.saveIds(key, it, nowMs) }
            val ledger = EmergencyLedger.reconcile(store.ledger(key), result.emergency, now)
            store.saveLedger(key, ledger.entries)
            result.repairs?.let { store.saveRepairs(key, it) }
            (result.emergency is EmergencyFetch.Confirmed) to ledger.events
        }
    } catch (_: Exception) {
        null
    }

    private fun buildTarget(query: SelectedAddressQuery, key: String, nowMs: Long): PowerOnTarget? {
        val rem = ZtoeAddressLookup.getRems().firstOrNull { it.id == query.remId }
            ?: ZtoeAddressLookup.ZTOE_REM_OPTIONS.firstOrNull { it.id == query.remId }
        val settlement = ZtoeAddressLookup.findSettlementById(query.settlementId) ?: return null
        val street = ZtoeAddressLookup.findStreetById(query.streetId) ?: return null
        val streetKey = StreetKey.of(street.nameUk)
        val names = ZtoeAddressLookup.getStreetsForSettlement(settlement.id)
            .filter { StreetKey.of(it.nameUk) == streetKey }
            .map { it.nameUk }
            .ifEmpty { listOf(street.nameUk) }
        val cached = store.ids(key)?.takeIf { nowMs - it.second in 0 until PowerOnClient.IDS_TTL_MS }
        return PowerOnTarget(
            remOtgId = rem?.ztoeOtgId,
            settlementName = settlement.nameUk,
            streetNames = names,
            house = query.house,
            cachedCityIds = cached?.first?.cityIds.orEmpty(),
            cachedStreetIds = cached?.first?.streetIds.orEmpty()
        )
    }
}
`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/data/repository/OutageStateStore.kt',
    language: 'kotlin',
    description: 'Persisted site state, PowerOn status, ledger and site notice',
    content: `package ua.blackout.prewarning.data.repository

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import ua.blackout.prewarning.core.LedgerEntry
import ua.blackout.prewarning.core.Outage
import ua.blackout.prewarning.core.OutageKind
import ua.blackout.prewarning.core.SiteState
import ua.blackout.prewarning.data.poweron.PowerOnIds
import java.time.LocalDateTime

/** When the ztoe site was last checked and what was found. */
data class SiteSnapshot(
    val state: SiteState,
    val checkedAtMs: Long,
    val lastSuccessMs: Long?,
    /** The site's own notice ("УВАГА! ВАЖЛИВА ІНФОРМАЦІЯ!"), kept only while the page has no table. */
    val notice: String? = null
)

/** Whether the last PowerOn refresh worked. */
data class PowerOnSnapshot(val ok: Boolean, val checkedAtMs: Long, val lastOkMs: Long?)

/**
 * Small persistent state of the outage pipeline, kept apart from user settings so a long network
 * call can never overwrite a setting the user just changed. Layout: \`spec/PERSISTENCE.md\`.
 */
class OutageStateStore(context: Context) {
    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences("zt_outage_state_v1", Context.MODE_PRIVATE)

    // --- emergency ledger (per address) ---------------------------------------------------------

    fun ledger(addressKey: String): List<LedgerEntry> = readArray("ledger_$addressKey") { o ->
        LedgerEntry(
            id = o.getString("id"),
            start = LocalDateTime.parse(o.getString("start")),
            estimatedEnd = o.optStr("estimatedEnd")?.let(LocalDateTime::parse),
            label = o.optStr("label"),
            firstSeen = LocalDateTime.parse(o.getString("firstSeen")),
            lastSeen = LocalDateTime.parse(o.getString("lastSeen")),
            closedAt = o.optStr("closedAt")?.let(LocalDateTime::parse),
            startEmitted = o.optBoolean("startEmitted", true),
            endEmitted = o.optBoolean("endEmitted", false),
            lastEmittedEta = o.optStr("lastEmittedEta")?.let(LocalDateTime::parse)
        )
    }

    fun saveLedger(addressKey: String, entries: List<LedgerEntry>) {
        val key = "ledger_$addressKey"
        if (entries.isEmpty()) {
            prefs.edit().remove(key).apply()
            return
        }
        val arr = JSONArray()
        for (e in entries) {
            arr.put(
                JSONObject()
                    .put("id", e.id)
                    .put("start", e.start.toString())
                    .putOpt("estimatedEnd", e.estimatedEnd?.toString())
                    .putOpt("label", e.label)
                    .put("firstSeen", e.firstSeen.toString())
                    .put("lastSeen", e.lastSeen.toString())
                    .putOpt("closedAt", e.closedAt?.toString())
                    .put("startEmitted", e.startEmitted)
                    .put("endEmitted", e.endEmitted)
                    .putOpt("lastEmittedEta", e.lastEmittedEta?.toString())
            )
        }
        prefs.edit().putString(key, arr.toString()).apply()
    }

    // --- planned repair works from PowerOn (per address) -----------------------------------------

    fun repairs(addressKey: String): List<Outage> = readArray("repair_$addressKey") { o ->
        Outage(
            id = o.getString("id"),
            kind = OutageKind.REPAIR,
            start = LocalDateTime.parse(o.getString("start")),
            end = LocalDateTime.parse(o.getString("end")),
            label = o.optStr("label")
        )
    }

    fun saveRepairs(addressKey: String, outages: List<Outage>) {
        val key = "repair_$addressKey"
        if (outages.isEmpty()) {
            prefs.edit().remove(key).apply()
            return
        }
        val arr = JSONArray()
        for (o in outages) {
            arr.put(
                JSONObject().put("id", o.id).put("start", o.start.toString()).put("end", o.end.toString()).putOpt("label", o.label)
            )
        }
        prefs.edit().putString(key, arr.toString()).apply()
    }

    // --- resolved PowerOn ids (per address) -------------------------------------------------------

    fun ids(addressKey: String): Pair<PowerOnIds, Long>? {
        val raw = prefs.getString("ids_$addressKey", null) ?: return null
        return try {
            val o = JSONObject(raw)
            val cities = o.optJSONArray("cityIds") ?: JSONArray()
            val streets = o.optJSONArray("streetIds") ?: JSONArray()
            PowerOnIds((0 until cities.length()).map { cities.getInt(it) }, (0 until streets.length()).map { streets.getInt(it) }) to
                o.optLong("resolvedAtMs", 0L)
        } catch (_: Exception) {
            null
        }
    }

    fun saveIds(addressKey: String, ids: PowerOnIds, nowMs: Long) {
        val o = JSONObject()
            .put("cityIds", JSONArray(ids.cityIds))
            .put("streetIds", JSONArray(ids.streetIds))
            .put("resolvedAtMs", nowMs)
        prefs.edit().putString("ids_$addressKey", o.toString()).apply()
    }

    // --- site and source status -------------------------------------------------------------------

    fun site(): SiteSnapshot? {
        val name = prefs.getString("site_state", null) ?: return null
        val state = runCatching { SiteState.valueOf(name) }.getOrNull() ?: return null
        val success = prefs.getLong("site_last_success_ms", 0L).takeIf { it > 0L }
        val notice = prefs.getString("site_notice", null)?.takeIf { it.isNotBlank() && state == SiteState.AVAILABLE_NO_TABLE }
        return SiteSnapshot(state, prefs.getLong("site_checked_ms", 0L), success, notice)
    }

    fun saveSite(state: SiteState, nowMs: Long, notice: String? = null) {
        val editor = prefs.edit().putString("site_state", state.name).putLong("site_checked_ms", nowMs)
        // A notice only means something while the page has no table; any other state forgets it
        if (state == SiteState.AVAILABLE_NO_TABLE && !notice.isNullOrBlank()) {
            editor.putString("site_notice", notice)
        } else if (state != SiteState.SITE_UNREACHABLE && state != SiteState.NO_INTERNET) {
            editor.remove("site_notice")
        }
        if (state == SiteState.AVAILABLE_WITH_TABLE) editor.putLong("site_last_success_ms", nowMs)
        editor.apply()
    }

    fun poweron(): PowerOnSnapshot? {
        if (!prefs.contains("poweron_checked_ms")) return null
        return PowerOnSnapshot(
            ok = prefs.getBoolean("poweron_ok", false),
            checkedAtMs = prefs.getLong("poweron_checked_ms", 0L),
            lastOkMs = prefs.getLong("poweron_last_ok_ms", 0L).takeIf { it > 0L }
        )
    }

    fun savePowerOn(ok: Boolean, nowMs: Long) {
        val editor = prefs.edit().putBoolean("poweron_ok", ok).putLong("poweron_checked_ms", nowMs)
        if (ok) editor.putLong("poweron_last_ok_ms", nowMs)
        editor.apply()
    }

    /** PowerOn status of a non-primary address (spec/SUBSCRIPTIONS.md 8.4); the primary keeps the keys above. */
    fun poweron(addressKey: String): PowerOnSnapshot? {
        if (!prefs.contains("poweron_checked_ms_$addressKey")) return null
        return PowerOnSnapshot(
            ok = prefs.getBoolean("poweron_ok_$addressKey", false),
            checkedAtMs = prefs.getLong("poweron_checked_ms_$addressKey", 0L),
            lastOkMs = prefs.getLong("poweron_last_ok_ms_$addressKey", 0L).takeIf { it > 0L }
        )
    }

    fun savePowerOn(addressKey: String, ok: Boolean, nowMs: Long) {
        val editor = prefs.edit().putBoolean("poweron_ok_$addressKey", ok).putLong("poweron_checked_ms_$addressKey", nowMs)
        if (ok) editor.putLong("poweron_last_ok_ms_$addressKey", nowMs)
        editor.apply()
    }

    /** Forgets everything (used by "reset to defaults"). */
    fun clearAll() {
        prefs.edit().clear().apply()
    }

    fun getSharedPreferences(): SharedPreferences = prefs

    // --- helpers --------------------------------------------------------------------------------

    private fun <T> readArray(key: String, map: (JSONObject) -> T): List<T> {
        val raw = prefs.getString(key, null) ?: return emptyList()
        return try {
            val arr = JSONArray(raw)
            (0 until arr.length()).mapNotNull { i -> runCatching { map(arr.getJSONObject(i)) }.getOrNull() }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun JSONObject.optStr(key: String): String? = if (isNull(key)) null else getString(key).takeIf { it.isNotEmpty() }
}
`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/notification/ExactAlarmGate.kt',
    language: 'kotlin',
    description: 'Exact alarms through SCHEDULE_EXACT_ALARM with inexact fallback',
    content: `package ua.blackout.prewarning.notification

import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings

/**
 * Exact alarms need the "Alarms & reminders" special access on Android 12+ (\`SCHEDULE_EXACT_ALARM\`).
 * Without it alerts fall back to inexact delivery and the UI shows a card that explains what to do
 * and opens the right system screen.
 */
object ExactAlarmGate {
    fun canScheduleExact(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        return try {
            (context.applicationContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager).canScheduleExactAlarms()
        } catch (_: Exception) {
            false
        }
    }

    /** Intent for the system "Alarms & reminders" screen of this app, or null below Android 12. */
    fun settingsIntent(context: Context): Intent? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return null
        return Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:\${context.packageName}"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
}

/**
 * Stable integer request codes for PendingIntents and notifications. Replaces \`String.hashCode()\`,
 * where two keys could collide and silently lose an alarm.
 */
object AlarmCodes {
    private const val PREFS = "zt_alarm_codes_v1"
    private const val NEXT = "__next"
    private const val FIRST = 1000

    @Synchronized
    fun codeFor(context: Context, key: String): Int {
        val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val existing = prefs.getInt(key, -1)
        if (existing >= 0) return existing
        val next = prefs.getInt(NEXT, FIRST)
        prefs.edit().putInt(key, next).putInt(NEXT, next + 1).apply()
        return next
    }

    @Synchronized
    fun lookup(context: Context, key: String): Int? {
        val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return prefs.getInt(key, -1).takeIf { it >= 0 }
    }

    /** Forgets every code whose key is not in [keep] (call after the matching alarms were cancelled). */
    @Synchronized
    fun retainOnly(context: Context, keep: Set<String>) {
        val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val editor = prefs.edit()
        for (k in prefs.all.keys) if (k != NEXT && k !in keep) editor.remove(k)
        editor.apply()
    }
}
`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/ui/components/GlassCard.kt',
    language: 'kotlin',
    description: 'Shared dark glass card (border, shadow, radius)',
    content: `package ua.blackout.prewarning.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import ua.blackout.prewarning.ui.theme.ZtColors
import ua.blackout.prewarning.ui.theme.ZtGlass
import ua.blackout.prewarning.ui.theme.ZtShapes

/**
 * The glass card used by every block of the app: soft floating shadow, 24 dp corners, translucent
 * matte fill with a top sheen and (by default) the lit glass rim. One implementation so border,
 * radius and shadow cannot drift apart between screens; [glassSurface] gives the same look to
 * surfaces that are not a GlassCard (About blocks, bottom navigation).
 */
@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    shape: Shape = ZtShapes.Card,
    cornerRadius: Dp = 24.dp,
    background: Color = ZtColors.Card,
    borderColor: Color? = ZtColors.CardBorder,
    contentPadding: PaddingValues = PaddingValues(16.dp),
    content: @Composable () -> Unit
) {
    Box(
        modifier = modifier
            .glassSurface(shape, cornerRadius, background, rim = false)
            .then(
                when (borderColor) {
                    null -> Modifier
                    // the default border is the lit glass rim; a custom colour (warning cards) stays solid
                    ZtColors.CardBorder -> Modifier.border(1.dp, ZtGlass.Rim, shape)
                    else -> Modifier.border(1.dp, borderColor, shape)
                }
            )
            .padding(contentPadding)
    ) {
        content()
    }
}

/** Liquid-glass surface: soft shadow, translucent fill, matte top sheen and (when [rim]) the lit rim. */
fun Modifier.glassSurface(
    shape: Shape,
    cornerRadius: Dp,
    background: Color = ZtColors.Card,
    rim: Boolean = true
): Modifier = this
    .floatingShadow(color = ZtGlass.Shadow, borderRadius = cornerRadius)
    .clip(shape)
    .background(background)
    .background(ZtGlass.Sheen)
    .then(if (rim) Modifier.border(1.dp, ZtGlass.Rim, shape) else Modifier)
`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/ui/components/SearchablePickerField.kt',
    language: 'kotlin',
    description: 'Full-screen searchable picker for REM, settlement, street and house',
    content: `package ua.blackout.prewarning.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import ua.blackout.prewarning.ui.AppStrings
import ua.blackout.prewarning.ui.theme.ZtColors
import ua.blackout.prewarning.ui.theme.ZtMinTouch
import ua.blackout.prewarning.ui.theme.ZtShapes
import ua.blackout.prewarning.ui.theme.ZtType

/** Minimum height of one list row. */
private val PICKER_ROW_HEIGHT = 52.dp

/** One row of a [SearchablePickerField]. [id] must be unique inside one list; duplicates are dropped. */
@Immutable
data class PickerItem(val id: String, val label: String)

/** Colours of the app's glass text fields: dark fill, hairline border, accent when focused, light icons and cursor. */
@Composable
fun glassFieldColors(
    focusedBorder: Color = ZtColors.Accent,
    unfocusedBorder: Color = ZtColors.InputBorder
) = OutlinedTextFieldDefaults.colors(
    focusedTextColor = Color.White,
    unfocusedTextColor = Color.White,
    disabledTextColor = Color(0x80FFFFFF),
    focusedBorderColor = focusedBorder,
    unfocusedBorderColor = unfocusedBorder,
    disabledBorderColor = Color(0x1AFFFFFF),
    focusedContainerColor = Color(0x1AFFFFFF),
    unfocusedContainerColor = ZtColors.InnerRow,
    disabledContainerColor = Color(0x0DFFFFFF),
    cursorColor = ZtColors.Accent,
    focusedTrailingIconColor = Color.White,
    unfocusedTrailingIconColor = Color(0xB3FFFFFF),
    disabledTrailingIconColor = Color(0x4DFFFFFF),
    focusedLeadingIconColor = Color(0xB3FFFFFF),
    unfocusedLeadingIconColor = Color(0xB3FFFFFF),
    focusedPlaceholderColor = ZtColors.TextTertiary,
    unfocusedPlaceholderColor = ZtColors.TextTertiary
)

/**
 * A read-only field that opens a full-screen searchable list. Built for the address lookup, where one
 * list can hold 966 streets: rows are lazy and keyed by [PickerItem.id], search is [PickerSearch]
 * (apostrophe, diacritic, case and street-type-prefix insensitive), and there is no entrance animation
 * because people open it often.
 *
 * States: [loading] (spinner; a thin bar when rows are already shown), [loadFailed] (message with
 * Retry when [onRetry] is set), and an empty result ("Нічого не знайдено").
 *
 * @param value text shown in the field, or null to show [placeholder]
 * @param selectedId id of the current value; gets the check mark and the initial scroll position
 * @param enabled when false the field is dimmed and does not open ([disabledHint] is read by TalkBack)
 * @param kind [PickerSearch.Kind.HOUSE] for house numbers ("16А" equals "16a", "34-А" equals "34а")
 * @param openRequest opens the list whenever it grows above 0 (the address form opens the houses right after a
 *   street is chosen); the search field is focused and the keyboard opens, as for every list
 */
@Composable
fun SearchablePickerField(
    label: String,
    value: String?,
    placeholder: String,
    items: List<PickerItem>,
    selectedId: String?,
    onSelect: (PickerItem) -> Unit,
    lang: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    loadFailed: Boolean = false,
    onRetry: (() -> Unit)? = null,
    kind: PickerSearch.Kind = PickerSearch.Kind.TEXT,
    disabledHint: String? = null,
    openRequest: Int = 0
) {
    var open by remember { mutableStateOf(false) }
    LaunchedEffect(openRequest) {
        if (openRequest > 0 && enabled) open = true
    }
    val shape = ZtShapes.Control
    val shownText = value?.takeIf { it.isNotBlank() } ?: placeholder

    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(text = label, style = ZtType.label, color = Color(0xE6BAE6FD))
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .clip(shape)
                .background(if (enabled) ZtColors.InnerRow else Color(0x0DFFFFFF))
                .border(1.dp, if (enabled) ZtColors.InputBorder else Color(0x1AFFFFFF), shape)
                .clickable(enabled = enabled, role = Role.Button, onClickLabel = label) { open = true }
                .semantics(mergeDescendants = true) {
                    contentDescription = "$label, $shownText"
                    if (!enabled && disabledHint != null) stateDescription = disabledHint
                }
                .padding(start = 16.dp, end = 8.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = shownText,
                style = ZtType.body,
                color = when {
                    !enabled -> Color(0x80FFFFFF)
                    value.isNullOrBlank() -> ZtColors.TextTertiary
                    else -> Color.White
                },
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f)
            )
            if (loading) {
                CircularProgressIndicator(
                    modifier = Modifier.padding(horizontal = 8.dp).size(18.dp),
                    strokeWidth = 2.dp,
                    color = ZtColors.Accent
                )
            }
            Icon(
                imageVector = Icons.Default.ArrowDropDown,
                contentDescription = null,
                tint = if (enabled) Color(0xB3FFFFFF) else Color(0x4DFFFFFF),
                modifier = Modifier.size(24.dp)
            )
        }
    }

    if (open) {
        PickerDialog(
            title = label,
            items = items,
            selectedId = selectedId,
            lang = lang,
            loading = loading,
            loadFailed = loadFailed,
            onRetry = onRetry,
            kind = kind,
            onDismiss = { open = false },
            onSelect = {
                open = false
                onSelect(it)
            }
        )
    }
}

@Composable
private fun PickerDialog(
    title: String,
    items: List<PickerItem>,
    selectedId: String?,
    lang: String,
    loading: Boolean,
    loadFailed: Boolean,
    onRetry: (() -> Unit)?,
    kind: PickerSearch.Kind,
    onDismiss: () -> Unit,
    onSelect: (PickerItem) -> Unit
) {
    // duplicate ids would crash LazyColumn(key = id), so the list is made unique once
    val unique = remember(items) { items.distinctBy { it.id } }
    val index = remember(unique, kind) { PickerSearch.Index(unique, kind) { it.label } }
    var query by remember { mutableStateOf("") }
    val shown = remember(index, query) { index.search(query) }
    val initialIndex = remember { unique.indexOfFirst { it.id == selectedId }.coerceAtLeast(0) }
    val listState = rememberLazyListState(initialFirstVisibleItemIndex = initialIndex)
    val focusRequester = remember { FocusRequester() }
    val keyboard = LocalSoftwareKeyboardController.current
    // The search field is focused on open, so the keyboard comes up at once (owner, 2026-11-18)
    LaunchedEffect(Unit) {
        withFrameNanos { }
        try {
            focusRequester.requestFocus()
        } catch (_: Exception) {
            // the field is not attached yet on a very slow first frame; the user can still tap it
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(ZtColors.CardSolid)
                .statusBarsPadding()
                .navigationBarsPadding()
                .imePadding()
        ) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(start = 4.dp, end = 16.dp, top = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onDismiss, modifier = Modifier.size(ZtMinTouch)) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = AppStrings.pickerClose(lang),
                        tint = Color.White
                    )
                }
                Text(
                    text = title,
                    style = ZtType.heading,
                    color = Color.White,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f).padding(start = 4.dp)
                )
            }

            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp)
                    .heightIn(min = 56.dp)
                    .focusRequester(focusRequester),
                singleLine = true,
                shape = ZtShapes.Control,
                textStyle = ZtType.body,
                placeholder = { Text(AppStrings.pickerSearchHint(lang), style = ZtType.body) },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                trailingIcon = if (query.isNotEmpty()) {
                    {
                        IconButton(onClick = { query = "" }, modifier = Modifier.size(ZtMinTouch)) {
                            Icon(Icons.Default.Close, contentDescription = AppStrings.pickerClearSearch(lang))
                        }
                    }
                } else null,
                keyboardOptions = KeyboardOptions(
                    capitalization = KeyboardCapitalization.None,
                    autoCorrectEnabled = false,
                    imeAction = ImeAction.Search
                ),
                keyboardActions = KeyboardActions(onSearch = { keyboard?.hide() }),
                colors = glassFieldColors()
            )

            if (loading && shown.isNotEmpty()) {
                LinearProgressIndicator(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                    color = ZtColors.Accent,
                    trackColor = Color(0x1AFFFFFF)
                )
            }
            if (loadFailed && unique.isNotEmpty()) {
                PickerStatusRow(
                    text = AppStrings.pickerLoadError(lang),
                    lang = lang,
                    onRetry = onRetry,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                )
            }

            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                when {
                    shown.isNotEmpty() -> LazyColumn(
                        state = listState,
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(bottom = 16.dp)
                    ) {
                        items(shown, key = { it.id }) { item ->
                            PickerRow(
                                text = item.label,
                                selected = item.id == selectedId,
                                lang = lang,
                                onClick = { onSelect(item) }
                            )
                        }
                    }
                    loading -> CenteredColumn {
                        CircularProgressIndicator(color = ZtColors.Accent, strokeWidth = 3.dp)
                        Text(AppStrings.pickerLoading(lang), style = ZtType.body, color = ZtColors.TextSecondary)
                    }
                    loadFailed && unique.isEmpty() -> CenteredColumn {
                        Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = ZtColors.ChipRedText, modifier = Modifier.size(32.dp))
                        Text(
                            AppStrings.pickerLoadError(lang),
                            style = ZtType.body,
                            color = Color.White,
                            textAlign = TextAlign.Center
                        )
                        if (onRetry != null) PickerRetryButton(lang = lang, onRetry = onRetry)
                    }
                    else -> CenteredColumn {
                        Text(
                            AppStrings.pickerNothingFound(lang),
                            style = ZtType.body,
                            color = ZtColors.TextSecondary,
                            textAlign = TextAlign.Center
                        )
                        if (unique.isEmpty() && onRetry != null) PickerRetryButton(lang = lang, onRetry = onRetry)
                    }
                }
            }
        }
    }
}

@Composable
private fun PickerRow(text: String, selected: Boolean, lang: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = PICKER_ROW_HEIGHT)
            .selectable(selected = selected, role = Role.RadioButton, onClick = onClick)
            .background(if (selected) ZtColors.InnerRow else Color.Transparent)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = text,
            style = ZtType.body,
            color = Color.White,
            modifier = Modifier.weight(1f).padding(end = 12.dp)
        )
        if (selected) {
            Icon(
                imageVector = Icons.Default.Check,
                contentDescription = AppStrings.pickerSelected(lang),
                tint = ZtColors.Accent,
                modifier = Modifier.size(24.dp)
            )
        }
    }
}

@Composable
private fun PickerStatusRow(text: String, lang: String, onRetry: (() -> Unit)?, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = ZtColors.ChipRedText, modifier = Modifier.size(20.dp))
        Text(text, style = ZtType.caption, color = ZtColors.ChipRedText, modifier = Modifier.weight(1f))
        if (onRetry != null) PickerRetryButton(lang = lang, onRetry = onRetry)
    }
}

@Composable
private fun PickerRetryButton(lang: String, onRetry: () -> Unit) {
    Box(
        modifier = Modifier
            .heightIn(min = ZtMinTouch)
            .clip(ZtShapes.Control)
            .background(Color(0x1AFFFFFF))
            .border(1.dp, ZtColors.InputBorder, ZtShapes.Control)
            .clickable(role = Role.Button, onClick = onRetry)
            .padding(horizontal = 20.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(AppStrings.pickerRetry(lang), style = ZtType.label, color = Color.White)
    }
}

@Composable
private fun CenteredColumn(content: @Composable () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        content()
    }
}
`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/ui/components/SiteStatusIndicator.kt',
    language: 'kotlin',
    description: 'Site status chips, banner and the ztoe notice card',
    content: `package ua.blackout.prewarning.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Event
import androidx.compose.material.icons.filled.EventBusy
import androidx.compose.material.icons.filled.HelpOutline
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import ua.blackout.prewarning.core.SiteState
import ua.blackout.prewarning.data.KYIV_ZONE
import ua.blackout.prewarning.data.repository.OutageSnapshot
import ua.blackout.prewarning.ui.AppStrings
import ua.blackout.prewarning.ui.theme.ZtColors
import ua.blackout.prewarning.ui.theme.ZtShapes
import ua.blackout.prewarning.ui.theme.ZtType
import java.time.Instant
import java.time.ZoneId

/** Colour family of a status chip or banner (UI_PROPOSALS section 3.3). Never the only cue: each also has an icon and text. */
enum class StatusTone { GREEN, AMBER, RED, GREY }

enum class StatusIcon { OK, WARNING, SERVER_DOWN, OFFLINE, UNKNOWN, TOMORROW_OK, TOMORROW_PENDING }

data class StatusChip(val tone: StatusTone, val icon: StatusIcon, val text: String)

data class SiteBanner(val tone: StatusTone, val icon: StatusIcon, val title: String, val message: String)

/** Pure rules that decide which site and PowerOn status the main screen shows, so they can be unit tested. */
object SiteStatusModel {

    fun formatHhmm(epochMs: Long, zone: ZoneId = KYIV_ZONE): String {
        val t = Instant.ofEpochMilli(epochMs).atZone(zone)
        return "\${t.hour.toString().padStart(2, '0')}:\${t.minute.toString().padStart(2, '0')}"
    }

    private fun siteText(lang: String, state: SiteState): String = when (state) {
        SiteState.AVAILABLE_WITH_TABLE -> AppStrings.siteStateWithTable(lang)
        SiteState.AVAILABLE_NO_TABLE -> AppStrings.siteStateNoTable(lang)
        SiteState.SITE_UNREACHABLE -> AppStrings.siteStateUnreachable(lang)
        SiteState.NO_INTERNET -> AppStrings.siteStateNoInternet(lang)
    }

    private fun tone(state: SiteState) = when (state) {
        SiteState.AVAILABLE_WITH_TABLE -> StatusTone.GREEN
        SiteState.AVAILABLE_NO_TABLE -> StatusTone.AMBER
        SiteState.SITE_UNREACHABLE -> StatusTone.RED
        SiteState.NO_INTERNET -> StatusTone.GREY
    }

    private fun icon(state: SiteState) = when (state) {
        SiteState.AVAILABLE_WITH_TABLE -> StatusIcon.OK
        SiteState.AVAILABLE_NO_TABLE -> StatusIcon.WARNING
        SiteState.SITE_UNREACHABLE -> StatusIcon.SERVER_DOWN
        SiteState.NO_INTERNET -> StatusIcon.OFFLINE
    }

    private fun hint(lang: String, state: SiteState): String? = when (state) {
        SiteState.AVAILABLE_WITH_TABLE -> null
        SiteState.AVAILABLE_NO_TABLE -> AppStrings.siteStateHintNoTable(lang)
        SiteState.SITE_UNREACHABLE -> AppStrings.siteStateHintUnreachable(lang)
        SiteState.NO_INTERNET -> AppStrings.siteStateHintNoInternet(lang)
    }

    /** Chip row of the "Last updated" card. Empty when no queue is selected (nothing is checked then). */
    fun chips(snapshot: OutageSnapshot, lang: String, zone: ZoneId = KYIV_ZONE): List<StatusChip> {
        if (snapshot.queue.isBlank()) return emptyList()
        val out = ArrayList<StatusChip>()
        val site = snapshot.site
        if (site == null) {
            out.add(StatusChip(StatusTone.GREY, StatusIcon.UNKNOWN, AppStrings.siteStateChecking(lang)))
        } else {
            out.add(StatusChip(tone(site.state), icon(site.state), siteText(lang, site.state)))
        }
        if (snapshot.isStale) {
            val since = site?.lastSuccessMs?.let { formatHhmm(it, zone) }
            if (since != null) out.add(StatusChip(StatusTone.AMBER, StatusIcon.WARNING, AppStrings.staleChip(lang, since)))
        }
        if (snapshot.tomorrowPublished) {
            out.add(StatusChip(StatusTone.GREEN, StatusIcon.TOMORROW_OK, AppStrings.tomorrowPublished(lang)))
        } else {
            out.add(StatusChip(StatusTone.GREY, StatusIcon.TOMORROW_PENDING, AppStrings.tomorrowNotPublishedShort(lang)))
        }
        return out
    }

    /** Small status line shown only when the last PowerOn (emergency outages) refresh failed. */
    fun poweronLine(snapshot: OutageSnapshot, lang: String): StatusChip? =
        if (snapshot.poweron?.ok == false) {
            StatusChip(StatusTone.AMBER, StatusIcon.WARNING, AppStrings.poweronUnavailable(lang))
        } else {
            null
        }

    /**
     * The site's own notice ("УВАГА! ВАЖЛИВА ІНФОРМАЦІЯ!") while the page is up but has no schedule
     * table. Shown even without a queue: it concerns everybody in the region.
     */
    fun notice(snapshot: OutageSnapshot): String? {
        val site = snapshot.site ?: return null
        return site.notice?.takeIf { site.state == SiteState.AVAILABLE_NO_TABLE && it.isNotBlank() }
    }

    /**
     * Glass banner above the hero, for degraded site states only. Not shown while the ztoe notice card
     * is: the notice already explains the missing table and the chip below still names the state.
     */
    fun banner(snapshot: OutageSnapshot, lang: String, zone: ZoneId = KYIV_ZONE): SiteBanner? {
        if (snapshot.queue.isBlank()) return null
        val site = snapshot.site ?: return null
        if (site.state == SiteState.AVAILABLE_WITH_TABLE) return null
        if (notice(snapshot) != null) return null
        val since = if (snapshot.isStale) site.lastSuccessMs?.let { formatHhmm(it, zone) } else null
        val message = listOfNotNull(since?.let { AppStrings.staleDataSince(lang, it) }, hint(lang, site.state))
            .joinToString("\\n")
        return SiteBanner(tone(site.state), icon(site.state), siteText(lang, site.state), message)
    }
}

private fun StatusTone.background(): Color = when (this) {
    StatusTone.GREEN -> ZtColors.ChipGreen
    StatusTone.AMBER -> ZtColors.ChipAmber
    StatusTone.RED -> ZtColors.ChipRed
    StatusTone.GREY -> ZtColors.ChipGrey
}

private fun StatusTone.content(): Color = when (this) {
    StatusTone.GREEN -> ZtColors.ChipGreenText
    StatusTone.AMBER -> ZtColors.ChipAmberText
    StatusTone.RED -> ZtColors.ChipRedText
    StatusTone.GREY -> ZtColors.ChipGreyText
}

private fun StatusIcon.vector(): ImageVector = when (this) {
    StatusIcon.OK -> Icons.Default.CheckCircle
    StatusIcon.WARNING -> Icons.Default.Warning
    StatusIcon.SERVER_DOWN -> Icons.Default.CloudOff
    StatusIcon.OFFLINE -> Icons.Default.WifiOff
    StatusIcon.UNKNOWN -> Icons.Default.HelpOutline
    StatusIcon.TOMORROW_OK -> Icons.Default.Event
    StatusIcon.TOMORROW_PENDING -> Icons.Default.EventBusy
}

/** One status pill: tinted background, icon and text in the same family. Text wraps instead of clipping. */
@Composable
fun StatusChipView(chip: StatusChip, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .clip(ZtShapes.Badge)
            .background(chip.tone.background())
            .padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Icon(
            imageVector = chip.icon.vector(),
            contentDescription = null,
            tint = chip.tone.content(),
            modifier = Modifier.size(16.dp)
        )
        Text(text = chip.text, style = ZtType.label, color = chip.tone.content())
    }
}

/** Chips for the "Last updated" card, plus the PowerOn status line when that source is down. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SiteStatusChipRow(snapshot: OutageSnapshot, lang: String, modifier: Modifier = Modifier) {
    val chips = SiteStatusModel.chips(snapshot, lang)
    val poweron = SiteStatusModel.poweronLine(snapshot, lang)
    if (chips.isEmpty() && poweron == null) return
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (chips.isNotEmpty()) {
            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                chips.forEach { StatusChipView(it) }
            }
        }
        if (poweron != null) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Icon(
                    imageVector = poweron.icon.vector(),
                    contentDescription = null,
                    tint = poweron.tone.content(),
                    modifier = Modifier.size(16.dp)
                )
                Text(text = poweron.text, style = ZtType.caption, color = poweron.tone.content())
            }
        }
    }
}

/** Information card with the text ztoe publishes in place of the schedule, quoted as is. */
@Composable
fun SiteNoticeCard(text: String, lang: String, modifier: Modifier = Modifier) {
    GlassCard(
        modifier = modifier
            .fillMaxWidth()
            .semantics(mergeDescendants = true) { contentDescription = AppStrings.siteNoticeA11y(lang) + ". " + text }
    ) {
        Row(
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(ZtColors.ChipAmber),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Info,
                    contentDescription = null,
                    tint = ZtColors.ChipAmberText,
                    modifier = Modifier.size(20.dp)
                )
            }
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text(text = AppStrings.siteNoticeTitle(lang), style = ZtType.overline, color = ZtColors.ChipAmberText)
                text.lines().forEachIndexed { i, line ->
                    Text(
                        text = line,
                        style = if (i == 0) ZtType.subhead else ZtType.body,
                        color = if (i == 0) Color.White else Color(0xE6BAE6FD)
                    )
                }
            }
        }
    }
}

/**
 * Persistent glass banner for a degraded site state (not a 3 s toast). Compact: the title and each
 * message line keep to one line each (two lines for the usual banner).
 */
@Composable
fun SiteStatusBanner(banner: SiteBanner, modifier: Modifier = Modifier) {
    GlassCard(
        modifier = modifier
            .fillMaxWidth()
            .semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite },
        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 12.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(banner.tone.background()),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = banner.icon.vector(),
                    contentDescription = null,
                    tint = banner.tone.content(),
                    modifier = Modifier.size(18.dp)
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                OneLineText(text = banner.title, style = BannerTitle, color = banner.tone.content())
                banner.message.lines().filter { it.isNotBlank() }.forEach { line ->
                    // 0xE6 alpha instead of the 0xB3 token: small text on a translucent card needs the extra contrast
                    OneLineText(text = line, style = ZtType.caption, color = Color(0xE6BAE6FD))
                }
            }
        }
    }
}

private val BannerTitle = ZtType.label.copy(fontWeight = FontWeight.Bold)

/**
 * Text kept on one line: when it does not fit, the size steps down 5 % at a time to at most 15 % below
 * the style (never under 12 sp). If it still does not fit, it wraps instead of being cut.
 */
@Composable
private fun OneLineText(text: String, style: TextStyle, color: Color) = BoxWithConstraints {
    // Measured again when the width changes (rotation, split screen)
    val width = maxWidth
    val minSize = maxOf(style.fontSize.value * 0.85f, 12f)
    var size by remember(text, style, width) { mutableFloatStateOf(style.fontSize.value) }
    var wrap by remember(text, style, width) { mutableStateOf(false) }
    var settled by remember(text, style, width) { mutableStateOf(false) }
    Text(
        text = text,
        style = style.copy(fontSize = size.sp),
        color = color,
        maxLines = if (wrap) Int.MAX_VALUE else 1,
        softWrap = wrap,
        modifier = Modifier.drawWithContent { if (settled) drawContent() },
        onTextLayout = { result ->
            when {
                settled -> Unit
                !result.didOverflowWidth -> settled = true
                size * 0.95f >= minSize -> size *= 0.95f
                else -> { wrap = true; settled = true }
            }
        }
    )
}
`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/ui/components/OutageRowFormat.kt',
    language: 'kotlin',
    description: 'Text of outage rows, tags and the drum summary',
    content: `package ua.blackout.prewarning.ui.components

import ua.blackout.prewarning.core.DayRow
import ua.blackout.prewarning.core.IntervalStatus
import ua.blackout.prewarning.core.OutageEngine
import ua.blackout.prewarning.core.OutageKind
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SlotStatus
import ua.blackout.prewarning.ui.AppStrings
import java.time.LocalDateTime

/**
 * Pure text rules of the outage list under the drum (spec/UI_DRUM.md section 5): one row per outage
 * with its full span, the date on the far side of midnight, kind and state tags. No Android types, so
 * it is unit tested (OutageRowFormatTest) and mirrored by the web simulator.
 */
object OutageRowFormat {

    data class RowText(
        val kind: OutageKind,
        /** "10:00 – 12:00", "23:00 – 01:00 (14.11)", "00:00 – 01:00", "10:00 – --:--" for an overdue emergency. */
        val timeText: String,
        /** Full length of the outage ("2 год"); null when the end is unknown (overdue emergency). */
        val durationText: String?,
        /** "Аварійне" / "Можливі планові роботи"; null for a plain planned outage (the dot is its marker). */
        val kindTag: String?,
        /** "з 13.11 23:00" on the day an outage continues into. */
        val originTag: String?,
        /** "завершено" / "очікується відновлення". */
        val statusTag: String?,
        /** "можливе продовження" when the real end is later than the known schedule. */
        val continueTag: String?,
        val isFinished: Boolean,
        val isEmergency: Boolean,
        val isRepair: Boolean,
        /** One sentence for TalkBack: kind, time, duration and tags. */
        val contentDescription: String
    )

    private fun p2(n: Int) = n.toString().padStart(2, '0')

    fun hhmm(t: LocalDateTime): String = "\${p2(t.hour)}:\${p2(t.minute)}"

    fun dayMonth(t: LocalDateTime): String = "\${p2(t.dayOfMonth)}.\${p2(t.monthValue)}"

    /** End of an outage that leaves the day, with the date it really ends on; exactly 00:00 reads "24:00" of the day before. */
    private fun endWithDate(end: LocalDateTime): String =
        if (end.toLocalTime() == java.time.LocalTime.MIDNIGHT) {
            "24:00 (\${dayMonth(end.minusDays(1))})"
        } else {
            "\${hhmm(end)} (\${dayMonth(end)})"
        }

    fun kindLabel(lang: String, kind: OutageKind): String = when (kind) {
        OutageKind.EMERGENCY -> AppStrings.kindEmergency(lang)
        OutageKind.REPAIR -> AppStrings.kindRepair(lang)
        OutageKind.PLANNED -> AppStrings.kindPlanned(lang)
    }

    fun format(lang: String, row: DayRow): RowText {
        val o = row.outage
        val overdue = row.status == IntervalStatus.OVERDUE
        val finished = row.status == IntervalStatus.FINISHED

        val startText = if (row.continuesFromPrevDay) "00:00" else hhmm(row.from)
        val endText = when {
            overdue -> "--:--"
            row.continuesToNextDay -> endWithDate(o.end)
            else -> OutageEngine.formatSpanTime(row.to)
        }
        val timeText = "$startText – $endText"
        val durationText = if (overdue) null else AppStrings.durationText(lang, row.durationMinutes)
        val kindTag = when (o.kind) {
            OutageKind.EMERGENCY -> AppStrings.kindEmergency(lang)
            OutageKind.REPAIR -> AppStrings.kindRepair(lang)
            OutageKind.PLANNED -> null
        }
        val originTag = if (row.continuesFromPrevDay) {
            AppStrings.rowFromEarlier(lang, "\${dayMonth(o.start)} \${hhmm(o.start)}")
        } else {
            null
        }
        val statusTag = when (row.status) {
            IntervalStatus.FINISHED -> AppStrings.rowFinished(lang)
            IntervalStatus.OVERDUE -> AppStrings.rowOverdue(lang)
            else -> null
        }
        val continueTag = if (o.mayContinue && !finished) AppStrings.rowMayContinue(lang) else null

        val description = listOfNotNull(kindLabel(lang, o.kind), timeText, durationText, originTag, statusTag, continueTag)
            .joinToString(", ")

        return RowText(
            kind = o.kind,
            timeText = timeText,
            durationText = durationText,
            kindTag = kindTag,
            originTag = originTag,
            statusTag = statusTag,
            continueTag = continueTag,
            isFinished = finished,
            isEmergency = o.kind == OutageKind.EMERGENCY,
            isRepair = o.kind == OutageKind.REPAIR,
            contentDescription = description
        )
    }

    /** Contiguous runs of off half-hours of a day as (first cell, last cell exclusive, any emergency). */
    private data class Run(val from: Int, val to: Int, val emergency: Boolean)

    private fun cellsOf(slots: List<BlackoutSlot>): List<BlackoutSlot>? = when (slots.size) {
        48 -> slots
        24 -> slots.flatMap { listOf(it, it) }
        else -> null
    }

    private fun runs(cells: List<BlackoutSlot>): List<Run> {
        val out = ArrayList<Run>()
        var start = -1
        var emergency = false
        for (i in cells.indices) {
            val off = cells[i].status == SlotStatus.POWER_OFF
            if (off) {
                if (start < 0) {
                    start = i
                    emergency = false
                }
                if (cells[i].isEmergency) emergency = true
            } else if (start >= 0) {
                out.add(Run(start, i, emergency))
                start = -1
            }
        }
        if (start >= 0) out.add(Run(start, cells.size, emergency))
        return out
    }

    private fun cellTime(index: Int): String {
        val minutes = index * 30
        return if (minutes >= 1440) "24:00" else "\${p2(minutes / 60)}:\${p2(minutes % 60)}"
    }

    /**
     * One TalkBack sentence for the whole drum, replacing the 48 silent cells:
     * "Шкала доби: без світла: 00:00 – 02:00, 10:00 – 12:00 (аварійне)".
     * [unclearBase] is true when the schedule of the day is not known (grey drum).
     */
    fun drumSummary(lang: String, slots: List<BlackoutSlot>, unclearBase: Boolean): String {
        val head = AppStrings.drumTitle(lang)
        val cells = cellsOf(slots) ?: return "$head: \${AppStrings.outagesUnclear(lang)}"
        val found = runs(cells)
        val spans = found.joinToString(", ") { r ->
            val text = "\${cellTime(r.from)} – \${cellTime(r.to)}"
            if (r.emergency) "$text (\${AppStrings.drumEmergencyMark(lang)})" else text
        }
        val parts = ArrayList<String>()
        if (unclearBase) parts.add(AppStrings.outagesUnclear(lang))
        if (found.isNotEmpty()) {
            parts.add(AppStrings.drumPowerOffAt(lang, spans))
        } else if (!unclearBase) {
            parts.add(AppStrings.drumNoOutages(lang))
        }
        return "$head: \${parts.joinToString("; ")}"
    }
}
`
  },
  {
    path: 'app/src/main/res/xml/blackout_widget_strip_info.xml',
    language: 'xml',
    description: 'Strip (4x1) drum-only AppWidget Provider Metadata',
    content: `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:description="@string/widget_strip_name"
    android:initialKeyguardLayout="@layout/glance_default_loading_layout"
    android:initialLayout="@layout/glance_default_loading_layout"
    android:minWidth="250dp"
    android:minHeight="40dp"
    android:previewImage="@drawable/widget_preview_strip"
    android:resizeMode="horizontal|vertical"
    android:targetCellWidth="4"
    android:targetCellHeight="1"
    android:updatePeriodMillis="900000"
    android:configure="ua.blackout.prewarning.widget.WidgetConfigActivity"
    android:widgetFeatures="reconfigurable|configuration_optional"
    android:widgetCategory="home_screen" />
`
  },
  {
    path: 'app/src/main/res/drawable/widget_preview_strip.xml',
    language: 'xml',
    description: 'Strip (4x1) Widget Picker Thumbnail Vector Drawable',
    content: `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="320dp"
    android:height="90dp"
    android:viewportWidth="320"
    android:viewportHeight="90">

    <!-- Outer rounded widget background (#141A29) -->
    <path
        android:fillColor="#141A29"
        android:pathData="M22,4 L298,4 A18,18 0 0,1 316,22 L316,68 A18,18 0 0,1 298,86 L22,86 A18,18 0 0,1 4,68 L4,22 A18,18 0 0,1 22,4 Z" />
    <path
        android:fillColor="#00000000"
        android:strokeColor="#33FFFFFF"
        android:strokeWidth="1.5"
        android:pathData="M22,4 L298,4 A18,18 0 0,1 316,22 L316,68 A18,18 0 0,1 298,86 L22,86 A18,18 0 0,1 4,68 L4,22 A18,18 0 0,1 22,4 Z" />

    <!-- Drum at the big widget's aspect (720 x 132): scaled to 52 high, centred -->
    <group android:scaleY="0.79" android:pivotY="45">
    <!-- Vintage analog counter faceplate (#D4D1C1) -->
    <path
        android:fillColor="#D4D1C1"
        android:strokeColor="#7A7768"
        android:strokeWidth="1.5"
        android:pathData="M22,12 L298,12 A8,8 0 0,1 306,20 L306,70 A8,8 0 0,1 298,78 L22,78 A8,8 0 0,1 14,70 L14,20 A8,8 0 0,1 22,12 Z" />

    <!-- Recessed drum window (#4E514E) -->
    <path
        android:fillColor="#4E514E"
        android:pathData="M24,18 L296,18 A4,4 0 0,1 300,22 L300,52 A4,4 0 0,1 296,56 L24,56 A4,4 0 0,1 20,52 L20,22 A4,4 0 0,1 24,18 Z" />

    <!-- Light power-on track (#FCFBF7) -->
    <path
        android:fillColor="#FCFBF7"
        android:pathData="M24,22 L296,22 L296,52 L24,52 Z" />

    <!-- Red blackout segments (#D62E26) -->
    <path
        android:fillColor="#D62E26"
        android:pathData="M70,22 L115,22 L115,52 L70,52 Z" />
    <path
        android:fillColor="#D62E26"
        android:pathData="M182,22 L238,22 L238,52 L182,52 Z" />

    <!-- Emergency (amber) block -->
    <path
        android:fillColor="#F28A1B"
        android:pathData="M250,22 L272,22 L272,52 L250,52 Z" />

    <!-- Hour markers 00 06 12 18 24 -->
    <path
        android:fillColor="#1C1B18"
        android:pathData="M24,63 L33,63 L33,68 L24,68 Z M88,63 L97,63 L97,68 L88,68 Z M156,63 L165,63 L165,68 L156,68 Z M224,63 L233,63 L233,68 L224,68 Z M287,63 L296,63 L296,68 L287,68 Z" />

    <!-- Black current-time needle (#0B0B0A) with halo -->
    <path
        android:fillColor="#D9FFFFFF"
        android:pathData="M145,14 L151,14 L151,60 L145,60 Z" />
    <path
        android:fillColor="#0B0B0A"
        android:pathData="M146.5,14 L149.5,14 L149.5,60 L146.5,60 Z" />
    </group>
</vector>
`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/core/Subscriptions.kt',
    language: 'kotlin',
    description: 'Multi-address subscriptions: model, repair, store operations and migration (spec/SUBSCRIPTIONS.md)',
    content: `package ua.blackout.prewarning.core

/**
 * Multi-address subscriptions: the stored model, its repair rules, the store operations, the
 * migration from single-address settings, the primary mirror, the alert grouping and the main-screen switcher. Specified in \`spec/SUBSCRIPTIONS.md\`, golden cases in
 * \`spec/vectors/subscriptions.json\`, mirrored in \`src/core/subscriptions.ts\`.
 *
 * The model is exchanged as plain maps (\`toMap\` / \`fromMap\`) so this package needs no JSON library;
 * the platform encodes the map as a string.
 */

enum class QueueSource { LOOKUP, MANUAL }

data class SubscriptionAddress(
    val remSlug: String,
    val settlementId: String,
    val streetId: String,
    /** Display name resolved from [streetId] when the address was stored; may be empty. */
    val streetName: String,
    val house: String,
    /** Full human readable line (1.4.0 \`selected_address\`); may be empty. */
    val text: String
) {
    val isValid: Boolean
        get() = remSlug.isNotBlank() && settlementId.isNotBlank() && streetId.isNotBlank() && house.isNotBlank()

    /** The 1.4.0 address key of \`ledger_*\`, \`repair_*\`, \`ids_*\` and emergency alert keys. */
    val key: String
        get() = "$settlementId|\${StreetKey.of(streetName.ifBlank { streetId })}|\${HouseKey.of(house)}"
}

data class Subscription(
    val id: String,
    /** Cleaned user label; empty = automatic (see [Subscriptions.displayLabel]). */
    val label: String = "",
    val address: SubscriptionAddress? = null,
    val queue: String? = null,
    val queueSource: QueueSource = QueueSource.MANUAL,
    val queueStatusText: String? = null,
    val plannedAlerts: Boolean = true,
    val emergencyAlerts: Boolean = true,
    val createdAtMs: Long = 0L
) {
    /** \`a:<address key>\` or \`q:<queue>\`; two items with one identity are duplicates. */
    val identity: String
        get() = address?.let { "a:\${it.key}" } ?: "q:\${queue.orEmpty()}"
}

data class SubscriptionStore(
    val primaryId: String? = null,
    val items: List<Subscription> = emptyList()
) {
    val primary: Subscription? get() = items.firstOrNull { it.id == primaryId }

    companion object {
        val EMPTY = SubscriptionStore()
    }
}

/** 1.4.0 single-address settings, plus the street name the platform resolved for [streetId]. */
data class LegacySettings(
    val queue: String,
    val customQueueStatusText: String?,
    val selectedAddress: String?,
    val remSlug: String,
    val settlementId: String,
    val streetId: String,
    val streetName: String?,
    val house: String,
    val notificationsEnabled: Boolean,
    val emergencyNotificationsEnabled: Boolean
)

data class MigrationResult(val store: SubscriptionStore, val alertsMaster: Boolean)

/** Values for the single-address keys, written from the primary item (\`spec/SUBSCRIPTIONS.md\` section 7). */
data class LegacyMirror(
    val queue: String,
    val customQueueStatusText: String?,
    val selectedAddress: String?,
    val remSlug: String,
    val settlementId: String,
    val streetId: String,
    val house: String,
    val notificationsEnabled: Boolean,
    val emergencyNotificationsEnabled: Boolean
)

data class DroppedItem(val id: String?, val reason: String)

data class RepairResult(val store: SubscriptionStore, val dropped: List<DroppedItem>)

/** Either the new store or an error code from \`spec/SUBSCRIPTIONS.md\` section 4. */
sealed class StoreResult {
    data class Ok(val store: SubscriptionStore) : StoreResult()
    data class Error(val code: String, val existingId: String? = null) : StoreResult()
}

object Subscriptions {
    const val SCHEMA_VERSION = 1
    const val MAX_ITEMS = 5
    const val MAX_LABEL_LENGTH = 40

    const val ERR_INVALID = "invalid"
    const val ERR_DUPLICATE_ID = "duplicate_id"
    const val ERR_DUPLICATE = "duplicate"
    const val ERR_LIMIT = "limit_reached"
    const val ERR_NOT_FOUND = "not_found"

    private val ID = Regex("^[a-z0-9]{4,32}$")
    private val QUEUE = Regex("^[1-6]\\\\.[12]$")
    private val SPACES = Regex("[ \\\\t\\\\n\\\\u000B\\\\f\\\\r\\\\u00A0\\\\u200B]+")

    fun isValidId(id: String?): Boolean = id != null && ID.matches(id)
    fun isValidQueue(queue: String?): Boolean = queue != null && QUEUE.matches(queue)

    private fun collapse(raw: String): String = SPACES.replace(raw, " ").trim(' ')

    // ---------------------------------------------------------------------------------------------
    // Labels
    // ---------------------------------------------------------------------------------------------

    fun cleanLabel(raw: String?): String {
        val s = collapse(raw.orEmpty())
        if (s.length <= MAX_LABEL_LENGTH) return s
        var end = MAX_LABEL_LENGTH
        if (Character.isHighSurrogate(s[end - 1])) end--
        return s.substring(0, end)
    }

    fun defaultLabel(item: Subscription): String {
        val a = item.address ?: return "Черга \${item.queue.orEmpty()}"
        val house = collapse(a.house)
        val street = collapse(TextNorm.decodeEntities(a.streetName))
        if (street.isEmpty()) return "буд. $house"
        val tokens = street.split(' ')
        val core = if (tokens.size > 1 && StreetKey.isTypeWord(tokens[0])) tokens.drop(1) else tokens
        return "\${core.joinToString(" ")} $house"
    }

    fun displayLabel(item: Subscription): String = item.label.ifEmpty { defaultLabel(item) }

    // ---------------------------------------------------------------------------------------------
    // Maps
    // ---------------------------------------------------------------------------------------------

    fun toMap(store: SubscriptionStore): Map<String, Any?> = linkedMapOf(
        "schemaVersion" to SCHEMA_VERSION,
        "primaryId" to store.primaryId,
        "items" to store.items.map { itemToMap(it) }
    )

    fun itemToMap(item: Subscription): Map<String, Any?> = linkedMapOf(
        "id" to item.id,
        "label" to item.label,
        "address" to item.address?.let {
            linkedMapOf(
                "remSlug" to it.remSlug,
                "settlementId" to it.settlementId,
                "streetId" to it.streetId,
                "streetName" to it.streetName,
                "house" to it.house,
                "text" to it.text
            )
        },
        "queue" to item.queue,
        "queueSource" to item.queueSource.name,
        "queueStatusText" to item.queueStatusText,
        "plannedAlerts" to item.plannedAlerts,
        "emergencyAlerts" to item.emergencyAlerts,
        "createdAtMs" to item.createdAtMs
    )

    /**
     * Lenient read: wrong types read as missing, nothing throws. Returns null ("absent") when the map
     * is not a version-1 store, so the caller migrates again from the legacy keys. Call [repair] on
     * the result before use.
     */
    fun fromMap(map: Map<*, *>?): SubscriptionStore? {
        map ?: return null
        val version = (map["schemaVersion"] as? Number)?.toInt() ?: return null
        if (version != SCHEMA_VERSION) return null
        val items = (map["items"] as? List<*>).orEmpty().mapNotNull { (it as? Map<*, *>)?.let(::itemFromMap) }
        return SubscriptionStore(primaryId = map["primaryId"] as? String, items = items)
    }

    fun itemFromMap(m: Map<*, *>): Subscription {
        val a = m["address"] as? Map<*, *>
        return Subscription(
            id = m["id"] as? String ?: "",
            label = m["label"] as? String ?: "",
            address = a?.let {
                SubscriptionAddress(
                    remSlug = it["remSlug"] as? String ?: "",
                    settlementId = it["settlementId"] as? String ?: "",
                    streetId = it["streetId"] as? String ?: "",
                    streetName = it["streetName"] as? String ?: "",
                    house = it["house"] as? String ?: "",
                    text = it["text"] as? String ?: ""
                )
            },
            queue = m["queue"] as? String,
            queueSource = if (m["queueSource"] == QueueSource.LOOKUP.name) QueueSource.LOOKUP else QueueSource.MANUAL,
            queueStatusText = m["queueStatusText"] as? String,
            plannedAlerts = m["plannedAlerts"] as? Boolean ?: true,
            emergencyAlerts = m["emergencyAlerts"] as? Boolean ?: true,
            createdAtMs = (m["createdAtMs"] as? Number)?.toLong() ?: 0L
        )
    }

    // ---------------------------------------------------------------------------------------------
    // Repair
    // ---------------------------------------------------------------------------------------------

    /** Repair step 2: invalid queue or address -> null, label cleaned. */
    fun normalize(item: Subscription): Subscription = item.copy(
        label = cleanLabel(item.label),
        address = item.address?.takeIf { it.isValid },
        queue = item.queue?.takeIf { isValidQueue(it) }
    )

    fun repair(store: SubscriptionStore): RepairResult {
        val dropped = ArrayList<DroppedItem>()
        var items = store.items.filter { ok -> isValidId(ok.id).also { if (!it) dropped += DroppedItem(ok.id, "invalid_id") } }
        items = items.map(::normalize)
        items = items.filter { ok -> (ok.address != null || ok.queue != null).also { if (!it) dropped += DroppedItem(ok.id, "empty") } }
        val ids = HashSet<String>()
        items = items.filter { ok -> ids.add(ok.id).also { if (!it) dropped += DroppedItem(ok.id, "duplicate_id") } }
        val identities = HashSet<String>()
        items = items.filter { ok -> identities.add(ok.identity).also { if (!it) dropped += DroppedItem(ok.id, "duplicate_address") } }
        if (items.size > MAX_ITEMS) {
            items.drop(MAX_ITEMS).forEach { dropped += DroppedItem(it.id, "over_limit") }
            items = items.take(MAX_ITEMS)
        }
        val primaryId = store.primaryId?.takeIf { p -> items.any { it.id == p } } ?: items.firstOrNull()?.id
        return RepairResult(SubscriptionStore(primaryId, items), dropped)
    }

    // ---------------------------------------------------------------------------------------------
    // Operations
    // ---------------------------------------------------------------------------------------------

    fun add(store: SubscriptionStore, candidate: Subscription): StoreResult {
        if (!isValidId(candidate.id)) return StoreResult.Error(ERR_INVALID)
        val item = normalize(candidate)
        if (item.address == null && item.queue == null) return StoreResult.Error(ERR_INVALID)
        if (store.items.any { it.id == item.id }) return StoreResult.Error(ERR_DUPLICATE_ID)
        store.items.firstOrNull { it.identity == item.identity }?.let { return StoreResult.Error(ERR_DUPLICATE, it.id) }
        if (store.items.size >= MAX_ITEMS) return StoreResult.Error(ERR_LIMIT)
        return StoreResult.Ok(SubscriptionStore(store.primaryId ?: item.id, store.items + item))
    }

    fun remove(store: SubscriptionStore, id: String): StoreResult {
        if (store.items.none { it.id == id }) return StoreResult.Error(ERR_NOT_FOUND)
        val rest = store.items.filter { it.id != id }
        val primaryId = if (store.primaryId != id && rest.any { it.id == store.primaryId }) {
            store.primaryId
        } else {
            // minByOrNull keeps the first of equal values, which is the list-order tie rule
            rest.minByOrNull { it.createdAtMs }?.id
        }
        return StoreResult.Ok(SubscriptionStore(primaryId, rest))
    }

    fun setPrimary(store: SubscriptionStore, id: String): StoreResult =
        if (store.items.none { it.id == id }) StoreResult.Error(ERR_NOT_FOUND) else StoreResult.Ok(store.copy(primaryId = id))

    fun setPlanned(store: SubscriptionStore, id: String, on: Boolean): StoreResult = update(store, id) { it.copy(plannedAlerts = on) }

    fun setEmergency(store: SubscriptionStore, id: String, on: Boolean): StoreResult = update(store, id) { it.copy(emergencyAlerts = on) }

    fun rename(store: SubscriptionStore, id: String, raw: String?): StoreResult = update(store, id) { it.copy(label = cleanLabel(raw)) }

    /** Moves the item to [toIndex] (clamped); the primary and the fields stay unchanged (spec section 4). */
    fun move(store: SubscriptionStore, id: String, toIndex: Int): StoreResult {
        val from = store.items.indexOfFirst { it.id == id }
        if (from < 0) return StoreResult.Error(ERR_NOT_FOUND)
        val to = toIndex.coerceIn(0, store.items.size - 1)
        val items = store.items.toMutableList()
        items.add(to, items.removeAt(from))
        return StoreResult.Ok(store.copy(items = items))
    }

    /** Result of a ZTOE lookup for an address item (\`spec/SUBSCRIPTIONS.md\` section 4). */
    fun setQueueInfo(store: SubscriptionStore, id: String, queue: String?, statusText: String?, addressText: String?): StoreResult {
        val item = store.items.firstOrNull { it.id == id } ?: return StoreResult.Error(ERR_NOT_FOUND)
        val address = item.address ?: return StoreResult.Error(ERR_INVALID)
        return update(store, id) {
            it.copy(
                queue = queue?.takeIf { q -> isValidQueue(q) },
                queueStatusText = statusText?.takeIf { s -> s.isNotBlank() },
                address = if (addressText.isNullOrBlank()) address else address.copy(text = addressText)
            )
        }
    }

    /**
     * The user edited the item's address (\`spec/SUBSCRIPTIONS.md\` section 4): address, queue and status text come
     * from the lookup; id, label, switches, position and primary stay. Another item with the new identity is a duplicate.
     */
    fun setAddress(store: SubscriptionStore, id: String, address: SubscriptionAddress, queue: String?, statusText: String?): StoreResult {
        val item = store.items.firstOrNull { it.id == id } ?: return StoreResult.Error(ERR_NOT_FOUND)
        val changed = normalize(
            item.copy(
                address = address,
                queue = queue,
                queueSource = QueueSource.LOOKUP,
                queueStatusText = statusText?.takeIf { it.isNotBlank() }
            )
        )
        if (changed.address == null) return StoreResult.Error(ERR_INVALID)
        store.items.firstOrNull { it.id != id && it.identity == changed.identity }?.let { return StoreResult.Error(ERR_DUPLICATE, it.id) }
        return update(store, id) { changed }
    }

    private inline fun update(store: SubscriptionStore, id: String, change: (Subscription) -> Subscription): StoreResult {
        if (store.items.none { it.id == id }) return StoreResult.Error(ERR_NOT_FOUND)
        return StoreResult.Ok(store.copy(items = store.items.map { if (it.id == id) change(it) else it }))
    }

    // ---------------------------------------------------------------------------------------------
    // Effective switches
    // ---------------------------------------------------------------------------------------------

    fun plannedActive(master: Boolean, item: Subscription): Boolean = master && item.plannedAlerts && item.queue != null

    fun emergencyActive(master: Boolean, item: Subscription, poweronIdsKnown: Boolean): Boolean =
        master && item.emergencyAlerts && item.address != null && poweronIdsKnown

    fun anyAlertsEnabled(master: Boolean, store: SubscriptionStore): Boolean =
        master && store.items.any { it.plannedAlerts || it.emergencyAlerts }

    // ---------------------------------------------------------------------------------------------
    // Mirror of the primary item into the single-address keys (section 7)
    // ---------------------------------------------------------------------------------------------

    fun primaryMirror(store: SubscriptionStore, master: Boolean): LegacyMirror {
        val p = store.primary
        val a = p?.address
        return LegacyMirror(
            queue = p?.queue.orEmpty(),
            customQueueStatusText = p?.queueStatusText,
            selectedAddress = if (p != null && a != null) a.text.ifEmpty { displayLabel(p) } else null,
            remSlug = a?.remSlug.orEmpty(),
            settlementId = a?.settlementId.orEmpty(),
            streetId = a?.streetId.orEmpty(),
            house = a?.house.orEmpty(),
            notificationsEnabled = master && (p?.plannedAlerts ?: true),
            emergencyNotificationsEnabled = master && (p?.emergencyAlerts ?: true)
        )
    }

    // ---------------------------------------------------------------------------------------------
    // Migration
    // ---------------------------------------------------------------------------------------------

    fun migrate(legacy: LegacySettings, newId: String, nowMs: Long): MigrationResult {
        val queue = legacy.queue.takeIf { isValidQueue(it) }
        val address = SubscriptionAddress(
            remSlug = legacy.remSlug,
            settlementId = legacy.settlementId,
            streetId = legacy.streetId,
            streetName = legacy.streetName.orEmpty(),
            house = legacy.house,
            text = legacy.selectedAddress.orEmpty()
        )
        val item = when {
            address.isValid -> Subscription(
                id = newId,
                address = address,
                queue = queue,
                queueSource = QueueSource.LOOKUP,
                queueStatusText = legacy.customQueueStatusText?.takeIf { it.isNotBlank() },
                createdAtMs = nowMs
            )
            queue != null -> Subscription(id = newId, queue = queue, queueSource = QueueSource.MANUAL, createdAtMs = nowMs)
            else -> null
        }?.copy(
            plannedAlerts = legacy.notificationsEnabled,
            emergencyAlerts = legacy.emergencyNotificationsEnabled
        )
        val store = if (item == null) SubscriptionStore.EMPTY else SubscriptionStore(item.id, listOf(item))
        return MigrationResult(store, legacy.notificationsEnabled || legacy.emergencyNotificationsEnabled)
    }

    // ---------------------------------------------------------------------------------------------
    // Alerts for every item (section 8)
    // ---------------------------------------------------------------------------------------------

    /** The primary first, then the other items by \`createdAtMs\`, list order on ties. */
    fun alertOrder(store: SubscriptionStore): List<Subscription> {
        val primary = store.primary
        val rest = store.items.withIndex()
            .filter { it.value.id != primary?.id }
            .sortedWith(compareBy<IndexedValue<Subscription>> { it.value.createdAtMs }.thenBy { it.index })
            .map { it.value }
        return listOfNotNull(primary) + rest
    }

    /** One planned alert per (queue, span start, span end) over every \`plannedActive\` item (8.1). */
    fun groupAlerts(store: SubscriptionStore, master: Boolean, alertsById: Map<String, List<AlertSpec>>): List<PlannedGroup> {
        data class Acc(val queue: String, val first: AlertSpec, var mayContinue: Boolean, val members: LinkedHashSet<String>)
        val groups = LinkedHashMap<String, Acc>()
        for (item in alertOrder(store)) {
            if (!plannedActive(master, item)) continue
            val queue = item.queue ?: continue
            val alerts = alertsById[item.id] ?: continue
            for (a in alerts) {
                val key = "planned_q\${queue}_\${a.spanStart}_\${a.spanEnd}"
                val acc = groups.getOrPut(key) { Acc(queue, a, false, LinkedHashSet()) }
                acc.mayContinue = acc.mayContinue || a.mayContinue
                acc.members.add(item.id)
            }
        }
        return groups.map { (key, g) ->
            PlannedGroup(
                key = key,
                queue = g.queue,
                fireAt = g.first.fireAt,
                spanStart = g.first.spanStart,
                spanEnd = g.first.spanEnd,
                mayContinue = g.mayContinue,
                durationMinutes = g.first.durationMinutes,
                memberIds = g.members.toList()
            )
        }.sortedWith(compareBy<PlannedGroup> { it.fireAt }.thenBy { it.spanStart }.thenBy { it.key })
    }

    /** Fired-registry key of one item for one span (8.2). */
    fun memberKey(id: String, spanStart: java.time.LocalDateTime): String = "planned_\${id}_$spanStart"

    /** The address-independent key 1.4.0 recorded; it counts for every item. */
    fun legacyAlertKey(spanStart: java.time.LocalDateTime): String = "planned_$spanStart"

    fun pendingMembers(group: PlannedGroup, notified: (String) -> Boolean): List<String> =
        group.memberIds.filter { !notified(memberKey(it, group.spanStart)) && !notified(legacyAlertKey(group.spanStart)) }

    /** Labels that open the planned text, or null when the store has at most one item (8.3). */
    fun alertLabels(store: SubscriptionStore, memberIds: List<String>): String? {
        if (store.items.size <= 1 || memberIds.isEmpty()) return null
        val labels = memberIds.mapNotNull { id -> store.items.firstOrNull { it.id == id }?.let { displayLabel(it) } }
        if (labels.isEmpty()) return null
        val head = labels.take(2).joinToString(" · ")
        return if (labels.size > 2) "$head +\${labels.size - 2}" else head
    }

    // ---------------------------------------------------------------------------------------------
    // Main screen (section 9)
    // ---------------------------------------------------------------------------------------------

    /** The chips of the address switcher: every item in list order, or none with fewer than 2 items. */
    fun switcherItems(store: SubscriptionStore): List<Subscription> = if (store.items.size >= 2) store.items else emptyList()

    /** The item the main screen shows: the selected one if it still exists, else the primary. */
    fun viewItem(store: SubscriptionStore, selectedId: String?): Subscription? =
        store.items.firstOrNull { it.id == selectedId } ?: store.primary

    /** The master is on but no item has a switch on: "on" would silently mean nothing. */
    fun noAlertsCaption(master: Boolean, store: SubscriptionStore): Boolean =
        master && store.items.isNotEmpty() && !anyAlertsEnabled(master, store)

    // ---------------------------------------------------------------------------------------------
    // Widgets (spec/SUBSCRIPTIONS.md section 10)
    // ---------------------------------------------------------------------------------------------

    /** The item a widget shows: its bound item if it still exists, else the primary (null = follow primary). */
    fun widgetItem(store: SubscriptionStore, boundId: String?): Subscription? = viewItem(store, boundId)

    /**
     * The address label a widget prints: always with two or more items; with one item only when the bound
     * item was removed, so the fall back to the primary is visible.
     */
    fun widgetLabel(store: SubscriptionStore, boundId: String?): String? {
        val item = widgetItem(store, boundId) ?: return null
        val removed = boundId != null && store.items.none { it.id == boundId }
        return if (store.items.size >= 2 || removed) displayLabel(item) else null
    }

    /** The distinct items the placed widgets show, in order of first appearance (redraw alarms, polling). */
    fun widgetItemIds(store: SubscriptionStore, boundIds: List<String?>): List<String> =
        boundIds.mapNotNull { widgetItem(store, it)?.id }.distinct()

    /**
     * Android: the cards of a widget's address stack (\`spec/SUBSCRIPTIONS.md\` section 10). A widget that follows
     * the primary shows every item when there are two or more, the primary first; otherwise its one item.
     */
    fun widgetStackIds(store: SubscriptionStore, boundId: String?): List<String> {
        if (boundId == null && store.items.size >= 2) {
            val primary = store.items.firstOrNull { it.id == store.primaryId }
            return listOfNotNull(primary?.id) + store.items.filter { it.id != primary?.id }.map { it.id }
        }
        return listOfNotNull(widgetItem(store, boundId)?.id)
    }
}

/** One planned pre-warning shared by every item on one queue with the same span (\`spec/SUBSCRIPTIONS.md\` 8.1). */
data class PlannedGroup(
    val key: String,
    val queue: String,
    val fireAt: java.time.LocalDateTime,
    val spanStart: java.time.LocalDateTime,
    val spanEnd: java.time.LocalDateTime,
    val mayContinue: Boolean,
    val durationMinutes: Long,
    val memberIds: List<String>
)
`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/data/repository/SubscriptionRepository.kt',
    language: 'kotlin',
    description: 'Stores the multi-address subscriptions and the alerts master switch in the user settings',
    content: `package ua.blackout.prewarning.data.repository

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import ua.blackout.prewarning.core.LegacySettings
import ua.blackout.prewarning.core.RepairResult
import ua.blackout.prewarning.core.StoreResult
import ua.blackout.prewarning.core.SubscriptionStore
import ua.blackout.prewarning.core.Subscriptions
import ua.blackout.prewarning.data.model.UserSettings
import ua.blackout.prewarning.data.parser.ZtoeAddressLookup
import java.security.SecureRandom

/**
 * Stores the multi-address subscriptions (\`spec/SUBSCRIPTIONS.md\`): the store as the JSON string
 * [KEY_STORE] and the kill switch [KEY_MASTER], both in the user settings file so they travel with a
 * device backup. The rules live in [Subscriptions]; this class only encodes, reads and writes.
 *
 * Used through [SubscriptionSync], which runs [ensureMigrated] before every read or change and
 * writes the primary item back into the single-address keys (multi-address step 2).
 */
class SubscriptionRepository(
    private val prefs: SharedPreferences,
    private val clock: () -> Long = System::currentTimeMillis,
    private val random: () -> String = ::randomId
) {
    constructor(context: Context) : this(
        context.applicationContext.getSharedPreferences(SETTINGS_PREFS, Context.MODE_PRIVATE)
    )

    companion object {
        const val SETTINGS_PREFS = "zt_user_settings_v1"
        const val KEY_STORE = "zt_subscriptions_v1"
        const val KEY_MASTER = "alerts_master_enabled"

        private val LOCK = Any()
        private val RNG = SecureRandom()
        private const val ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789"

        /** 8 random characters from \`[a-z0-9]\`. */
        fun randomId(): String = buildString { repeat(8) { append(ID_CHARS[RNG.nextInt(ID_CHARS.length)]) } }

        /** The 1.4.0 settings as migration input; [streetName] is resolved by the caller (see [resolveStreetName]). */
        fun legacyFrom(settings: UserSettings, streetName: String?): LegacySettings {
            val q = settings.selectedAddressQuery
            return LegacySettings(
                queue = settings.queue,
                customQueueStatusText = settings.customQueueStatusText,
                selectedAddress = settings.selectedAddress,
                remSlug = q?.remId.orEmpty(),
                settlementId = q?.settlementId.orEmpty(),
                streetId = q?.streetId.orEmpty(),
                streetName = streetName,
                house = q?.house.orEmpty(),
                notificationsEnabled = settings.notificationsEnabled,
                emergencyNotificationsEnabled = settings.emergencyNotificationsEnabled
            )
        }

        /** Same lookup as \`OutageRepository.addressKey\`, so the migrated address key matches 1.4.0. */
        fun resolveStreetName(streetId: String?): String? {
            if (streetId.isNullOrBlank()) return null
            return try {
                ZtoeAddressLookup.findStreetById(streetId)?.nameUk
            } catch (_: Exception) {
                null
            }
        }

        // -----------------------------------------------------------------------------------------
        // JSON <-> plain map. Written by hand because JSONObject(Map) drops null values in some
        // org.json versions and keeps them in others; the stored text must not depend on that.
        // -----------------------------------------------------------------------------------------

        fun encode(store: SubscriptionStore): String = (toJson(Subscriptions.toMap(store)) as JSONObject).toString()

        /** Returns null for missing, unreadable or non-version-1 text ("absent"). */
        fun decode(text: String?): SubscriptionStore? {
            if (text.isNullOrBlank()) return null
            val parsed = try {
                JSONObject(text)
            } catch (_: Exception) {
                return null
            }
            return Subscriptions.fromMap(fromJson(parsed) as Map<*, *>)
        }

        private fun toJson(v: Any?): Any = when (v) {
            null -> JSONObject.NULL
            is Map<*, *> -> JSONObject().also { o -> v.forEach { (k, x) -> o.put(k.toString(), toJson(x)) } }
            is List<*> -> JSONArray().also { a -> v.forEach { a.put(toJson(it)) } }
            else -> v
        }

        private fun fromJson(v: Any?): Any? = when (v) {
            null, JSONObject.NULL -> null
            is JSONObject -> v.keys().asSequence().associateWith { fromJson(v.opt(it)) }
            is JSONArray -> (0 until v.length()).map { fromJson(v.opt(it)) }
            is Int -> v.toLong()
            else -> v
        }
    }

    /** The repaired store, or null when it has never been written (or is unreadable): then migrate. */
    fun read(): RepairResult? = decode(prefs.getString(KEY_STORE, null))?.let { Subscriptions.repair(it) }

    fun store(): SubscriptionStore = read()?.store ?: SubscriptionStore.EMPTY

    fun alertsMaster(): Boolean = prefs.getBoolean(KEY_MASTER, true)

    fun setAlertsMaster(on: Boolean) {
        prefs.edit().putBoolean(KEY_MASTER, on).apply()
    }

    /**
     * Runs the one-time migration from the 1.4.0 settings when the store is absent and returns the
     * store in use. [legacy] is only evaluated when a migration is needed.
     */
    fun ensureMigrated(legacy: () -> LegacySettings): SubscriptionStore = synchronized(LOCK) {
        read()?.let { return it.store }
        val result = Subscriptions.migrate(legacy(), random(), clock())
        prefs.edit()
            .putString(KEY_STORE, encode(result.store))
            .putBoolean(KEY_MASTER, result.alertsMaster)
            .apply()
        result.store
    }

    /** Read-modify-write under one lock; writes only when [op] succeeds. */
    fun mutate(op: (SubscriptionStore) -> StoreResult): StoreResult = synchronized(LOCK) {
        val result = op(store())
        if (result is StoreResult.Ok) prefs.edit().putString(KEY_STORE, encode(result.store)).apply()
        result
    }

    /** A fresh id that no current item uses. */
    fun newItemId(): String {
        val used = store().items.map { it.id }.toSet()
        while (true) {
            val id = random()
            if (id !in used && Subscriptions.isValidId(id)) return id
        }
    }
}
`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/data/repository/SubscriptionSync.kt',
    language: 'kotlin',
    description: 'Changes the subscription store and mirrors the primary address into the single-address settings',
    content: `package ua.blackout.prewarning.data.repository

import android.content.Context
import ua.blackout.prewarning.core.QueueSource
import ua.blackout.prewarning.core.StoreResult
import ua.blackout.prewarning.core.Subscription
import ua.blackout.prewarning.core.SubscriptionAddress
import ua.blackout.prewarning.core.SubscriptionStore
import ua.blackout.prewarning.core.Subscriptions
import ua.blackout.prewarning.data.model.SelectedAddressQuery

/**
 * The one way to change addresses and alert switches since multi-address step 2
 * (\`spec/SUBSCRIPTIONS.md\` section 7). Every call runs the one-time migration first, changes the
 * subscription store, then writes the primary item into the single-address keys that the main
 * screen and widgets still read (alerts read the store, section 8). Callers sync alarms and widgets themselves.
 */
class SubscriptionSync(context: Context) {
    private val appContext = context.applicationContext
    private val settingsRepo = SettingsRepository(appContext)
    private val repo = SubscriptionRepository(appContext)

    fun ensureReady(): SubscriptionStore = repo.ensureMigrated {
        val s = settingsRepo.getSettings()
        SubscriptionRepository.legacyFrom(s, SubscriptionRepository.resolveStreetName(s.selectedAddressQuery?.streetId))
    }

    fun store(): SubscriptionStore {
        ensureReady()
        return repo.store()
    }

    fun master(): Boolean {
        ensureReady()
        return repo.alertsMaster()
    }

    fun setMaster(on: Boolean) {
        ensureReady()
        val was = repo.alertsMaster()
        repo.setAlertsMaster(on)
        if (was != on) settingsRepo.applyMasterSound(on)
        mirror()
    }

    /** Applies [op] to the store; on success writes the mirror. */
    fun change(op: (SubscriptionStore) -> StoreResult): StoreResult {
        ensureReady()
        val result = repo.mutate(op)
        if (result is StoreResult.Ok) mirror()
        return result
    }

    fun addFromLookup(queue: String, statusText: String?, addressText: String, query: SelectedAddressQuery): StoreResult {
        ensureReady()
        val item = Subscription(
            id = repo.newItemId(),
            address = SubscriptionAddress(
                remSlug = query.remId,
                settlementId = query.settlementId,
                streetId = query.streetId,
                streetName = SubscriptionRepository.resolveStreetName(query.streetId).orEmpty(),
                house = query.house,
                text = addressText
            ),
            queue = queue.takeIf { Subscriptions.isValidQueue(it) },
            queueSource = QueueSource.LOOKUP,
            queueStatusText = statusText?.takeIf { it.isNotBlank() },
            createdAtMs = System.currentTimeMillis()
        )
        return change { Subscriptions.add(it, item) }
    }

    /** The user edited the address of item [id] in Settings (\`Subscriptions.setAddress\`). */
    fun editAddress(id: String, queue: String, statusText: String?, addressText: String, query: SelectedAddressQuery): StoreResult {
        ensureReady()
        val address = SubscriptionAddress(
            remSlug = query.remId,
            settlementId = query.settlementId,
            streetId = query.streetId,
            streetName = SubscriptionRepository.resolveStreetName(query.streetId).orEmpty(),
            house = query.house,
            text = addressText
        )
        return change { Subscriptions.setAddress(it, id, address, queue, statusText) }
    }

    fun addQueueOnly(queue: String): StoreResult {
        ensureReady()
        val item = Subscription(
            id = repo.newItemId(),
            queue = queue,
            queueSource = QueueSource.MANUAL,
            createdAtMs = System.currentTimeMillis()
        )
        return change { Subscriptions.add(it, item) }
    }

    /** A background ZTOE lookup for the primary address found its queue (or "no queue"). */
    fun assignPrimaryQueue(queue: String?, statusText: String?, addressText: String?): StoreResult = change { s ->
        val id = s.primaryId ?: return@change StoreResult.Error(Subscriptions.ERR_NOT_FOUND)
        Subscriptions.setQueueInfo(s, id, queue, statusText, addressText)
    }

    fun mirror() {
        settingsRepo.applyPrimaryMirror(Subscriptions.primaryMirror(repo.store(), repo.alertsMaster()))
    }
}
`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/core/HouseVariants.kt',
    language: 'kotlin',
    description: 'A house listed in several ztoe rows: queue variants by consumer type (spec/ADDRESS_KEY.md section 6)',
    content: `package ua.blackout.prewarning.core

/**
 * A house listed in several ztoe rows (households / non-household, sometimes two queues of one type).
 * Specified in \`spec/ADDRESS_KEY.md\` section 6, golden cases in \`spec/vectors/house_variants.json\`,
 * mirrored in \`src/core/houseVariants.ts\` and \`ios/Shared/Core/HouseVariants.swift\`.
 */
object ConsumerType {
    const val HOUSEHOLD = "household"
    const val BUSINESS = "business"

    /** \`household\`, \`business\` or \`""\` when the text names no consumer type. A type code maps to itself. */
    fun of(raw: String?): String {
        if (raw.isNullOrBlank()) return ""
        val s = TextNorm.decodeEntities(raw).trim().lowercase()
        return when {
            s == HOUSEHOLD || s == BUSINESS -> s
            s.contains("непобут") || s.contains("юридич") -> BUSINESS
            s.contains("побут") -> HOUSEHOLD
            else -> ""
        }
    }
}

/** One queue (or one status without a queue) of a house, with the consumer types the site lists it for. */
data class HouseVariant(
    val queue: String,
    val statusText: String? = null,
    val consumers: List<String> = emptyList()
)

object HouseVariants {
    /** Folds one table row into [variants]: same non-empty queue = same variant; all status rows = one variant. */
    fun add(variants: List<HouseVariant>, queue: String, statusText: String?, consumerRaw: String?): List<HouseVariant> {
        val type = ConsumerType.of(consumerRaw)
        val q = queue.trim()
        val idx = variants.indexOfFirst { if (q.isNotEmpty()) it.queue == q else it.queue.isEmpty() }
        if (idx < 0) {
            val status = if (q.isEmpty()) statusText?.takeIf { it.isNotBlank() } else null
            return variants + HouseVariant(q, status, if (type.isEmpty()) emptyList() else listOf(type))
        }
        val existing = variants[idx]
        val merged = existing.copy(
            statusText = existing.statusText ?: if (q.isEmpty()) statusText?.takeIf { it.isNotBlank() } else null,
            consumers = if (type.isEmpty() || type in existing.consumers) existing.consumers else existing.consumers + type
        )
        return variants.toMutableList().also { it[idx] = merged }
    }

    /** Unites two variant lists (the rows of [b] come after those of [a]). */
    fun union(a: List<HouseVariant>, b: List<HouseVariant>): List<HouseVariant> {
        var out = a
        for (v in b) {
            if (v.consumers.isEmpty()) {
                out = add(out, v.queue, v.statusText, null)
            } else {
                for (c in v.consumers) out = add(out, v.queue, v.statusText, c)
            }
        }
        return out
    }

    /** Households first, then a queue before no queue, otherwise discovery order. */
    fun ordered(variants: List<HouseVariant>): List<HouseVariant> =
        variants.sortedWith(
            compareBy<HouseVariant> { if (ConsumerType.HOUSEHOLD in it.consumers) 0 else 1 }
                .thenBy { if (it.queue.isNotEmpty()) 0 else 1 }
        )

    /**
     * The variant to apply (spec/ADDRESS_KEY.md section 6, rule 5). [preferredQueue] null: the first. Otherwise the
     * variant with that queue (\`""\` = the one without a queue) while it still lists one of [preferredConsumers] (or
     * none were given); else the first variant that lists one of them; else the first.
     */
    fun pick(variants: List<HouseVariant>, preferredQueue: String?, preferredConsumers: List<String> = emptyList()): HouseVariant? {
        val list = ordered(variants)
        if (preferredQueue != null) {
            val p = preferredQueue.trim()
            val sharesType = { v: HouseVariant -> preferredConsumers.isEmpty() || v.consumers.any { it in preferredConsumers } }
            list.firstOrNull { it.queue == p && sharesType(it) }?.let { return it }
            if (preferredConsumers.isNotEmpty()) list.firstOrNull { v -> v.consumers.any { it in preferredConsumers } }?.let { return it }
        }
        return list.firstOrNull()
    }
}
`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/ui/components/CoachMarks.kt',
    language: 'kotlin',
    description: 'First-run tour spotlight overlay: dims the window except the lit controls, arrow and tip',
    content: `package ua.blackout.prewarning.ui.components

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import kotlin.math.roundToInt
import ua.blackout.prewarning.ui.AppStrings
import ua.blackout.prewarning.ui.theme.ZtColors
import ua.blackout.prewarning.ui.theme.ZtMinTouch
import ua.blackout.prewarning.ui.theme.ZtType

/**
 * Spotlight overlay of the first-run tour (spec/ONBOARDING.md), mirrored by src/components/CoachTour.tsx.
 *
 * Controls mark themselves with [coachTarget]; [CoachOverlay] dims its window except the lit targets, points
 * an arrow with a tip at a target (outside it) and rings the control to use next. The dim layer has no
 * pointer input, so every touch reaches the controls underneath; only the tips' buttons take touches.
 * A dialog is its own window, so the address lookup dialog has its own [CoachTargets] and overlay.
 */
class CoachTargets {
    /** Target bounds in the coordinates of their window's root. */
    val rects = mutableStateMapOf<String, Rect>()

    /** The smallest rectangle around all the [keys] that are on screen; null when none is. */
    fun union(keys: List<String>): Rect? {
        val found = keys.mapNotNull { rects[it] }
        if (found.isEmpty()) return null
        return Rect(found.minOf { it.left }, found.minOf { it.top }, found.maxOf { it.right }, found.maxOf { it.bottom })
    }
}

val LocalCoachTargets = staticCompositionLocalOf<CoachTargets?> { null }

/** Registers this element as tour target [key] (no effect outside a [LocalCoachTargets] provider). */
fun Modifier.coachTarget(key: String): Modifier = composed {
    val targets = LocalCoachTargets.current ?: return@composed this
    DisposableEffect(targets, key) { onDispose { targets.rects.remove(key) } }
    onGloballyPositioned { coordinates ->
        val p = coordinates.positionInRoot()
        targets.rects[key] = Rect(p, androidx.compose.ui.geometry.Size(coordinates.size.width.toFloat(), coordinates.size.height.toFloat()))
    }
}

/** One tip: an arrow and a text next to [anchor] (the union of its keys), outside it. */
data class CoachTip(
    val anchor: List<String>,
    val text: String,
    /** The control to use next, ringed in the accent colour. */
    val ring: String? = null,
    /** «Далі» goes on to the next step. */
    val next: Boolean = false,
    /** «Зрозуміло» ends the tour. */
    val done: Boolean = false,
    /** «Пропустити підказки» (one tip per step). */
    val skip: Boolean = false
)

private val HolePad = 6.dp
private val HoleRadius = 14.dp
private val ArrowSize = 32.dp
private val TipWidth = 260.dp
private val DimColor = Color(0xC705080F)

/**
 * Dims the window except the [holes] (each the union of its keys) and draws the [tips]. Draws nothing until
 * a tip's anchor is on screen.
 */
@Composable
fun CoachOverlay(
    targets: CoachTargets,
    holes: List<List<String>>,
    tips: List<CoachTip>,
    lang: String,
    onSkip: () -> Unit,
    onNext: () -> Unit = {},
    onDone: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    // the overlay may sit inside a padded box: target rects are moved into its own coordinates
    var origin by remember { mutableStateOf(Offset.Zero) }
    val local = { r: Rect -> r.translate(-origin.x, -origin.y) }
    val shown = tips.mapNotNull { tip -> targets.union(tip.anchor)?.let { tip to local(it) } }
    BoxWithConstraints(
        modifier = modifier
            .fillMaxSize()
            .onGloballyPositioned { origin = it.boundsInRoot().topLeft }
    ) {
        if (shown.isEmpty()) return@BoxWithConstraints
        val density = LocalDensity.current
        val pad = with(density) { HolePad.toPx() }
        val radius = with(density) { HoleRadius.toPx() }
        val holeRects = holes.mapNotNull { keys -> targets.union(keys)?.let(local) }
        Canvas(modifier = Modifier.fillMaxSize()) {
            val path = Path().apply {
                fillType = PathFillType.EvenOdd
                addRect(Rect(0f, 0f, size.width, size.height))
                holeRects.forEach { addRoundRect(RoundRect(it.inflate(pad), CornerRadius(radius, radius))) }
            }
            drawPath(path, DimColor)
        }
        val width = with(density) { constraints.maxWidth.toDp() }
        val height = with(density) { constraints.maxHeight.toDp() }
        shown.forEach { (tip, anchor) ->
            TipMark(
                tip = tip,
                anchor = anchor,
                ring = tip.ring?.let { targets.rects[it] }?.let(local),
                screenWidth = width,
                screenHeight = height,
                lang = lang,
                onSkip = onSkip,
                onNext = onNext,
                onDone = onDone
            )
        }
    }
}

@Composable
private fun TipMark(
    tip: CoachTip,
    anchor: Rect,
    ring: Rect?,
    screenWidth: androidx.compose.ui.unit.Dp,
    screenHeight: androidx.compose.ui.unit.Dp,
    lang: String,
    onSkip: () -> Unit,
    onNext: () -> Unit,
    onDone: () -> Unit
) {
    val density = LocalDensity.current
    val context = LocalContext.current
    val animate = remember { !reducedMotion(context) }
    val a = with(density) { Rect(anchor.left.toDp().value, anchor.top.toDp().value, anchor.right.toDp().value, anchor.bottom.toDp().value) }
    val cx = (a.left + a.right) / 2f
    val above = (a.top + a.bottom) / 2f > screenHeight.value * 0.45f
    val arrowTop = if (above) a.top - HolePad.value - 4f - ArrowSize.value else a.bottom + HolePad.value + 4f
    val bubbleWidth = minOf(TipWidth.value, screenWidth.value - 24f)
    val bubbleLeft = (cx - bubbleWidth / 2f).coerceIn(12f, maxOf(12f, screenWidth.value - 12f - bubbleWidth))
    var bubbleHeight by remember { mutableIntStateOf(0) }
    val nudge: State<Float>? = if (animate) {
        rememberInfiniteTransition(label = "coach").animateFloat(
            initialValue = 0f,
            targetValue = 1f,
            animationSpec = infiniteRepeatable(tween(700, easing = FastOutSlowInEasing), RepeatMode.Reverse),
            label = "coachNudge"
        )
    } else {
        null
    }

    if (ring != null) {
        val r = with(density) { Rect(ring.left.toDp().value, ring.top.toDp().value, ring.right.toDp().value, ring.bottom.toDp().value) }
        Box(
            modifier = Modifier
                .offset((r.left - 3f).dp, (r.top - 3f).dp)
                .size((r.width + 6f).dp, (r.height + 6f).dp)
                .border(2.dp, ZtColors.Accent, RoundedCornerShape(16.dp))
        )
    }
    Icon(
        imageVector = if (above) Icons.Default.ArrowDownward else Icons.Default.ArrowUpward,
        contentDescription = null,
        tint = ZtColors.Accent,
        modifier = Modifier
            .offset((cx - ArrowSize.value / 2f).dp, arrowTop.dp)
            .size(ArrowSize)
            .graphicsLayer { translationY = (nudge?.value ?: 0f) * 8.dp.toPx() * if (above) 1f else -1f }
    )
    Column(
        modifier = Modifier
            .offset {
                val top = if (above) arrowTop.dp.toPx() - 2.dp.toPx() - bubbleHeight else (arrowTop + ArrowSize.value + 2f).dp.toPx()
                IntOffset(bubbleLeft.dp.roundToPx(), top.roundToInt())
            }
            .width(bubbleWidth.dp)
            .onSizeChanged { bubbleHeight = it.height }
            .background(ZtColors.CardSolid, RoundedCornerShape(16.dp))
            .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(16.dp))
            .padding(horizontal = 16.dp, vertical = 12.dp)
            .semantics { liveRegion = LiveRegionMode.Polite },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text(text = tip.text, style = ZtType.body.copy(fontWeight = FontWeight.Bold), color = Color.White, textAlign = TextAlign.Center)
        if (tip.next || tip.done) {
            Box(
                modifier = Modifier
                    .heightIn(min = 44.dp)
                    .background(ZtColors.Accent, RoundedCornerShape(12.dp))
                    .clickable(role = Role.Button) { if (tip.done) onDone() else onNext() }
                    .padding(horizontal = 20.dp, vertical = 10.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = if (tip.done) AppStrings.tourGotIt(lang) else AppStrings.tourNext(lang),
                    style = ZtType.label.copy(fontWeight = FontWeight.ExtraBold),
                    color = Color.White
                )
            }
        }
        if (tip.skip) {
            Box(
                modifier = Modifier
                    .heightIn(min = ZtMinTouch)
                    .clickable(role = Role.Button, onClick = onSkip)
                    .padding(horizontal = 12.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = AppStrings.tourSkip(lang),
                    style = ZtType.caption.copy(textDecoration = TextDecoration.Underline, fontWeight = FontWeight.SemiBold),
                    color = ZtColors.TextSecondary
                )
            }
        }
    }
}
`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/ui/components/OnboardingTour.kt',
    language: 'kotlin',
    description: 'First-run tour steps (PICK, APPLY, RENAME, ALERTS, ABOUT) and the "done" flag',
    content: `package ua.blackout.prewarning.ui.components

import android.content.Context

/**
 * First-run tour (spec/ONBOARDING.md); mirrored by src/services/onboarding.ts, cases in OnboardingTourTest.
 *
 * The tour starts when a new user taps the first-launch «Виберіть чергу» button and walks them through:
 *  PICK   - the address picker: settlement, street and house are lit, the rest is dimmed;
 *  APPLY  - the result card: the «Обрати чергу» button is ringed;
 *  RENAME - Settings with the new address: an arrow at its rename button («Далі» or the rename dialog goes on);
 *  ALERTS - its planned and emergency alert switches, and an arrow at the dock's home button;
 *  ABOUT  - the main screen: an arrow at the dock's About button, «Або допоможіть волонтерам...».
 * It ends on «Зрозуміло», on «Пропустити підказки» or when About is opened, and is never shown again.
 */
enum class TourStep { NONE, PICK, APPLY, RENAME, ALERTS, ABOUT }

enum class TourPage { SCHEDULE, SETTINGS, ABOUT, OTHER }

data class TourInput(
    /** The tour was started (first-launch button) and not finished or skipped. */
    val active: Boolean,
    /** The address lookup dialog is open. */
    val lookupOpen: Boolean,
    /** The lookup shows a result card (a house, or a settlement / street without lower levels). */
    val resultShown: Boolean,
    val page: TourPage,
    /** At least one address or queue is saved. */
    val hasAddress: Boolean,
    /** The RENAME step was shown, so the main screen goes on to ABOUT. */
    val reachedRename: Boolean,
    /** «Далі» was tapped on RENAME, or the rename dialog was closed: Settings goes on to ALERTS. */
    val renameDone: Boolean,
    /** Another dialog is on top: the tour waits (on Android a dialog is its own window above the overlay). */
    val covered: Boolean = false
)

object OnboardingTour {
    fun step(i: TourInput): TourStep = when {
        !i.active || i.covered -> TourStep.NONE
        i.lookupOpen -> if (i.resultShown) TourStep.APPLY else TourStep.PICK
        !i.hasAddress -> TourStep.NONE
        i.page == TourPage.SETTINGS -> if (i.renameDone) TourStep.ALERTS else TourStep.RENAME
        i.page == TourPage.SCHEDULE && i.reachedRename -> TourStep.ABOUT
        else -> TourStep.NONE
    }

    /** Opening About after the RENAME step finishes the tour (the donations are there). */
    fun finishedBy(page: TourPage, reachedRename: Boolean): Boolean = page == TourPage.ABOUT && reachedRename
}

/** "The tour was finished or skipped": never shown again (a reinstall shows it again). */
class OnboardingStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("onboarding", Context.MODE_PRIVATE)

    fun isDone(): Boolean = prefs.getBoolean(KEY_DONE, false)

    fun setDone(done: Boolean) {
        prefs.edit().putBoolean(KEY_DONE, done).apply()
    }

    private companion object {
        const val KEY_DONE = "done"
    }
}
`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/data/repository/HouseVariantChoices.kt',
    language: 'kotlin',
    description: 'The queue variant the user applied for a house listed more than once, kept by re-checks',
    content: `package ua.blackout.prewarning.data.repository

import android.content.Context
import ua.blackout.prewarning.core.HouseKey
import ua.blackout.prewarning.core.HouseVariant

/**
 * The queue variant the user applied from the address lookup for a house the site lists more than once
 * (spec/ADDRESS_KEY.md section 6, rule 5). Re-checks of the address prefer it; without a stored choice the
 * default (households first) applies, so addresses saved before 1.4.1 move to the households' queue.
 * Keyed by street id and [HouseKey]; mirrored by src/services/houseVariantChoices.ts and
 * ios/Shared/Data/HouseVariantChoices.swift.
 */
object HouseVariantChoices {
    private const val PREFS = "house_variant_choice"

    internal fun key(streetId: String, house: String) = "$streetId|\${HouseKey.of(house)}"

    /** Stored as \`queue\` TAB \`consumer,consumer\`. */
    internal fun encode(v: HouseVariant) = "\${v.queue}\\t\${v.consumers.joinToString(",")}"

    internal fun decode(raw: String?): HouseVariant? {
        if (raw == null) return null
        val tab = raw.indexOf('\\t')
        if (tab < 0) return null
        val consumers = raw.substring(tab + 1).split(',').filter { it.isNotBlank() }
        return HouseVariant(queue = raw.substring(0, tab), consumers = consumers)
    }

    fun get(context: Context, streetId: String, house: String): HouseVariant? {
        if (streetId.isBlank() || HouseKey.of(house).isEmpty()) return null
        return decode(prefs(context).getString(key(streetId, house), null))
    }

    /** [variant] null forgets the choice (the house has a single queue). */
    fun put(context: Context, streetId: String, house: String, variant: HouseVariant?) {
        if (streetId.isBlank() || HouseKey.of(house).isEmpty()) return
        val edit = prefs(context).edit()
        if (variant == null) edit.remove(key(streetId, house)) else edit.putString(key(streetId, house), encode(variant))
        edit.apply()
    }

    private fun prefs(context: Context) = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
`
  }
];
