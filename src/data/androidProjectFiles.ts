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
        versionName = semverEnv ?: "1.3.5"

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
    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
    <uses-permission android:name="android.permission.USE_EXACT_ALARM" />
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
            android:exported="true">
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
    val isEmergency: Boolean = false
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

enum class FetchStatus {
    SUCCESS,
    NO_INTERNET,
    NO_QUEUES_FOUND
}

data class ScheduleFetchResult(
    val todaySlots: List<BlackoutSlot>,
    val tomorrowSlots: List<BlackoutSlot>?,
    val hasTomorrowSchedule: Boolean,
    val status: FetchStatus = FetchStatus.SUCCESS
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

        if (!isValidUrl(url, context)) {
            repo?.clearScheduleCache()
            return ScheduleFetchResult(
                todaySlots = emptyList(),
                tomorrowSlots = null,
                hasTomorrowSchedule = false,
                status = FetchStatus.NO_QUEUES_FOUND
            )
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

            val effectiveDoc = doc ?: run {
                repo?.clearScheduleCache()
                return ScheduleFetchResult(
                    todaySlots = emptyList(),
                    tomorrowSlots = null,
                    hasTomorrowSchedule = false,
                    status = FetchStatus.NO_QUEUES_FOUND
                )
            }

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

            if (trimmedQueue.isEmpty()) {
                return ScheduleFetchResult(
                    todaySlots = emptyList(),
                    tomorrowSlots = null,
                    hasTomorrowSchedule = false,
                    status = if (allQueueResults.isNotEmpty()) FetchStatus.SUCCESS else FetchStatus.NO_QUEUES_FOUND
                )
            }

            val finalRes = allQueueResults[trimmedQueue] ?: parseDocumentFull(effectiveDoc, trimmedQueue, today)
            if (finalRes.status != FetchStatus.SUCCESS) {
                repo?.clearScheduleCache()
            }
            finalRes
        } catch (e: UnknownHostException) {
            repo?.clearScheduleCache()
            ScheduleFetchResult(
                todaySlots = emptyList(),
                tomorrowSlots = null,
                hasTomorrowSchedule = false,
                status = FetchStatus.NO_INTERNET
            )
        } catch (e: ConnectException) {
            repo?.clearScheduleCache()
            ScheduleFetchResult(
                todaySlots = emptyList(),
                tomorrowSlots = null,
                hasTomorrowSchedule = false,
                status = FetchStatus.NO_INTERNET
            )
        } catch (e: SocketTimeoutException) {
            repo?.clearScheduleCache()
            ScheduleFetchResult(
                todaySlots = emptyList(),
                tomorrowSlots = null,
                hasTomorrowSchedule = false,
                status = FetchStatus.NO_INTERNET
            )
        } catch (e: IOException) {
            repo?.clearScheduleCache()
            ScheduleFetchResult(
                todaySlots = emptyList(),
                tomorrowSlots = null,
                hasTomorrowSchedule = false,
                status = FetchStatus.NO_INTERNET
            )
        } catch (e: Exception) {
            repo?.clearScheduleCache()
            ScheduleFetchResult(
                todaySlots = emptyList(),
                tomorrowSlots = null,
                hasTomorrowSchedule = false,
                status = FetchStatus.NO_QUEUES_FOUND
            )
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
        const val MAX_STORED_ENTRIES = 100
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
     * and bounds total stored entries to MAX_STORED_ENTRIES = 100.
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
import ua.blackout.prewarning.MainActivity
import ua.blackout.prewarning.R
import ua.blackout.prewarning.data.model.EmergencyOutageInfo
import ua.blackout.prewarning.data.model.UserSettings
import ua.blackout.prewarning.data.repository.AlertRegistry
import ua.blackout.prewarning.data.repository.SettingsRepository

object NotificationHelper {
    const val CHANNEL_SOUND_VIBE = "zt_blackout_sound_vibe_v2"
    const val CHANNEL_SOUND_ONLY = "zt_blackout_sound_only_v2"
    const val CHANNEL_VIBE_ONLY = "zt_blackout_vibe_only_v2"
    const val CHANNEL_SILENT = "zt_blackout_silent_v2"

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

            manager.createNotificationChannels(listOf(ch1, ch2, ch3, ch4))
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

    fun checkAndTriggerEmergencyOutageAlert(
        context: Context,
        settings: UserSettings,
        previousEmergency: EmergencyOutageInfo?,
        currentEmergency: EmergencyOutageInfo?
    ): Pair<String, String>? {
        val lang = ua.blackout.prewarning.ui.AppStrings.resolveLang(settings.language)
        return checkAndTriggerEmergencyOutageAlert(
            context = context,
            prevOutage = previousEmergency,
            nextOutage = currentEmergency,
            settings = settings,
            lang = lang
        )
    }

    fun checkAndTriggerEmergencyOutageAlert(
        context: Context,
        prevOutage: EmergencyOutageInfo?,
        nextOutage: EmergencyOutageInfo?,
        settings: UserSettings,
        lang: String
    ): Pair<String, String>? {
        if (!settings.emergencyNotificationsEnabled) return null
        val registry = AlertRegistry(context.applicationContext)

        // 1. Outage Restored (prev active -> next null)
        if (prevOutage != null && nextOutage == null) {
            val restoreKey = "emergency_restore_\${prevOutage.id}_\${prevOutage.startTime}"
            if (registry.hasFired(restoreKey)) return null
            registry.markFired(restoreKey)
            val title = if (lang == "uk") "Аварійне відключення завершено" else "Emergency Outage Restored"
            val body = if (lang == "uk") {
                "Електропостачання за вашою адресою відновлено (початок був: \${prevOutage.startTime})."
            } else {
                "Power supply at your address has been restored (started: \${prevOutage.startTime})."
            }
            showPreWarningNotification(
                context = context,
                notificationId = restoreKey.hashCode(),
                title = title,
                body = body,
                isTest = false,
                isEmergencyAlert = true
            )
            return title to body
        }

        // 2. Outage Detected (next active)
        if (nextOutage != null) {
            val detectKey = "emergency_detect_\${nextOutage.id}_\${nextOutage.startTime}_\${nextOutage.estimatedRestoreTime}"
            if (registry.hasFired(detectKey)) return null
            registry.markFired(detectKey)
            val title = if (lang == "uk") {
                nextOutage.outageType.ifBlank { "Аварійне відключення" }
            } else {
                "Emergency Outage"
            }
            val body = if (lang == "uk") {
                "Зафіксовано аварійне відключення. Початок: \${nextOutage.startTime}. Орієнтовне відновлення: \${nextOutage.estimatedRestoreTime}."
            } else {
                "Emergency outage detected. Start: \${nextOutage.startTime}. Estimated restore: \${nextOutage.estimatedRestoreTime}."
            }
            showPreWarningNotification(
                context = context,
                notificationId = detectKey.hashCode(),
                title = title,
                body = body,
                isTest = false,
                isEmergencyAlert = true
            )
            return title to body
        }

        return null
    }

    fun showPreWarningNotification(
        context: Context,
        notificationId: Int,
        title: String,
        body: String,
        isTest: Boolean = false,
        isEmergencyAlert: Boolean = false
    ) {
        val settings = SettingsRepository(context).getSettings()

        // If notifications are disabled globally in the app, do NOT send unless this is an explicit Test or an enabled Emergency Alert
        if (isEmergencyAlert) {
            if (!settings.emergencyNotificationsEnabled) return
        } else if (!settings.notificationsEnabled && !isTest) {
            return
        }

        val activeSound = if (isEmergencyAlert) {
            settings.emergencyNotificationsEnabled && settings.soundEnabled
        } else {
            settings.notificationsEnabled && settings.soundEnabled
        }
        val activeVibe = if (isEmergencyAlert) {
            settings.emergencyNotificationsEnabled && settings.vibrationEnabled
        } else {
            settings.notificationsEnabled && settings.vibrationEnabled
        }

        createNotificationChannels(context)

        val targetChannelId = when {
            activeSound && activeVibe -> CHANNEL_SOUND_VIBE
            activeSound && !activeVibe -> CHANNEL_SOUND_ONLY
            !activeSound && activeVibe -> CHANNEL_VIBE_ONLY
            else -> CHANNEL_SILENT
        }

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
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
            // Trigger hardware vibrator directly with USAGE_ALARM so vibration always fires even when sound is disabled
            triggerVibration(context)
        } else {
            builder.setVibrate(longArrayOf(0))
        }

        // Only mark silent if BOTH sound AND vibration are disabled
        if (!activeSound && !activeVibe) {
            builder.setSilent(true)
        }

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
import ua.blackout.prewarning.data.repository.AlertRegistry
import ua.blackout.prewarning.data.repository.ScheduleRepository
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.widget.BlackoutGlanceWidget
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import ua.blackout.prewarning.data.KYIV_ZONE

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val appContext = context.applicationContext
        val pendingResult = goAsync()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                try {
                    BlackoutGlanceWidget.syncAllWidgets(appContext)
                } catch (_: Exception) {}

                if (intent.action == "ua.blackout.prewarning.ACTION_WIDGET_TRANSITION_UPDATE") {
                    return@launch
                }

                val currentSettings = SettingsRepository(appContext).getSettings()
                if (!currentSettings.notificationsEnabled) {
                    return@launch
                }

                val slotId = intent.getStringExtra("EXTRA_SLOT_ID") ?: return@launch
                val intentQueue = intent.getStringExtra("EXTRA_QUEUE") ?: return@launch

                // Reject stale alarms from any queue other than the user's currently selected queue (e.g. default 1.1)
                if (intentQueue != currentSettings.queue || !slotId.endsWith("_Q\${currentSettings.queue}")) {
                    return@launch
                }

                val kyivZone = KYIV_ZONE
                val today = LocalDate.now(kyivZone)
                if (!slotId.startsWith("block_\${today}_")) {
                    return@launch
                }

                val timeStr = intent.getStringExtra("EXTRA_TIME") ?: return@launch
                val minutes = intent.getIntExtra("EXTRA_MINUTES", currentSettings.advanceNoticeMinutes)

                // Verify that the alarm corresponds to an active blackout interval in today's schedule for the selected queue
                val scheduleRepo = ScheduleRepository(appContext)
                val todayIntervals = scheduleRepo.getDetailedIntervals(scheduleRepo.getTodaySlots(currentSettings.queue))
                val matchingInterval = todayIntervals.firstOrNull { "\${it.startStr}–\${it.endStr}" == timeStr }
                    ?: return@launch

                // Verify current time is within the valid pre-warning window [alertTime - 2min, blockStartTime + 2min]
                // Prevents past-due alarms from firing when the user changes system time on mobile
                val startParts = matchingInterval.startStr.split(":")
                val startH = startParts.getOrNull(0)?.toIntOrNull() ?: return@launch
                val startM = startParts.getOrNull(1)?.toIntOrNull() ?: return@launch
                val blockStartTime = LocalDateTime.of(today, LocalTime.of(startH, startM))
                val alertTime = blockStartTime.minusMinutes(minutes.toLong())
                val now = LocalDateTime.now(kyivZone)

                if (now.isBefore(alertTime.minusMinutes(2))) {
                    // System clock was moved backward before the alert window; reschedule alarms
                    AlarmScheduler.syncAlarms(appContext, onTimeChanged = true)
                    return@launch
                }
                if (now.isAfter(blockStartTime.plusMinutes(2))) {
                    // System clock was moved forward past the outage start time; do not fire stale pre-warning
                    return@launch
                }

                val alertRegistry = AlertRegistry(appContext)

                // STRICT REQUIREMENT: Send notification only once per blackout slot
                if (alertRegistry.hasNotified(slotId)) {
                    return@launch
                }

                // Mark as notified immediately
                alertRegistry.markNotified(slotId)

                val queue = currentSettings.queue
                val title = "Попередження: відключення світла"
                val body = "Черга $queue: відключення розпочнеться о $timeStr (через $minutes хв)."

                val notificationId = slotId.hashCode()
                NotificationHelper.showPreWarningNotification(appContext, notificationId, title, body)
            } finally {
                try {
                    pendingResult.finish()
                } catch (_: Exception) {}
            }
        }
    }
}`
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
import ua.blackout.prewarning.data.parser.FetchStatus
import ua.blackout.prewarning.data.parser.ZtoeAddressLookup
import ua.blackout.prewarning.data.parser.ZtoeParser
import ua.blackout.prewarning.data.repository.ScheduleRepository
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.notification.AlarmScheduler
import ua.blackout.prewarning.notification.NotificationHelper
import ua.blackout.prewarning.ui.AppStrings
import ua.blackout.prewarning.widget.BlackoutGlanceWidget
import java.util.concurrent.TimeUnit

class ScheduleSyncWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        return try {
            val appContext = context.applicationContext
            val settingsRepo = SettingsRepository(appContext)
            var settings = settingsRepo.getSettings()
            val resolvedLang = AppStrings.resolveLang(settings.language)

            // Re-check saved address query & emergency outages on ZTOE website
            val addressQuery = settings.selectedAddressQuery
            if (addressQuery != null) {
                ZtoeAddressLookup.initDiskCache(appContext)
                val latestAddressLookup = ZtoeAddressLookup.checkAddressOnZtoeWebsite(addressQuery, settings.cityUrl)
                if (latestAddressLookup != null) {
                    val prevEmergency = settings.activeEmergencyOutage
                    val nextEmergency = latestAddressLookup.emergencyOutage

                    NotificationHelper.checkAndTriggerEmergencyOutageAlert(
                        context = appContext,
                        prevOutage = prevEmergency,
                        nextOutage = nextEmergency,
                        settings = settings,
                        lang = resolvedLang
                    )

                    val emergencyChanged =
                        (prevEmergency?.id != nextEmergency?.id) ||
                            (prevEmergency?.startTime != nextEmergency?.startTime) ||
                            (prevEmergency?.estimatedRestoreTime != nextEmergency?.estimatedRestoreTime)

                    val hadNoQueue = settings.queue.isBlank()
                    val queueAssignedForNoQueueHouse = hadNoQueue &&
                        (latestAddressLookup.queue != settings.queue ||
                            latestAddressLookup.statusText != settings.customQueueStatusText)

                    if (queueAssignedForNoQueueHouse || emergencyChanged) {
                        val nextQueue = if (queueAssignedForNoQueueHouse) latestAddressLookup.queue else settings.queue
                        val nextStatusText = if (queueAssignedForNoQueueHouse) latestAddressLookup.statusText else settings.customQueueStatusText
                        settings = settings.copy(
                            queue = nextQueue,
                            customQueueStatusText = nextStatusText,
                            activeEmergencyOutage = nextEmergency
                        )
                        settingsRepo.saveSettings(settings)
                    }
                }
            }

            val scheduleRepo = ScheduleRepository(appContext)
            val fetchRes = ZtoeParser.fetchFullSchedule(settings.cityUrl, settings.queue, appContext)

            // Only save schedule when live fetch succeeded; clear cached results if unreachable or no queues found
            if (fetchRes.status == FetchStatus.SUCCESS) {
                if (settings.queue.isNotBlank()) {
                    scheduleRepo.saveSchedule(settings.queue, fetchRes.todaySlots, fetchRes.tomorrowSlots)
                }
            } else {
                scheduleRepo.clearScheduleCache()
            }

            val hasWidgets = try {
                BlackoutGlanceWidget.hasActiveWidgets(appContext)
            } catch (_: Exception) {
                false
            }

            if (hasWidgets) {
                try {
                    BlackoutGlanceWidget.syncAllWidgets(appContext)
                } catch (_: Exception) {}
            }

            // Re-read latest settings right before scheduling alarms in case user changed queue while network fetch was running
            AlarmScheduler.syncAlarms(appContext)

            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }

    companion object {
        const val WORK_NAME = "ScheduleSyncWorker"

        fun schedulePeriodicWork(
            context: Context,
            policy: ExistingPeriodicWorkPolicy = ExistingPeriodicWorkPolicy.KEEP
        ) {
            val appContext = context.applicationContext
            val settings = SettingsRepository(appContext).getSettings()
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
}`
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
import androidx.compose.ui.graphics.Color
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
import androidx.glance.LocalSize
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import ua.blackout.prewarning.MainActivity
import ua.blackout.prewarning.R
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SlotStatus
import ua.blackout.prewarning.data.parser.ZtoeParser
import ua.blackout.prewarning.data.repository.ScheduleRepository
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.notification.AlarmScheduler
import ua.blackout.prewarning.ui.AppStrings
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import ua.blackout.prewarning.data.KYIV_ZONE

open class BlackoutGlanceWidget(private val forceBigLayout: Boolean = false) : GlanceAppWidget() {

    override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

    override val sizeMode = SizeMode.Responsive(
        setOf(
            DpSize(120.dp, 60.dp),   // 2x1 Small
            DpSize(250.dp, 110.dp),  // 4x2 Big
            DpSize(250.dp, 160.dp)   // 3x2 Big
        )
    )

    companion object {
        val KEY_NOTIFICATIONS_ENABLED = booleanPreferencesKey("glance_notifications_enabled")
        val KEY_QUEUE = stringPreferencesKey("glance_queue")
        val KEY_LANGUAGE = stringPreferencesKey("glance_language")
        val KEY_REFRESH_TICK = longPreferencesKey("glance_refresh_tick")
        val KEY_IS_BLACKOUT_NOW = booleanPreferencesKey("glance_is_blackout_now")
        val KEY_IS_UNCLEAR = booleanPreferencesKey("glance_is_unclear")
        val KEY_COUNTDOWN_TEXT = stringPreferencesKey("glance_countdown_text")
        val KEY_NEXT_SLOT_TIME = stringPreferencesKey("glance_next_slot_time")
        val KEY_NEXT_BLACKOUT_TEXT = stringPreferencesKey("glance_next_blackout_text")

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

        private fun buildLightNoOutageSlots(): List<BlackoutSlot> {
            return (0 until 48).map { idx ->
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

        @Volatile
        private var cachedChartBitmapKey: String? = null
        @Volatile
        private var cachedChartBitmap: Bitmap? = null

        suspend fun hasActiveWidgets(context: Context): Boolean {
            return try {
                val appCtx = context.applicationContext
                val manager = GlanceAppWidgetManager(appCtx)
                manager.getGlanceIds(BlackoutGlanceWidget::class.java).isNotEmpty() ||
                    manager.getGlanceIds(BlackoutBigGlanceWidget::class.java).isNotEmpty()
            } catch (_: Exception) {
                false
            }
        }

        suspend fun syncAllWidgets(context: Context) {
            val appCtx = context.applicationContext
            val manager = GlanceAppWidgetManager(appCtx)
            val smallIds = manager.getGlanceIds(BlackoutGlanceWidget::class.java)
            val bigIds = manager.getGlanceIds(BlackoutBigGlanceWidget::class.java)
            val glanceIds = smallIds + bigIds
            if (glanceIds.isEmpty()) return

            val settings = SettingsRepository(appCtx).getSettings()
            val resolvedLang = AppStrings.resolveLang(settings.language)
            val scheduleRepo = ScheduleRepository(appCtx)

            val todayDateIso = LocalDate.now(KYIV_ZONE).format(DateTimeFormatter.ISO_LOCAL_DATE)
            val tomorrowDateIso = LocalDate.now(KYIV_ZONE).plusDays(1).format(DateTimeFormatter.ISO_LOCAL_DATE)
            val isNoQueueHouse = !settings.customQueueStatusText.isNullOrBlank()
            val baseTodaySlots = when {
                isNoQueueHouse && settings.activeEmergencyOutage == null -> buildLightNoOutageSlots()
                settings.queue.isBlank() && isNoQueueHouse -> buildLightNoOutageSlots()
                else -> scheduleRepo.getTodaySlots(settings.queue)
            }
            val effectiveTodaySlots = ScheduleRepository.applyEmergencyOutageToSlots(
                baseTodaySlots,
                todayDateIso,
                settings.activeEmergencyOutage
            )
            val rawTomorrowSlots = scheduleRepo.getTomorrowSlots(settings.queue)
            val effectiveTomorrowSlots = rawTomorrowSlots?.let {
                ScheduleRepository.applyEmergencyOutageToSlots(it, tomorrowDateIso, settings.activeEmergencyOutage)
            }

            val info = when {
                settings.queue.isBlank() && !isNoQueueHouse && settings.activeEmergencyOutage == null ->
                    ScheduleRepository.StatusAndCountdown(false, "--:--:--", "--:-- - --:--", true)
                isNoQueueHouse && settings.activeEmergencyOutage == null ->
                    ScheduleRepository.StatusAndCountdown(false, "--:--:--", "Відключень немає", false)
                else ->
                    ScheduleRepository.calculateStatusAndCountdown(
                        slots = effectiveTodaySlots,
                        tomorrowSlots = effectiveTomorrowSlots,
                        now = LocalTime.now(KYIV_ZONE)
                    )
            }
            val formattedCountdown = formatWidgetCountdown(info.countdownText, resolvedLang)
            val nextBlackoutText = if (isNoQueueHouse && settings.activeEmergencyOutage == null) {
                "Сьогодні більше немає"
            } else {
                val nowMin = LocalTime.now(KYIV_ZONE).let { it.hour * 60 + it.minute }
                val upcoming = scheduleRepo.getDetailedIntervals(effectiveTodaySlots).firstOrNull { interval ->
                    val p = interval.startStr.split(":")
                    val startMin = (p.getOrNull(0)?.toIntOrNull() ?: 0) * 60 + (p.getOrNull(1)?.toIntOrNull() ?: 0)
                    startMin > nowMin
                }
                if (upcoming != null) "\${upcoming.startStr} – \${upcoming.endStr}" else "Сьогодні більше немає"
            }
            val nowMs = System.currentTimeMillis()
            for (gId in smallIds) {
                updateAppWidgetState(appCtx, PreferencesGlanceStateDefinition, gId) { prefs ->
                    prefs.toMutablePreferences().apply {
                        this[KEY_NOTIFICATIONS_ENABLED] = settings.notificationsEnabled
                        this[KEY_QUEUE] = settings.queue
                        this[KEY_LANGUAGE] = resolvedLang
                        this[KEY_REFRESH_TICK] = nowMs
                        this[KEY_IS_BLACKOUT_NOW] = info.isBlackoutNow
                        this[KEY_IS_UNCLEAR] = info.isUnclear
                        this[KEY_COUNTDOWN_TEXT] = formattedCountdown
                        this[KEY_NEXT_SLOT_TIME] = info.nextSlotTime
                        this[KEY_NEXT_BLACKOUT_TEXT] = nextBlackoutText
                    }
                }
                BlackoutGlanceWidget().update(appCtx, gId)
            }
            for (gId in bigIds) {
                updateAppWidgetState(appCtx, PreferencesGlanceStateDefinition, gId) { prefs ->
                    prefs.toMutablePreferences().apply {
                        this[KEY_NOTIFICATIONS_ENABLED] = settings.notificationsEnabled
                        this[KEY_QUEUE] = settings.queue
                        this[KEY_LANGUAGE] = resolvedLang
                        this[KEY_REFRESH_TICK] = nowMs
                        this[KEY_IS_BLACKOUT_NOW] = info.isBlackoutNow
                        this[KEY_IS_UNCLEAR] = info.isUnclear
                        this[KEY_COUNTDOWN_TEXT] = formattedCountdown
                        this[KEY_NEXT_SLOT_TIME] = info.nextSlotTime
                        this[KEY_NEXT_BLACKOUT_TEXT] = nextBlackoutText
                    }
                }
                BlackoutBigGlanceWidget().update(appCtx, gId)
            }
        }

        /**
         * Renders the 24-hour analog electricity counter (САЗУ-ИТ) chart as a high-DPI Bitmap
         * and caches it by (slotStatuses, currentH, currentM) to avoid redundant Bitmap allocations
         * and Canvas redraws within the same minute (e.g., when toggling the alert bell icon).
         */
        fun renderAnalogCounterBitmap(
            slots: List<BlackoutSlot>,
            currentH: Int,
            currentM: Int,
            lang: String = "uk"
        ): Bitmap {
            val slotSignature = if (slots.isEmpty()) {
                "UNCLEAR"
            } else {
                buildString(slots.size) {
                    for (s in slots) {
                        append(if (s.status == SlotStatus.POWER_OFF) '1' else '0')
                    }
                }
            }
            val bitmapKey = "\${slotSignature}_\${currentH}_\${currentM}_$lang"
            val existingBmp = cachedChartBitmap
            if (cachedChartBitmapKey == bitmapKey && existingBmp != null && !existingBmp.isRecycled) {
                return existingBmp
            }

            val width = 720
            val height = 132
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
            val contourBottom = 84f
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
            val trackBottom = 76f
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
                val is48 = slots.size >= 48
                (0 until 24).forEach { hour ->
                    val half1Off = if (is48) {
                        slots.getOrNull(hour * 2)?.status == SlotStatus.POWER_OFF
                    } else {
                        slots.getOrNull(hour)?.status == SlotStatus.POWER_OFF
                    }
                    val half2Off = if (is48) {
                        slots.getOrNull(hour * 2 + 1)?.status == SlotStatus.POWER_OFF
                    } else {
                        slots.getOrNull(hour)?.status == SlotStatus.POWER_OFF
                    }

                    val hLeft = trackLeft + hour * (hourWidth + sepPx)

                    // Half 1: XX:00 - XX:30
                    paint.shader = if (half1Off) offShader else onShader
                    canvas.drawRect(hLeft, trackTop, hLeft + halfWidth, trackBottom, paint)

                    // Half 2: XX:30 - (XX+1):00 (contiguous with Half 1, no half-hour separator)
                    paint.shader = if (half2Off) offShader else onShader
                    canvas.drawRect(hLeft + halfWidth, trackTop, hLeft + hourWidth, trackBottom, paint)
                }
                paint.shader = null
            }

            // 5. Black current-time needle (#0B0B0A) protruding above and below the dark-grey contour
            val fraction = ((currentH.coerceIn(0, 23) * 60 + currentM.coerceIn(0, 59)) / 1440f).coerceIn(0f, 1f)
            val needleX = trackLeft + trackWidth * fraction
            val needleTop = contourTop - 8f
            val needleBottom = contourBottom + 8f

            // Subtle white halo around the black needle
            paint.style = Paint.Style.FILL
            paint.color = 0xD9FFFFFF.toInt()
            canvas.drawRoundRect(
                RectF(needleX - 4.5f, needleTop, needleX + 4.5f, needleBottom),
                4.5f, 4.5f, paint
            )

            // Solid black needle
            paint.color = 0xFF0B0B0A.toInt()
            canvas.drawRoundRect(
                RectF(needleX - 3f, needleTop, needleX + 3f, needleBottom),
                3f, 3f, paint
            )

            // 6. Stamped black (#1C1B18) hour markers: 00, 06, 12, 18, 24
            val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = 0xFF1C1B18.toInt()
                typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
                textSize = 21f
            }
            val labels = listOf(
                0f to "00",
                0.25f to "06",
                0.50f to "12",
                0.75f to "18",
                1.0f to "24"
            )
            val textY = 116f
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
        val settingsRepo = SettingsRepository(appContext)
        val scheduleRepo = ScheduleRepository(appContext)
        val initialSettings = settingsRepo.getSettings()

        // Immediately fetch live schedule on first widget placement if cache is missing for selected queue
        if (initialSettings.queue.isNotBlank() && !scheduleRepo.hasValidTodayCache(initialSettings.queue)) {
            withContext(Dispatchers.IO) {
                try {
                    val res = ZtoeParser.fetchFullSchedule(initialSettings.cityUrl, initialSettings.queue, appContext)
                    if (res.status == ua.blackout.prewarning.data.parser.FetchStatus.SUCCESS) {
                        scheduleRepo.saveSchedule(initialSettings.queue, res.todaySlots, res.tomorrowSlots)
                    } else {
                        scheduleRepo.clearScheduleCache()
                    }
                } catch (_: Exception) {
                    scheduleRepo.clearScheduleCache()
                }
            }
        }

        provideContent {
            val prefs = currentState<Preferences>()
            // Observe Glance state preferences so recomposition always triggers when toggled or refreshed
            val currentSettings = settingsRepo.getSettings()
            val resolvedLang = AppStrings.resolveLang(prefs[KEY_LANGUAGE] ?: currentSettings.language)
            val notificationsEnabled = prefs[KEY_NOTIFICATIONS_ENABLED] ?: currentSettings.notificationsEnabled
            val activeQueue = currentSettings.queue
            val isNoQueueHouse = !currentSettings.customQueueStatusText.isNullOrBlank()
            val refreshTick = prefs[KEY_REFRESH_TICK] ?: 0L

            val todayDateIso = LocalDate.now(KYIV_ZONE).format(DateTimeFormatter.ISO_LOCAL_DATE)
            val tomorrowDateIso = LocalDate.now(KYIV_ZONE).plusDays(1).format(DateTimeFormatter.ISO_LOCAL_DATE)

            // Always use Today's schedule for the widget, with active emergency outage overlaid
            val baseTodaySlots = when {
                isNoQueueHouse && currentSettings.activeEmergencyOutage == null -> buildLightNoOutageSlots()
                activeQueue.isBlank() && isNoQueueHouse -> buildLightNoOutageSlots()
                else -> scheduleRepo.getTodaySlots(activeQueue)
            }
            val slots = ScheduleRepository.applyEmergencyOutageToSlots(
                baseTodaySlots,
                todayDateIso,
                currentSettings.activeEmergencyOutage
            )
            val rawTomorrowSlots = scheduleRepo.getTomorrowSlots(activeQueue)
            val effectiveTomorrowSlots = rawTomorrowSlots?.let {
                ScheduleRepository.applyEmergencyOutageToSlots(it, tomorrowDateIso, currentSettings.activeEmergencyOutage)
            }
            val liveInfo = when {
                activeQueue.isBlank() && !isNoQueueHouse && currentSettings.activeEmergencyOutage == null ->
                    ScheduleRepository.StatusAndCountdown(false, "--:--:--", "--:-- - --:--", true)
                isNoQueueHouse && currentSettings.activeEmergencyOutage == null ->
                    ScheduleRepository.StatusAndCountdown(false, "--:--:--", "Відключень немає", false)
                else ->
                    ScheduleRepository.calculateStatusAndCountdown(
                        slots = slots,
                        tomorrowSlots = effectiveTomorrowSlots,
                        now = LocalTime.now(KYIV_ZONE)
                    )
            }

            val isUnclear = slots.isEmpty() || (if (refreshTick > 0L) (prefs[KEY_IS_UNCLEAR] ?: liveInfo.isUnclear) else liveInfo.isUnclear)
            val isBlackoutNow = !isUnclear && (if (refreshTick > 0L) (prefs[KEY_IS_BLACKOUT_NOW] ?: liveInfo.isBlackoutNow) else liveInfo.isBlackoutNow)
            val rawCountdownText = if (isUnclear) "--:--:--" else (prefs[KEY_COUNTDOWN_TEXT]?.takeIf { it.isNotBlank() && refreshTick > 0L } ?: liveInfo.countdownText)
            val countdownText = formatWidgetCountdown(rawCountdownText, resolvedLang)
            val nextSlotTime = if (isUnclear) "--:-- - --:--" else (prefs[KEY_NEXT_SLOT_TIME]?.takeIf { it.isNotBlank() && refreshTick > 0L } ?: liveInfo.nextSlotTime)
            val nextBlackoutText = if (isUnclear) {
                "--:-- - --:--"
            } else if (isNoQueueHouse && currentSettings.activeEmergencyOutage == null) {
                "Сьогодні більше немає"
            } else {
                val nowMin = LocalTime.now(KYIV_ZONE).let { it.hour * 60 + it.minute }
                val upcoming = scheduleRepo.getDetailedIntervals(slots).firstOrNull { interval ->
                    val p = interval.startStr.split(":")
                    val startMin = (p.getOrNull(0)?.toIntOrNull() ?: 0) * 60 + (p.getOrNull(1)?.toIntOrNull() ?: 0)
                    startMin > nowMin
                }
                if (upcoming != null) "\${upcoming.startStr} – \${upcoming.endStr}" else (prefs[KEY_NEXT_BLACKOUT_TEXT] ?: "Сьогодні більше немає")
            }

            val size = LocalSize.current
            val isBigWidget = forceBigLayout || size.height >= 110.dp || size.width >= 220.dp

            val queueHeaderText = when {
                isNoQueueHouse -> if (resolvedLang == "uk") "Черга відсутня" else "No queue"
                activeQueue.isBlank() -> if (resolvedLang == "uk") "Черга —" else "Queue —"
                else -> "Черга $activeQueue"
            }

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
                        .background(ColorProvider(Color(0xCC141A29)))
                        .padding(12.dp)
                ) {
                    if (isBigWidget) {
                        val now = LocalTime.now(KYIV_ZONE)
                        val chartBitmap = renderAnalogCounterBitmap(slots, now.hour, now.minute, resolvedLang)

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
                                Column(
                                    modifier = GlanceModifier
                                        .defaultWeight()
                                        .clickable(actionStartActivity<MainActivity>())
                                ) {
                                    Text(
                                        text = queueHeaderText,
                                        style = TextStyle(
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 16.sp,
                                            color = ColorProvider(Color.White)
                                        )
                                    )
                                    Text(
                                        text = statusText,
                                        style = TextStyle(
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 11.sp,
                                            color = ColorProvider(statusColor)
                                        )
                                    )
                                }

                                // Round Refresh Button (same style as Notification toggle)
                                Box(
                                    modifier = GlanceModifier
                                        .size(36.dp)
                                        .cornerRadius(18.dp)
                                        .background(ColorProvider(Color(0x26FFFFFF)))
                                        .clickable(actionRunCallback<RefreshWidgetActionCallback>()),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Image(
                                        provider = ImageProvider(R.drawable.ic_refresh),
                                        contentDescription = "Оновити дані",
                                        colorFilter = ColorFilter.tint(ColorProvider(Color.White)),
                                        modifier = GlanceModifier.size(18.dp)
                                    )
                                }

                                Spacer(modifier = GlanceModifier.width(8.dp))

                                // Round Notification Toggle Button
                                Box(
                                    modifier = GlanceModifier
                                        .size(36.dp)
                                        .cornerRadius(18.dp)
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
                                        modifier = GlanceModifier.size(20.dp)
                                    )
                                }
                            }

                            Spacer(modifier = GlanceModifier.height(6.dp))

                            // Countdown Card Row (clickable to open app)
                            Row(
                                modifier = GlanceModifier
                                    .fillMaxWidth()
                                    .cornerRadius(12.dp)
                                    .background(ColorProvider(Color(0x33000000)))
                                    .padding(horizontal = 10.dp, vertical = 6.dp)
                                    .clickable(actionStartActivity<MainActivity>()),
                                verticalAlignment = Alignment.Vertical.CenterVertically
                            ) {
                                Column(modifier = GlanceModifier.defaultWeight()) {
                                    Text(
                                        text = if (isBlackoutNow) "До увімкнення:" else "До відключення:",
                                        style = TextStyle(fontSize = 10.sp, color = ColorProvider(Color(0xB3BAE6FD)))
                                    )
                                    Text(
                                        text = countdownText,
                                        style = TextStyle(
                                            fontSize = 20.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = ColorProvider(Color.White)
                                        ),
                                        maxLines = 1
                                    )
                                }
                                Column(horizontalAlignment = Alignment.Horizontal.End) {
                                    Text(
                                        text = "Період",
                                        style = TextStyle(fontSize = 10.sp, color = ColorProvider(Color(0xB3BAE6FD)))
                                    )
                                    Text(
                                        text = nextSlotTime,
                                        style = TextStyle(
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = ColorProvider(Color.White)
                                        )
                                    )
                                }
                            }

                            Spacer(modifier = GlanceModifier.height(6.dp))

                            // 24-Hour Analog Electricity Counter (САЗУ-ИТ) Chart rendered via Bitmap
                            Image(
                                provider = ImageProvider(chartBitmap),
                                contentDescription = "24-годинний графік відключень",
                                contentScale = ContentScale.FillBounds,
                                modifier = GlanceModifier
                                    .fillMaxWidth()
                                    .height(52.dp)
                                    .clickable(actionStartActivity<MainActivity>())
                            )

                            // Upcoming Outage Interval ("Наступне відключення")
                            Spacer(modifier = GlanceModifier.height(4.dp))
                            Row(
                                modifier = GlanceModifier
                                    .fillMaxWidth()
                                    .cornerRadius(8.dp)
                                    .background(ColorProvider(Color(0x26000000)))
                                    .padding(horizontal = 8.dp, vertical = 3.dp)
                                    .clickable(actionStartActivity<MainActivity>()),
                                verticalAlignment = Alignment.Vertical.CenterVertically
                            ) {
                                Text(
                                    text = nextBlackoutText,
                                    style = TextStyle(
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = ColorProvider(Color.White)
                                    )
                                )
                                Spacer(modifier = GlanceModifier.defaultWeight())
                                Text(
                                    text = "Наступне відключення",
                                    style = TextStyle(
                                        fontSize = 10.sp,
                                        color = ColorProvider(Color(0xFFFF5E3A))
                                    )
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
                                    text = queueHeaderText,
                                    style = TextStyle(
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        color = ColorProvider(Color.White)
                                    ),
                                    modifier = GlanceModifier.clickable(actionStartActivity<MainActivity>())
                                )
                                Spacer(modifier = GlanceModifier.defaultWeight())
                                Text(
                                    text = statusText,
                                    style = TextStyle(
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 10.sp,
                                        color = ColorProvider(statusColor)
                                    ),
                                    modifier = GlanceModifier.clickable(actionStartActivity<MainActivity>())
                                )
                            }

                            Spacer(modifier = GlanceModifier.height(4.dp))

                            // Bottom Row: Countdown + Round Refresh Button + Round Notification Toggle Button
                            Row(
                                modifier = GlanceModifier.fillMaxWidth(),
                                verticalAlignment = Alignment.Vertical.CenterVertically
                            ) {
                                Column(
                                    modifier = GlanceModifier
                                        .defaultWeight()
                                        .clickable(actionStartActivity<MainActivity>())
                                ) {
                                    Text(
                                        text = if (isBlackoutNow) "До увімкнення:" else "До відключення:",
                                        style = TextStyle(fontSize = 10.sp, color = ColorProvider(Color(0xB3BAE6FD)))
                                    )
                                    Text(
                                        text = countdownText,
                                        style = TextStyle(
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = ColorProvider(Color.White)
                                        ),
                                        maxLines = 1
                                    )
                                }

                                // Round Refresh Button (same style as Notification toggle)
                                Box(
                                    modifier = GlanceModifier
                                        .size(34.dp)
                                        .cornerRadius(17.dp)
                                        .background(ColorProvider(Color(0x26FFFFFF)))
                                        .clickable(actionRunCallback<RefreshWidgetActionCallback>()),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Image(
                                        provider = ImageProvider(R.drawable.ic_refresh),
                                        contentDescription = "Оновити дані",
                                        colorFilter = ColorFilter.tint(ColorProvider(Color.White)),
                                        modifier = GlanceModifier.size(16.dp)
                                    )
                                }

                                Spacer(modifier = GlanceModifier.width(6.dp))

                                // Round Notification Toggle Button
                                Box(
                                    modifier = GlanceModifier
                                        .size(34.dp)
                                        .cornerRadius(17.dp)
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
                                        modifier = GlanceModifier.size(18.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

class BlackoutBigGlanceWidget : BlackoutGlanceWidget(forceBigLayout = true)

class ToggleAlertsActionCallback : ActionCallback {
    override suspend fun onAction(
        context: Context,
        glanceId: GlanceId,
        parameters: ActionParameters
    ) {
        val appContext = context.applicationContext
        val settingsRepo = SettingsRepository(appContext)
        val current = settingsRepo.getSettings()
        val newState = !current.notificationsEnabled
        settingsRepo.updateNotificationsEnabled(newState)
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
        val settingsRepo = SettingsRepository(appContext)
        val scheduleRepo = ScheduleRepository(appContext)
        val current = settingsRepo.getSettings()

        withContext(Dispatchers.IO) {
            try {
                if (current.queue.isNotBlank()) {
                    val res = ZtoeParser.fetchFullSchedule(current.cityUrl, current.queue, appContext, forceNetwork = true)
                    if (res.status == ua.blackout.prewarning.data.parser.FetchStatus.SUCCESS) {
                        scheduleRepo.saveSchedule(current.queue, res.todaySlots, res.tomorrowSlots)
                    } else {
                        scheduleRepo.clearScheduleCache()
                    }
                }
                AlarmScheduler.syncAlarms(appContext)
                BlackoutGlanceWidget.syncAllWidgets(appContext)
            } catch (_: Exception) {
                try {
                    scheduleRepo.clearScheduleCache()
                    AlarmScheduler.syncAlarms(appContext)
                    BlackoutGlanceWidget.syncAllWidgets(appContext)
                } catch (_: Exception) {}
            }
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
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import ua.blackout.prewarning.data.parser.ZtoeParser
import ua.blackout.prewarning.data.repository.ScheduleRepository
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.notification.AlarmScheduler

open class BlackoutWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = BlackoutGlanceWidget()

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        fetchAndRefreshWidgetImmediately(context, forceNetwork = true)
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        fetchAndRefreshWidgetImmediately(context, forceNetwork = false)
    }

    private fun fetchAndRefreshWidgetImmediately(context: Context, forceNetwork: Boolean) {
        val pendingResult = goAsync()
        val appContext = context.applicationContext
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val settings = SettingsRepository(appContext).getSettings()
                val scheduleRepo = ScheduleRepository(appContext)
                val cacheFresh = scheduleRepo.hasValidTodayCache(settings.queue) &&
                    scheduleRepo.isCacheFresh(settings.refreshIntervalMinutes)

                if (forceNetwork || !cacheFresh) {
                    val res = ZtoeParser.fetchFullSchedule(settings.cityUrl, settings.queue, appContext)
                    if (res.status == ua.blackout.prewarning.data.parser.FetchStatus.SUCCESS) {
                        scheduleRepo.saveSchedule(settings.queue, res.todaySlots, res.tomorrowSlots)
                    }
                }
                AlarmScheduler.syncAlarms(appContext)
                BlackoutGlanceWidget.syncAllWidgets(appContext)
            } catch (_: Exception) {
                try {
                    AlarmScheduler.syncAlarms(appContext)
                    BlackoutGlanceWidget.syncAllWidgets(appContext)
                } catch (_: Exception) {}
            } finally {
                try {
                    pendingResult.finish()
                } catch (_: Exception) {}
            }
        }
    }
}

class BlackoutBigWidgetReceiver : BlackoutWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = BlackoutBigGlanceWidget()
}`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/MainActivity.kt',
    language: 'kotlin',
    description: 'Main Jetpack Compose Activity with Material 3 navigation and permission handling',
    content: `package ua.blackout.prewarning

import android.Manifest
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
import ua.blackout.prewarning.ui.screens.RouletteSoundEngine
import ua.blackout.prewarning.ui.theme.ZTBlackoutTheme

class MainActivity : ComponentActivity() {

    private val requestNotificationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { isGranted ->
            // Notification permission granted or denied
        }

    override fun onResume() {
        super.onResume()
        RouletteSoundEngine.setAppInForeground(true, this)
    }

    override fun onPause() {
        RouletteSoundEngine.setAppInForeground(false, this)
        super.onPause()
    }

    override fun onStop() {
        RouletteSoundEngine.setAppInForeground(false, this)
        super.onStop()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

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
                        onThemeChanged = { isDarkMode = it }
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
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.NotificationsOff
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ua.blackout.prewarning.R
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SlotStatus
import ua.blackout.prewarning.data.parser.ZtoeAddressLookup
import ua.blackout.prewarning.data.repository.ScheduleRepository
import ua.blackout.prewarning.ui.AppStrings
import ua.blackout.prewarning.ui.components.TimelineBar
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import ua.blackout.prewarning.data.KYIV_ZONE

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

@Composable
fun MainScreen(
    queue: String = "",
    customQueueStatusText: String? = null,
    selectedAddress: String? = null,
    emergencyOutageStartTime: String? = null,
    emergencyOutageRestoreTime: String? = null,
    emergencyOutageType: String? = null,
    isBlackoutNow: Boolean = false,
    countdownText: String = "01:35:12",
    slotTimeText: String = "14:00 – 18:00",
    slots: List<BlackoutSlot> = emptyList(),
    tomorrowSlots: List<BlackoutSlot>? = null,
    hasTomorrowSchedule: Boolean = false,
    notificationsEnabled: Boolean = true,
    lastUpdated: String = "19:27",
    nextUpdated: String = "19:57",
    currentTime: LocalTime = LocalTime.now(KYIV_ZONE),
    lang: String = "uk",
    selectedLanguage: String = "SYSTEM",
    onToggleNotifications: () -> Unit = {},
    onRefresh: () -> Unit = {},
    onOpenQueueSelection: () -> Unit = {},
    onChangeLanguage: (String) -> Unit = {}
) {
    val context = LocalContext.current
    val scheduleRepo = remember { ScheduleRepository(context.applicationContext) }
    var selectedDayTab by remember { mutableStateOf("today") }

    val hasEmergencyOutage = ZtoeAddressLookup.isValidOutageTimestamp(emergencyOutageStartTime) &&
        ZtoeAddressLookup.isValidOutageTimestamp(emergencyOutageRestoreTime)
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

    // Reset to "today" if tomorrow schedule is no longer available
    LaunchedEffect(hasTomorrowSchedule, tomorrowSlots) {
        if (!hasTomorrowSchedule || tomorrowSlots == null) {
            selectedDayTab = "today"
        }
    }

    val isTomorrowSelected = selectedDayTab == "tomorrow" && hasTomorrowSchedule && tomorrowSlots != null
    val activeSlots = when {
        hasCustomNoQueueStatus && !hasEmergencyOutage -> lightNoOutageSlots
        isTomorrowSelected -> tomorrowSlots!!
        else -> slots
    }
    val isUnclear = activeSlots.isEmpty() || isQueueUnselected
    val isStatusUnclear = (slots.isEmpty() && !hasCustomNoQueueStatus) || isQueueUnselected
    val activeSlotsSignature = activeSlots.joinToString("") {
        val statusChar = if (it.status == SlotStatus.POWER_OFF) "1" else "0"
        val emgChar = if (it.isEmergency) "E" else "S"
        "$statusChar$emgChar"
    }

    // Compute continuous blackout intervals with exact 30-min resolution using hoisted ScheduleRepository
    val intervals = remember(queue, selectedDayTab, activeSlotsSignature) {
        scheduleRepo.getDetailedIntervals(activeSlots)
    }

    // Pulse animation for status dot — only active during an active blackout to avoid 60fps idle CPU/battery drain
    val pulseScale = if (!isStatusUnclear && isBlackoutNow) {
        val infiniteTransition = rememberInfiniteTransition(label = "pulse")
        val scale by infiniteTransition.animateFloat(
            initialValue = 0.85f,
            targetValue = 1.25f,
            animationSpec = infiniteRepeatable(
                animation = tween(900, easing = FastOutSlowInEasing),
                repeatMode = RepeatMode.Reverse
            ),
            label = "pulseScale"
        )
        scale
    } else {
        1f
    }

    var entryRefreshTick by remember { mutableStateOf(0) }
    LaunchedEffect(Unit) {
        entryRefreshTick++
    }

    val kyivNow = remember(countdownText, currentTime, entryRefreshTick) {
        LocalTime.now(KYIV_ZONE)
    }
    val currentTimeStr = remember(kyivNow.hour, kyivNow.minute) {
        kyivNow.format(DateTimeFormatter.ofPattern("HH:mm"))
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .then(
                    if (isQueueUnselected) {
                        Modifier.alpha(0.15f)
                    } else {
                        Modifier.verticalScroll(rememberScrollState())
                    }
                )
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // 1. Top Header: Queue title + Sleek pill toggle switch (NO text)
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (isQueueUnselected || hasCustomNoQueueStatus || queue.isBlank()) {
                    Box(modifier = Modifier.weight(1f).defaultMinSize(minHeight = 44.dp))
                } else {
                    Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
                        Text(
                            text = "\${AppStrings.queue(lang)} $queue",
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = formattedSelectedAddress ?: "Житомиробленерго (ZTOE)",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color(0xB3BAE6FD),
                            lineHeight = 16.sp
                        )
                    }
                }

                // Enlarged Pill Switch matching emulator exactly
                Box(
                    modifier = Modifier
                        .size(width = 58.dp, height = 34.dp)
                        .clip(CircleShape)
                        .background(if (notificationsEnabled) Color(0xFFFF5E3A) else Color(0x26FFFFFF))
                        .clickable(enabled = !isQueueUnselected) { onToggleNotifications() }
                        .padding(4.dp),
                    contentAlignment = if (notificationsEnabled) Alignment.CenterEnd else Alignment.CenterStart
                ) {
                    Box(
                        modifier = Modifier
                            .size(26.dp)
                            .clip(CircleShape)
                            .background(Color.White),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = if (notificationsEnabled) Icons.Default.Notifications else Icons.Default.NotificationsOff,
                            contentDescription = null,
                            tint = if (notificationsEnabled) Color(0xFFFF5E3A) else Color(0xFF6B7280),
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }

            // 1c. Active Emergency Outage ("Аварійне відключення") Banner with Start & Estimated Restore Times — matching Workbench MainView.tsx
            if (!isQueueUnselected && hasEmergencyOutage) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .shadow(10.dp, RoundedCornerShape(24.dp), ambientColor = Color(0x66000000), spotColor = Color(0x80000000))
                        .clip(RoundedCornerShape(24.dp))
                        .background(Color(0xBF141A29))
                        .border(1.dp, Color(0x26FFFFFF), RoundedCornerShape(24.dp))
                        .padding(16.dp)
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            text = if (lang == "uk" && !emergencyOutageType.isNullOrBlank()) {
                                emergencyOutageType
                            } else {
                                AppStrings.emergencyOutageTitle(lang)
                            },
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFFFF5E3A),
                            lineHeight = 19.sp
                        )
                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = AppStrings.emergencyStartLabel(lang),
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = Color(0xB3BAE6FD)
                                )
                                Text(
                                    text = emergencyOutageStartTime ?: "--:--",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace,
                                    color = Color.White,
                                    textAlign = TextAlign.End
                                )
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = AppStrings.emergencyRestoreLabel(lang),
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = Color(0xB3BAE6FD)
                                )
                                Text(
                                    text = emergencyOutageRestoreTime ?: "--:--",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace,
                                    color = Color.White,
                                    textAlign = TextAlign.End
                                )
                            }
                        }
                    }
                }
            }

            // 1b. Custom ZTOE Queue/House Status Message Bar — exact same style/color/placement as Workbench MainView.tsx
            if (!isQueueUnselected && !customQueueStatusText.isNullOrBlank()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .shadow(10.dp, RoundedCornerShape(24.dp), ambientColor = Color(0x66000000), spotColor = Color(0x80000000))
                        .clip(RoundedCornerShape(24.dp))
                        .background(Color(0xBF141A29))
                        .border(1.dp, Color(0x26FFFFFF), RoundedCornerShape(24.dp))
                        .padding(16.dp)
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        if (!formattedSelectedAddress.isNullOrBlank()) {
                            Text(
                                text = formattedSelectedAddress,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium,
                                color = Color(0xB3BAE6FD),
                                lineHeight = 16.sp
                            )
                        }
                        Text(
                            text = customQueueStatusText ?: "",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            lineHeight = 19.sp
                        )
                    }
                }
            }

            // 2. Hero Outage Status Card (Translucent Frosted Glass)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .shadow(10.dp, RoundedCornerShape(24.dp), ambientColor = Color(0x66000000), spotColor = Color(0x80000000))
                    .clip(RoundedCornerShape(24.dp))
                    .background(Color(0xBF141A29))
                    .border(1.dp, Color(0x26FFFFFF), RoundedCornerShape(24.dp))
                    .padding(18.dp)
            ) {
                if (hasCustomNoQueueStatus && !hasEmergencyOutage) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 16.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "--:--:--",
                            fontSize = 44.sp,
                            fontWeight = FontWeight.Black,
                            fontFamily = FontFamily.Monospace,
                            color = Color.White
                        )
                    }
                } else {
                    Column {
                        // Status Line
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(10.dp)
                                        .scale(if (!isStatusUnclear && isBlackoutNow) pulseScale else 1f)
                                        .clip(CircleShape)
                                        .background(
                                            when {
                                                isStatusUnclear -> Color(0xFF9CA3AF)
                                                isBlackoutNow -> Color(0xFFFF5E3A)
                                                else -> Color(0xFF34D399)
                                            }
                                        )
                                )
                                Text(
                                    text = when {
                                        isStatusUnclear -> AppStrings.powerUnclear(lang)
                                        isBlackoutNow -> AppStrings.powerOff(lang)
                                        else -> AppStrings.powerOn(lang)
                                    },
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                            }

                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Icon(
                                    Icons.Default.Schedule,
                                    contentDescription = null,
                                    tint = Color(0xB3BAE6FD),
                                    modifier = Modifier.size(14.dp)
                                )
                                Text(
                                    text = currentTimeStr,
                                    fontSize = 12.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xB3BAE6FD)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        // Big Countdown Digits
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = if (!isStatusUnclear && isBlackoutNow) AppStrings.powerOnIn(lang) else AppStrings.powerOffIn(lang),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color(0xB3BAE6FD)
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = countdownText,
                                fontSize = 44.sp,
                                fontWeight = FontWeight.Black,
                                fontFamily = FontFamily.Monospace,
                                color = Color.White
                            )
                        }

                        val effectiveSlotTimeText = when {
                            isStatusUnclear -> "--:-- - --:--"
                            else -> slotTimeText
                        }
                        if (effectiveSlotTimeText.isNotEmpty() && effectiveSlotTimeText != "Відключень немає") {
                            Spacer(modifier = Modifier.height(14.dp))
                            Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(Color(0x1AFFFFFF)))
                            Spacer(modifier = Modifier.height(10.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = if (!isStatusUnclear && isBlackoutNow) AppStrings.outagePeriod(lang) else AppStrings.nextPeriod(lang),
                                    fontSize = 13.sp,
                                    color = Color(0xB3BAE6FD)
                                )
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(Color(0x26FFFFFF))
                                        .padding(horizontal = 10.dp, vertical = 4.dp)
                                ) {
                                    Text(
                                        text = effectiveSlotTimeText,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold,
                                        fontFamily = FontFamily.Monospace,
                                        color = Color.White
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // 3. Day Selector (Today / Tomorrow)
            if (hasTomorrowSchedule && tomorrowSlots != null && !hasCustomNoQueueStatus) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .shadow(8.dp, RoundedCornerShape(16.dp), ambientColor = Color(0x55000000), spotColor = Color(0x66000000))
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color(0x80141A29))
                        .padding(4.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (selectedDayTab == "today") Color(0x33FFFFFF) else Color.Transparent)
                            .clickable(enabled = !isQueueUnselected) { selectedDayTab = "today" }
                            .padding(vertical = 10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = AppStrings.today(lang),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (selectedDayTab == "today") Color.White else Color(0x99BAE6FD)
                        )
                    }
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (selectedDayTab == "tomorrow") Color(0x33FFFFFF) else Color.Transparent)
                            .clickable(enabled = !isQueueUnselected) { selectedDayTab = "tomorrow" }
                            .padding(vertical = 10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = AppStrings.tomorrow(lang),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (selectedDayTab == "tomorrow") Color.White else Color(0x99BAE6FD)
                        )
                    }
                }
            } else {
                // Centered "Today" button
                Box(
                    modifier = Modifier
                        .fillMaxWidth(),
                    contentAlignment = Alignment.Center
                ) {
                    Box(
                        modifier = Modifier
                            .shadow(8.dp, RoundedCornerShape(16.dp), ambientColor = Color(0x55000000), spotColor = Color(0x66000000))
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color(0x80141A29))
                            .padding(horizontal = 24.dp, vertical = 10.dp)
                    ) {
                        Text(
                            text = AppStrings.today(lang),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }
                }
            }

            // 4. Schedule Card with 24h Timeline matching user screenshot
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .shadow(10.dp, RoundedCornerShape(24.dp), ambientColor = Color(0x66000000), spotColor = Color(0x80000000))
                    .clip(RoundedCornerShape(24.dp))
                    .background(Color(0xBF141A29))
                    .padding(18.dp)
            ) {
                key(queue, selectedDayTab, activeSlotsSignature) {
                    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        // 24-Hour Timeline Bar (automatically refreshed on main screen entry and every minute)
                        key(kyivNow.hour, kyivNow.minute, entryRefreshTick) {
                            TimelineBar(
                                slots = activeSlots,
                                currentHour = kyivNow.hour,
                                currentMinute = kyivNow.minute,
                                showNeedle = selectedDayTab == "today",
                                lang = lang
                            )
                        }

                        // List of Outage Hours for this day (removed when outages are unclear)
                        if (!isUnclear) {
                            Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(Color(0x1AFFFFFF)))

                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(
                                    text = if (isTomorrowSelected) AppStrings.blackoutHoursForTomorrowHeader(lang) else AppStrings.blackoutHoursForDayHeader(lang),
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xB3BAE6FD)
                                )

                                if (intervals.isNotEmpty()) {
                                    intervals.forEach { interval ->
                                        val start = interval.startStr
                                        val end = interval.endStr
                                        val dur = interval.durationHours
                                        val durStr = if (dur % 1.0 == 0.0) "\${dur.toInt()} \${AppStrings.hourShort(lang)}" else "\${String.format(java.util.Locale.US, "%.1f", dur)} \${AppStrings.hourShort(lang)}"
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clip(RoundedCornerShape(14.dp))
                                                .background(Color(0x14FFFFFF))
                                                .padding(horizontal = 14.dp, vertical = 10.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Row(
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                                            ) {
                                                // Fixed 20x20dp leading indicator slot so text start X is 100% identical
                                                Box(
                                                    modifier = Modifier.size(20.dp),
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    if (interval.isEmergency) {
                                                        Box(
                                                            modifier = Modifier
                                                                .size(20.dp)
                                                                .clip(CircleShape)
                                                                .background(Color(0xFFFF5E3A)),
                                                            contentAlignment = Alignment.Center
                                                        ) {
                                                            Text(
                                                                text = "!",
                                                                fontSize = 12.sp,
                                                                fontWeight = FontWeight.Black,
                                                                color = Color.White
                                                            )
                                                        }
                                                    } else {
                                                        Box(
                                                            modifier = Modifier
                                                                .size(10.dp)
                                                                .clip(CircleShape)
                                                                .background(Color(0xFFFF5E3A))
                                                        )
                                                    }
                                                }
                                                Text(
                                                    text = "$start – $end",
                                                    fontSize = 15.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    fontFamily = FontFamily.Monospace,
                                                    color = Color.White
                                                )
                                            }

                                            Box(
                                                modifier = Modifier
                                                    .clip(RoundedCornerShape(8.dp))
                                                    .background(Color(0x26FF5E3A))
                                                    .padding(horizontal = 8.dp, vertical = 3.dp)
                                            ) {
                                                Text(
                                                    text = durStr,
                                                    fontSize = 11.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    fontFamily = FontFamily.Monospace,
                                                    color = Color(0xFFFF5E3A)
                                                )
                                            }
                                        }
                                    }
                                } else {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(14.dp))
                                            .background(Color(0x14FFFFFF))
                                            .padding(14.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = AppStrings.noBlackoutsScheduled(lang),
                                            fontSize = 13.sp,
                                            color = Color(0xB3BAE6FD)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // 5. Last Updated & Circular Refresh Button Card
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color(0xBF141A29))
                    .padding(14.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(AppStrings.lastUpdated(lang), fontSize = 11.sp, color = Color(0x99BAE6FD))
                            Text(lastUpdated, fontSize = 11.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, color = Color.White)
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(AppStrings.nextUpdated(lang), fontSize = 11.sp, color = Color(0x99BAE6FD))
                            Text(nextUpdated, fontSize = 11.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, color = Color.White)
                        }
                    }

                    // Circular white refresh button with feedback
                    Box(
                        modifier = Modifier
                            .size(42.dp)
                            .clip(CircleShape)
                            .background(Color.White)
                            .clickable(enabled = !isQueueUnselected) {
                                onRefresh()
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Оновити",
                            tint = Color.Black,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }

            // 6. Emergency Outages Info Link (right after refresh block, styled like AboutScreen links with site icon)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(24.dp))
                    .background(Color(0xBF141A29))
                    .padding(14.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0x14FFFFFF))
                        .clickable(enabled = !isQueueUnselected) {
                            try {
                                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(AppStrings.EMERGENCY_OUTAGES_URL))
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
                                .background(Color(0xFF1877F2)),
                            contentAlignment = Alignment.Center
                        ) {
                            // Facebook vector logo (replaces generic Icons.Default.Language globe)
                            Icon(
                                painter = painterResource(id = R.drawable.ic_facebook),
                                contentDescription = "Facebook",
                                tint = Color.White,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = AppStrings.emergencyOutagesLabel(lang),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                                softWrap = true
                            )
                            Text(
                                text = AppStrings.EMERGENCY_OUTAGES_URL,
                                fontSize = 10.sp,
                                fontFamily = FontFamily.Monospace,
                                color = Color(0x99BAE6FD),
                                maxLines = 1,
                                overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                            )
                        }
                    }
                    Icon(
                        imageVector = Icons.Default.OpenInNew,
                        contentDescription = null,
                        tint = Color(0x99BAE6FD),
                        modifier = Modifier.size(16.dp)
                    )
                }
            }

            // 7. Blackout Schedules on ZTOE Website Link ("Графіки відключень на сайті") at very bottom after Facebook link
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(24.dp))
                    .background(Color(0xBF141A29))
                    .padding(14.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0x14FFFFFF))
                        .clickable(enabled = !isQueueUnselected) {
                            try {
                                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(AppStrings.SITE_SCHEDULES_URL))
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
                                .background(Color(0xFFFF5E3A)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Language,
                                contentDescription = "Графіки відключень на сайті",
                                tint = Color.White,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = AppStrings.siteSchedulesLabel(lang),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                                softWrap = true
                            )
                            Text(
                                text = AppStrings.SITE_SCHEDULES_URL,
                                fontSize = 10.sp,
                                fontFamily = FontFamily.Monospace,
                                color = Color(0x99BAE6FD),
                                maxLines = 1,
                                overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                            )
                        }
                    }
                    Icon(
                        imageVector = Icons.Default.OpenInNew,
                        contentDescription = null,
                        tint = Color(0x99BAE6FD),
                        modifier = Modifier.size(16.dp)
                    )
                }
            }

            // Extra spacing so floating navigation dock does not overlap bottom card
            Spacer(modifier = Modifier.height(96.dp))
        }

        // First-launch / Unselected Queue Overlay: dark dimming + centered #FF5E3A "Виберіть чергу" button with subtitle + 3-segment language switch
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
                    Box(
                        modifier = Modifier
                            .defaultMinSize(minWidth = 260.dp)
                            .clip(RoundedCornerShape(24.dp))
                            .background(Color(0xFFFF5E3A))
                            .border(1.dp, Color(0x40FFFFFF), RoundedCornerShape(24.dp))
                            .clickable { onOpenQueueSelection() }
                            .padding(horizontal = 32.dp, vertical = 20.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = AppStrings.selectQueueAction(lang),
                                fontSize = 24.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = Color.White,
                                textAlign = TextAlign.Center
                            )
                            Text(
                                text = "Житомиробленерго (ZTOE)",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color(0xE6FFFFFF),
                                textAlign = TextAlign.Center
                            )
                        }
                    }

                    Row(
                        modifier = Modifier
                            .width(260.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color(0xE6141A29))
                            .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(16.dp))
                            .padding(6.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        val langOptions = listOf(
                            "SYSTEM" to "Auto",
                            "en" to "English",
                            "uk" to "Українська"
                        )
                        langOptions.forEach { (code, label) ->
                            val isActive = selectedLanguage.equals(code, ignoreCase = true)
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(if (isActive) Color.White else Color.Transparent)
                                    .clickable { onChangeLanguage(code) }
                                    .padding(horizontal = 8.dp, vertical = 8.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = label,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isActive) Color.Black else Color(0xCCBAE6FD),
                                    maxLines = 1
                                )
                            }
                        }
                    }
                }
            }
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
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ua.blackout.prewarning.data.model.EmergencyOutageInfo
import ua.blackout.prewarning.data.model.SelectedAddressQuery
import ua.blackout.prewarning.data.parser.AddressLookupResult
import ua.blackout.prewarning.data.parser.FetchStatus
import ua.blackout.prewarning.data.parser.ZtoeAddressLookup
import ua.blackout.prewarning.data.parser.ZtoeParser
import ua.blackout.prewarning.ui.AppStrings

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    currentQueue: String = "",
    customQueueStatusText: String? = null,
    selectedAddressQuery: SelectedAddressQuery? = null,
    activeEmergencyOutage: EmergencyOutageInfo? = null,
    siteUrl: String = "https://www.ztoe.com.ua/unhooking-search.php",
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
    onQueueSelected: (String) -> Unit = {},
    onAddressQueueResolved: (
        queue: String,
        statusText: String?,
        addressLabel: String,
        emergencyOutage: EmergencyOutageInfo?,
        query: SelectedAddressQuery
    ) -> Unit = { _, _, _, _, _ -> },
    onSiteUrlChanged: (String) -> Unit = {},
    onAdvanceMinutesChanged: (Int) -> Unit = {},
    onRefreshMinutesChanged: (Int) -> Unit = {},
    onToggleNotifications: (Boolean) -> Unit = {},
    onToggleEmergencyNotifications: (Boolean) -> Unit = {},
    onToggleSound: (Boolean) -> Unit = {},
    onToggleVibration: (Boolean) -> Unit = {},
    onLanguageSelected: (String) -> Unit = {},
    onSendTestAlert: () -> Unit = {},
    onForceRefresh: () -> Unit = {},
    onResetDefaults: () -> Unit = {},
    onShowAppBanner: (String) -> Unit = {}
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var showQueueHelpDialog by remember { mutableStateOf(false) }
    var showResetConfirmDialog by remember { mutableStateOf(false) }
    var queueDropdownExpanded by remember { mutableStateOf(false) }
    var advanceDropdownExpanded by remember { mutableStateOf(false) }
    var refreshDropdownExpanded by remember { mutableStateOf(false) }

    // Interactive Address Lookup state inside "?" modal
    var selectedRemId by remember(selectedAddressQuery) {
        mutableStateOf(selectedAddressQuery?.remId?.ifBlank { "zhytomyr" } ?: "zhytomyr")
    }
    var selectedSettlementId by remember(selectedAddressQuery) {
        mutableStateOf(selectedAddressQuery?.settlementId?.ifBlank { "zt_city" } ?: "zt_city")
    }
    var selectedStreetId by remember(selectedAddressQuery) {
        mutableStateOf(selectedAddressQuery?.streetId ?: "")
    }
    var selectedHouse by remember(selectedAddressQuery) {
        mutableStateOf(selectedAddressQuery?.house ?: "")
    }
    var remDropdownExpanded by remember { mutableStateOf(false) }
    var settlementDropdownExpanded by remember { mutableStateOf(false) }
    var streetDropdownExpanded by remember { mutableStateOf(false) }
    var houseDropdownExpanded by remember { mutableStateOf(false) }
    var isCheckingAddressOnSite by remember { mutableStateOf(false) }
    var addressLookupResult by remember { mutableStateOf<AddressLookupResult?>(null) }

    LaunchedEffect(autoOpenQueueHelp) {
        if (autoOpenQueueHelp) {
            showQueueHelpDialog = true
            onAutoOpenQueueHelpHandled()
        }
    }

    val queues = listOf(
        "1.1", "1.2", "2.1", "2.2", "3.1", "3.2",
        "4.1", "4.2", "5.1", "5.2", "6.1", "6.2"
    )
    val timerOptions = listOf(5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240)

    val isUrlInValidList = remember(siteUrl) { ZtoeParser.isValidUrl(siteUrl, context) }
    var urlFetchStatus by remember { mutableStateOf(FetchStatus.SUCCESS) }
    var isVerifyingUrl by remember { mutableStateOf(false) }

    // Live URL verification against valid-urls.json + actual table with current date & queues on site
    LaunchedEffect(siteUrl, currentQueue) {
        if (!ZtoeParser.isValidUrl(siteUrl, context)) {
            urlFetchStatus = FetchStatus.NO_QUEUES_FOUND
            return@LaunchedEffect
        }
        isVerifyingUrl = true
        val verifyQueue = currentQueue.ifBlank { "1.1" }
        val res = withContext(Dispatchers.IO) {
            ZtoeParser.fetchFullSchedule(siteUrl, verifyQueue, context)
        }
        urlFetchStatus = res.status
        isVerifyingUrl = false
    }

    val isSiteVerifiedSuccess = isUrlInValidList && urlFetchStatus == FetchStatus.SUCCESS

    val queueFieldDisplay = when {
        !customQueueStatusText.isNullOrBlank() ->
            if (lang == "uk") "Черга відсутня (не вимикається)" else "No queue (not disconnected)"
        currentQueue.isBlank() ->
            if (lang == "uk") "Виберіть чергу" else "Select queue"
        else -> "\${AppStrings.queue(lang)} $currentQueue"
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Icon(
                Icons.Default.Tune,
                contentDescription = null,
                tint = Color(0xFFFF5E3A),
                modifier = Modifier.size(24.dp)
            )
            Text(
                text = AppStrings.settingsTitle(lang),
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }

        // 1. Queue Selection Card (Frosted Glass)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .shadow(10.dp, RoundedCornerShape(24.dp), ambientColor = Color(0x66000000), spotColor = Color(0x80000000))
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0xBF141A29))
                .padding(18.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .padding(end = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(2.dp)
                    ) {
                        Text(
                            text = AppStrings.queueTitle(lang),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = AppStrings.queueDesc(lang),
                            fontSize = 11.sp,
                            color = Color(0xB3BAE6FD)
                        )
                    }
                    // Prominent "?" button on the right matching Workbench size (40x40dp), color (#FF5E3A), and rounded-2xl (16.dp) shape
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color(0xFFFF5E3A))
                            .border(1.dp, Color(0x40FFFFFF), RoundedCornerShape(16.dp))
                            .clickable { showQueueHelpDialog = true },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.HelpOutline,
                            contentDescription = AppStrings.queueHelpTitle(lang),
                            tint = Color.White,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }

                // Clean Native Exposed Dropdown Menu
                ExposedDropdownMenuBox(
                    expanded = queueDropdownExpanded,
                    onExpandedChange = { queueDropdownExpanded = it }
                ) {
                    OutlinedTextField(
                        value = queueFieldDisplay,
                        onValueChange = {},
                        readOnly = true,
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = queueDropdownExpanded) },
                        modifier = Modifier.menuAnchor().fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = Color(0xFFFF5E3A),
                            unfocusedBorderColor = Color(0x33FFFFFF),
                            focusedContainerColor = Color(0x1AFFFFFF),
                            unfocusedContainerColor = Color(0x14FFFFFF)
                        )
                    )
                    ExposedDropdownMenu(
                        expanded = queueDropdownExpanded,
                        onDismissRequest = { queueDropdownExpanded = false },
                        modifier = Modifier.background(Color(0xFF141A29))
                    ) {
                        queues.forEach { q ->
                            DropdownMenuItem(
                                text = { Text("\${AppStrings.queue(lang)} $q", fontWeight = FontWeight.Bold, color = Color.White) },
                                onClick = {
                                    onQueueSelected(q)
                                    queueDropdownExpanded = false
                                }
                            )
                        }
                    }
                }
            }
        }

        // 2. Site Address with Strict Verification Glyph against /valid-urls.json & live table check
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .shadow(10.dp, RoundedCornerShape(24.dp), ambientColor = Color(0x66000000), spotColor = Color(0x80000000))
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0xBF141A29))
                .padding(18.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = AppStrings.siteAddressTitle(lang),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )

                    // Verification Glyph
                    val statusBadgeText = when {
                        isSiteVerifiedSuccess -> AppStrings.siteReachable(lang)
                        urlFetchStatus == FetchStatus.NO_INTERNET -> AppStrings.errorNoInternet(lang)
                        else -> AppStrings.errorNoQueuesFound(lang)
                    }
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (isSiteVerifiedSuccess) Color(0x3310B981) else Color(0x33EF4444))
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text(
                            text = statusBadgeText,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isSiteVerifiedSuccess) Color(0xFF34D399) else Color(0xFFF87171)
                        )
                    }
                }

                Text(
                    text = AppStrings.siteAddressDesc(lang),
                    fontSize = 11.sp,
                    color = Color(0xB3BAE6FD)
                )

                OutlinedTextField(
                    value = siteUrl,
                    onValueChange = { onSiteUrlChanged(it) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = if (isSiteVerifiedSuccess) Color(0xFFFF5E3A) else Color(0xFFEF4444),
                        unfocusedBorderColor = if (isSiteVerifiedSuccess) Color(0x33FFFFFF) else Color(0x66EF4444),
                        focusedContainerColor = Color(0x1AFFFFFF),
                        unfocusedContainerColor = Color(0x14FFFFFF)
                    )
                )

                if (!isSiteVerifiedSuccess && !isVerifyingUrl) {
                    val errText = if (urlFetchStatus == FetchStatus.NO_INTERNET) {
                        AppStrings.errorNoInternet(lang)
                    } else {
                        AppStrings.errorNoQueuesFound(lang)
                    }
                    Text(
                        text = errText,
                        fontSize = 10.sp,
                        color = Color(0xFFF87171)
                    )
                }
            }
        }

        // 3. Timers: Native Android Spinners restricted to 1..240 (No Edit Boxes!)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .shadow(10.dp, RoundedCornerShape(24.dp), ambientColor = Color(0x66000000), spotColor = Color(0x80000000))
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0xBF141A29))
                .padding(18.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                // Spinner 1: Advance Warning Notice
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = AppStrings.advanceNoticeTitle(lang),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = "1–240 \${AppStrings.minShort(lang)}",
                            fontSize = 10.sp,
                            color = Color(0x99BAE6FD)
                        )
                    }

                    ExposedDropdownMenuBox(
                        expanded = advanceDropdownExpanded,
                        onExpandedChange = { advanceDropdownExpanded = it }
                    ) {
                        OutlinedTextField(
                            value = "$advanceMinutes \${AppStrings.minShort(lang)}",
                            onValueChange = {},
                            readOnly = true,
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = advanceDropdownExpanded) },
                            modifier = Modifier.menuAnchor().fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedBorderColor = Color(0xFFFF5E3A),
                                unfocusedBorderColor = Color(0x33FFFFFF),
                                focusedContainerColor = Color(0x1AFFFFFF),
                                unfocusedContainerColor = Color(0x14FFFFFF)
                            )
                        )
                        ExposedDropdownMenu(
                            expanded = advanceDropdownExpanded,
                            onDismissRequest = { advanceDropdownExpanded = false },
                            modifier = Modifier.background(Color(0xFF141A29))
                        ) {
                            timerOptions.forEach { mins ->
                                DropdownMenuItem(
                                    text = { Text("$mins \${AppStrings.minShort(lang)}", fontWeight = FontWeight.Bold, color = Color.White) },
                                    onClick = {
                                        onAdvanceMinutesChanged(mins)
                                        advanceDropdownExpanded = false
                                    }
                                )
                            }
                        }
                    }
                }

                Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(Color(0x1AFFFFFF)))

                // Spinner 2: Site Refresh Interval
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = AppStrings.refreshIntervalTitle(lang),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = "1–240 \${AppStrings.minShort(lang)}",
                            fontSize = 10.sp,
                            color = Color(0x99BAE6FD)
                        )
                    }

                    ExposedDropdownMenuBox(
                        expanded = refreshDropdownExpanded,
                        onExpandedChange = { refreshDropdownExpanded = it }
                    ) {
                        OutlinedTextField(
                            value = "$refreshMinutes \${AppStrings.minShort(lang)}",
                            onValueChange = {},
                            readOnly = true,
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = refreshDropdownExpanded) },
                            modifier = Modifier.menuAnchor().fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedBorderColor = Color(0xFFFF5E3A),
                                unfocusedBorderColor = Color(0x33FFFFFF),
                                focusedContainerColor = Color(0x1AFFFFFF),
                                unfocusedContainerColor = Color(0x14FFFFFF)
                            )
                        )
                        ExposedDropdownMenu(
                            expanded = refreshDropdownExpanded,
                            onDismissRequest = { refreshDropdownExpanded = false },
                            modifier = Modifier.background(Color(0xFF141A29))
                        ) {
                            timerOptions.forEach { mins ->
                                DropdownMenuItem(
                                    text = { Text("$mins \${AppStrings.minShort(lang)}", fontWeight = FontWeight.Bold, color = Color.White) },
                                    onClick = {
                                        onRefreshMinutesChanged(mins)
                                        refreshDropdownExpanded = false
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }

        // 4. Notification Toggles (Sound & Vibration shared by Notifications and Emergency Power Outages)
        val anyAlertsEnabled = notificationsEnabled || emergencyNotificationsEnabled
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .shadow(10.dp, RoundedCornerShape(24.dp), ambientColor = Color(0x66000000), spotColor = Color(0x80000000))
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0xBF141A29))
                .border(1.dp, Color(0x26FFFFFF), RoundedCornerShape(24.dp))
                .padding(18.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Notifications,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(16.dp)
                        )
                        Text(AppStrings.notifications(lang), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
                    }
                    Switch(
                        checked = notificationsEnabled,
                        onCheckedChange = onToggleNotifications,
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color.White,
                            checkedTrackColor = Color(0xFFFF5E3A),
                            uncheckedThumbColor = Color.LightGray,
                            uncheckedTrackColor = Color(0x33FFFFFF)
                        )
                    )
                }

                Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(Color(0x1AFFFFFF)))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.VolumeUp,
                            contentDescription = null,
                            tint = if (anyAlertsEnabled) Color(0xB3BAE6FD) else Color(0x4DBAE6FD),
                            modifier = Modifier.size(16.dp)
                        )
                        Text(
                            text = AppStrings.sound(lang),
                            fontSize = 12.sp,
                            color = if (anyAlertsEnabled) Color.White else Color(0x66FFFFFF)
                        )
                    }
                    Switch(
                        checked = anyAlertsEnabled && soundEnabled,
                        onCheckedChange = onToggleSound,
                        enabled = anyAlertsEnabled,
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color.White,
                            checkedTrackColor = Color(0xFFFF5E3A),
                            uncheckedThumbColor = Color.LightGray,
                            uncheckedTrackColor = Color(0x33FFFFFF),
                            disabledCheckedTrackColor = Color(0x33FF5E3A),
                            disabledUncheckedTrackColor = Color(0x1AFFFFFF),
                            disabledUncheckedThumbColor = Color(0x4DFFFFFF)
                        )
                    )
                }

                Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(Color(0x1AFFFFFF)))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Vibration,
                            contentDescription = null,
                            tint = if (anyAlertsEnabled) Color(0xB3BAE6FD) else Color(0x4DBAE6FD),
                            modifier = Modifier.size(16.dp)
                        )
                        Text(
                            text = AppStrings.vibration(lang),
                            fontSize = 12.sp,
                            color = if (anyAlertsEnabled) Color.White else Color(0x66FFFFFF)
                        )
                    }
                    Switch(
                        checked = anyAlertsEnabled && vibrationEnabled,
                        onCheckedChange = onToggleVibration,
                        enabled = anyAlertsEnabled,
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color.White,
                            checkedTrackColor = Color(0xFFFF5E3A),
                            uncheckedThumbColor = Color.LightGray,
                            uncheckedTrackColor = Color(0x33FFFFFF),
                            disabledCheckedTrackColor = Color(0x33FF5E3A),
                            disabledUncheckedTrackColor = Color(0x1AFFFFFF),
                            disabledUncheckedThumbColor = Color(0x4DFFFFFF)
                        )
                    )
                }
            }
        }

        // 4b. Emergency Power Outages Switch (Separate block below Notifications block; always visible even when no outages detected; ON by default)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .shadow(10.dp, RoundedCornerShape(24.dp), ambientColor = Color(0x66000000), spotColor = Color(0x80000000))
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0xBF141A29))
                .border(1.dp, Color(0x26FFFFFF), RoundedCornerShape(24.dp))
                .padding(18.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    modifier = Modifier
                        .weight(1f)
                        .padding(end = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Warning,
                        contentDescription = null,
                        tint = Color(0xFFFF5E3A),
                        modifier = Modifier.size(16.dp)
                    )
                    Text(
                        text = AppStrings.emergencyNotifications(lang),
                        fontSize = 12.sp,
                        lineHeight = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
                Switch(
                    checked = emergencyNotificationsEnabled,
                    onCheckedChange = onToggleEmergencyNotifications,
                    enabled = true,
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = Color.White,
                        checkedTrackColor = Color(0xFFFF5E3A),
                        uncheckedThumbColor = Color.LightGray,
                        uncheckedTrackColor = Color(0x33FFFFFF)
                    )
                )
            }
        }

        // 5. Language Selection Card (Dynamic Localization!)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .shadow(10.dp, RoundedCornerShape(24.dp), ambientColor = Color(0x66000000), spotColor = Color(0x80000000))
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0xBF141A29))
                .border(1.dp, Color(0x26FFFFFF), RoundedCornerShape(24.dp))
                .padding(18.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Language,
                        contentDescription = null,
                        tint = Color(0xFFFF5E3A),
                        modifier = Modifier.size(14.dp)
                    )
                    Text(
                        text = AppStrings.languageTitle(lang),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0x59000000))
                        .border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(12.dp))
                        .padding(4.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    listOf("SYSTEM" to (if (lang == "uk") "Системна" else "System"), "uk" to "Українська", "en" to "English").forEach { (code, label) ->
                        val isSelected = currentLanguage.equals(code, ignoreCase = true)
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(9.dp))
                                .background(if (isSelected) Color.White else Color.Transparent)
                                .clickable { onLanguageSelected(code) }
                                .padding(vertical = 8.dp, horizontal = 8.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = label,
                                fontSize = 11.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.SemiBold,
                                color = if (isSelected) Color.Black else Color(0xBFE0F2FE)
                            )
                        }
                    }
                }
            }
        }

        // 6. Diagnostics & Actions Card
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .shadow(10.dp, RoundedCornerShape(24.dp), ambientColor = Color(0x66000000), spotColor = Color(0x80000000))
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0xBF141A29))
                .border(1.dp, Color(0x26FFFFFF), RoundedCornerShape(24.dp))
                .padding(18.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Send Test Alert Button (Respects Sound & Vibration)
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color(0xFFFF5E3A))
                            .clickable {
                                onSendTestAlert()
                                onShowAppBanner(if (lang == "uk") "Тестове сповіщення надіслано" else "Test alert dispatched")
                            }
                            .padding(vertical = 12.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Icon(Icons.Default.Send, contentDescription = null, tint = Color.White, modifier = Modifier.size(14.dp))
                            Text(AppStrings.testAlertBtn(lang), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
                        }
                    }

                    // Refresh Button with In-App Application Icon Notification Banner
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color(0x1AFFFFFF))
                            .border(1.dp, Color(0x26FFFFFF), RoundedCornerShape(16.dp))
                            .clickable {
                                onForceRefresh()
                            }
                            .padding(vertical = 12.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Icon(Icons.Default.Language, contentDescription = null, tint = Color.White, modifier = Modifier.size(14.dp))
                            Text(AppStrings.refreshBtn(lang), fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = Color.White)
                        }
                    }
                }

                // Reset to Defaults
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(16.dp))
                        .clickable { showResetConfirmDialog = true }
                        .padding(vertical = 10.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = null, tint = Color(0xB3BAE6FD), modifier = Modifier.size(14.dp))
                        Text(AppStrings.resetDefaultsBtn(lang), fontSize = 12.sp, fontWeight = FontWeight.Medium, color = Color(0xB3BAE6FD))
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(96.dp))
    }

    // =========================================================================================
    // Full-Screen Queue Help & Interactive ZTOE Address Lookup Dialog ("?" Button)
    // =========================================================================================
    if (showQueueHelpDialog) {
        var allRems by remember {
            mutableStateOf(ZtoeAddressLookup.getRems())
        }
        val currentRem = allRems.find { it.id == selectedRemId } ?: allRems.first()

        var settlementsList by remember(selectedRemId) {
            mutableStateOf(ZtoeAddressLookup.getSettlementsForRem(selectedRemId))
        }
        var streetsList by remember(selectedSettlementId) {
            mutableStateOf(
                if (selectedSettlementId.isNotBlank()) {
                    ZtoeAddressLookup.getStreetsForSettlement(selectedSettlementId)
                } else {
                    emptyList()
                }
            )
        }
        var housesList by remember(selectedStreetId) {
            mutableStateOf(
                if (selectedStreetId.isNotBlank()) {
                    ZtoeAddressLookup.getHousesForStreet(selectedStreetId)
                } else {
                    emptyList()
                }
            )
        }

        // Refresh the list of all REMs, Cities, Streets and Houses whenever User enters the "?" screen
        LaunchedEffect(siteUrl) {
            val fetchedRems = withContext(Dispatchers.IO) {
                ZtoeAddressLookup.fetchRemsFromZtoe(siteUrl, forceRefresh = true)
            }
            if (fetchedRems.isNotEmpty()) {
                allRems = fetchedRems
            }
        }

        // Dynamically load full settlement list for selected REM from ZTOE (refreshed when entering "?" screen)
        LaunchedEffect(selectedRemId, siteUrl) {
            val fetched = withContext(Dispatchers.IO) {
                ZtoeAddressLookup.fetchSettlementsForRem(selectedRemId, siteUrl, forceRefresh = true)
            }
            if (fetched.isNotEmpty()) {
                settlementsList = fetched
                if (selectedSettlementId.isBlank() || fetched.none { it.id == selectedSettlementId }) {
                    selectedSettlementId = fetched.first().id
                }
            }
        }

        // Dynamically load full street list (and bulk-index all houses for every street in the settlement) from ZTOE
        LaunchedEffect(selectedRemId, selectedSettlementId, siteUrl) {
            if (selectedSettlementId.isBlank()) {
                streetsList = emptyList()
                return@LaunchedEffect
            }
            val fetched = withContext(Dispatchers.IO) {
                ZtoeAddressLookup.fetchStreetsForSettlement(selectedRemId, selectedSettlementId, siteUrl, forceRefresh = true)
            }
            if (fetched.isNotEmpty()) {
                streetsList = fetched
                allRems = ZtoeAddressLookup.getRems()
                settlementsList = ZtoeAddressLookup.getSettlementsForRem(selectedRemId)
                if (selectedStreetId.isNotBlank()) {
                    val bulkIndexed = ZtoeAddressLookup.getHousesForStreet(selectedStreetId)
                    if (bulkIndexed.isNotEmpty()) {
                        housesList = bulkIndexed
                    }
                }
            }
        }

        // Dynamically load full house list for selected street from ZTOE (served in 0ms when already bulk-indexed)
        LaunchedEffect(selectedRemId, selectedSettlementId, selectedStreetId, siteUrl) {
            if (selectedStreetId.isBlank()) {
                housesList = emptyList()
                return@LaunchedEffect
            }
            housesList = ZtoeAddressLookup.getHousesForStreet(selectedStreetId)
            val fetched = withContext(Dispatchers.IO) {
                ZtoeAddressLookup.fetchHousesForStreet(selectedRemId, selectedSettlementId, selectedStreetId, siteUrl, forceRefresh = true)
            }
            if (fetched.isNotEmpty()) {
                housesList = fetched
            }
        }

        val currentSettlement = settlementsList.find { it.id == selectedSettlementId }
            ?: ZtoeAddressLookup.findSettlementById(selectedSettlementId)
            ?: settlementsList.firstOrNull()
        val currentStreet = streetsList.find { it.id == selectedStreetId }
            ?: ZtoeAddressLookup.findStreetById(selectedStreetId)
        val currentHouseRecord = housesList.find { it.house.equals(selectedHouse, ignoreCase = true) }

        // Automatically query ZTOE when a valid street and house are selected (do NOT close or apply until user clicks button)
        LaunchedEffect(selectedRemId, selectedSettlementId, selectedStreetId, selectedHouse) {
            addressLookupResult = null
            if (selectedStreetId.isBlank() || selectedHouse.isBlank()) {
                isCheckingAddressOnSite = false
                return@LaunchedEffect
            }
            isCheckingAddressOnSite = true
            val res = withContext(Dispatchers.IO) {
                ZtoeAddressLookup.checkAddressOnZtoeWebsite(
                    remId = selectedRemId,
                    settlementId = selectedSettlementId,
                    streetId = selectedStreetId,
                    house = selectedHouse,
                    siteUrl = siteUrl
                )
            }
            isCheckingAddressOnSite = false
            addressLookupResult = res
            if (res != null) {
                val exists = housesList.any { it.house.equals(res.house, ignoreCase = true) }
                housesList = if (!exists) {
                    housesList + res
                } else {
                    housesList.map { h ->
                        if (h.house.equals(res.house, ignoreCase = true)) {
                            h.copy(
                                queue = res.queue.ifEmpty { h.queue },
                                statusText = res.statusText ?: h.statusText,
                                emergencyOutage = res.emergencyOutage ?: h.emergencyOutage,
                                addressLabel = res.addressLabel.ifEmpty { h.addressLabel }
                            )
                        } else h
                    }
                }
            }
        }

        val selectedAddressStr = if (currentStreet != null && selectedHouse.isNotBlank()) {
            val remName = if (lang == "uk") currentRem.nameUk else currentRem.nameEn
            val settlementName = if (currentSettlement != null) {
                if (lang == "uk") currentSettlement.nameUk else currentSettlement.nameEn
            } else ""
            val streetName = if (lang == "uk") currentStreet.nameUk else currentStreet.nameEn
            val housePrefix = if (lang == "uk") "буд." else "bldg."
            "$remName, $settlementName,\\n$streetName, $housePrefix $selectedHouse"
        } else {
            ""
        }

        Dialog(
            onDismissRequest = { showQueueHelpDialog = false },
            properties = DialogProperties(usePlatformDefaultWidth = false)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xFF141A29))
                    .statusBarsPadding()
                    .navigationBarsPadding()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 14.dp, vertical = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(20.dp)
                ) {
                    // Modal Header matching Workbench
                    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 4.dp),
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
                                        .background(Color(0xFFFF5E3A)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = "?",
                                        fontSize = 20.sp,
                                        fontWeight = FontWeight.Black,
                                        color = Color.White
                                    )
                                }
                                Text(
                                    text = AppStrings.queueHelpTitle(lang),
                                    fontSize = 20.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = Color.White
                                )
                            }
                            Box(
                                modifier = Modifier
                                    .size(40.dp)
                                    .clip(CircleShape)
                                    .background(Color(0x1AFFFFFF))
                                    .border(1.dp, Color(0x26FFFFFF), CircleShape)
                                    .clickable { showQueueHelpDialog = false },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    Icons.Default.Close,
                                    contentDescription = "Close",
                                    tint = Color.White,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(Color(0x33FFFFFF)))
                    }

                    // 1) Interactive Search by Address Card matching Workbench
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
                                    text = (if (lang == "uk") "Пошук черги за адресою" else "Find Queue by Address").uppercase(),
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = Color.White,
                                    letterSpacing = 0.8.sp
                                )
                                Text(
                                    text = AppStrings.queueHelpAddressSubtitle(lang),
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = Color(0xCCBAE6FD)
                                )
                            }

                            // 1. РЕМ Dropdown
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(
                                    text = if (lang == "uk") "РЕМ" else "District (РЕМ)",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xE6BAE6FD)
                                )
                                ExposedDropdownMenuBox(
                                    expanded = remDropdownExpanded,
                                    onExpandedChange = { remDropdownExpanded = it }
                                ) {
                                    OutlinedTextField(
                                        value = if (lang == "uk") currentRem.nameUk else currentRem.nameEn,
                                        onValueChange = {},
                                        readOnly = true,
                                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = remDropdownExpanded) },
                                        modifier = Modifier.menuAnchor().fillMaxWidth(),
                                        shape = RoundedCornerShape(16.dp),
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedTextColor = Color.White,
                                            unfocusedTextColor = Color.White,
                                            focusedBorderColor = Color(0xFFFF5E3A),
                                            unfocusedBorderColor = Color(0x33FFFFFF),
                                            focusedContainerColor = Color(0x14FFFFFF),
                                            unfocusedContainerColor = Color(0x14FFFFFF)
                                        )
                                    )
                                    ExposedDropdownMenu(
                                        expanded = remDropdownExpanded,
                                        onDismissRequest = { remDropdownExpanded = false },
                                        modifier = Modifier
                                            .background(Color(0xFF141A29))
                                            .heightIn(max = 320.dp)
                                    ) {
                                        allRems.forEach { rem ->
                                            DropdownMenuItem(
                                                text = {
                                                    Text(
                                                        if (lang == "uk") rem.nameUk else rem.nameEn,
                                                        fontWeight = FontWeight.Bold,
                                                        color = Color.White
                                                    )
                                                },
                                                onClick = {
                                                    selectedRemId = rem.id
                                                    val nextSettlements = ZtoeAddressLookup.getSettlementsForRem(rem.id)
                                                    settlementsList = nextSettlements
                                                    val nextSettlementId = nextSettlements.firstOrNull()?.id ?: ""
                                                    selectedSettlementId = nextSettlementId
                                                    streetsList = if (nextSettlementId.isNotBlank()) {
                                                        ZtoeAddressLookup.getStreetsForSettlement(nextSettlementId)
                                                    } else {
                                                        emptyList()
                                                    }
                                                    selectedStreetId = ""
                                                    housesList = emptyList()
                                                    selectedHouse = ""
                                                    addressLookupResult = null
                                                    remDropdownExpanded = false
                                                }
                                            )
                                        }
                                    }
                                }
                            }

                            // 2. Населений пункт Dropdown
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(
                                    text = if (lang == "uk") "Населений пункт" else "City / Settlement",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xE6BAE6FD)
                                )
                                ExposedDropdownMenuBox(
                                    expanded = settlementDropdownExpanded,
                                    onExpandedChange = { settlementDropdownExpanded = it }
                                ) {
                                    val settlementDisplay = if (currentSettlement != null) {
                                        if (lang == "uk") currentSettlement.nameUk else currentSettlement.nameEn
                                    } else {
                                        if (lang == "uk") "Оберіть населений пункт" else "Select settlement"
                                    }
                                    OutlinedTextField(
                                        value = settlementDisplay,
                                        onValueChange = {},
                                        readOnly = true,
                                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = settlementDropdownExpanded) },
                                        modifier = Modifier.menuAnchor().fillMaxWidth(),
                                        shape = RoundedCornerShape(16.dp),
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedTextColor = Color.White,
                                            unfocusedTextColor = Color.White,
                                            focusedBorderColor = Color(0xFFFF5E3A),
                                            unfocusedBorderColor = Color(0x33FFFFFF),
                                            focusedContainerColor = Color(0x14FFFFFF),
                                            unfocusedContainerColor = Color(0x14FFFFFF)
                                        )
                                    )
                                    ExposedDropdownMenu(
                                        expanded = settlementDropdownExpanded,
                                        onDismissRequest = { settlementDropdownExpanded = false },
                                        modifier = Modifier
                                            .background(Color(0xFF141A29))
                                            .heightIn(max = 320.dp)
                                    ) {
                                        settlementsList.forEach { settlement ->
                                            DropdownMenuItem(
                                                text = {
                                                    Text(
                                                        if (lang == "uk") settlement.nameUk else settlement.nameEn,
                                                        fontWeight = FontWeight.Bold,
                                                        color = Color.White
                                                    )
                                                },
                                                onClick = {
                                                    selectedSettlementId = settlement.id
                                                    streetsList = ZtoeAddressLookup.getStreetsForSettlement(settlement.id)
                                                    selectedStreetId = ""
                                                    housesList = emptyList()
                                                    selectedHouse = ""
                                                    addressLookupResult = null
                                                    settlementDropdownExpanded = false
                                                }
                                            )
                                        }
                                    }
                                }
                            }

                            // 3. Вулиця Dropdown (unselected by default on first launch)
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(
                                    text = if (lang == "uk") "Вулиця" else "Street",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xE6BAE6FD)
                                )
                                ExposedDropdownMenuBox(
                                    expanded = streetDropdownExpanded,
                                    onExpandedChange = { streetDropdownExpanded = it }
                                ) {
                                    val streetDisplay = when {
                                        currentStreet == null -> if (lang == "uk") "Оберіть вулицю" else "Select street"
                                        lang == "uk" -> currentStreet.nameUk
                                        else -> currentStreet.nameEn
                                    }
                                    OutlinedTextField(
                                        value = streetDisplay,
                                        onValueChange = {},
                                        readOnly = true,
                                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = streetDropdownExpanded) },
                                        modifier = Modifier.menuAnchor().fillMaxWidth(),
                                        shape = RoundedCornerShape(16.dp),
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedTextColor = Color.White,
                                            unfocusedTextColor = Color.White,
                                            focusedBorderColor = Color(0xFFFF5E3A),
                                            unfocusedBorderColor = Color(0x33FFFFFF),
                                            focusedContainerColor = Color(0x14FFFFFF),
                                            unfocusedContainerColor = Color(0x14FFFFFF)
                                        )
                                    )
                                    ExposedDropdownMenu(
                                        expanded = streetDropdownExpanded,
                                        onDismissRequest = { streetDropdownExpanded = false },
                                        modifier = Modifier
                                            .background(Color(0xFF141A29))
                                            .heightIn(max = 320.dp)
                                    ) {
                                        streetsList.forEach { street ->
                                            DropdownMenuItem(
                                                text = {
                                                    Text(
                                                        if (lang == "uk") street.nameUk else street.nameEn,
                                                        fontWeight = FontWeight.Bold,
                                                        color = Color.White
                                                    )
                                                },
                                                onClick = {
                                                    selectedStreetId = street.id
                                                    housesList = ZtoeAddressLookup.getHousesForStreet(street.id)
                                                    selectedHouse = ""
                                                    addressLookupResult = null
                                                    streetDropdownExpanded = false
                                                }
                                            )
                                        }
                                    }
                                }
                            }

                            // 4. Будинок Dropdown (unselected by default on first launch)
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(
                                    text = if (lang == "uk") "Будинок" else "House Number",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xE6BAE6FD)
                                )
                                ExposedDropdownMenuBox(
                                    expanded = houseDropdownExpanded,
                                    onExpandedChange = {
                                        if (currentStreet != null) {
                                            houseDropdownExpanded = it
                                        }
                                    }
                                ) {
                                    val houseDisplay = when {
                                        selectedHouse.isBlank() -> if (lang == "uk") "Оберіть будинок" else "Select house"
                                        else -> selectedHouse
                                    }
                                    OutlinedTextField(
                                        value = houseDisplay,
                                        onValueChange = {},
                                        readOnly = true,
                                        enabled = currentStreet != null,
                                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = houseDropdownExpanded) },
                                        modifier = Modifier.menuAnchor().fillMaxWidth(),
                                        shape = RoundedCornerShape(16.dp),
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedTextColor = Color.White,
                                            unfocusedTextColor = Color.White,
                                            disabledTextColor = Color(0x80FFFFFF),
                                            focusedBorderColor = Color(0xFFFF5E3A),
                                            unfocusedBorderColor = Color(0x33FFFFFF),
                                            disabledBorderColor = Color(0x1AFFFFFF),
                                            focusedContainerColor = Color(0x14FFFFFF),
                                            unfocusedContainerColor = Color(0x14FFFFFF),
                                            disabledContainerColor = Color(0x0DFFFFFF)
                                        )
                                    )
                                    ExposedDropdownMenu(
                                        expanded = houseDropdownExpanded,
                                        onDismissRequest = { houseDropdownExpanded = false },
                                        modifier = Modifier
                                            .background(Color(0xFF141A29))
                                            .heightIn(max = 320.dp)
                                    ) {
                                        housesList.forEach { h ->
                                            DropdownMenuItem(
                                                text = {
                                                    Text(
                                                        h.house,
                                                        fontWeight = FontWeight.Bold,
                                                        color = Color.White
                                                    )
                                                },
                                                onClick = {
                                                    selectedHouse = h.house
                                                    addressLookupResult = null
                                                    houseDropdownExpanded = false
                                                }
                                            )
                                        }
                                    }
                                }
                            }

                            // Result Card matching Workbench (shown when a house is selected)
                            val validLookupResult = addressLookupResult?.takeIf {
                                it.house.equals(selectedHouse, ignoreCase = true)
                            }
                            val matchedRecord = when {
                                validLookupResult != null && currentHouseRecord != null -> validLookupResult.copy(
                                    queue = validLookupResult.queue.ifEmpty { currentHouseRecord.queue },
                                    statusText = validLookupResult.statusText ?: currentHouseRecord.statusText,
                                    emergencyOutage = validLookupResult.emergencyOutage ?: currentHouseRecord.emergencyOutage
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
                            if (selectedHouse.isNotBlank() && matchedRecord != null) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(top = 6.dp)
                                        .clip(RoundedCornerShape(16.dp))
                                        .background(Color(0xD9141A29))
                                        .border(2.dp, Color.White.copy(alpha = 0.25f), RoundedCornerShape(16.dp))
                                        .padding(16.dp)
                                ) {
                                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                        if (selectedAddressStr.isNotBlank()) {
                                            Text(
                                                text = selectedAddressStr,
                                                fontSize = 14.sp,
                                                fontWeight = FontWeight.SemiBold,
                                                color = Color(0xE6BAE6FD),
                                                lineHeight = 19.sp
                                            )
                                        }

                                        if (matchedRecord.queue.isNotBlank()) {
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Text(
                                                    text = if (lang == "uk") "Знайдена черга:" else "Found Queue:",
                                                    fontSize = 14.sp,
                                                    fontWeight = FontWeight.Medium,
                                                    color = Color(0xCCBAE6FD)
                                                )
                                                Text(
                                                    text = "\${AppStrings.queue(lang)} \${matchedRecord.queue}",
                                                    fontSize = 16.sp,
                                                    fontWeight = FontWeight.ExtraBold,
                                                    fontFamily = FontFamily.Monospace,
                                                    color = Color.White
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
                                                    fontSize = 14.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = Color.White,
                                                    lineHeight = 19.sp
                                                )
                                            }
                                        }

                                        val emerg = matchedRecord.emergencyOutage
                                        if (emerg != null) {
                                            Box(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .clip(RoundedCornerShape(16.dp))
                                                    .background(Color(0x1AFF5E3A))
                                                    .border(2.dp, Color(0x59FF5E3A), RoundedCornerShape(16.dp))
                                                    .padding(horizontal = 16.dp, vertical = 12.dp)
                                            ) {
                                                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                                    Text(
                                                        text = if (lang == "uk") {
                                                            emerg.outageType.ifBlank { "Аварійне відключення" }
                                                        } else {
                                                            "Emergency Outage"
                                                        },
                                                        fontSize = 14.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        color = Color(0xFFFF5E3A)
                                                    )
                                                    Text(
                                                        text = if (lang == "uk") {
                                                            "Початок: \${emerg.startTime} · Відновлення: \${emerg.estimatedRestoreTime}"
                                                        } else {
                                                            "Start: \${emerg.startTime} · Restore: \${emerg.estimatedRestoreTime}"
                                                        },
                                                        fontSize = 12.sp,
                                                        fontFamily = FontFamily.Monospace,
                                                        color = Color.White
                                                    )
                                                }
                                            }
                                        }

                                        // Full-width "Обрати чергу X.Y" / "Apply Queue X.Y" button UNDER address matching Workbench
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clip(RoundedCornerShape(16.dp))
                                                .background(Color(0xFFFF5E3A))
                                                .clickable {
                                                    val query = SelectedAddressQuery(
                                                        remId = selectedRemId,
                                                        settlementId = selectedSettlementId,
                                                        streetId = selectedStreetId,
                                                        house = selectedHouse
                                                    )
                                                    val addressToSave = selectedAddressStr.ifBlank { matchedRecord.addressLabel }
                                                    if (matchedRecord.queue.isNotBlank()) {
                                                        onAddressQueueResolved(
                                                            matchedRecord.queue,
                                                            null,
                                                            addressToSave,
                                                            matchedRecord.emergencyOutage,
                                                            query
                                                        )
                                                        showQueueHelpDialog = false
                                                        onShowAppBanner("\${AppStrings.queue(lang)} \${matchedRecord.queue}")
                                                    } else {
                                                        onAddressQueueResolved(
                                                            "",
                                                            matchedRecord.statusText,
                                                            addressToSave,
                                                            matchedRecord.emergencyOutage,
                                                            query
                                                        )
                                                        showQueueHelpDialog = false
                                                        onShowAppBanner(
                                                            matchedRecord.statusText
                                                                ?: if (lang == "uk") "Адресу збережено" else "Address saved"
                                                        )
                                                    }
                                                }
                                                .padding(vertical = 14.dp, horizontal = 16.dp),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text(
                                                text = if (matchedRecord.queue.isNotBlank()) {
                                                    if (lang == "uk") "Обрати чергу \${matchedRecord.queue}" else "Apply Queue \${matchedRecord.queue}"
                                                } else {
                                                    if (lang == "uk") "Підтвердити вибір" else "Confirm selection"
                                                },
                                                fontSize = 16.sp,
                                                fontWeight = FontWeight.ExtraBold,
                                                color = Color.White
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // 2) "Пошук вручну" / "Manual search" Heading matching Workbench
                    Text(
                        text = AppStrings.queueHelpManualSearchTitle(lang).uppercase(),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = Color.White,
                        letterSpacing = 0.8.sp,
                        modifier = Modifier.padding(top = 4.dp, start = 4.dp)
                    )

                    // 3) Numbered instructions 1-4 inside cards matching Workbench
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
                                            .size(24.dp)
                                            .clip(CircleShape)
                                            .background(Color(0x26FFFFFF)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = "\${idx + 1}",
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                            fontFamily = FontFamily.Monospace,
                                            color = Color.White
                                        )
                                    }
                                    val targetUrl = "https://www.ztoe.com.ua/unhooking-search.php"
                                    val urlStart = step.indexOf(targetUrl)
                                    if (urlStart >= 0) {
                                        val urlEnd = urlStart + targetUrl.length
                                        val annotatedStep = buildAnnotatedString {
                                            append(step)
                                            addStyle(
                                                style = SpanStyle(
                                                    color = Color(0xFFFF5E3A),
                                                    fontWeight = FontWeight.SemiBold,
                                                    textDecoration = TextDecoration.Underline
                                                ),
                                                start = urlStart,
                                                end = urlEnd
                                            )
                                        }
                                        Text(
                                            text = annotatedStep,
                                            color = Color(0xFFF4F4F5),
                                            fontSize = 14.sp,
                                            lineHeight = 20.sp,
                                            modifier = Modifier
                                                .weight(1f)
                                                .clickable {
                                                    try {
                                                        val intent = android.content.Intent(
                                                            android.content.Intent.ACTION_VIEW,
                                                            android.net.Uri.parse(targetUrl)
                                                        )
                                                        context.startActivity(intent)
                                                    } catch (_: Exception) {}
                                                }
                                        )
                                    } else {
                                        Text(
                                            text = step,
                                            color = Color(0xFFF4F4F5),
                                            fontSize = 14.sp,
                                            lineHeight = 20.sp,
                                            modifier = Modifier.weight(1f)
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // Bottom "Зрозуміло" / "Got it" button matching Workbench (white bg, black text)
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 4.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color.White)
                            .clickable { showQueueHelpDialog = false }
                            .padding(vertical = 14.dp, horizontal = 20.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = AppStrings.queueHelpGotIt(lang),
                            color = Color.Black,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                    }
                }
            }
        }
    }

    // Reset Confirm Dialog
    if (showResetConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showResetConfirmDialog = false },
            title = { Text(AppStrings.resetConfirmTitle(lang), fontWeight = FontWeight.Bold, color = Color.White) },
            text = { Text(AppStrings.resetConfirmDesc(lang), color = Color.LightGray) },
            confirmButton = {
                TextButton(onClick = {
                    onResetDefaults()
                    showResetConfirmDialog = false
                    onShowAppBanner(if (lang == "uk") "Налаштування скинуто" else "Settings reset")
                }) {
                    Text(AppStrings.resetYes(lang), color = Color(0xFFFF5E3A), fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showResetConfirmDialog = false }) {
                    Text(AppStrings.cancel(lang), color = Color.White)
                }
            },
            containerColor = Color(0xFF141A29)
        )
    }
}
`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/data/parser/ZtoeAddressLookup.kt',
    language: 'kotlin',
    description: 'ZTOE Address Queue Lookup & Emergency Outage Parser',
    content: `package ua.blackout.prewarning.data.parser

import org.jsoup.Jsoup
import ua.blackout.prewarning.data.KYIV_ZONE
import ua.blackout.prewarning.data.model.EmergencyOutageInfo
import ua.blackout.prewarning.data.model.SelectedAddressQuery
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.Charset
import java.time.LocalDate

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

data class ZtoeStreetOption(
    val id: String,
    val settlementId: String,
    val ztoeVulicaId: Int,
    val nameUk: String,
    val nameEn: String,
    val poweronStreetId: Int? = null
) {
    val houses: List<ZtoeHouseLookupResult>
        get() = ZtoeAddressLookup.getHousesForStreet(id)
}

data class ZtoeHouseLookupResult(
    val house: String,
    val queue: String,
    val statusText: String? = null,
    val emergencyOutage: EmergencyOutageInfo? = null,
    val addressLabel: String = ""
)

object ZtoeAddressLookup {
    private val ISO_TIMESTAMP_REGEX = Regex("""^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2})""")
    private val PW_ACCIDENTS_PARSE_REGEX = Regex("""pw_accidents\\s*=\\s*JSON\\.parse\\(\\s*'((?:\\\\'|[^'])*)'\\s*\\)""", RegexOption.IGNORE_CASE)
    private val PW_ACCIDENTS_ARRAY_REGEX = Regex("""pw_accidents\\s*=\\s*(\\[\\s*\\{[\\s\\S]*?\\}\\s*\\])\\s*;""")
    private val CITY_PREFIX_REGEX = Regex("""^(м\\.|місто|с\\.|село|смт|селище)\\s*""", RegexOption.IGNORE_CASE)
    private val STREET_PREFIX_REGEX = Regex("""^(вул\\.|вулиця|пров\\.|провулок|просп\\.|проспект|майдан|бульвар|б-р|шосе)\\s*""", RegexOption.IGNORE_CASE)
    private val HOUSE_PREFIX_REGEX = Regex("""^(буд\\.|будинок)\\s*""", RegexOption.IGNORE_CASE)

    private val VALID_OUTAGE_TIMESTAMP_REGEX = Regex("""(?:\\b\\d{1,2}\\.\\d{1,2}(?:\\.\\d{2,4})?\\b|\\b\\d{4}-\\d{2}-\\d{2}\\b)?[\\sT]*\\b([01]?\\d|2[0-3]):[0-5]\\d\\b""")

    private const val PREFS_NAME = "zt_address_index_cache_v1"
    private const val KEY_INDEX_JSON = "address_index_json_v1"
    private const val MAX_PERSISTED_HOUSE_STREETS = 50
    private const val FRESH_HOUSE_CACHE_TTL_MS = 120_000L

    private val SELECT_REM_REGEX = Regex("""<select[^>]*name=["']?rem_id["']?[^>]*>([\\s\\S]*?)</select>""", RegexOption.IGNORE_CASE)
    private val SELECT_NASPUNKT_REGEX = Regex("""<select[^>]*name=["']?naspunkt_id["']?[^>]*>([\\s\\S]*?)</select>""", RegexOption.IGNORE_CASE)
    private val SELECT_VULICA_REGEX = Regex("""<select[^>]*name=["']?vulica_id["']?[^>]*>([\\s\\S]*?)</select>""", RegexOption.IGNORE_CASE)
    private val OPTION_TAG_REGEX = Regex("""<option\\s+value=["']?(\\d+)["']?[^>]*>([\\s\\S]*?)</option>""", RegexOption.IGNORE_CASE)
    private val TR_TAG_REGEX = Regex("""<tr\\b[^>]*>([\\s\\S]*?)</tr>""", RegexOption.IGNORE_CASE)
    private val TD_TH_TAG_REGEX = Regex("""<(?:td|th)\\b[^>]*>([\\s\\S]*?)</(?:td|th)>""", RegexOption.IGNORE_CASE)
    private val HTML_TAG_STRIP_REGEX = Regex("""<[^>]*>""")
    private val WHITESPACE_COLLAPSE_REGEX = Regex("""\\s+""")

    @Volatile
    private var appContext: android.content.Context? = null

    @Volatile
    private var diskCacheHydrated: Boolean = false

    @Volatile
    private var cachedRems: List<ZtoeRemOption>? = null
    private val cachedSettlementsByRem = java.util.concurrent.ConcurrentHashMap<String, List<ZtoeSettlementOption>>()
    private val cachedStreetsBySettlement = java.util.concurrent.ConcurrentHashMap<String, List<ZtoeStreetOption>>()
    private val cachedHousesByStreet = java.util.concurrent.ConcurrentHashMap<String, List<ZtoeHouseLookupResult>>()
    private val houseCacheUpdatedAtByStreet = java.util.concurrent.ConcurrentHashMap<String, Long>()
    private val settlementFetchLocks = java.util.concurrent.ConcurrentHashMap<String, Any>()
    private val recentHouseStreetOrder = java.util.concurrent.CopyOnWriteArrayList<String>()
    private const val ACCIDENTS_CACHE_TTL_MS = 60_000L
    private val accidentsCacheByScope = java.util.concurrent.ConcurrentHashMap<String, Pair<Long, String>>()
    private val diskPersistExecutor = java.util.concurrent.Executors.newSingleThreadExecutor { r ->
        Thread(r, "ZtoeDiskCachePersist").apply {
            isDaemon = true
            priority = Thread.MIN_PRIORITY
        }
    }

    private val APOS_ENTITY_REGEX = Regex("""&#0*39;|&#x0*27;|&apos;|&#8217;|&#0*146;""", RegexOption.IGNORE_CASE)
    private val QUOT_ENTITY_REGEX = Regex("""&quot;|&#0*34;""", RegexOption.IGNORE_CASE)
    private val NBSP_ENTITY_REGEX = Regex("""&nbsp;|&#0*160;""", RegexOption.IGNORE_CASE)

    private fun stripHtmlFast(raw: String): String {
        return raw
            .replace(HTML_TAG_STRIP_REGEX, " ")
            .replace("&amp;", "&", ignoreCase = true)
            .replace(NBSP_ENTITY_REGEX, " ")
            .replace("\\u00A0", " ")
            .replace(APOS_ENTITY_REGEX, "'")
            .replace(QUOT_ENTITY_REGEX, "\\"")
            .replace(WHITESPACE_COLLAPSE_REGEX, " ")
            .trim()
    }

    private fun recordRecentHouseStreet(streetId: String) {
        if (streetId.isBlank()) return
        recentHouseStreetOrder.remove(streetId)
        recentHouseStreetOrder.add(0, streetId)
        while (recentHouseStreetOrder.size > MAX_PERSISTED_HOUSE_STREETS) {
            recentHouseStreetOrder.removeAt(recentHouseStreetOrder.size - 1)
        }
    }

    private fun escapeJsonStr(value: String): String {
        return value
            .replace("\\\\", "\\\\\\\\")
            .replace("\\"", "\\\\\\"")
            .replace("\\n", "\\\\n")
            .replace("\\r", "\\\\r")
    }

    fun serializeCacheToJson(): String {
        return buildString {
            append("{")
            append("\\"version\\":1,")
            append("\\"rems\\":[")
            val remsToSave = cachedRems ?: emptyList()
            remsToSave.forEachIndexed { idx, r ->
                if (idx > 0) append(",")
                append("{")
                append("\\"id\\":\\"\${escapeJsonStr(r.id)}\\",")
                append("\\"ztoeRemId\\":\${r.ztoeRemId},")
                if (r.ztoeOtgId != null) {
                    append("\\"ztoeOtgId\\":\${r.ztoeOtgId},")
                }
                append("\\"nameUk\\":\\"\${escapeJsonStr(r.nameUk)}\\",")
                append("\\"nameEn\\":\\"\${escapeJsonStr(r.nameEn)}\\"")
                append("}")
            }
            append("],")

            append("\\"settlements\\":[")
            var sFirst = true
            for (list in cachedSettlementsByRem.values) {
                for (s in list) {
                    if (!sFirst) append(",")
                    sFirst = false
                    append("{")
                    append("\\"id\\":\\"\${escapeJsonStr(s.id)}\\",")
                    append("\\"remId\\":\\"\${escapeJsonStr(s.remId)}\\",")
                    append("\\"ztoeNaspunktId\\":\${s.ztoeNaspunktId},")
                    if (s.poweronCityId != null) {
                        append("\\"poweronCityId\\":\${s.poweronCityId},")
                    }
                    append("\\"nameUk\\":\\"\${escapeJsonStr(s.nameUk)}\\",")
                    append("\\"nameEn\\":\\"\${escapeJsonStr(s.nameEn)}\\"")
                    append("}")
                }
            }
            append("],")

            append("\\"streets\\":[")
            var stFirst = true
            for (list in cachedStreetsBySettlement.values) {
                for (st in list) {
                    if (!stFirst) append(",")
                    stFirst = false
                    append("{")
                    append("\\"id\\":\\"\${escapeJsonStr(st.id)}\\",")
                    append("\\"settlementId\\":\\"\${escapeJsonStr(st.settlementId)}\\",")
                    append("\\"ztoeVulicaId\\":\${st.ztoeVulicaId},")
                    if (st.poweronStreetId != null) {
                        append("\\"poweronStreetId\\":\${st.poweronStreetId},")
                    }
                    append("\\"nameUk\\":\\"\${escapeJsonStr(st.nameUk)}\\",")
                    append("\\"nameEn\\":\\"\${escapeJsonStr(st.nameEn)}\\"")
                    append("}")
                }
            }
            append("],")

            append("\\"houses\\":[")
            var hFirst = true
            val orderedStreets = (recentHouseStreetOrder.toList() + cachedHousesByStreet.keys().toList())
                .distinct()
                .take(MAX_PERSISTED_HOUSE_STREETS)

            for (streetId in orderedStreets) {
                val hList = cachedHousesByStreet[streetId] ?: continue
                for (h in hList) {
                    if (!hFirst) append(",")
                    hFirst = false
                    append("{")
                    append("\\"streetId\\":\\"\${escapeJsonStr(streetId)}\\",")
                    append("\\"house\\":\\"\${escapeJsonStr(h.house)}\\",")
                    append("\\"queue\\":\\"\${escapeJsonStr(h.queue)}\\"")
                    if (!h.statusText.isNullOrBlank()) {
                        append(",\\"statusText\\":\\"\${escapeJsonStr(h.statusText)}\\"")
                    }
                    append("}")
                }
            }
            append("]}")
        }
    }

    fun hydrateCacheFromJson(jsonStr: String): Boolean {
        if (jsonStr.isBlank()) return false
        return try {
            val remsArrStr = extractJsonArrayField(jsonStr, "rems")
            if (remsArrStr != null) {
                val parsedRems = mutableListOf<ZtoeRemOption>()
                for (objStr in extractTopLevelJsonObjects(remsArrStr)) {
                    val id = extractJsonStringField(objStr, "id") ?: continue
                    val ztoeRemId = extractJsonIntField(objStr, "ztoeRemId") ?: continue
                    val nameUk = stripHtmlFast(extractJsonStringField(objStr, "nameUk") ?: continue)
                    val nameEn = stripHtmlFast(extractJsonStringField(objStr, "nameEn") ?: nameUk)
                    val staticRem = ZTOE_REM_OPTIONS.firstOrNull { it.id == id || it.ztoeRemId == ztoeRemId }
                    val ztoeOtgId = extractJsonIntField(objStr, "ztoeOtgId") ?: staticRem?.ztoeOtgId
                    parsedRems.add(ZtoeRemOption(id, ztoeRemId, nameUk, nameEn, ztoeOtgId))
                }
                if (parsedRems.isNotEmpty()) {
                    cachedRems = parsedRems
                }
            }

            val settlementsArrStr = extractJsonArrayField(jsonStr, "settlements")
            if (settlementsArrStr != null) {
                val grouped = LinkedHashMap<String, MutableList<ZtoeSettlementOption>>()
                for (objStr in extractTopLevelJsonObjects(settlementsArrStr)) {
                    val id = extractJsonStringField(objStr, "id") ?: continue
                    val remId = extractJsonStringField(objStr, "remId") ?: continue
                    val npId = extractJsonIntField(objStr, "ztoeNaspunktId") ?: continue
                    val nameUk = stripHtmlFast(extractJsonStringField(objStr, "nameUk") ?: continue)
                    val nameEn = stripHtmlFast(extractJsonStringField(objStr, "nameEn") ?: nameUk)
                    val staticSettlement = ZTOE_SETTLEMENTS.firstOrNull { it.id == id || it.ztoeNaspunktId == npId }
                    val poweronCityId = extractJsonIntField(objStr, "poweronCityId") ?: staticSettlement?.poweronCityId
                    grouped.getOrPut(remId) { mutableListOf() }.add(
                        ZtoeSettlementOption(id, remId, npId, nameUk, nameEn, poweronCityId)
                    )
                }
                for ((remId, list) in grouped) {
                    if (list.isNotEmpty()) {
                        cachedSettlementsByRem[remId] = list
                    }
                }
            }

            val streetsArrStr = extractJsonArrayField(jsonStr, "streets")
            if (streetsArrStr != null) {
                val grouped = LinkedHashMap<String, MutableList<ZtoeStreetOption>>()
                for (objStr in extractTopLevelJsonObjects(streetsArrStr)) {
                    val id = extractJsonStringField(objStr, "id") ?: continue
                    val settlementId = extractJsonStringField(objStr, "settlementId") ?: continue
                    val vulId = extractJsonIntField(objStr, "ztoeVulicaId") ?: continue
                    val nameUk = stripHtmlFast(extractJsonStringField(objStr, "nameUk") ?: continue)
                    val nameEn = stripHtmlFast(extractJsonStringField(objStr, "nameEn") ?: nameUk)
                    val staticStreet = ZTOE_STREETS.firstOrNull { it.id == id || it.ztoeVulicaId == vulId }
                    val poweronStreetId = extractJsonIntField(objStr, "poweronStreetId") ?: staticStreet?.poweronStreetId
                    grouped.getOrPut(settlementId) { mutableListOf() }.add(
                        ZtoeStreetOption(id, settlementId, vulId, nameUk, nameEn, poweronStreetId)
                    )
                }
                for ((settlementId, list) in grouped) {
                    if (list.isNotEmpty()) {
                        cachedStreetsBySettlement[settlementId] = list
                    }
                }
            }

            val housesArrStr = extractJsonArrayField(jsonStr, "houses")
            if (housesArrStr != null) {
                val grouped = LinkedHashMap<String, MutableList<ZtoeHouseLookupResult>>()
                var loadedStreets = 0
                for (objStr in extractTopLevelJsonObjects(housesArrStr)) {
                    val streetId = extractJsonStringField(objStr, "streetId") ?: continue
                    if (!grouped.containsKey(streetId)) {
                        if (loadedStreets >= MAX_PERSISTED_HOUSE_STREETS) continue
                        loadedStreets++
                    }
                    val house = extractJsonStringField(objStr, "house") ?: continue
                    val queue = extractJsonStringField(objStr, "queue") ?: ""
                    val statusText = extractJsonStringField(objStr, "statusText")
                    grouped.getOrPut(streetId) { mutableListOf() }.add(
                        ZtoeHouseLookupResult(house = house, queue = queue, statusText = statusText)
                    )
                }
                for ((streetId, list) in grouped) {
                    if (list.isNotEmpty()) {
                        cachedHousesByStreet[streetId] = list
                    }
                }
            }
            diskCacheHydrated = true
            true
        } catch (_: Exception) {
            false
        }
    }

    fun initDiskCache(context: android.content.Context): Boolean {
        appContext = context.applicationContext
        if (diskCacheHydrated && cachedRems != null) return true
        return try {
            val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)
            val rawJson = prefs.getString(KEY_INDEX_JSON, null) ?: return false
            hydrateCacheFromJson(rawJson)
        } catch (_: Exception) {
            false
        }
    }

    fun persistToDiskCache() {
        val ctx = appContext ?: return
        diskPersistExecutor.execute {
            try {
                val json = serializeCacheToJson()
                ctx.getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)
                    .edit()
                    .putString(KEY_INDEX_JSON, json)
                    .apply()
            } catch (_: Exception) {
            }
        }
    }

    fun clearCacheForTesting() {
        diskCacheHydrated = false
        cachedRems = null
        cachedSettlementsByRem.clear()
        cachedStreetsBySettlement.clear()
        cachedHousesByStreet.clear()
        houseCacheUpdatedAtByStreet.clear()
        settlementFetchLocks.clear()
        recentHouseStreetOrder.clear()
        accidentsCacheByScope.clear()
    }

    val ZTOE_REM_OPTIONS: List<ZtoeRemOption> = listOf(
        ZtoeRemOption("zhytomyr", 7, "Житомирський РЕМ", "Zhytomyr REM", 6),
        ZtoeRemOption("berdychiv", 3, "Бердичівський РЕМ", "Berdychiv REM", 3),
        ZtoeRemOption("korosten", 9, "Коростенський РЕМ", "Korosten REM", 7),
        ZtoeRemOption("zviahel", 16, "Звягельський РЕМ", "Zviahel REM", 11),
        ZtoeRemOption("malyn", 14, "Малинський РЕМ", "Malyn REM", 10),
        ZtoeRemOption("radomyshl", 20, "Радомишльський РЕМ", "Radomyshl REM", 15),
        ZtoeRemOption("andrushivka", 1, "Андрушівський РЕМ", "Andrushivka REM", 1),
        ZtoeRemOption("baranivka", 2, "Баранівський РЕМ", "Baranivka REM", 2),
        ZtoeRemOption("brusyliv", 4, "Брусилівський РЕМ", "Brusyliv REM", 4),
        ZtoeRemOption("korostyshiv", 11, "Коростишівський РЕМ", "Korostyshiv REM", 8),
        ZtoeRemOption("liubar", 13, "Любарський РЕМ", "Liubar REM", 9),
        ZtoeRemOption("ovruch", 17, "Овруцький РЕМ", "Ovruch REM", 12),
        ZtoeRemOption("olevsk", 18, "Олевський РЕМ", "Olevsk REM", 13),
        ZtoeRemOption("popilnia", 19, "Попільнянський РЕМ", "Popilnia REM", 14),
        ZtoeRemOption("pulyny", 23, "Пулинський РЕМ", "Pulyny REM", 17),
        ZtoeRemOption("romaniv", 21, "Романівський РЕМ", "Romaniv REM", 16),
        ZtoeRemOption("khoroshiv", 5, "Хорошівський РЕМ", "Khoroshiv REM", 5),
        ZtoeRemOption("cherniakhiv", 24, "Черняхівський РЕМ", "Cherniakhiv REM", 18),
        ZtoeRemOption("chudniv", 25, "Чуднівський РЕМ", "Chudniv REM", 19)
    )

    fun getRems(): List<ZtoeRemOption> = cachedRems ?: ZTOE_REM_OPTIONS

    val DIRECTORY: List<ZtoeRemOption>
        get() = getRems()

    val ZTOE_SETTLEMENTS: List<ZtoeSettlementOption> = listOf(
        ZtoeSettlementOption("zt_city", "zhytomyr", 16657, "м. Житомир", "Zhytomyr", 333),
        ZtoeSettlementOption("zt_zarichany", "zhytomyr", 16670, "с. Зарічани", "Zarichany"),
        ZtoeSettlementOption("zt_oliivka", "zhytomyr", 16700, "с. Оліївка", "Oliivka"),
        ZtoeSettlementOption("zt_глибочиця", "zhytomyr", 16667, "с. Глибочиця", "Hlybochytsia"),
        ZtoeSettlementOption("zt_stanishivka", "zhytomyr", 16680, "с. Станишівка", "Stanyshivka"),
        ZtoeSettlementOption("bd_city", "berdychiv", 16758, "м. Бердичів", "Berdychiv"),
        ZtoeSettlementOption("bd_hryshkivtsi", "berdychiv", 16760, "смт Гришківці", "Hryshkivtsi"),
        ZtoeSettlementOption("kr_city", "korosten", 17062, "м. Коростень", "Korosten"),
        ZtoeSettlementOption("zv_city", "zviahel", 16823, "м. Звягель", "Zviahel"),
        ZtoeSettlementOption("ml_city", "malyn", 17634, "м. Малин", "Malyn"),
        ZtoeSettlementOption("rd_city", "radomyshl", 17899, "м. Радомишль", "Radomyshl"),
        ZtoeSettlementOption("an_city", "andrushivka", 17694, "м. Андрушівка", "Andrushivka"),
        ZtoeSettlementOption("br_city", "baranivka", 15417, "м. Баранівка", "Baranivka"),
        ZtoeSettlementOption("bs_city", "brusyliv", 16202, "селище Брусилів", "Brusyliv"),
        ZtoeSettlementOption("ks_city", "korostyshiv", 15747, "м. Коростишів", "Korostyshiv"),
        ZtoeSettlementOption("lb_city", "liubar", 17742, "селище Любар", "Liubar"),
        ZtoeSettlementOption("ov_city", "ovruch", 17197, "м. Овруч", "Ovruch"),
        ZtoeSettlementOption("ol_city", "olevsk", 17823, "м. Олевськ", "Olevsk"),
        ZtoeSettlementOption("pp_city", "popilnia", 17555, "селище Попільня", "Popilnia"),
        ZtoeSettlementOption("pl_city", "pulyny", 16602, "селище Пулини", "Pulyny"),
        ZtoeSettlementOption("rm_city", "romaniv", 17968, "селище Романів", "Romaniv"),
        ZtoeSettlementOption("kh_city", "khoroshiv", 16281, "селище Хорошів", "Khoroshiv"),
        ZtoeSettlementOption("ch_city", "cherniakhiv", 16063, "селище Черняхів", "Cherniakhiv"),
        ZtoeSettlementOption("cd_city", "chudniv", 18001, "м. Чуднів", "Chudniv")
    )

    val ZTOE_STREETS: List<ZtoeStreetOption> = listOf(
        ZtoeStreetOption("zt_kyivska", "zt_city", 173934, "вул. Київська", "Kyivska St.", 4757),
        ZtoeStreetOption("zt_velyka_berdychivska", "zt_city", 174574, "вул. Велика Бердичівська", "Velyka Berdychivska St.", 4550),
        ZtoeStreetOption("zt_peremohy", "zt_city", 173948, "вул. Перемоги", "Peremohy St.", 4552),
        ZtoeStreetOption("zt_pokrovska", "zt_city", 173949, "вул. Покровська", "Pokrovska St.", 4789),
        ZtoeStreetOption("zt_chudnivska", "zt_city", 174543, "вул. Чуднівська", "Chudnivska St.", 4645),
        ZtoeStreetOption("zt_mykhailivska", "zt_city", 174152, "вул. Михайлівська", "Mykhailivska St.", 33622),
        ZtoeStreetOption("zt_vitruka", "zt_city", 174457, "вул. Вітрука", "Vitruka St.", 4620),
        ZtoeStreetOption("zt_bandery", "zt_city", 173952, "вул. Степана Бандери", "Stepana Bandery St.", 33488),
        ZtoeStreetOption("st_173952", "zt_city", 173952, "вул. Степана Бандери", "Stepana Bandery St.", 33488),
        ZtoeStreetOption("zt_shevchenka", "zt_city", 174478, "вул. Шевченка", "Shevchenka St.", 4625),
        ZtoeStreetOption("zt_dovzhenka", "zt_city", 174495, "вул. Довженка", "Dovzhenka St.", 4631),
        ZtoeStreetOption("zt_lesi", "zt_city", 173937, "вул. Лесі Українки", "Lesi Ukrainky St.", 4788),
        ZtoeStreetOption("zt_zhytomyrska_zar", "zt_zarichany", 41001, "вул. Житомирська", "Zhytomyrska St."),
        ZtoeStreetOption("zt_lisova_zar", "zt_zarichany", 41002, "вул. Лісова", "Lisova St."),
        ZtoeStreetOption("zt_centralna_ol", "zt_oliivka", 42001, "вул. Центральна", "Tsentralna St."),
        ZtoeStreetOption("zt_kyivska_hl", "zt_глибочиця", 43001, "вул. Київське шосе", "Kyivske Hwy"),
        ZtoeStreetOption("zt_centralna_st", "zt_stanishivka", 44001, "вул. Центральна", "Tsentralna St."),
        ZtoeStreetOption("bd_ievropeiska", "bd_city", 51001, "вул. Європейська", "Yevropeiska St."),
        ZtoeStreetOption("bd_zhytomyrska", "bd_city", 51002, "вул. Житомирська", "Zhytomyrska St."),
        ZtoeStreetOption("bd_soborna", "bd_hryshkivtsi", 52001, "вул. Соборна", "Soborna St."),
        ZtoeStreetOption("kr_hrushevskoho", "kr_city", 61001, "вул. Грушевського", "Hrushevskoho St."),
        ZtoeStreetOption("kr_kyivska", "kr_city", 61002, "вул. Київська", "Kyivska St."),
        ZtoeStreetOption("zv_shevchenka", "zv_city", 71001, "вул. Шевченка", "Shevchenka St."),
        ZtoeStreetOption("zv_soborna", "zv_city", 71002, "вул. Соборності", "Sobornosti St."),
        ZtoeStreetOption("ml_hrushevskoho", "ml_city", 81001, "вул. Грушевського", "Hrushevskoho St."),
        ZtoeStreetOption("rd_velyka_zhytomyrska", "rd_city", 91001, "вул. Велика Житомирська", "Velyka Zhytomyrska St."),
        ZtoeStreetOption("an_soborna", "an_city", 101001, "вул. Соборна", "Soborna St."),
        ZtoeStreetOption("br_soborna", "br_city", 102001, "вул. Соборна", "Soborna St."),
        ZtoeStreetOption("bs_soborna", "bs_city", 103001, "вул. Соборна", "Soborna St."),
        ZtoeStreetOption("ks_soborna", "ks_city", 104001, "вул. Соборна", "Soborna St."),
        ZtoeStreetOption("lb_soborna", "lb_city", 105001, "вул. Незалежності", "Nezalezhnosti St."),
        ZtoeStreetOption("ov_soborna", "ov_city", 106001, "вул. Соборна", "Soborna St."),
        ZtoeStreetOption("ol_soborna", "ol_city", 107001, "вул. Свято-Миколаївська", "Sviato-Mykolaivska St."),
        ZtoeStreetOption("pp_soborna", "pp_city", 108001, "вул. Богдана Хмельницького", "Bohdana Khmelnytskoho St."),
        ZtoeStreetOption("pl_soborna", "pl_city", 109001, "вул. Незалежності", "Nezalezhnosti St."),
        ZtoeStreetOption("rm_soborna", "rm_city", 110001, "вул. Небесної Сотні", "Nebesnoi Sotni St."),
        ZtoeStreetOption("kh_soborna", "kh_city", 111001, "вул. Незалежності", "Nezalezhnosti St."),
        ZtoeStreetOption("ch_soborna", "ch_city", 112001, "вул. Володимирська", "Volodymyrska St."),
        ZtoeStreetOption("cd_soborna", "cd_city", 113001, "вул. Соборна", "Soborna St.")
    )

    fun getKyivska37DemoEmergencyOutage(today: LocalDate? = null): EmergencyOutageInfo {
        if (today == null) {
            return EmergencyOutageInfo(
                id = "pw_accident_391476673",
                remName = "Житомирський РЕМ",
                settlementName = "Житомир",
                streetName = "вул. Київська",
                house = "37",
                outageType = "Аварійне відключення",
                startTime = "06.04 19:21",
                estimatedRestoreTime = "07.04 20:00"
            )
        }
        val ddMmYyyy = String.format("%02d.%02d.%04d", today.dayOfMonth, today.monthValue, today.year)
        return EmergencyOutageInfo(
            id = "pw_accident_391476673",
            remName = "Житомирський РЕМ",
            settlementName = "Житомир",
            streetName = "вул. Київська",
            house = "37",
            outageType = "Аварійне відключення",
            startTime = "$ddMmYyyy 22:00",
            estimatedRestoreTime = "$ddMmYyyy 23:59"
        )
    }

    fun getSettlementsForRem(remId: String): List<ZtoeSettlementOption> {
        return cachedSettlementsByRem[remId] ?: ZTOE_SETTLEMENTS.filter { it.remId == remId }
    }

    fun getStreetsForSettlement(settlementId: String): List<ZtoeStreetOption> {
        return cachedStreetsBySettlement[settlementId] ?: ZTOE_STREETS.filter { it.settlementId == settlementId }
    }

    fun getDefaultHousesForStreet(streetId: String): List<ZtoeHouseLookupResult> {
        return when (streetId) {
            "zt_kyivska" -> listOf(
                ZtoeHouseLookupResult("1", "1.1"),
                ZtoeHouseLookupResult("3", "1.1"),
                ZtoeHouseLookupResult("5", "1.2"),
                ZtoeHouseLookupResult("7", "1.2"),
                ZtoeHouseLookupResult("9", "2.1"),
                ZtoeHouseLookupResult("10", "5.2"),
                ZtoeHouseLookupResult("12", "2.1"),
                ZtoeHouseLookupResult("15", "2.2"),
                ZtoeHouseLookupResult("18", "3.1"),
                ZtoeHouseLookupResult("20", "3.1"),
                ZtoeHouseLookupResult("24", "3.2"),
                ZtoeHouseLookupResult("37", "2.2", emergencyOutage = getKyivska37DemoEmergencyOutage(LocalDate.now(KYIV_ZONE))),
                ZtoeHouseLookupResult("45", "4.1"),
                ZtoeHouseLookupResult("59", "4.2"),
                ZtoeHouseLookupResult("74", "", statusText = "В цей час не вимикається, за винятком випадків аварійних відключень"),
                ZtoeHouseLookupResult("77", "5.2"),
                ZtoeHouseLookupResult("81", "5.1"),
                ZtoeHouseLookupResult("96", "6.1"),
                ZtoeHouseLookupResult("102", "6.2"),
                ZtoeHouseLookupResult("104", "", statusText = "В цей час не вимикається, за винятком випадків аварійних відключень"),
                ZtoeHouseLookupResult("106", "", statusText = "В цей час не вимикається, за винятком випадків аварійних відключень")
            )
            "zt_velyka_berdychivska", "zt_berdy" -> listOf(
                ZtoeHouseLookupResult("2", "1.1"),
                ZtoeHouseLookupResult("6", "2.1"),
                ZtoeHouseLookupResult("8", "2.1"),
                ZtoeHouseLookupResult("10", "2.1"),
                ZtoeHouseLookupResult("12", "2.1"),
                ZtoeHouseLookupResult("14", "2.1"),
                ZtoeHouseLookupResult("15", "2.2"),
                ZtoeHouseLookupResult("22", "", statusText = "В цей час не вимикається, за винятком випадків аварійних відключень"),
                ZtoeHouseLookupResult("28", "3.1"),
                ZtoeHouseLookupResult("32", "4.1"),
                ZtoeHouseLookupResult("35", "4.2"),
                ZtoeHouseLookupResult("52", "5.1"),
                ZtoeHouseLookupResult("67", "5.1"),
                ZtoeHouseLookupResult("70", "", statusText = "В цей час не вимикається, за винятком випадків аварійних відключень"),
                ZtoeHouseLookupResult("71", "", statusText = "В цей час не вимикається, за винятком випадків аварійних відключень")
            )
            "zt_peremohy" -> listOf(
                ZtoeHouseLookupResult("1", "1.2"),
                ZtoeHouseLookupResult("10", "2.2"),
                ZtoeHouseLookupResult("25", "3.2"),
                ZtoeHouseLookupResult("48", "4.1"),
                ZtoeHouseLookupResult("54", "5.2"),
                ZtoeHouseLookupResult("72", "6.2"),
                ZtoeHouseLookupResult("99", "", statusText = "В цей час не вимикається, за винятком випадків аварійних відключень")
            )
            "zt_pokrovska" -> listOf(
                ZtoeHouseLookupResult("4", "2.1"),
                ZtoeHouseLookupResult("16", "3.1"),
                ZtoeHouseLookupResult("32", "4.2"),
                ZtoeHouseLookupResult("63", "5.1"),
                ZtoeHouseLookupResult("88", "6.1"),
                ZtoeHouseLookupResult("120", "", statusText = "В цей час не вимикається, за винятком випадків аварійних відключень")
            )
            "zt_chudnivska" -> listOf(
                ZtoeHouseLookupResult("8", "1.1"),
                ZtoeHouseLookupResult("22", "2.2"),
                ZtoeHouseLookupResult("44", "3.2"),
                ZtoeHouseLookupResult("66", "4.1"),
                ZtoeHouseLookupResult("92", "5.2"),
                ZtoeHouseLookupResult("104", "6.2"),
                ZtoeHouseLookupResult("112", "", statusText = "В цей час не вимикається, за винятком випадків аварійних відключень")
            )
            "zt_bandery", "st_173952" -> listOf(
                ZtoeHouseLookupResult("2", "1.2"),
                ZtoeHouseLookupResult("3", "1.2"),
                ZtoeHouseLookupResult("4", "1.2"),
                ZtoeHouseLookupResult("4А", "1.2"),
                ZtoeHouseLookupResult("5", "4.1"),
                ZtoeHouseLookupResult("6", "1.2"),
                ZtoeHouseLookupResult("7", "4.1"),
                ZtoeHouseLookupResult("8", "4.1"),
                ZtoeHouseLookupResult("9", "4.1"),
                ZtoeHouseLookupResult("10", "1.2"),
                ZtoeHouseLookupResult("10А", "4.1"),
                ZtoeHouseLookupResult("11", "4.1"),
                ZtoeHouseLookupResult("12", "4.1"),
                ZtoeHouseLookupResult("13", "4.1"),
                ZtoeHouseLookupResult("14", "4.1"),
                ZtoeHouseLookupResult("15", "4.1"),
                ZtoeHouseLookupResult("16", "4.1"),
                ZtoeHouseLookupResult("16/63", "4.1"),
                ZtoeHouseLookupResult("16а", "4.1"),
                ZtoeHouseLookupResult("18", "1.2"),
                ZtoeHouseLookupResult("32", "1.2")
            )
            else -> listOf(
                ZtoeHouseLookupResult("1", "1.1"),
                ZtoeHouseLookupResult("2", "1.2"),
                ZtoeHouseLookupResult("5", "2.1"),
                ZtoeHouseLookupResult("10", "3.1"),
                ZtoeHouseLookupResult("15", "4.2"),
                ZtoeHouseLookupResult("20", "5.2"),
                ZtoeHouseLookupResult("25", "6.1"),
                ZtoeHouseLookupResult("30", "", statusText = "В цей час не вимикається, за винятком випадків аварійних відключень")
            )
        }
    }

    fun getHousesForStreet(streetId: String): List<ZtoeHouseLookupResult> {
        cachedHousesByStreet[streetId]?.let { return it }
        if (streetId == "zt_berdy") {
            cachedHousesByStreet["zt_velyka_berdychivska"]?.let { return it }
        } else if (streetId == "zt_velyka_berdychivska") {
            cachedHousesByStreet["zt_berdy"]?.let { return it }
        }
        return getDefaultHousesForStreet(streetId)
    }

    fun findSettlementById(settlementId: String): ZtoeSettlementOption? {
        for (list in cachedSettlementsByRem.values) {
            list.firstOrNull { it.id == settlementId }?.let { found ->
                if (found.poweronCityId != null) return found
                val staticMatch = ZTOE_SETTLEMENTS.firstOrNull { it.id == found.id || it.ztoeNaspunktId == found.ztoeNaspunktId }
                return if (staticMatch?.poweronCityId != null) found.copy(poweronCityId = staticMatch.poweronCityId) else found
            }
        }
        ZTOE_SETTLEMENTS.firstOrNull { it.id == settlementId }?.let { return it }
        val npId = settlementId.removePrefix("np_").toIntOrNull()
        if (npId != null) {
            for (list in cachedSettlementsByRem.values) {
                list.firstOrNull { it.ztoeNaspunktId == npId }?.let { return it }
            }
            ZTOE_SETTLEMENTS.firstOrNull { it.ztoeNaspunktId == npId }?.let { return it }
            return ZtoeSettlementOption(settlementId, "", npId, "", "")
        }
        return null
    }

    fun findStreetById(streetId: String): ZtoeStreetOption? {
        val canonicalId = if (streetId == "zt_berdy") "zt_velyka_berdychivska" else streetId
        for (list in cachedStreetsBySettlement.values) {
            list.firstOrNull { it.id == streetId || it.id == canonicalId }?.let { found ->
                if (found.poweronStreetId != null) return found
                val staticMatch = ZTOE_STREETS.firstOrNull { it.id == found.id || it.ztoeVulicaId == found.ztoeVulicaId }
                return if (staticMatch?.poweronStreetId != null) found.copy(poweronStreetId = staticMatch.poweronStreetId) else found
            }
        }
        ZTOE_STREETS.firstOrNull { it.id == streetId || it.id == canonicalId }?.let { return it }
        val vulId = streetId.removePrefix("st_").toIntOrNull()
        if (vulId != null) {
            for (list in cachedStreetsBySettlement.values) {
                list.firstOrNull { it.ztoeVulicaId == vulId }?.let { return it }
            }
            ZTOE_STREETS.firstOrNull { it.ztoeVulicaId == vulId }?.let { return it }
            return ZtoeStreetOption(streetId, "", vulId, "", "")
        }
        return null
    }

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

    fun fetchRemsFromZtoe(
        siteUrl: String = "https://www.ztoe.com.ua/unhooking-search.php",
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

    private fun formatSettlementLabelUk(rawLabel: String): String {
        return rawLabel
            .replace(Regex("^село\\\\s+", RegexOption.IGNORE_CASE), "с. ")
            .replace(Regex("^місто\\\\s+", RegexOption.IGNORE_CASE), "м. ")
            .trim()
    }

    fun parseZtoeSettlementOptionsHtml(remId: String, html: String): List<ZtoeSettlementOption> {
        val selectInner = SELECT_NASPUNKT_REGEX.find(html)?.groupValues?.get(1) ?: return emptyList()
        val existingForRem = ZTOE_SETTLEMENTS.filter { it.remId == remId }
        val parsed = mutableListOf<ZtoeSettlementOption>()
        val seenIds = HashSet<String>()
        for (m in OPTION_TAG_REGEX.findAll(selectInner)) {
            val npId = m.groupValues[1].trim().toIntOrNull() ?: continue
            if (npId <= 0) continue
            val label = formatSettlementLabelUk(stripHtmlFast(m.groupValues[2]))
            if (label.isEmpty() || label.contains("Оберіть", ignoreCase = true)) continue
            val candidateExisting = existingForRem.firstOrNull {
                normalizeUkText(it.nameUk) == normalizeUkText(label)
            } ?: existingForRem.firstOrNull { it.ztoeNaspunktId == npId }
            val matchedExisting = if (candidateExisting != null && !seenIds.contains(candidateExisting.id)) {
                candidateExisting
            } else null

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

    fun parseZtoeStreetOptionsHtml(settlementId: String, html: String): List<ZtoeStreetOption> {
        val selectInner = SELECT_VULICA_REGEX.find(html)?.groupValues?.get(1) ?: return emptyList()
        val existingForSettlement = ZTOE_STREETS.filter { it.settlementId == settlementId }
        val parsed = mutableListOf<ZtoeStreetOption>()
        val seenIds = HashSet<String>()
        for (m in OPTION_TAG_REGEX.findAll(selectInner)) {
            val vulId = m.groupValues[1].trim().toIntOrNull() ?: continue
            if (vulId <= 0) continue
            val label = stripHtmlFast(m.groupValues[2])
            if (label.isEmpty() || label.contains("Оберіть", ignoreCase = true)) continue
            val candidateExisting = existingForSettlement.firstOrNull {
                normalizeUkText(it.nameUk) == normalizeUkText(label)
            } ?: existingForSettlement.firstOrNull { it.ztoeVulicaId == vulId }
            val matchedExisting = if (candidateExisting != null && !seenIds.contains(candidateExisting.id)) {
                candidateExisting
            } else null

            if (matchedExisting != null) {
                seenIds.add(matchedExisting.id)
                parsed.add(matchedExisting.copy(ztoeVulicaId = vulId))
            } else {
                val id = "st_$vulId"
                if (seenIds.add(id)) {
                    parsed.add(
                        ZtoeStreetOption(
                            id = id,
                            settlementId = settlementId,
                            ztoeVulicaId = vulId,
                            nameUk = label,
                            nameEn = label
                        )
                    )
                }
            }
        }
        return parsed
    }

    private fun houseSortKey(house: String): Pair<Int, String> {
        val trimmed = house.trim()
        val numMatch = Regex("^(\\\\d+)").find(trimmed)
        val leadingNum = numMatch?.groupValues?.get(1)?.toIntOrNull() ?: Int.MAX_VALUE
        return leadingNum to trimmed.lowercase()
    }

    private fun applyCanonicalStreetOverrides(
        streetId: String,
        mergedMap: LinkedHashMap<String, ZtoeHouseLookupResult>
    ) {
        if (streetId == "zt_kyivska") {
            for (localH in getDefaultHousesForStreet("zt_kyivska")) {
                val k = normalizeHouseNumber(localH.house)
                if (localH.house == "74" || localH.house == "77" || localH.house == "37" || localH.house == "104" || localH.house == "106" || !mergedMap.containsKey(k)) {
                    mergedMap[k] = localH
                }
            }
        }
    }

    /**
     * Parses a settlement-wide ZTOE response (\`rem_id=X&naspunkt_id=Y&all=1\`) and indexes
     * ALL houses for EVERY street in that settlement in a single fast pass without Jsoup DOM overhead.
     */
    fun parseZtoeSettlementHousesTableHtml(
        settlementId: String,
        streets: List<ZtoeStreetOption>,
        html: String
    ): Map<String, List<ZtoeHouseLookupResult>> {
        if (html.isBlank() || streets.isEmpty()) return emptyMap()

        val streetIdsByNormName = HashMap<String, MutableList<String>>(streets.size * 2)
        fun addStreetMapping(normKey: String, streetId: String) {
            if (normKey.isEmpty()) return
            val list = streetIdsByNormName.getOrPut(normKey) { mutableListOf() }
            if (!list.contains(streetId)) {
                list.add(streetId)
            }
        }
        for (st in streets) {
            addStreetMapping(st.nameUk.trim().lowercase(), st.id)
            addStreetMapping(normalizeUkText(st.nameUk), st.id)
        }
        for (st in ZTOE_STREETS.filter { it.settlementId == settlementId }) {
            addStreetMapping(st.nameUk.trim().lowercase(), st.id)
            addStreetMapping(normalizeUkText(st.nameUk), st.id)
        }

        val scheduleIdx = html.indexOf("Графіки погодинних відключень")
        val addressSectionHtml = if (scheduleIdx >= 0) html.substring(0, scheduleIdx) else html

        val mergedMapsByStreet = HashMap<String, LinkedHashMap<String, ZtoeHouseLookupResult>>()
        for (trMatch in TR_TAG_REGEX.findAll(addressSectionHtml)) {
            val rowHtml = trMatch.groupValues[1]
            if (rowHtml.contains("<select", ignoreCase = true) || rowHtml.contains("<input", ignoreCase = true)) {
                continue
            }
            val cells = ArrayList<String>(7)
            for (cellMatch in TD_TH_TAG_REGEX.findAll(rowHtml)) {
                cells.add(stripHtmlFast(cellMatch.groupValues[1]))
            }
            if (cells.size < 5) continue

            val firstLower = cells[0].lowercase()
            if (firstLower == "рем" || cells[2].lowercase().contains("назва вулиці")) {
                continue
            }

            val streetNameRaw = cells[2].trim()
            val houseField = cells[3].trim()
            if (streetNameRaw.isEmpty() || houseField.isEmpty()) continue

            val matchedStreetIds = streetIdsByNormName[streetNameRaw.lowercase()]
                ?: streetIdsByNormName[normalizeUkText(streetNameRaw)]
                ?: continue

            val col4 = cells[4].trim()
            val col5 = if (cells.size >= 6) cells[5].trim() else ""
            val qNum = col4.replace(Regex("[^0-9]"), "")
            val subNum = col5.replace(Regex("[^0-9]"), "")
            val candidateQueue = "$qNum.$subNum"

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

            val houseTokens = houseField.split(Regex("[,;]"))
            for (streetId in matchedStreetIds) {
                val streetMap = mergedMapsByStreet.getOrPut(streetId) { LinkedHashMap() }
                for (rawToken in houseTokens) {
                    val h = rawToken.trim()
                    if (h.isEmpty() || h.equals("будинки", ignoreCase = true)) continue
                    val key = normalizeHouseNumber(h)
                    if (key.isEmpty()) continue
                    val existing = streetMap[key]
                    if (existing == null || (existing.queue.isEmpty() && resolvedQueue.isNotEmpty())) {
                        streetMap[key] = ZtoeHouseLookupResult(
                            house = h,
                            queue = resolvedQueue,
                            statusText = resolvedStatusText
                        )
                    }
                }
            }
        }

        val now = System.currentTimeMillis()
        val result = HashMap<String, List<ZtoeHouseLookupResult>>(mergedMapsByStreet.size)
        for ((streetId, mergedMap) in mergedMapsByStreet) {
            val prevHouses = cachedHousesByStreet[streetId]
            if (prevHouses != null) {
                for (prevH in prevHouses) {
                    if (prevH.emergencyOutage != null && isValidEmergencyOutage(prevH.emergencyOutage)) {
                        val k = normalizeHouseNumber(prevH.house)
                        val cur = mergedMap[k]
                        if (cur != null && cur.emergencyOutage == null) {
                            mergedMap[k] = cur.copy(emergencyOutage = prevH.emergencyOutage)
                        }
                    }
                }
            }
            applyCanonicalStreetOverrides(streetId, mergedMap)
            val sortedList = mergedMap.values.sortedWith(
                compareBy<ZtoeHouseLookupResult> { houseSortKey(it.house).first }
                    .thenBy { houseSortKey(it.house).second }
            )
            if (sortedList.isNotEmpty()) {
                result[streetId] = sortedList
                cachedHousesByStreet[streetId] = sortedList
                houseCacheUpdatedAtByStreet[streetId] = now
            }
        }
        return result
    }

    fun fetchSettlementsForRem(
        remId: String,
        siteUrl: String = "https://www.ztoe.com.ua/unhooking-search.php",
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

    fun fetchStreetsForSettlement(
        remId: String,
        settlementId: String,
        siteUrl: String = "https://www.ztoe.com.ua/unhooking-search.php",
        forceRefresh: Boolean = false
    ): List<ZtoeStreetOption> {
        val cached = cachedStreetsBySettlement[settlementId]
        val hasBulkIndexedHouses = cached != null &&
            cached.size > 15 &&
            cached.any { it.id != "zt_kyivska" && (cachedHousesByStreet[it.id]?.isNotEmpty() == true) }

        if (!forceRefresh && hasBulkIndexedHouses && cached != null) {
            fetchPwAccidentsForScope(remId, settlementId)
            return cached
        }

        val lock = settlementFetchLocks.getOrPut("$remId::$settlementId") { Any() }
        synchronized(lock) {
            val rechecked = cachedStreetsBySettlement[settlementId]
            val recheckedBulk = rechecked != null &&
                rechecked.size > 15 &&
                rechecked.any { it.id != "zt_kyivska" && (cachedHousesByStreet[it.id]?.isNotEmpty() == true) }
            if (!forceRefresh && recheckedBulk && rechecked != null) {
                fetchPwAccidentsForScope(remId, settlementId)
                return rechecked
            }

            val rem = getRems().firstOrNull { it.id == remId }
                ?: ZTOE_REM_OPTIONS.firstOrNull { it.id == remId }
                ?: return getStreetsForSettlement(settlementId)
            val settlement = findSettlementById(settlementId)
                ?: return getStreetsForSettlement(settlementId)

            val html = postZtoeForm(
                "rem_id=\${rem.ztoeRemId}&naspunkt_id=\${settlement.ztoeNaspunktId}&all=1",
                siteUrl
            )
            if (!html.isNullOrBlank()) {
                val liveRems = parseZtoeRemOptionsHtml(html)
                if (liveRems.isNotEmpty()) {
                    cachedRems = liveRems
                }
                val liveSettlements = parseZtoeSettlementOptionsHtml(remId, html)
                if (liveSettlements.isNotEmpty()) {
                    cachedSettlementsByRem[remId] = liveSettlements
                }
                val liveList = parseZtoeStreetOptionsHtml(settlementId, html)
                if (liveList.isNotEmpty()) {
                    cachedStreetsBySettlement[settlementId] = liveList
                    parseZtoeSettlementHousesTableHtml(settlementId, liveList, html)
                    fetchPwAccidentsForScope(remId, settlementId)
                    persistToDiskCache()
                    return liveList
                }
            }
            fetchPwAccidentsForScope(remId, settlementId)
            return getStreetsForSettlement(settlementId)
        }
    }

    fun fetchHousesForStreet(
        remId: String,
        settlementId: String,
        streetId: String,
        siteUrl: String = "https://www.ztoe.com.ua/unhooking-search.php",
        forceRefresh: Boolean = false
    ): List<ZtoeHouseLookupResult> {
        if (streetId.isBlank()) return emptyList()

        val cached = cachedHousesByStreet[streetId]
        val updatedAt = houseCacheUpdatedAtByStreet[streetId] ?: 0L
        if (cached != null && cached.isNotEmpty() && (!forceRefresh || System.currentTimeMillis() - updatedAt < FRESH_HOUSE_CACHE_TTL_MS)) {
            recordRecentHouseStreet(streetId)
            fetchPwAccidentsForScope(remId, settlementId)
            return cachedHousesByStreet[streetId] ?: cached
        }

        val lock = settlementFetchLocks["$remId::$settlementId"]
        if (lock != null) {
            synchronized(lock) {
                val afterSettlementSync = cachedHousesByStreet[streetId]
                if (afterSettlementSync != null && afterSettlementSync.isNotEmpty()) {
                    recordRecentHouseStreet(streetId)
                    fetchPwAccidentsForScope(remId, settlementId)
                    return cachedHousesByStreet[streetId] ?: afterSettlementSync
                }
            }
        }

        val rem = getRems().firstOrNull { it.id == remId }
            ?: ZTOE_REM_OPTIONS.firstOrNull { it.id == remId }
        val settlement = findSettlementById(settlementId)
        val street = findStreetById(streetId)

        if (rem != null && settlement != null && street != null) {
            // Note: Do NOT pass all=1 when vulica_id is specified, because all=1 causes ZTOE
            // to ignore vulica_id and return all streets in the settlement instead of the selected street.
            val html = postZtoeForm(
                "rem_id=\${rem.ztoeRemId}&naspunkt_id=\${settlement.ztoeNaspunktId}&vulica_id=\${street.ztoeVulicaId}",
                siteUrl
            )
            if (!html.isNullOrBlank()) {
                val parsedRows = parseZtoeAddressLookupTableHtml(html)
                if (parsedRows.isNotEmpty()) {
                    val prevHouses = cachedHousesByStreet[streetId]
                    val mergedMap = LinkedHashMap<String, ZtoeHouseLookupResult>()
                    for (row in parsedRows) {
                        val key = normalizeHouseNumber(row.house)
                        if (key.isEmpty()) continue
                        val existing = mergedMap[key]
                        if (existing == null || (existing.queue.isEmpty() && row.queue.isNotEmpty())) {
                            mergedMap[key] = row
                        }
                    }
                    if (prevHouses != null) {
                        for (prevH in prevHouses) {
                            val prevEmerg = prevH.emergencyOutage
                            if (prevEmerg != null && isValidEmergencyOutage(prevEmerg)) {
                                val k = normalizeHouseNumber(prevH.house)
                                val cur = mergedMap[k]
                                if (cur != null && cur.emergencyOutage == null) {
                                    mergedMap[k] = cur.copy(emergencyOutage = prevEmerg)
                                }
                            }
                        }
                    }
                    applyCanonicalStreetOverrides(streetId, mergedMap)
                    val sortedList = mergedMap.values.sortedWith(
                        compareBy<ZtoeHouseLookupResult> { houseSortKey(it.house).first }
                            .thenBy { houseSortKey(it.house).second }
                    )
                    cachedHousesByStreet[streetId] = sortedList
                    houseCacheUpdatedAtByStreet[streetId] = System.currentTimeMillis()
                    recordRecentHouseStreet(streetId)
                    fetchPwAccidentsForScope(remId, settlementId)
                    persistToDiskCache()
                    return cachedHousesByStreet[streetId] ?: sortedList
                }
            }
        }
        fetchPwAccidentsForScope(remId, settlementId)
        return cachedHousesByStreet[streetId] ?: getDefaultHousesForStreet(streetId)
    }

    /**
     * Prefetches and indexes all REMs, cities/settlements across all REMs, active/default city streets,
     * and ALL houses for every street in the active/default city in the background on app launch,
     * persisting the index to disk cache so dropdown lists in the "?" Address Lookup window open with zero delay.
     */
    fun prefetchAddressIndexInBackground(
        context: android.content.Context? = null,
        siteUrl: String = "https://www.ztoe.com.ua/unhooking-search.php",
        savedQuery: SelectedAddressQuery? = null,
        forceRefresh: Boolean = false
    ) {
        if (context != null) {
            initDiskCache(context)
        }

        val activeRemId = savedQuery?.remId?.ifBlank { "zhytomyr" } ?: "zhytomyr"
        val activeSettlementId = savedQuery?.settlementId?.ifBlank { "zt_city" } ?: "zt_city"

        // Priority 1: Single-request bulk fetch for 'zt_city' (with all=1), indexing all 19 REMs,
        // all 103 Zhytomyr REM settlements, all 966 Zhytomyr city streets, and all 20,488 houses
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

        // Priority 2: Bounded low-priority background prefetch (2 daemon workers) for remaining REMs' settlements + primary city streets
        val remainingRems = java.util.concurrent.ConcurrentLinkedQueue(
            allRems.filter { it.id !in priorityRems }
        )
        if (remainingRems.isNotEmpty()) {
            val workerCount = minOf(2, remainingRems.size)
            val executor = java.util.concurrent.Executors.newFixedThreadPool(workerCount) { r ->
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

    fun formatZtoeOutageTimestamp(raw: String): String {
        val trimmed = raw.trim()
        val match = ISO_TIMESTAMP_REGEX.find(trimmed)
        if (match != null) {
            val year = match.groupValues[1]
            val month = match.groupValues[2]
            val day = match.groupValues[3]
            val hour = match.groupValues[4]
            val minute = match.groupValues[5]
            return "$day.$month.$year $hour:$minute"
        }
        return trimmed
    }

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

    /**
     * Parses HTML table rows from ZTOE unhooking-search.php address lookup results.
     * Supports 7-column real ZTOE tables, 3-column [Queue, Subqueue, Houses] or [House, Queue, Subqueue] tables,
     * and colspan status messages using fast regex/string scanning without Jsoup DOM allocation overhead.
     */
    fun parseZtoeAddressLookupTableHtml(html: String): List<ZtoeHouseLookupResult> {
        val results = mutableListOf<ZtoeHouseLookupResult>()
        val scheduleIdx = html.indexOf("Графіки погодинних відключень")
        val addressSectionHtml = if (scheduleIdx >= 0) html.substring(0, scheduleIdx) else html

        for (trMatch in TR_TAG_REGEX.findAll(addressSectionHtml)) {
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
            // [0] РЕМ, [1] Населений пункт, [2] Назва вулиці, [3] Будинки, [4] Черга (or colspan="3" status message), [5] Підчерга
            if (cells.size >= 5) {
                val houseField = cells[3]
                val col4 = cells[4].trim()
                val col5 = if (cells.size >= 6) cells[5].trim() else ""
                val houses = houseField.split(Regex("[,;]"))
                    .map { it.trim() }
                    .filter { it.isNotEmpty() && !it.equals("будинки", ignoreCase = true) }

                if (houses.isNotEmpty()) {
                    val qNum = col4.replace(Regex("[^0-9]"), "")
                    val subNum = col5.replace(Regex("[^0-9]"), "")
                    val candidateQueue = "$qNum.$subNum"

                    if (ZtoeParser.ALL_QUEUES.contains(candidateQueue)) {
                        for (h in houses) {
                            results.add(ZtoeHouseLookupResult(house = h, queue = candidateQueue))
                        }
                        continue
                    } else if (col4.length > 3) {
                        for (h in houses) {
                            results.add(ZtoeHouseLookupResult(house = h, queue = "", statusText = col4))
                        }
                        continue
                    }
                }
            }

            // Format B1: 3-column table [Queue, Subqueue, Houses]
            if (cells.size >= 3) {
                val qNum0 = cells[0].replace(Regex("[^0-9]"), "")
                val subNum1 = cells[1].replace(Regex("[^0-9]"), "")
                val candidateQueue01 = "$qNum0.$subNum1"
                if (ZtoeParser.ALL_QUEUES.contains(candidateQueue01)) {
                    val houses = cells[cells.size - 1].split(Regex("[,;]")).map { it.trim() }.filter { it.isNotEmpty() }
                    for (h in houses) {
                        results.add(ZtoeHouseLookupResult(house = h, queue = candidateQueue01))
                    }
                    continue
                }

                // Format B2: 3-column table [Houses, Queue, Subqueue]
                val qNum1 = cells[1].replace(Regex("[^0-9]"), "")
                val subNum2 = cells[2].replace(Regex("[^0-9]"), "")
                val candidateQueue12 = "$qNum1.$subNum2"
                if (ZtoeParser.ALL_QUEUES.contains(candidateQueue12)) {
                    val houses = cells[0].split(Regex("[,;]")).map { it.trim() }.filter { it.isNotEmpty() }
                    for (h in houses) {
                        results.add(ZtoeHouseLookupResult(house = h, queue = candidateQueue12))
                    }
                    continue
                }
            }

            // Format C: 2-column or colspan status message row ([Houses, StatusMessage] or [StatusMessage, Houses])
            val firstCell = cells.first()
            val lastCell = cells.last()
            if (lastCell.length > 12 && firstCell.length <= 12) {
                val houses = firstCell.split(Regex("[,;]")).map { it.trim() }.filter { it.isNotEmpty() }
                for (h in houses) {
                    results.add(ZtoeHouseLookupResult(house = h, queue = "", statusText = lastCell))
                }
            } else {
                val houses = lastCell.split(Regex("[,;]")).map { it.trim() }.filter { it.isNotEmpty() }
                val statusMessage = cells.dropLast(1).joinToString(" ").trim()
                if (statusMessage.isNotEmpty()) {
                    for (h in houses) {
                        results.add(ZtoeHouseLookupResult(house = h, queue = "", statusText = statusMessage))
                    }
                }
            }
        }
        return results
    }

    /**
     * Convenience overload returning Pair(queueOrNull, statusTextOrNull) for a specific house number.
     */
    fun parseZtoeAddressLookupTableHtml(html: String, targetHouse: String): Pair<String?, String?>? {
        val parsed = parseZtoeAddressLookupTableHtml(html)
        val normTarget = normalizeHouseNumber(targetHouse)
        val matching = parsed.filter { normalizeHouseNumber(it.house) == normTarget }
        if (matching.isEmpty()) return null
        val withQueue = matching.firstOrNull { it.queue.isNotEmpty() }
        if (withQueue != null) {
            return withQueue.queue to null
        }
        val withStatus = matching.firstOrNull { !it.statusText.isNullOrBlank() }
        if (withStatus != null) {
            return null to withStatus.statusText
        }
        return null
    }

    fun parseZtoeEmergencyOutagesTableHtml(html: String): List<EmergencyOutageInfo> {
        val results = mutableListOf<EmergencyOutageInfo>()
        val doc = Jsoup.parse(html)
        val rows = doc.select("tr")

        for ((rowIdx, row) in rows.withIndex()) {
            val cells = row.select("td, th").map { it.text().replace("\\u00A0", " ").trim() }
            if (cells.size < 6) continue

            val joinedLower = cells.joinToString(" ").lowercase()
            if (joinedLower.contains("тип відключення") ||
                joinedLower.contains("час відключення") ||
                joinedLower.contains("очікуваний час")
            ) {
                continue
            }

            val remName = cells[0]
            val settlementName = cells[1]
            val streetName = cells[2]
            val houseField = cells[3]
            val outageType = cells[4]
            val startRaw = cells[5]
            val restoreRaw = cells.getOrNull(6) ?: ""

            if (outageType.isBlank() || startRaw.isBlank()) continue
            val typeLower = outageType.lowercase()
            val isEmergencyType = (typeLower.contains("аварійн") || typeLower.contains("emergency")) &&
                !typeLower.contains("не вимикається") &&
                !typeLower.contains("за винятком")
            if (!isEmergencyType) continue

            val formattedStart = formatZtoeOutageTimestamp(startRaw)
            val formattedRestore = formatZtoeOutageTimestamp(restoreRaw)
            if (!isValidOutageTimestamp(formattedStart) || !isValidOutageTimestamp(formattedRestore)) continue

            val houses = houseField.split(Regex("[,;]")).map { it.trim() }.filter { it.isNotEmpty() }
            for (h in houses) {
                results.add(
                    EmergencyOutageInfo(
                        id = "emergency_\${rowIdx}_$h",
                        remName = remName,
                        settlementName = settlementName,
                        streetName = streetName,
                        house = h,
                        outageType = outageType,
                        startTime = formattedStart,
                        estimatedRestoreTime = formattedRestore
                    )
                )
            }
        }
        return results
    }

    fun parseZtoeEmergencyOutagesTableHtml(html: String, targetHouse: String): EmergencyOutageInfo? {
        val normTarget = normalizeHouseNumber(targetHouse)
        return parseZtoeEmergencyOutagesTableHtml(html).firstOrNull {
            normalizeHouseNumber(it.house ?: "") == normTarget
        }
    }

    private fun normalizeUkText(value: String): String {
        return value.lowercase()
            .replace(Regex("""\\([^)]*\\)"""), "")
            .replace(CITY_PREFIX_REGEX, "")
            .replace(STREET_PREFIX_REGEX, "")
            .replace(Regex("""^(?:вулиця|вул\\.?|провулок|пров\\.?|пр-к\\.?|пр\\.?|проспект|просп\\.?|пр-т\\.?|майдан|м-н\\.?|площа|пл\\.?|бульвар|бул\\.?|б-р\\.?|шосе|ш\\.?|проїзд|пр-д\\.?|тупик|наб\\.?)\\s+"""), "")
            .replace(Regex("""[.,'"«»’ʼ\`]"""), " ")
            .replace("бердичив", "бердичів")
            .replace(Regex("""\\s+"""), " ")
            .trim()
    }

    private fun normalizeHouseNumber(value: String): String {
        val latinToCyrillic = mapOf(
            'a' to 'а',
            'b' to 'б',
            'v' to 'в',
            'g' to 'г',
            'd' to 'д',
            'e' to 'е',
            'k' to 'к',
            'm' to 'м',
            'i' to 'і'
        )
        val cleaned = value.lowercase()
            .replace(Regex("""^(буд\\.?|будинок|б\\.?|д\\.?)\\s*""", RegexOption.IGNORE_CASE), "")
            .replace(Regex("""\\.+$"""), "")
            .replace(Regex("""['"«»’ʼ\`\\s-]+"""), "")
            .trim()
        val sb = StringBuilder(cleaned.length)
        for (ch in cleaned) {
            sb.append(latinToCyrillic[ch] ?: ch)
        }
        return sb.toString()
    }

    private fun getAccidentPriorityScore(
        switchSubReason: Int?,
        typeOff: Int?,
        koment: String?
    ): Int {
        // 1. Genuine unscheduled emergency accident ("Аварійне відключення"): switchSubReason == 0 (or omitted) & typeOff == 1
        if ((switchSubReason == null || switchSubReason == -1 || switchSubReason == 0) && (typeOff == null || typeOff == 1)) {
            return 4
        }
        // 2. Emergency blackout schedules (ГАВ = 1, СГАВ = 3)
        if (switchSubReason == 1 || switchSubReason == 3) {
            return 3
        }
        // 3. Explicit emergency keywords in koment (excluding generic "ГПВ")
        if (!koment.isNullOrBlank() && Regex("""аварі|гав|сгав|(^|\\s)мо(?=\\s|$)""", RegexOption.IGNORE_CASE).containsMatchIn(koment)) {
            return 3
        }
        // 4. Other typeOff == 1 (e.g. switchSubReason == 2 GPV rows)
        if (typeOff == 1) {
            return if (switchSubReason == 2) 1 else 2
        }
        return 0
    }

    private fun getAccidentOutageTypeLabel(
        switchSubReason: Int?,
        koment: String?
    ): String {
        if (switchSubReason == 1) return "Графік аварійних відключень"
        if (switchSubReason == 3) return "Спеціальний графік аварійних відключень"
        if (!koment.isNullOrBlank()) {
            if (koment.contains("сгав", ignoreCase = true)) return "Спеціальний графік аварійних відключень"
            if (koment.contains("гав", ignoreCase = true)) return "Графік аварійних відключень"
        }
        return "Аварійне відключення"
    }

    private fun extractTopLevelJsonObjects(jsonStr: String): List<String> {
        val objects = mutableListOf<String>()
        var depth = 0
        var objStart = -1
        var inString = false
        var escaped = false
        for (i in jsonStr.indices) {
            val ch = jsonStr[i]
            if (escaped) {
                escaped = false
                continue
            }
            if (ch == '\\\\' && inString) {
                escaped = true
                continue
            }
            if (ch == '"') {
                inString = !inString
                continue
            }
            if (!inString) {
                if (ch == '{') {
                    if (depth == 0) objStart = i
                    depth++
                } else if (ch == '}') {
                    depth--
                    if (depth == 0 && objStart != -1) {
                        objects.add(jsonStr.substring(objStart, i + 1))
                        objStart = -1
                    }
                }
            }
        }
        return objects
    }

    private fun extractBalancedBracketBlock(src: String, openIdx: Int, openChar: Char, closeChar: Char): String? {
        if (openIdx < 0 || openIdx >= src.length || src[openIdx] != openChar) return null
        var depth = 0
        var inString = false
        var escaped = false
        for (i in openIdx until src.length) {
            val ch = src[i]
            if (escaped) {
                escaped = false
                continue
            }
            if (ch == '\\\\' && inString) {
                escaped = true
                continue
            }
            if (ch == '"') {
                inString = !inString
                continue
            }
            if (!inString) {
                if (ch == openChar) {
                    depth++
                } else if (ch == closeChar) {
                    depth--
                    if (depth == 0) {
                        return src.substring(openIdx, i + 1)
                    }
                }
            }
        }
        return null
    }

    /**
     * Finds the value start index for a top-level property \`fieldName\` inside \`objStr\`,
     * ignoring any nested \`{...}\` or \`[...]\` objects so nested fields (like \`street.city.name\`)
     * never shadow the parent object's own fields (like \`street.name\`).
     */
    private fun findTopLevelJsonFieldValueStart(objStr: String, fieldName: String): Int {
        val firstNonWs = objStr.indexOfFirst { !it.isWhitespace() }
        if (firstNonWs < 0) return -1
        val targetDepth = if (objStr[firstNonWs] == '{') 1 else 0
        var depth = 0
        var i = firstNonWs
        val len = objStr.length

        while (i < len) {
            val ch = objStr[i]
            if (ch == '"') {
                val strStart = i + 1
                var k = strStart
                var escaped = false
                while (k < len) {
                    val sc = objStr[k]
                    if (escaped) {
                        escaped = false
                    } else if (sc == '\\\\') {
                        escaped = true
                    } else if (sc == '"') {
                        break
                    }
                    k++
                }
                if (k >= len) return -1
                val keyCandidate = objStr.substring(strStart, k)
                i = k + 1
                if (depth == targetDepth) {
                    while (i < len && objStr[i].isWhitespace()) i++
                    if (i < len && objStr[i] == ':') {
                        i++
                        while (i < len && objStr[i].isWhitespace()) i++
                        if (keyCandidate.trim() == fieldName) {
                            return if (i < len) i else -1
                        }
                    }
                }
                continue
            }
            when (ch) {
                '{', '[' -> depth++
                '}', ']' -> depth--
            }
            i++
        }
        return -1
    }

    private fun unescapeJsonString(raw: String): String {
        if (!raw.contains('\\\\')) return raw
        val sb = StringBuilder(raw.length)
        var i = 0
        while (i < raw.length) {
            val ch = raw[i]
            if (ch == '\\\\' && i + 1 < raw.length) {
                val next = raw[i + 1]
                when (next) {
                    '"' -> { sb.append('"'); i += 2 }
                    '\\\\' -> { sb.append('\\\\'); i += 2 }
                    '/' -> { sb.append('/'); i += 2 }
                    'n' -> { sb.append('\\n'); i += 2 }
                    'r' -> { sb.append('\\r'); i += 2 }
                    't' -> { sb.append('\\t'); i += 2 }
                    'u' -> {
                        if (i + 5 < raw.length) {
                            val hex = raw.substring(i + 2, i + 6)
                            val code = hex.toIntOrNull(16)
                            if (code != null) {
                                sb.append(code.toChar())
                                i += 6
                                continue
                            }
                        }
                        sb.append(ch)
                        i++
                    }
                    else -> {
                        sb.append(next)
                        i += 2
                    }
                }
            } else {
                sb.append(ch)
                i++
            }
        }
        return sb.toString()
    }

    private fun extractJsonArrayField(objStr: String, fieldName: String): String? {
        val valIdx = findTopLevelJsonFieldValueStart(objStr, fieldName)
        if (valIdx >= 0 && objStr[valIdx] == '[') {
            return extractBalancedBracketBlock(objStr, valIdx, '[', ']')
        }
        val keyRegex = Regex(""""\\s*\${Regex.escape(fieldName)}\\s*"\\s*:\\s*\\[""")
        val m = keyRegex.find(objStr) ?: return null
        val bracketIdx = objStr.indexOf('[', m.range.first)
        return extractBalancedBracketBlock(objStr, bracketIdx, '[', ']')
    }

    private fun extractJsonObjectField(objStr: String, fieldName: String): String? {
        val valIdx = findTopLevelJsonFieldValueStart(objStr, fieldName)
        if (valIdx >= 0 && objStr[valIdx] == '{') {
            return extractBalancedBracketBlock(objStr, valIdx, '{', '}')
        }
        return null
    }

    private fun extractJsonStringField(objStr: String, fieldName: String): String? {
        val valIdx = findTopLevelJsonFieldValueStart(objStr, fieldName)
        if (valIdx < 0 || objStr[valIdx] != '"') return null
        var k = valIdx + 1
        var escaped = false
        while (k < objStr.length) {
            val ch = objStr[k]
            if (escaped) {
                escaped = false
            } else if (ch == '\\\\') {
                escaped = true
            } else if (ch == '"') {
                return unescapeJsonString(objStr.substring(valIdx + 1, k))
            }
            k++
        }
        return null
    }

    private fun extractJsonIntField(objStr: String, fieldName: String): Int? {
        val valIdx = findTopLevelJsonFieldValueStart(objStr, fieldName)
        if (valIdx < 0) return null
        var start = valIdx
        if (objStr[start] == '"') start++
        var end = start
        if (end < objStr.length && objStr[end] == '-') end++
        while (end < objStr.length && objStr[end].isDigit()) end++
        if (end <= start || (end == start + 1 && objStr[start] == '-')) return null
        return objStr.substring(start, end).toIntOrNull()
    }

    private fun applyAccidentsToSettlementHouses(settlementId: String, rawJson: String) {
        if (settlementId.isBlank() || rawJson.isBlank()) return
        try {
            val hydraArr = extractJsonArrayField(rawJson, "hydra:member")
            val items = extractTopLevelJsonObjects(hydraArr ?: rawJson)
            if (items.isEmpty()) return

            val settlementObj = findSettlementById(settlementId)
            val targetCityNorm = settlementObj?.let { normalizeUkText(it.nameUk) } ?: ""

            val streets = getStreetsForSettlement(settlementId)
            if (streets.isEmpty()) return

            val streetIdsByNormName = HashMap<String, MutableList<String>>(streets.size * 2)
            val streetIdsByPoweronId = HashMap<Int, MutableList<String>>()
            fun addNorm(k: String, id: String) {
                if (k.isEmpty()) return
                val l = streetIdsByNormName.getOrPut(k) { mutableListOf() }
                if (!l.contains(id)) l.add(id)
            }
            for (st in streets) {
                addNorm(st.nameUk.trim().lowercase(), st.id)
                addNorm(normalizeUkText(st.nameUk), st.id)
                if (st.poweronStreetId != null) {
                    val l = streetIdsByPoweronId.getOrPut(st.poweronStreetId) { mutableListOf() }
                    if (!l.contains(st.id)) l.add(st.id)
                }
            }
            for (st in ZTOE_STREETS.filter { it.settlementId == settlementId }) {
                addNorm(st.nameUk.trim().lowercase(), st.id)
                addNorm(normalizeUkText(st.nameUk), st.id)
                if (st.poweronStreetId != null) {
                    val l = streetIdsByPoweronId.getOrPut(st.poweronStreetId) { mutableListOf() }
                    if (!l.contains(st.id)) l.add(st.id)
                }
            }

            data class ScoredOutage(val score: Int, val rawPlanIn: String, val info: EmergencyOutageInfo)
            val emergencyByStreetAndHouse = HashMap<String, HashMap<String, ScoredOutage>>()

            for (itemStr in items) {
                val switchSubReason = extractJsonIntField(itemStr, "switchSubReason")
                val typeOff = extractJsonIntField(itemStr, "typeOff")
                val koment = extractJsonStringField(itemStr, "koment")
                val score = getAccidentPriorityScore(switchSubReason, typeOff, koment)
                if (score < 3) continue

                val cityObjStr = extractJsonObjectField(itemStr, "city")
                val cityName = cityObjStr?.let { extractJsonStringField(it, "name") } ?: ""
                if (targetCityNorm.isNotEmpty() && cityName.isNotBlank()) {
                    val itemCityNorm = normalizeUkText(cityName)
                    if (itemCityNorm != targetCityNorm &&
                        !itemCityNorm.contains(targetCityNorm) &&
                        !targetCityNorm.contains(itemCityNorm)
                    ) {
                        continue
                    }
                }

                val streetObjStr = extractJsonObjectField(itemStr, "street")
                val streetIdNum = streetObjStr?.let { extractJsonIntField(it, "id") }
                val streetNameRaw = streetObjStr?.let { extractJsonStringField(it, "name") } ?: ""
                val matchedStreetIds = mutableListOf<String>()
                if (streetIdNum != null) {
                    streetIdsByPoweronId[streetIdNum]?.forEach { if (!matchedStreetIds.contains(it)) matchedStreetIds.add(it) }
                }
                if (streetNameRaw.isNotBlank()) {
                    streetIdsByNormName[streetNameRaw.trim().lowercase()]?.forEach { if (!matchedStreetIds.contains(it)) matchedStreetIds.add(it) }
                    streetIdsByNormName[normalizeUkText(streetNameRaw)]?.forEach { if (!matchedStreetIds.contains(it)) matchedStreetIds.add(it) }
                }
                if (matchedStreetIds.isEmpty()) continue

                val buildingNames = extractJsonStringField(itemStr, "buildingNames") ?: ""
                if (buildingNames.isBlank()) continue

                val startTime = formatZtoeOutageTimestamp(extractJsonStringField(itemStr, "dateEvent") ?: "")
                val rawPlanIn = extractJsonStringField(itemStr, "datePlanIn") ?: ""
                val estimatedRestoreTime = formatZtoeOutageTimestamp(rawPlanIn)
                if (!isValidOutageTimestamp(startTime) || !isValidOutageTimestamp(estimatedRestoreTime)) continue

                val outageType = getAccidentOutageTypeLabel(switchSubReason, koment)
                val otgName = extractJsonObjectField(itemStr, "otg")?.let { extractJsonStringField(it, "name") }
                val explicitId = extractJsonIntField(itemStr, "id")?.toString()
                    ?: extractJsonStringField(itemStr, "id")

                val houseTokens = buildingNames.split(Regex("[,;]")).map { it.trim() }.filter { it.isNotEmpty() }
                for (streetId in matchedStreetIds) {
                    val streetEmergMap = emergencyByStreetAndHouse.getOrPut(streetId) { HashMap() }
                    for (hToken in houseTokens) {
                        val normH = normalizeHouseNumber(hToken)
                        if (normH.isEmpty()) continue
                        val existing = streetEmergMap[normH]
                        if (existing == null || score > existing.score || (score == existing.score && rawPlanIn > existing.rawPlanIn)) {
                            val outageId = if (!explicitId.isNullOrBlank()) {
                                "pw_accident_$explicitId"
                            } else {
                                "pw_accident_\${streetId}_\${normH}_$startTime"
                            }
                            streetEmergMap[normH] = ScoredOutage(
                                score = score,
                                rawPlanIn = rawPlanIn,
                                info = EmergencyOutageInfo(
                                    id = outageId,
                                    remName = otgName,
                                    settlementName = cityName.ifBlank { settlementObj?.nameUk },
                                    streetName = streetNameRaw,
                                    house = hToken,
                                    outageType = outageType,
                                    startTime = startTime,
                                    estimatedRestoreTime = estimatedRestoreTime
                                )
                            )
                        }
                    }
                }
            }

            for ((streetId, streetEmergMap) in emergencyByStreetAndHouse) {
                val baseHouses = cachedHousesByStreet[streetId] ?: getDefaultHousesForStreet(streetId)
                val updatedHouses = baseHouses.map { h ->
                    val matched = streetEmergMap[normalizeHouseNumber(h.house)]
                    if (matched != null) h.copy(emergencyOutage = matched.info) else h
                }.toMutableList()
                val existingHouseNorms = updatedHouses.map { normalizeHouseNumber(it.house) }.toHashSet()
                for ((normH, entry) in streetEmergMap) {
                    val hVal = entry.info.house
                    if (!existingHouseNorms.contains(normH) && !hVal.isNullOrBlank()) {
                        updatedHouses.add(
                            ZtoeHouseLookupResult(
                                house = hVal,
                                queue = "",
                                emergencyOutage = entry.info
                            )
                        )
                        existingHouseNorms.add(normH)
                    }
                }
                if (updatedHouses.isNotEmpty()) {
                    cachedHousesByStreet[streetId] = updatedHouses.sortedWith(
                        compareBy<ZtoeHouseLookupResult> { houseSortKey(it.house).first }
                            .thenBy { houseSortKey(it.house).second }
                    )
                }
            }
        } catch (_: Exception) {
        }
    }

    private fun applyAccidentsToRemHouses(remId: String, rawJson: String, fallbackSettlementId: String? = null) {
        if (rawJson.isBlank()) return
        val settlements = getSettlementsForRem(remId)
        val visited = HashSet<String>()
        for (s in settlements) {
            if (visited.add(s.id)) {
                applyAccidentsToSettlementHouses(s.id, rawJson)
            }
        }
        if (!fallbackSettlementId.isNullOrBlank() && visited.add(fallbackSettlementId)) {
            applyAccidentsToSettlementHouses(fallbackSettlementId, rawJson)
        }
    }

    fun fetchPwAccidentsForScope(
        remId: String,
        settlementId: String? = null
    ): String? {
        val remObj = getRems().firstOrNull { it.id == remId }
            ?: ZTOE_REM_OPTIONS.firstOrNull { it.id == remId }
        val canonicalRemObj = ZTOE_REM_OPTIONS.firstOrNull { it.id == remId }
        val settlementObj = settlementId?.let { findSettlementById(it) }
        val otgId = remObj?.ztoeOtgId ?: canonicalRemObj?.ztoeOtgId
        val cityId = settlementObj?.poweronCityId

        val scopeParam = when {
            otgId != null -> "otg.id=$otgId"
            cityId != null -> "city.id=$cityId"
            else -> ""
        }
        val cacheKey = scopeParam.ifEmpty { "$remId::\${settlementId ?: ""}" }
        val cached = accidentsCacheByScope[cacheKey]
        if (cached != null && System.currentTimeMillis() - cached.first < ACCIDENTS_CACHE_TTL_MS) {
            applyAccidentsToRemHouses(remId, cached.second, settlementId)
            return cached.second
        }

        val queryParams = buildString {
            append("switchSubReason[]=0&switchSubReason[]=1&switchSubReason[]=3")
            if (scopeParam.isNotEmpty()) {
                append("&").append(scopeParam)
            }
            append("&pagination=false")
        }
        val targetEndpoint = "https://api-ztoe-poweron.inneti.net/api/pw_accidents?$queryParams"
        var conn: HttpURLConnection? = null
        return try {
            conn = (URL(targetEndpoint).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 5000
                readTimeout = 5000
                setRequestProperty("Accept", "application/ld+json, application/json")
                setRequestProperty("User-Agent", "Mozilla/5.0 (Android; ZTBlackoutPreWarning)")
            }
            if (conn.responseCode in 200..299) {
                val text = conn.inputStream.use { String(it.readBytes(), Charsets.UTF_8) }
                if (text.contains("hydra:member") || text.trim().startsWith("[")) {
                    accidentsCacheByScope[cacheKey] = System.currentTimeMillis() to text
                    applyAccidentsToRemHouses(remId, text, settlementId)
                    return text
                }
            }
            null
        } catch (_: Exception) {
            null
        } finally {
            conn?.disconnect()
        }
    }

    fun matchEmergencyOutageFromAccidentsJson(
        accidentsJsonStr: String,
        query: SelectedAddressQuery
    ): EmergencyOutageInfo? {
        val settlementObj = findSettlementById(query.settlementId)
        val streetObj = findStreetById(query.streetId)
        val remObj = ZTOE_REM_OPTIONS.firstOrNull { it.id == query.remId }
        return matchEmergencyOutageFromAccidentsJson(
            htmlOrJson = accidentsJsonStr,
            remName = remObj?.nameUk ?: "",
            settlementName = settlementObj?.nameUk ?: "",
            streetName = streetObj?.nameUk ?: "",
            house = query.house,
            poweronStreetId = streetObj?.poweronStreetId,
            poweronCityId = settlementObj?.poweronCityId
        )
    }

    fun matchEmergencyOutageFromAccidentsJson(
        htmlOrJson: String,
        remName: String,
        settlementName: String,
        streetName: String,
        house: String,
        poweronStreetId: Int? = null,
        poweronCityId: Int? = null
    ): EmergencyOutageInfo? {
        val targetCityNorm = normalizeUkText(settlementName)
        val targetStreetNorm = normalizeUkText(streetName)
        val targetHouseNorm = normalizeHouseNumber(house)
        if (targetHouseNorm.isEmpty()) return null

        val extractedJson = run {
            val parseMatch = PW_ACCIDENTS_PARSE_REGEX.find(htmlOrJson)
            val arrayMatch = if (parseMatch == null) PW_ACCIDENTS_ARRAY_REGEX.find(htmlOrJson) else null
            when {
                parseMatch != null -> parseMatch.groupValues[1].replace("\\\\'", "'").replace("\\\\\\\\", "\\\\")
                arrayMatch != null -> arrayMatch.groupValues[1]
                else -> htmlOrJson.trim()
            }
        }

        return try {
            val hydraArr = extractJsonArrayField(extractedJson, "hydra:member")
            val items = extractTopLevelJsonObjects(hydraArr ?: extractedJson)
            var bestMatch: EmergencyOutageInfo? = null
            var bestScore = -1
            var bestRawPlanIn = ""

            for (itemStr in items) {
                // Support Nested Schema: {"rem_name": ..., " date_begin": ..., "date_plan": ..., "naspunkt": [{"name": ..., "streets": [{"name": "вул. Київська, 37"}]}]}
                val naspunktArrStr = extractJsonArrayField(itemStr, "naspunkt")
                if (naspunktArrStr != null) {
                    val startRaw = (extractJsonStringField(itemStr, "date_begin") ?: "").trim()
                    val restoreRaw = (extractJsonStringField(itemStr, "date_plan") ?: "").trim()
                    val outageType = (extractJsonStringField(itemStr, "Otkl_Type_Name") ?: "Аварійне відключення")
                        .ifBlank { "Аварійне відключення" }
                    val itemRemName = extractJsonStringField(itemStr, "rem_name") ?: ""
                    val itemId = extractJsonIntField(itemStr, "id")?.toString()
                        ?: extractJsonStringField(itemStr, "id")
                        ?: "\${targetStreetNorm}_$targetHouseNorm"

                    val npObjects = extractTopLevelJsonObjects(naspunktArrStr)
                    for (npObjStr in npObjects) {
                        val npName = extractJsonStringField(npObjStr, "name") ?: ""
                        if (targetCityNorm.isNotEmpty() && npName.isNotBlank()) {
                            val itemCityNorm = normalizeUkText(npName)
                            if (!itemCityNorm.contains(targetCityNorm) && !targetCityNorm.contains(itemCityNorm)) {
                                continue
                            }
                        }
                        val streetsArrStr = extractJsonArrayField(npObjStr, "streets") ?: continue
                        val stObjects = extractTopLevelJsonObjects(streetsArrStr)
                        for (stObjStr in stObjects) {
                            val stRaw = extractJsonStringField(stObjStr, "name") ?: ""
                            val stNorm = normalizeUkText(stRaw)
                            if (targetStreetNorm.isNotEmpty() && !stNorm.contains(targetStreetNorm) && !targetStreetNorm.contains(stNorm)) {
                                continue
                            }
                            val tokens = stRaw.split(Regex("[,;]")).map { normalizeHouseNumber(it) }
                            if (tokens.contains(targetHouseNorm)) {
                                return EmergencyOutageInfo(
                                    id = "pw_accident_$itemId",
                                    remName = remName.ifBlank { itemRemName },
                                    settlementName = settlementName.ifBlank { npName },
                                    streetName = streetName.ifBlank { stRaw },
                                    house = house,
                                    outageType = outageType,
                                    startTime = formatZtoeOutageTimestamp(startRaw),
                                    estimatedRestoreTime = formatZtoeOutageTimestamp(restoreRaw)
                                )
                            }
                        }
                    }
                    continue
                }

                // Support Flat / Hydra Schema: {"id": 391476673, "city": {"name": "Житомир"}, "street": {"name": "вул. Київська"}, "buildingNames": "18, 37", "dateEvent": "...", "datePlanIn": "..."}
                val switchSubReason = extractJsonIntField(itemStr, "switchSubReason")
                val typeOff = extractJsonIntField(itemStr, "typeOff")
                val koment = extractJsonStringField(itemStr, "koment")
                val score = getAccidentPriorityScore(switchSubReason, typeOff, koment)
                if (score < 3) continue

                val cityObjStr = extractJsonObjectField(itemStr, "city")
                val cityIdNum = cityObjStr?.let { extractJsonIntField(it, "id") }
                val cityName = cityObjStr?.let { extractJsonStringField(it, "name") } ?: ""

                val cityMatches = when {
                    poweronCityId != null && cityIdNum != null && poweronCityId == cityIdNum -> true
                    targetCityNorm.isEmpty() || cityName.isBlank() -> true
                    else -> {
                        val itemCityNorm = normalizeUkText(cityName)
                        itemCityNorm == targetCityNorm ||
                            itemCityNorm.contains(targetCityNorm) ||
                            targetCityNorm.contains(itemCityNorm)
                    }
                }
                if (!cityMatches) continue

                val streetObjStr = extractJsonObjectField(itemStr, "street")
                val streetIdNum = streetObjStr?.let { extractJsonIntField(it, "id") }
                val itemStreetName = streetObjStr?.let { extractJsonStringField(it, "name") } ?: ""

                val streetMatches = when {
                    poweronStreetId != null && streetIdNum != null && poweronStreetId == streetIdNum -> true
                    targetStreetNorm.isEmpty() || itemStreetName.isBlank() -> true
                    else -> {
                        val itemStreetNorm = normalizeUkText(itemStreetName)
                        itemStreetNorm == targetStreetNorm ||
                            itemStreetNorm.contains(targetStreetNorm) ||
                            targetStreetNorm.contains(itemStreetNorm)
                    }
                }
                if (!streetMatches) continue

                val buildingNames = extractJsonStringField(itemStr, "buildingNames") ?: ""
                val houses = buildingNames.split(Regex("[,;]"))
                    .map { normalizeHouseNumber(it) }
                    .filter { it.isNotEmpty() }

                if (houses.contains(targetHouseNorm)) {
                    val idVal = extractJsonIntField(itemStr, "id")?.toString()
                        ?: extractJsonStringField(itemStr, "id")
                        ?: "\${targetStreetNorm}_$targetHouseNorm"
                    val dateEvent = extractJsonStringField(itemStr, "dateEvent") ?: ""
                    val datePlanIn = extractJsonStringField(itemStr, "datePlanIn") ?: ""
                    val otgName = extractJsonObjectField(itemStr, "otg")?.let { extractJsonStringField(it, "name") }
                    val candidate = EmergencyOutageInfo(
                        id = "pw_accident_$idVal",
                        remName = otgName ?: remName.ifBlank { null },
                        settlementName = cityName.ifBlank { settlementName },
                        streetName = itemStreetName.ifBlank { streetName },
                        house = house,
                        outageType = getAccidentOutageTypeLabel(switchSubReason, koment),
                        startTime = formatZtoeOutageTimestamp(dateEvent),
                        estimatedRestoreTime = formatZtoeOutageTimestamp(datePlanIn)
                    )
                    if (isValidEmergencyOutage(candidate)) {
                        if (score > bestScore || (score == bestScore && datePlanIn > bestRawPlanIn)) {
                            bestScore = score
                            bestRawPlanIn = datePlanIn
                            bestMatch = candidate
                        }
                    }
                }
            }
            bestMatch
        } catch (_: Exception) {
            null
        }
    }

    fun checkEmergencyOutageOnZtoe(
        query: SelectedAddressQuery,
        pageHtml: String? = null
    ): EmergencyOutageInfo? {
        val settlementObj = findSettlementById(query.settlementId)
        val streetObj = findStreetById(query.streetId)
        val targetCityNorm = settlementObj?.let { normalizeUkText(it.nameUk) } ?: ""
        val targetStreetNorm = streetObj?.let { normalizeUkText(it.nameUk) } ?: ""
        val targetHouseNorm = normalizeHouseNumber(query.house)

        if (!pageHtml.isNullOrBlank()) {
            val parsedRows = parseZtoeEmergencyOutagesTableHtml(pageHtml)
            val matchedRow = parsedRows.firstOrNull { r ->
                val houseMatches = normalizeHouseNumber(r.house ?: "") == targetHouseNorm
                val rowStreetNorm = normalizeUkText(r.streetName.orEmpty())
                val streetMatches = targetStreetNorm.isEmpty() ||
                    rowStreetNorm.isEmpty() ||
                    rowStreetNorm.contains(targetStreetNorm) ||
                    targetStreetNorm.contains(rowStreetNorm)
                val rowCityNorm = normalizeUkText(r.settlementName.orEmpty())
                val cityMatches = targetCityNorm.isEmpty() ||
                    rowCityNorm.isEmpty() ||
                    rowCityNorm.contains(targetCityNorm) ||
                    targetCityNorm.contains(rowCityNorm)
                houseMatches && streetMatches && cityMatches
            }
            if (matchedRow != null && isValidEmergencyOutage(matchedRow)) return matchedRow

            matchEmergencyOutageFromAccidentsJson(pageHtml, query)?.takeIf { isValidEmergencyOutage(it) }?.let { return it }
        }

        // Query live ZTOE PowerOn API (https://api-ztoe-poweron.inneti.net/api/pw_accidents)
        val liveAccidentsJson = fetchPwAccidentsForScope(query.remId, query.settlementId)
        if (!liveAccidentsJson.isNullOrBlank()) {
            matchEmergencyOutageFromAccidentsJson(liveAccidentsJson, query)
                ?.takeIf { isValidEmergencyOutage(it) }
                ?.let { return it }
        }

        val localMatch = getHousesForStreet(query.streetId)
            .firstOrNull { normalizeHouseNumber(it.house) == targetHouseNorm }
        return localMatch?.emergencyOutage?.takeIf { isValidEmergencyOutage(it) }
    }

    fun checkAddressOnZtoeWebsite(
        remId: String,
        settlementId: String,
        streetId: String,
        house: String,
        siteUrl: String = "https://www.ztoe.com.ua/unhooking-search.php"
    ): ZtoeHouseLookupResult? {
        return checkAddressOnZtoeWebsite(
            query = SelectedAddressQuery(
                remId = remId,
                settlementId = settlementId,
                streetId = streetId,
                house = house
            ),
            siteUrl = siteUrl
        )
    }

    /**
     * Queries the ZTOE website (or falls back to local directory) for the selected address.
     * Preserves already-assigned queues (e.g. 5.2 for вул. Київська, буд. 77) so live HTML never overwrites them,
     * while updating houses that previously had no queue ("") and always refreshing emergency outages.
     */
    fun checkAddressOnZtoeWebsite(
        query: SelectedAddressQuery,
        siteUrl: String = "https://www.ztoe.com.ua/unhooking-search.php"
    ): ZtoeHouseLookupResult? {
        val localHouses = getHousesForStreet(query.streetId)
        val targetHouseNorm = normalizeHouseNumber(query.house)
        val localMatch = localHouses.firstOrNull {
            normalizeHouseNumber(it.house) == targetHouseNorm
        }
        var resolvedResult: ZtoeHouseLookupResult? = localMatch?.copy()

        val rem = getRems().firstOrNull { it.id == query.remId }
            ?: ZTOE_REM_OPTIONS.firstOrNull { it.id == query.remId }
        var settlement = findSettlementById(query.settlementId)
        var street = findStreetById(query.streetId)

        var fetchedHtml: String? = null
        if (rem != null && settlement != null && street != null && ZtoeParser.isValidUrl(siteUrl)) {
            var conn: HttpURLConnection? = null
            try {
                // Note: Do NOT pass all=1 when vulica_id is specified
                val formBody = "rem_id=\${rem.ztoeRemId}&naspunkt_id=\${settlement.ztoeNaspunktId}&vulica_id=\${street.ztoeVulicaId}"
                conn = (URL(siteUrl).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    connectTimeout = 7000
                    readTimeout = 7000
                    setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
                    setRequestProperty("User-Agent", "Mozilla/5.0 (Android; ZTBlackoutPreWarning)")
                }
                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { writer ->
                    writer.write(formBody)
                    writer.flush()
                }
                if (conn.responseCode in 200..299) {
                    val bytes = conn.inputStream.use { it.readBytes() }
                    var html = String(bytes, Charset.forName("windows-1251"))
                    if (!html.contains("Черга") && !html.contains("черга") && !html.contains("Будинки")) {
                        html = String(bytes, Charsets.UTF_8)
                    }
                    fetchedHtml = html
                    if (settlement.nameUk.isBlank() && query.remId.isNotBlank()) {
                        val parsedSettlements = parseZtoeSettlementOptionsHtml(query.remId, html)
                        if (parsedSettlements.isNotEmpty()) {
                            cachedSettlementsByRem[query.remId] = parsedSettlements
                            settlement = findSettlementById(query.settlementId) ?: settlement
                        }
                    }
                    if (street.nameUk.isBlank() && query.settlementId.isNotBlank()) {
                        val parsedStreets = parseZtoeStreetOptionsHtml(query.settlementId, html)
                        if (parsedStreets.isNotEmpty()) {
                            cachedStreetsBySettlement[query.settlementId] = parsedStreets
                            street = findStreetById(query.streetId) ?: street
                        }
                    }
                    val parsedRows = parseZtoeAddressLookupTableHtml(html)
                    val matchingRows = parsedRows.filter {
                        normalizeHouseNumber(it.house) == targetHouseNorm
                    }
                    // CRITICAL SAFEGUARD: Only allow live HTML table rows to assign/update queue when the house had NO queue locally
                    if (matchingRows.isNotEmpty() && (localMatch == null || localMatch.queue.isEmpty())) {
                        val noQueueRow = matchingRows.firstOrNull { it.queue.isEmpty() && !it.statusText.isNullOrBlank() }
                        resolvedResult = if (noQueueRow != null) {
                            noQueueRow.copy()
                        } else {
                            (matchingRows.firstOrNull { it.queue.isNotEmpty() } ?: matchingRows.first()).copy()
                        }
                    }
                }
            } catch (_: Exception) {
                // Offline or unreachable — fall back to localMatch
            } finally {
                conn?.disconnect()
            }
        }

        val formattedAddressLabel = buildString {
            append(rem?.nameUk?.ifBlank { "Житомирський РЕМ" } ?: "Житомирський РЕМ")
            append(", ")
            append(settlement?.nameUk?.ifBlank { "м. Житомир" } ?: "м. Житомир")
            append(",\\n")
            append(street?.nameUk?.ifBlank { "вул. Київська" } ?: "вул. Київська")
            append(", буд. ")
            append(query.house.trim())
        }

        val emergencyOutage = checkEmergencyOutageOnZtoe(query, fetchedHtml)
        if (resolvedResult != null) {
            resolvedResult = resolvedResult.copy(
                emergencyOutage = emergencyOutage,
                addressLabel = formattedAddressLabel
            )
        } else if (emergencyOutage != null) {
            resolvedResult = ZtoeHouseLookupResult(
                house = query.house.trim(),
                queue = "",
                emergencyOutage = emergencyOutage,
                addressLabel = formattedAddressLabel
            )
        }

        val finalResolved = resolvedResult
        if (finalResolved != null && query.streetId.isNotBlank()) {
            val currentList = cachedHousesByStreet[query.streetId] ?: getDefaultHousesForStreet(query.streetId)
            val exists = currentList.any { normalizeHouseNumber(it.house) == targetHouseNorm }
            val updatedList = if (exists) {
                currentList.map { h ->
                    if (normalizeHouseNumber(h.house) == targetHouseNorm) {
                        h.copy(
                            queue = finalResolved.queue.ifEmpty { h.queue },
                            statusText = finalResolved.statusText ?: h.statusText,
                            emergencyOutage = finalResolved.emergencyOutage,
                            addressLabel = finalResolved.addressLabel.ifEmpty { h.addressLabel }
                        )
                    } else h
                }
            } else {
                (currentList + finalResolved).sortedWith(
                    compareBy<ZtoeHouseLookupResult> { houseSortKey(it.house).first }
                        .thenBy { houseSortKey(it.house).second }
                )
            }
            cachedHousesByStreet[query.streetId] = updatedList
        }

        return finalResolved
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
  }
];
